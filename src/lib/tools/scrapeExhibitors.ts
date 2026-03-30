import { chromium, Page, BrowserContext } from 'playwright';
import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { zodSchema } from 'ai';
import { extractionProcessSchema, singleExhibitorProcessSchema, Exhibitor } from '../schema';

const randomDelay = (min = 800, max = 1500) => new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * (max - min)) + min));

function uniq(values: string[]) {
  return Array.from(new Set(values.map(v => v.trim()).filter(Boolean)));
}

function extractEmails(text: string) {
  const matches = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? [];
  return uniq(matches);
}

function extractPhones(text: string) {
  // Heuristique volontairement permissive (formats internationaux + séparateurs)
  const matches = text.match(/(\+?\d[\d\s().-]{6,}\d)/g) ?? [];
  const cleaned = matches
    .map(m => m.replace(/\s+/g, ' ').trim())
    .filter(m => m.replace(/[^\d]/g, '').length >= 8);
  return uniq(cleaned);
}

function isProbablyWebsite(href: string) {
  try {
    const u = new URL(href);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
    const host = u.hostname.toLowerCase();
    if (!host || host === 'localhost') return false;
    if (host.includes('twitter.com') || host.includes('x.com') || host.includes('linkedin.com')) return false;
    return true;
  } catch {
    return false;
  }
}

function pickBestWebsite(urls: string[]) {
  const clean = uniq(urls).filter(isProbablyWebsite);
  if (clean.length === 0) return '';
  // Préfère une URL courte (souvent domaine principal)
  return clean.sort((a, b) => a.length - b.length)[0];
}

async function autoScroll(page: Page) {
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      let totalHeight = 0;
      const distance = 200;
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;
        if (totalHeight >= scrollHeight - window.innerHeight || totalHeight > 20000) {
          clearInterval(timer);
          resolve();
        }
      }, 120);
    });
  });
}

// ========================================
// Phase 1: Collect exhibitor links + pagination
// ========================================
async function collectExhibitorLinks(
  page: Page,
  baseUrl: string,
  onProgress: (msg: string) => void
): Promise<{ links: string[]; names: string[] }> {
  const allLinks: Set<string> = new Set();
  const allNames: string[] = [];
  let pageNum = 1;
  const maxPages = 20; // Safety limit

  while (pageNum <= maxPages) {
    onProgress(`📄 Parcours de la page ${pageNum}...`);

    await autoScroll(page);
    await randomDelay(1000, 2000);

    // Extract all links that look like exhibitor detail pages
    const { links, names } = await page.evaluate((base: string) => {
      const anchors = Array.from(document.querySelectorAll('a[href]'));
      const result: { links: string[]; names: string[] } = { links: [], names: [] };

      for (const a of anchors) {
        const href = (a as HTMLAnchorElement).href;
        const text = (a as HTMLElement).innerText?.trim();

        // Heuristic: exhibitor detail pages typically contain "exhibitor" or "exposant" in URL
        // Or they are links inside a list/grid with short text (company names)
        if (
          href &&
          text &&
          text.length > 1 &&
          text.length < 150 &&
          !href.includes('#') &&
          !href.includes('javascript:') &&
          (
            href.includes('/exhibitor') ||
            href.includes('/exposant') ||
            href.includes('/company') ||
            href.includes('/sponsor') ||
            // Generic: same domain, looks like a detail page
            (href.startsWith(new URL(base).origin) && href.split('/').length > 4)
          )
        ) {
          result.links.push(href);
          result.names.push(text);
        }
      }
      return result;
    }, baseUrl);

    for (const link of links) {
      allLinks.add(link);
    }
    for (const name of names) {
      if (!allNames.includes(name)) allNames.push(name);
    }

    onProgress(`📄 Page ${pageNum}: ${allLinks.size} liens d'exposants trouvés au total`);

    // Try to find and click "Next" / pagination button
    const hasNext = await page.evaluate(() => {
      const nextSelectors = [
        'a[aria-label="Next"]',
        'button[aria-label="Next"]',
        'a:has-text("Next")',
        'button:has-text("Next")',
        'a:has-text("Suivant")',
        'button:has-text("Suivant")',
        '.pagination a.next',
        '.pagination .next a',
        'nav[aria-label="pagination"] a:last-child',
        '[class*="pagination"] [class*="next"]',
        'a[rel="next"]',
      ];

      for (const sel of nextSelectors) {
        try {
          const el = document.querySelector(sel) as HTMLElement;
          if (el && !el.hasAttribute('disabled') && el.offsetParent !== null) {
            el.click();
            return true;
          }
        } catch { /* selector might be invalid */ }
      }
      return false;
    });

    if (!hasNext) {
      onProgress(`✅ Fin de la pagination. ${allLinks.size} liens d'exposants récoltés sur ${pageNum} page(s).`);
      break;
    }

    pageNum++;
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await randomDelay(1500, 2500);
  }

  return { links: Array.from(allLinks), names: allNames };
}

// ========================================
// Phase 2: Scrape individual exhibitor detail
// ========================================
async function scrapeExhibitorDetail(
  context: BrowserContext,
  url: string,
  fallbackName: string
): Promise<Exhibitor | null> {
  const page = await context.newPage();
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 });
    await randomDelay(500, 1000);

    const { pageText, mailtos, tels, hrefs } = await page.evaluate(() => {
      document.querySelectorAll('script, style, noscript, svg, iframe').forEach(el => el.remove());
      const main = document.querySelector('main') || document.querySelector('#content') || document.querySelector('article') || document.body;
      const anchors = Array.from(document.querySelectorAll('a[href]')) as HTMLAnchorElement[];
      const hrefList = anchors.map(a => a.href).filter(Boolean);
      const mailtoList = hrefList
        .filter(h => h.startsWith('mailto:'))
        .map(h => h.replace(/^mailto:/i, '').split('?')[0]);
      const telList = hrefList
        .filter(h => h.startsWith('tel:'))
        .map(h => h.replace(/^tel:/i, ''));
      return {
        pageText: main.innerText.substring(0, 30000),
        mailtos: mailtoList,
        tels: telList,
        hrefs: hrefList,
      };
    });

    if (!pageText || pageText.trim().length < 50) {
      return { name: fallbackName, website: '', booth: '', linkedin: '', twitter: '', email: '', phone: '' };
    }

    const hasOpenAIKey = !!process.env.OPENAI_API_KEY;

    // Fallback “sans LLM”: extraction regex + mailto/tel + liens externes
    if (!hasOpenAIKey) {
      const emails = uniq([...mailtos, ...extractEmails(pageText)]);
      const phones = uniq([...tels, ...extractPhones(pageText)]);
      const website = pickBestWebsite(hrefs) || url;
      return {
        name: fallbackName,
        website,
        booth: '',
        linkedin: '',
        twitter: '',
        email: emails.join('; '),
        phone: phones.join('; '),
      };
    }

    const { object } = await generateObject({
      model: openai.chat('gpt-4o-mini'),
      schema: zodSchema(singleExhibitorProcessSchema),
      prompt: `Voici le contenu d'une fiche exposant. TA MISSION : Extraire UNIQUEMENT les COORDONNÉES DE CONTACT (email, téléphone, site web, booth, réseaux sociaux).

IMPORTANT : Ne perds pas de temps avec les descriptions, l'historique de l'entreprise ou les présentations marketing. Ignore tout ce qui n'est pas un contact direct.

Utilise "${fallbackName}" si le nom n'est pas clair. Contenu :\n\n${pageText}`,
    });

    return object.exhibitor;
  } catch (error: any) {
    console.warn(`[detail] Erreur sur ${url}: ${error.message}`);
    return { name: fallbackName, website: url, booth: '', linkedin: '', twitter: '', email: '', phone: '' };
  } finally {
    await page.close();
  }
}

// ========================================
// Phase 3: Orchestrator (used for streaming)
// ========================================
export interface ScrapeProgressEvent {
  type: 'status' | 'progress' | 'exhibitor' | 'done' | 'error';
  message?: string;
  current?: number;
  total?: number;
  exhibitor?: Exhibitor;
}

export async function* scrapeExhibitorsStream(url: string): AsyncGenerator<ScrapeProgressEvent> {
  yield { type: 'status', message: `🚀 Lancement du navigateur...` };
  
  const browser = await chromium.launch({ headless: true });

  try {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
    });

    const page = await context.newPage();
    yield { type: 'status', message: `🌐 Chargement de la page...` };

    await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
    await randomDelay(2000, 3000);

    // Phase 1: Collect links
    yield { type: 'status', message: `🔍 Recherche des liens d'exposants et navigation dans les pages...` };

    const statusMessages: string[] = [];
    const { links, names } = await collectExhibitorLinks(page, url, (msg) => {
      statusMessages.push(msg);
    });

    // Emit collected status messages
    for (const msg of statusMessages) {
      yield { type: 'status', message: msg };
    }

    // If we found exhibitor links, do deep scraping
    if (links.length > 0) {
      const total = Math.min(links.length, 200); // Safety cap at 200
      yield { type: 'status', message: `🔬 Deep scraping de ${total} fiches exposants...` };

      // Process in batches of 3 for parallelism
      const batchSize = 3;
      let processed = 0;

      for (let i = 0; i < total; i += batchSize) {
        const batch = links.slice(i, Math.min(i + batchSize, total));
        const batchNames = batch.map((_, idx) => names[i + idx] || `Exposant ${i + idx + 1}`);

        const results = await Promise.allSettled(
          batch.map((link, idx) => scrapeExhibitorDetail(context, link, batchNames[idx]))
        );

        for (const result of results) {
          processed++;
          if (result.status === 'fulfilled' && result.value) {
            yield {
              type: 'exhibitor',
              exhibitor: result.value,
              current: processed,
              total,
            };
          } else {
            yield { type: 'progress', current: processed, total, message: `⚠️ Échec sur une fiche` };
          }
        }

        yield { type: 'progress', current: processed, total, message: `Progression: ${processed}/${total}` };
        await randomDelay(300, 600);
      }

      yield { type: 'done', total: processed, message: `✅ Extraction terminée ! ${processed} exposants traités.` };

    } else {
      // Fallback: no detail links found, use LLM on the listing page text
      yield { type: 'status', message: `⚡ Aucun lien de détail trouvé. Extraction directe depuis la liste...` };

      const { pageTitle, pageUrl, pageData } = await page.evaluate(() => {
        document.querySelectorAll('script, style, noscript, svg, iframe').forEach(el => el.remove());
        const main = document.querySelector('main') || document.querySelector('#content') || document.body;
        return {
          pageTitle: document.title || '',
          pageUrl: window.location.href || '',
          pageData: main.innerText.substring(0, 150000),
        };
      });

      if (!pageData || pageData.trim().length < 50) {
        yield { type: 'error', message: '❌ Impossible d’extraire le contenu de la page de liste.' };
        return;
      }

      const hasOpenAIKey = !!process.env.OPENAI_API_KEY;
      if (!hasOpenAIKey) {
        const emails = extractEmails(pageData);
        const phones = extractPhones(pageData);
        const website = url;

        yield {
          type: 'exhibitor',
          exhibitor: {
            name: pageTitle || 'Liste exposants',
            website,
            booth: '',
            linkedin: '',
            twitter: '',
            email: emails.join('; '),
            phone: phones.join('; '),
          },
          current: 1,
          total: 1,
        };
        yield { type: 'done', total: 1, message: `✅ Extraction terminée (mode sans OpenAI).` };
        return;
      }

      const { object } = await generateObject({
        model: openai.chat('gpt-4o-mini'),
        schema: zodSchema(extractionProcessSchema),
        prompt: `Voici le contenu d'un site de salon professionnel.
TA MISSION : Extraire TOUS les exposants avec UNIQUEMENT leurs COORDONNÉES DE CONTACT (email, téléphone, site web, stand/booth, réseaux sociaux).

INSTRUCTIONS IMPORTANTES :
- RÉPONDS UNIQUEMENT avec un JSON strict correspondant au schéma fourni.
- Renvoie un objet { "exhibitors": [ ... ] } avec les champs exacts : name, website, booth, email, phone, linkedin, twitter.
- Si un champ n'existe pas, renvoie une chaîne vide.
- Ne fournis aucun texte explicatif, aucun commentaire, ni aucune mise en forme additionnelle.

Titre de la page : ${pageTitle}
URL : ${pageUrl}

Contenu de la page :\n\n${pageData}`,
      });

      for (let i = 0; i < object.exhibitors.length; i++) {
        yield {
          type: 'exhibitor',
          exhibitor: object.exhibitors[i],
          current: i + 1,
          total: object.exhibitors.length,
        };
      }

      yield { type: 'done', total: object.exhibitors.length, message: `✅ Extraction terminée ! ${object.exhibitors.length} exposants trouvés.` };
    }

  } catch (error: any) {
    console.error("[scrapeExhibitors] Erreur critique:", error.message);
    yield { type: 'error', message: `❌ Erreur: ${error.message}` };
  } finally {
    await browser.close();
  }
}
