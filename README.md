---
title: Nyaa Scraper
emoji: 🌊
colorFrom: blue
colorTo: purple
sdk: docker
pinned: false
app_port: 7860
---

# Nyaa.si Stremio Addon

Addon Stremio pour streamer des torrents depuis nyaa.si (principalement des animes).

## 🎯 Fonctionnalités

- ✅ Recherche automatique sur nyaa.si
- ✅ Récupération des liens magnet
- ✅ Affichage des seeders/leechers
- ✅ Pas besoin de débrideur
- ✅ Fonctionne en local

## 📦 Installation

### 1. Installer les dépendances

```bash
cd nyaa-scraper-addon
npm install
```

### 2. Démarrer l'addon

```bash
npm start
```

L'addon sera accessible sur `http://localhost:7000`

### 3. Installer dans Stremio

1. Ouvrir Stremio
2. Aller dans **Addons** (icône puzzle en haut à droite)
3. Cliquer sur **Community Addons** en bas
4. Coller l'URL : `http://localhost:7000/manifest.json`
5. Cliquer sur **Install**

## 🔧 Configuration

L'addon fonctionne directement sans configuration. Par défaut :
- Port : `7000` (modifiable via variable d'environnement `PORT`)
- Catégorie : Tous les contenus de nyaa.si
- Tri : Par nombre de seeders (décroissant)

## ⚠️ Notes

- Cet addon est pour usage personnel uniquement
- Assurez-vous d'avoir le droit de télécharger le contenu dans votre pays
- L'addon nécessite que Stremio soit configuré pour lire les torrents

## 🛠️ Développement

Structure du projet :
```
nyaa-scraper-addon/
├── index.js           # Point d'entrée principal
├── nyaa-scraper.js    # Module de scraping nyaa.si
├── package.json       # Dépendances npm
└── README.md          # Ce fichier
```
