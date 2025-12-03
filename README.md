# To-Do List avec Firebase

Application de gestion de tâches sobre et moderne, connectée à Firebase Firestore.

## Fonctionnalités

- ✅ Ajout, modification et suppression de tâches
- 📝 Descriptions détaillées pour chaque tâche
- 🔗 Liens vers fichiers ou URLs
- 📅 Affichage de la semaine en cours
- 🔄 Synchronisation en temps réel avec Firebase Firestore
- 💾 Sauvegarde automatique dans le cloud

## Configuration Firebase

### 1. Configurer Firestore dans la console Firebase

1. Allez sur [Firebase Console](https://console.firebase.google.com/)
2. Sélectionnez votre projet `to-do-list-66f6f`
3. Dans le menu de gauche, cliquez sur **Firestore Database**
4. Cliquez sur **Créer une base de données**
5. Choisissez le mode:
   - **Mode test** (recommandé pour développement) : Accès en lecture/écriture pendant 30 jours
   - **Mode production** : Nécessite des règles de sécurité personnalisées

### 2. Configuration des règles de sécurité

Pour un environnement de développement, utilisez ces règles (à modifier en production) :

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /tasks/{taskId} {
      allow read, write: if true;
    }
  }
}
```

⚠️ **Important** : Ces règles permettent à tout le monde d'accéder à vos données. Pour la production, ajoutez une authentification Firebase.

### 3. Règles de sécurité recommandées pour la production

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /tasks/{taskId} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## Installation locale

1. Clonez ou téléchargez ce projet
2. Ouvrez `index.html` dans votre navigateur
3. Les tâches seront automatiquement synchronisées avec Firebase

⚠️ **Note** : Pour utiliser l'application localement avec les modules ES6, vous devez soit :
- Utiliser un serveur local (ex: Live Server pour VS Code)
- Ou ouvrir directement le fichier HTML (certains navigateurs peuvent bloquer les imports)

## Serveur local recommandé

```bash
# Avec Python 3
python3 -m http.server 8000

# Avec Node.js (si npx est installé)
npx http-server

# Ou utilisez l'extension "Live Server" dans VS Code
```

Puis ouvrez `http://localhost:8000` dans votre navigateur.

## Structure du projet

```
├── index.html           # Page principale
├── style.css            # Styles CSS
├── script.js            # Logique JavaScript
├── firebase-config.js   # Configuration Firebase
└── README.md            # Documentation
```

## Technologies utilisées

- HTML5
- CSS3
- JavaScript ES6+
- Firebase Firestore
- Firebase Analytics
