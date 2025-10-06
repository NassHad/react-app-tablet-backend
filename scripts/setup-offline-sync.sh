#!/bin/bash

echo "🚀 Configuration de la synchronisation offline..."

# Vérifier que Node.js est installé
if ! command -v node &> /dev/null; then
    echo "❌ Node.js n'est pas installé. Veuillez l'installer d'abord."
    exit 1
fi

# Vérifier que npm est installé
if ! command -v npm &> /dev/null; then
    echo "❌ npm n'est pas installé. Veuillez l'installer d'abord."
    exit 1
fi

echo "📦 Installation des dépendances..."

# Installer les dépendances
npm install

if [ $? -ne 0 ]; then
    echo "❌ Erreur lors de l'installation des dépendances"
    exit 1
fi

echo "✅ Dépendances installées avec succès"

# Créer le dossier pour la base SQLite
echo "📁 Création des dossiers nécessaires..."
mkdir -p android/app/src/main/assets/databases

echo "✅ Dossiers créés"

# Vérifier que Strapi est démarré
echo "🔍 Vérification que Strapi est démarré..."
if curl -s http://localhost:1338/api/sync/tablet-001 > /dev/null; then
    echo "✅ Strapi est démarré et accessible"
else
    echo "⚠️  Strapi n'est pas démarré. Veuillez le démarrer avec 'npm run dev'"
    echo "   Puis relancez ce script."
    exit 1
fi

# Tester l'endpoint de sync
echo "🧪 Test de l'endpoint de synchronisation..."
npm run test-sync

if [ $? -eq 0 ]; then
    echo "✅ Endpoint de synchronisation fonctionne correctement"
else
    echo "❌ Problème avec l'endpoint de synchronisation"
    exit 1
fi

# Générer le seed SQLite
echo "🗄️  Génération du seed SQLite..."
npm run generate-seed

if [ $? -eq 0 ]; then
    echo "✅ Seed SQLite généré avec succès"
    echo "📁 Fichier créé : android/app/src/main/assets/databases/tablet-app.db"
else
    echo "❌ Erreur lors de la génération du seed SQLite"
    exit 1
fi

echo ""
echo "🎉 Configuration terminée avec succès !"
echo ""
echo "📋 Prochaines étapes :"
echo "1. Vérifiez que le fichier tablet-app.db est bien créé"
echo "2. Intégrez ce fichier dans votre build Android"
echo "3. Configurez le frontend pour lire depuis SQLite"
echo "4. Testez la synchronisation offline"
echo ""
echo "🔧 Commandes utiles :"
echo "  - Démarrer Strapi : npm run dev"
echo "  - Tester l'endpoint : npm run test-sync"
echo "  - Régénérer le seed : npm run generate-seed"
echo "  - Générer pour prod : npm run generate-seed:prod"
