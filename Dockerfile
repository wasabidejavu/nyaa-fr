# Utiliser une image Node.js récente (20 LTS) pour compatibilité
FROM node:20-alpine

# Définir le répertoire de travail
WORKDIR /app

# Copier les fichiers de dépendances
COPY package*.json ./

# Installer les dépendances
RUN npm install --production

# Copier le reste du code source
COPY . .

# Exposer le port (Hugging Face Spaces utilise 7860 par défaut)
ENV PORT=7860
EXPOSE 7860

# Commande de démarrage
CMD ["npm", "start"]
