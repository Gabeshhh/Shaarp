# Shaarp Expo Scraper - Hackathon MVP

Shaarp Expo Scraper est un outil conçu en 48h lors d’un hackathon pour Shaarp.  
Son objectif est d’automatiser l’extraction des exposants présents sur les sites de salons professionnels à l’aide d’un agent IA.

Concrètement, l’utilisateur renseigne une URL dans l’interface, l’agent explore le site, extrait les informations utiles, puis les affiche dans un tableau avec possibilité d’export en CSV.

---

## Installation

### Pré-requis

Avant de lancer le projet, assurez-vous d’avoir :

- **Node.js 18 ou supérieur**
- une **connexion internet active**

---

### Installer les dépendances

```
npm install
```

Installer Chromium pour Playwright
```
npx playwright install chromium
```

---

### Configurer les variables d’environnement

Créez un fichier local à partir du fichier d’exemple :
```
cp .env.example .env.local
```
Ajoutez ensuite votre clé API dans .env.local :
```
OPENAI_API_KEY=your_api_key_here
```

---

### Lancer le projet en local

Démarrez le serveur de développement avec :
```
npm run dev
```
Puis ouvrez :
```
http://localhost:3000
```
