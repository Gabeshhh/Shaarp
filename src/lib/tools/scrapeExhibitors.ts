import { chromium, Page } from 'playwright';
import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { zodSchema } from 'ai';
import { extractionProcessSchema } from '../schema';

// Helper to wait 1-2 seconds
const randomDelay = (min = 1000, max = 2000) => new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * (max - min)) + min));

async function autoScroll(page: Page) {
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      let totalHeight = 0;
      const distance = 150; // Increased distance
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;
        
        // Scroll for longer or until bottom
        if (totalHeight >= scrollHeight - window.innerHeight || totalHeight > 15000) {
          clearInterval(timer);
          resolve();
        }
      }, 150); // Slower scroll
    });
  });
}

export async function scrapeExhibitors(url: string) {
  console.log(`[scrapeExhibitors] Début du scraping pour: ${url}`);
  const browser = await chromium.launch({ headless: true });
  
  try {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
    });
    
    const page = await context.newPage();
    
    // Increased timeout and wait for networkidle
    await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
    await randomDelay(2000, 3000); // Initial wait
    
    console.log('[scrapeExhibitors] Scrolling pour charger le contenu dynamique...');
    await autoScroll(page);
    await randomDelay(1000, 2000);

    // Get cleaner but more complete content
    const pageData = await page.evaluate(() => {
      // Remove only the really unnecessary stuff
      const toRemove = document.querySelectorAll('script, style, noscript, svg, iframe, .cookie-banner, #cookie-consent');
      toRemove.forEach(el => el.remove());
      
      // Try to focus on main content if it exists
      const main = document.querySelector('main') || document.querySelector('#content') || document.body;
      return main.innerText.substring(0, 150000); // Increased limit
    });

    if (!pageData || pageData.trim().length < 100) {
      throw new Error("La page semble vide ou n'a pas pu être chargée correctement.");
    }

    console.log('[scrapeExhibitors] Contenu récupéré, analyse LLM...');

    const { object } = await generateObject({
      model: openai.chat('gpt-4o-mini'),
      schema: zodSchema(extractionProcessSchema),
      prompt: `Tu es un expert en extraction de données B2B. Voici le contenu texte extrait d'un site de salon professionnel :\n\n${pageData}\n\nMISSION :\n1. Identifie TOUS les exposants (entreprises) mentionnés dans la liste.\n2. Pour chaque exposant, extrais son nom, sa description si possible, son site web, son numéro de stand (booth), et ses catégories.\n3. Si une information est manquante, laisse le champ optionnel vide.\n4. Assure-toi que les noms sont propres et correctement orthographiés.\n5. Si tu ne trouves aucun exposant, renvoie une liste vide.`,
    });

    const count = object.exhibitors?.length || 0;
    console.log(`[scrapeExhibitors] ${count} exposants trouvés.`);
    
    return {
      success: true,
      exhibitors: object.exhibitors || [],
      message: count > 0 
        ? `J'ai terminé l'extraction. J'ai trouvé ${count} exposants sur cette page.`
        : `L'analyse est terminée mais aucun exposant n'a été détecté. Vérifiez que l'URL pointe bien vers la liste des exposants.`
    };

  } catch (error: any) {
    console.error("[scrapeExhibitors] Erreur critique:", error.message);
    return {
      success: false,
      exhibitors: [],
      message: `Une erreur technique est survenue lors de l'analyse : ${error.message}`
    };
  } finally {
    await browser.close();
  }
}
