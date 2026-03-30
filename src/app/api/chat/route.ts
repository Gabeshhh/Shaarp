import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';
import { scrapeExhibitorsStream, ScrapeProgressEvent } from '@/lib/tools/scrapeExhibitors';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes for deep scraping
export const dynamic = 'force-dynamic';

// Simple URL detection
function extractUrl(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s"'<>]+/i);
  return match ? match[0] : null;
}

function localChatbotReply(userText: string): string {
  const t = userText.trim();
  const lower = t.toLowerCase();
  if (!t) return 'Je suis là. Dis-moi ce que tu veux faire.';
  if (/(bonjour|salut|hello|bonsoir)/i.test(lower)) {
    return 'Bonjour ! Je suis prêt. Envoie-moi une URL d’exposants ou pose-moi une question, et je t’aide tout de suite.';
  }
  if (/(merci|thx|thanks)/i.test(lower)) {
    return 'Avec plaisir ! Si tu veux, je peux aussi te proposer la prochaine étape.';
  }
  return `Bien reçu. J’ai noté : "${t}".\n\nTu peux soit :\n- coller une URL de salon pour lancer l’extraction,\n- soit me poser une question précise (analyse, tri, résumé des contacts).`;
}

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { error: 'Corps de requête JSON invalide.' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    );
  }
  
  const rawMessages = body.messages || [];
  const messages = rawMessages.map((m: any) => {
    if (m.content) return { role: m.role, content: m.content };
    if (m.prompt) return { role: m.role || 'user', content: m.prompt };
    if (m.parts) {
      const textParts = m.parts
        .filter((p: any) => p.type === 'text')
        .map((p: any) => p.text);
      return { role: m.role, content: textParts.join('') || '' };
    }
    return { role: m.role || 'user', content: '' };
  });

  // Get the last user message
  const lastUserMsg = [...messages].reverse().find((m: any) => m.role === 'user');
  const url = lastUserMsg ? extractUrl(lastUserMsg.content) : null;

  // If URL detected, stream scrape progress
  if (url) {
    console.log(`[route] URL detected: ${url}, starting deep scrape stream...`);
    
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of scrapeExhibitorsStream(url)) {
            const line = JSON.stringify(event) + '\n';
            controller.enqueue(encoder.encode(line));
          }
        } catch (error: any) {
          const errorEvent: ScrapeProgressEvent = {
            type: 'error',
            message: error?.message || 'Erreur inconnue côté scraping.',
          };
          controller.enqueue(encoder.encode(JSON.stringify(errorEvent) + '\n'));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'application/x-ndjson; charset=utf-8',
        'X-Scrape-Stream': 'true',
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      },
    });
  }

  // No URL: chat mode
  const hasOpenAIKey = !!process.env.OPENAI_API_KEY;
  if (!hasOpenAIKey) {
    const text = localChatbotReply(lastUserMsg?.content || '');
    return new Response(text, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  }

  try {
    const result = streamText({
      model: openai.chat('gpt-4o'),
      messages,
      system: `Tu es "Shaarp Expo Scraper", un agent d'extraction B2B.
Ton rôle est d'extraire la liste des exposants depuis les sites web de salons professionnels.
Si l'utilisateur te fournit une URL, tu vas analyser la page et extraire les données.
Si l'utilisateur ne fournit pas d'URL, réponds comme ChatGPT: utile, clair, naturel, conversationnel.
Reste toujours courtois, professionnel et concis.`,
    });

    return result.toTextStreamResponse();
  } catch (error: any) {
    const fallback = `Je rencontre un souci temporaire avec GPT-4 (${error?.message || 'erreur inconnue'}).\n\n${localChatbotReply(lastUserMsg?.content || '')}`;
    return new Response(fallback, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
      },
      status: 200,
    });
  }
}
