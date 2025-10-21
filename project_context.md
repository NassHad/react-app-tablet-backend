# 📱 Application tablette en magasin – Projet GTI

## 🎯 Objectif
Développer une application Android destinée aux rayons automobiles (ex. batteries, huiles, ampoules, essuie-glaces) permettant aux clients de trouver le bon produit compatible avec leur véhicule.

L’application est installée sur des tablettes placées en libre-service dans les rayons.

## 💡 Fonctionnement général

1. Le client choisit :
   - Type de véhicule (voiture, moto, camion)
   - Catégorie de produit
   - Marque et modèle du véhicule
   - Questions spécifiques (ex. côté conducteur / passager)
2. L’application affiche la **liste des produits compatibles**.
3. Aucune connexion Internet permanente n’est requise :
   - Toutes les données sont stockées en **local via SQLite**.
   - Une synchronisation manuelle/ponctuelle est possible pour les mises à jour.

## ⚙️ Technologies principales

| Fonction | Technologie |
|-----------|--------------|
| Frontend | React + Vite + TypeScript |
| Base locale | SQLite via @capacitor-community/sqlite |
| Backend | Strapi (Node.js) |
| Déploiement tablette | Capacitor + Android Studio |
| Kiosque & gestion MDM | Scalefusion |
| Design | TailwindCSS + Framer Motion |

## 🔐 Contraintes
- Application **offline-first**
- Aucune donnée personnelle enregistrée
- Doit fonctionner **sans réseau permanent**
- Tablettes verrouillées (mode kiosque via Scalefusion)

## 🚀 Livraison
- L’application est compilée en **APK signé** via Android Studio.
- Chaque tablette dispose de sa propre base SQLite (catégories spécifiques au magasin).
