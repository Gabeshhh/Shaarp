# Shaarp — Exhibition Scraper Agent

Outil développé en 48h lors d'un hackathon Shaarp.  
L'objectif : automatiser l'extraction des exposants sur les sites de salons professionnels grâce à un agent IA.

L'utilisateur colle une URL dans l'interface, l'agent explore le site, extrait les informations (nom, stand, email, téléphone, site web, LinkedIn…) et les affiche dans un tableau exportable en CSV.

---

## Fonctionnalités

- **Scraping multi-sites** — fonctionne sur les sites de salons avec pagination, infinite scroll et pages de détail
- **Extraction IA** — GPT-4o-mini extrait les données structurées depuis le HTML nettoyé
- **Fallback regex** — si le LLM échoue, extraction par patterns (mailto:, tel:, href)
- **Chat temps réel** — progression visible phase par phase (connexion → collecte → scraping → terminé)
- **Export CSV** — toutes les données en un clic
- **Panel contacts** — agrégation emails / téléphones / sites avec copie rapide

---

## Architecture

```
src/
├── app/
│   ├── page.tsx              # Page principale (client)
│   └── api/chat/route.ts     # Route API unique (scraping + chat)
├── components/
│   ├── Chat.tsx              # Interface chat avec double input (URL / question)
│   ├── ExhibitorsTable.tsx   # Tableau avec recherche et export
│   ├── ContactsPanel.tsx     # Panel contacts agrégés
│   └── ScrapeProgress.tsx    # Barre de progression en temps réel
└── lib/
    ├── schema.ts             # Schémas Zod (validation des données)
    └── tools/
        └── scrapeExhibitors.ts  # Moteur de scraping (Playwright + LLM)
```

### Choix techniques

| Choix | Raison |
|---|---|
| **Playwright** | Les sites de salons sont souvent en JS lourd (React, Vue) — `fetch` HTML statique ne suffit pas |
| **Streaming NDJSON** | Afficher les exposants au fur et à mesure sans attendre la fin du scraping (peut durer 2-3 min) |
| **GPT-4o-mini** | Rapport coût/performance optimal pour de l'extraction structurée répétée |
| **Fallback regex** | Garantit un résultat même sans quota LLM disponible |
| **Pas de base de données** | Données éphémères par session — simplifie le déploiement, évite la persistance de données personnelles |
| **Batch de 3 requêtes** | Limite la charge serveur et réduit le risque de blocage anti-bot |
| **Délais aléatoires (800–2500ms)** | Simule un comportement humain pour réduire les détections automatiques |

### Scalabilité et modularité

- Le moteur de scraping (`scrapeExhibitors.ts`) est découplé de la route API — remplaçable sans toucher au front
- Les schémas Zod centralisent la validation des données : ajouter un champ = 1 ligne dans `schema.ts`
- Le système de fallback (LLM → regex → données partielles) garantit un résultat même en cas de dégradation
- Pour scaler : remplacer Playwright local par un service de scraping managé (Browserless, ScrapingBee) sans changer la logique métier

---

## Installation

### Pré-requis

- **Node.js 18+**
- Une clé API **OpenAI**
- Une connexion internet active

### 1. Installer les dépendances

```bash
npm install
```

### 2. Installer Chromium (Playwright)

```bash
npx playwright install chromium
```

### 3. Configurer les variables d'environnement

```bash
cp .env.local.example .env.local
```

Renseigner dans `.env.local` :

```env
OPENAI_API_KEY=sk-...        # Obligatoire
OPENAI_MODEL=gpt-4o-mini     # Optionnel (défaut : gpt-4o-mini)
```

### 4. Lancer en local

```bash
npm run dev
```

Ouvrir : [http://localhost:3000](http://localhost:3000)

### 5. Build production

```bash
npm run build
npm start
```

---

## Utilisation

1. Coller l'URL d'un salon professionnel dans le champ avec l'icône lien (ex: `https://www.vivatech.com/fr/exposants`)
2. L'agent explore le site et affiche les exposants en temps réel
3. Utiliser la barre de recherche pour filtrer
4. Exporter en CSV via le bouton en haut du tableau
5. Le panel "Contacts" agrège tous les emails et téléphones trouvés

Le champ texte (icône message) permet de poser des questions libres à l'assistant IA.

---

## Déploiement

Le projet est compatible **Vercel** nativement (Next.js + API routes).

```bash
vercel deploy
```

Variables d'environnement à configurer dans le dashboard Vercel :
- `OPENAI_API_KEY`
- `OPENAI_MODEL` (optionnel)

> Note : Playwright requiert un environnement avec Chromium. Sur Vercel, utiliser `@sparticuz/chromium` ou un service externe (Browserless) pour la production.

---

## Considérations légales et éthiques

### Risques liés au scraping

Le scraping automatisé peut être soumis à des restrictions légales et techniques :

- **Conditions d'utilisation (CGU)** — certains sites interdisent explicitement le scraping dans leurs CGU. Il est de la responsabilité de l'utilisateur de vérifier les CGU du site cible avant utilisation.
- **robots.txt** — l'outil ne consulte pas actuellement le fichier `robots.txt`. Une évolution future devrait respecter ces directives.
- **Charge serveur** — les délais aléatoires et le traitement par batch limitent l'impact sur les serveurs cibles, mais un usage intensif reste à proscrire.

### RGPD et données personnelles

Les données extraites (emails, téléphones) peuvent constituer des **données personnelles** au sens du RGPD :

- Ne pas stocker ces données sans base légale (consentement, intérêt légitime documenté)
- Ne pas les transmettre à des tiers sans accord
- Respecter les droits des personnes (accès, suppression)
- L'outil ne persiste aucune donnée côté serveur — les données restent dans la session navigateur de l'utilisateur

### Alternatives recommandées

Avant de scraper un site, vérifier l'existence :
- **APIs officielles** des organisateurs de salons (Comexposium, Reed Exhibitions, Viparis…)
- **Exports exposants** parfois disponibles en téléchargement direct sur les sites
- **Open data** événementiel (data.gouv.fr, APIs sectorielles)
- **Partenariats directs** avec les organisateurs pour accès aux données

---

## Limitations connues

- Sites avec CAPTCHA ou protection Cloudflare avancée peuvent bloquer le scraping
- Les sites sans page de détail par exposant retournent moins d'informations
- Le temps de scraping dépend du nombre d'exposants (comptez ~2s par exposant)
- Nécessite Chromium installé localement (non compatible avec certains environnements serverless par défaut)
