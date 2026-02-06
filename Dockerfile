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

# Exposer le port (Standard Koyeb/Cloud)
ENV PORT=8000
EXPOSE 8000

# Commande de démarrage
CMD ["npm", "start"]
