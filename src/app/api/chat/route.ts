import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { scrapeExhibitorsStream, ScrapeProgressEvent } from '@/lib/tools/scrapeExhibitors';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

function extractUrl(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s"'<>]+/i);
  return match ? match[0] : null;
}

function localChatbotReply(userText: string): string {
  const trimmed = userText.trim().toLowerCase();
  if (/^(stp|svp|s['’]?il te plaît|s il te plait)[\.\?!]*$/i.test(trimmed)) {
    return 'Oui, je suis là ! Que veux-tu que je fasse ?';
  }
  return 'Je suis prêt. Dis-moi comment je peux t’aider.';
}

function normalizeOpenAIProject(rawProject: string | undefined, apiKey: string | undefined): string | undefined {
  if (!rawProject) return undefined;
  const project = rawProject.trim();
  if (!project || project === apiKey) return undefined;
  if (project.startsWith('sk-')) return undefined;
  return project;
}

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'JSON invalide.' }, { status: 400 });
  }

  const rawMessages = body.messages || [];
  const messages = rawMessages.map((m: any) => {
    if (m.content) return { role: m.role, content: m.content };
    if (m.parts) {
      const text = m.parts.filter((p: any) => p.type === 'text').map((p: any) => p.text).join('');
      return { role: m.role, content: text };
    }
    return { role: m.role || 'user', content: '' };
  });

  const lastUserMsg = [...messages].reverse().find((m: any) => m.role === 'user');
  const url = lastUserMsg ? extractUrl(lastUserMsg.content) : null;

  logger.info('route/chat', 'Requête reçue', { mode: url ? 'scraping' : 'chatbot', url: url ?? undefined });

  if (lastUserMsg?.content && /^(stp|svp|s['’]?il te plaît|s il te plait)[\.\?!]*$/i.test(lastUserMsg.content.trim())) {
    return new Response(localChatbotReply(lastUserMsg.content), {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  // Mode scraping si URL détectée
  if (url) {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          logger.info('route/chat', 'Démarrage scraping', { url });
          for await (const event of scrapeExhibitorsStream(url)) {
            if (event.type === 'done') logger.info('route/chat', 'Scraping terminé', { total: event.total });
            if (event.type === 'error') logger.error('route/chat', 'Erreur scraping', { message: event.message });
            controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'));
          }
        } catch (error: any) {
          logger.error('route/chat', 'Erreur critique scraping', { message: error?.message });
          controller.enqueue(encoder.encode(JSON.stringify({ type: 'error', message: error?.message }) + '\n'));
        } finally {
          controller.close();
        }
      },
    });
    return new Response(stream, {
      headers: {
        'Content-Type': 'application/x-ndjson; charset=utf-8',
        'X-Scrape-Stream': 'true',
        'Cache-Control': 'no-store',
      },
    });
  }

  // Mode chatbot
  const openAIKey = process.env.OPENAI_API_KEY?.trim();
  const openAIProject = normalizeOpenAIProject(process.env.OPENAI_PROJECT?.trim(), openAIKey);

  if (!openAIKey) {
    return new Response('Clé OpenAI manquante dans .env.local', {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  const defaultModels = [
    'gpt-3.5-turbo',
    'gpt-3.5-turbo-16k',
    'gpt-3.5-turbo-16k-0613',
    'gpt-4o-mini',
    'gpt-4o',
    'gpt-3.5-turbo-0613',
    'gpt-5.4-mini',
    'gpt-3.5-turbo-0125',
  ];
  const modelCandidates = process.env.OPENAI_MODEL_CANDIDATES
    ? process.env.OPENAI_MODEL_CANDIDATES.split(',').map((m) => m.trim()).filter(Boolean)
    : process.env.OPENAI_MODEL?.trim()
      ? [process.env.OPENAI_MODEL.trim(), ...defaultModels.filter((m) => m !== process.env.OPENAI_MODEL?.trim())]
      : defaultModels;

  const systemPrompt = `Tu es un assistant IA intelligent et polyvalent intégré dans Shaarp Scraper, un outil B2B d'extraction d'exposants de salons professionnels.
Réponds toujours en français de manière claire, naturelle et brève.
Pour toutes les questions générales, donne une réponse courte et directe, idéalement en une ou deux phrases.
Ne dis pas seulement qu'il faut coller une URL, sauf si l'utilisateur fournit effectivement une URL.`;

  const tryGenerate = async (project?: string) => {
    for (const modelName of modelCandidates) {
      try {
        logger.info('route/chat', 'Tentative modèle', { model: modelName });
        const openaiClient = createOpenAI({ apiKey: openAIKey, project });
        const result = await generateText({
          model: openaiClient.chat(modelName),
          messages,
          system: systemPrompt,
        });
        logger.info('route/chat', 'Réponse chatbot générée', { model: modelName });
        return result;
      } catch (error: any) {
        const msg = String(error?.message || error || '').toLowerCase();
        if (msg.includes('openai-project header should match project') || msg.includes('mismatched_project')) {
          logger.warn('route/chat', 'Mismatch project OpenAI', { model: modelName });
          throw error;
        }
        if (msg.includes('model_not_found') || msg.includes('does not have access to model') || msg.includes('model not found')) {
          logger.warn('route/chat', 'Modèle indisponible, tentative suivante', { model: modelName });
          continue;
        }
        throw error;
      }
    }
    throw new Error('Aucun modèle OpenAI disponible pour cette clé. Vérifiez la configuration du projet et les modèles autorisés.');
  };

  try {
    const result = await tryGenerate(openAIProject);
    return new Response(result.text, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error: any) {
    logger.error('route/chat', 'Erreur chatbot', { message: error?.message });
    const message = String(error?.message || error).toLowerCase();
    const shouldFallback = openAIProject && (
      message.includes('openai-project header should match project') ||
      message.includes('mismatched_project') ||
      message.includes('does not have access to model') ||
      message.includes('model_not_found')
    );

    if (shouldFallback) {
      try {
        const fallback = await tryGenerate(undefined);
        return new Response(fallback.text, {
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'no-store',
          },
        });
      } catch (fallbackError: any) {
        return new Response(`Erreur OpenAI : ${String(fallbackError?.message || fallbackError)}`, {
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'no-store',
          },
          status: 500,
        });
      }
    }

    return new Response(`Erreur OpenAI : ${error?.message || error}`, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
      },
      status: 500,
    });
  }
}