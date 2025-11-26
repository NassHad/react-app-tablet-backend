# Configuration de la synchronisation offline
Write-Host "🚀 Configuration de la synchronisation offline..." -ForegroundColor Green

# Vérifier que Node.js est installé
try {
    $nodeVersion = node --version
    Write-Host "✅ Node.js détecté : $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js n'est pas installé. Veuillez l'installer d'abord." -ForegroundColor Red
    exit 1
}

# Vérifier que npm est installé
try {
    $npmVersion = npm --version
    Write-Host "✅ npm détecté : $npmVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ npm n'est pas installé. Veuillez l'installer d'abord." -ForegroundColor Red
    exit 1
}

Write-Host "📦 Installation des dépendances..." -ForegroundColor Yellow

# Installer les dépendances
npm install

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erreur lors de l'installation des dépendances" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Dépendances installées avec succès" -ForegroundColor Green

# Créer le dossier pour la base SQLite
Write-Host "📁 Création des dossiers nécessaires..." -ForegroundColor Yellow
$dbDir = "android/app/src/main/assets/databases"
if (!(Test-Path $dbDir)) {
    New-Item -ItemType Directory -Path $dbDir -Force | Out-Null
}

Write-Host "✅ Dossiers créés" -ForegroundColor Green

# Vérifier que Strapi est démarré
Write-Host "🔍 Vérification que Strapi est démarré..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:1338/api/sync/tablet-001" -Method GET -TimeoutSec 5
    Write-Host "✅ Strapi est démarré et accessible" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Strapi n'est pas démarré. Veuillez le démarrer avec 'npm run dev'" -ForegroundColor Yellow
    Write-Host "   Puis relancez ce script." -ForegroundColor Yellow
    exit 1
}

# Tester l'endpoint de sync
Write-Host "🧪 Test de l'endpoint de synchronisation..." -ForegroundColor Yellow
npm run test-sync

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Endpoint de synchronisation fonctionne correctement" -ForegroundColor Green
} else {
    Write-Host "❌ Problème avec l'endpoint de synchronisation" -ForegroundColor Red
    exit 1
}

# Générer le seed SQLite
Write-Host "🗄️  Génération du seed SQLite..." -ForegroundColor Yellow
npm run generate-seed

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Seed SQLite généré avec succès" -ForegroundColor Green
    Write-Host "📁 Fichier créé : android/app/src/main/assets/databases/tablet-app.db" -ForegroundColor Green
} else {
    Write-Host "❌ Erreur lors de la génération du seed SQLite" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🎉 Configuration terminée avec succès !" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Prochaines étapes :" -ForegroundColor Cyan
Write-Host "1. Vérifiez que le fichier tablet-app.db est bien créé"
Write-Host "2. Intégrez ce fichier dans votre build Android"
Write-Host "3. Configurez le frontend pour lire depuis SQLite"
Write-Host "4. Testez la synchronisation offline"
Write-Host ""
Write-Host "🔧 Commandes utiles :" -ForegroundColor Cyan
Write-Host "  - Démarrer Strapi : npm run dev"
Write-Host "  - Tester l'endpoint : npm run test-sync"
Write-Host "  - Régénérer le seed : npm run generate-seed"
Write-Host "  - Générer pour prod : npm run generate-seed:prod"
