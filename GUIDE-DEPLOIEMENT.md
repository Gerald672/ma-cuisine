# 🚀 Guide de déploiement — Ma cuisine

## Ce que tu vas obtenir
Une application web installable sur Android et accessible sur PC,
avec tes recettes et ton stock sauvegardés en ligne.

---

## Étape B — Créer un compte GitHub et déposer le code

### B1. Créer un compte GitHub
1. Va sur https://github.com
2. Clique sur "Sign up"
3. Entre ton email, un mot de passe, un nom d'utilisateur
4. Confirme ton email

### B2. Créer un nouveau dépôt
1. Une fois connecté, clique sur le "+" en haut à droite → "New repository"
2. Nom du dépôt : `ma-cuisine`
3. Laisse tout par défaut, clique "Create repository"

### B3. Déposer le code
1. Sur la page du dépôt vide, clique sur "uploading an existing file"
2. Glisse-dépose le dossier `ma-cuisine` que tu as téléchargé
3. En bas de page, clique "Commit changes"

---

## Étape C — Déployer sur Vercel

### C1. Créer un compte Vercel
1. Va sur https://vercel.com
2. Clique "Sign up" → choisis "Continue with GitHub"
3. Autorise Vercel à accéder à GitHub

### C2. Déployer l'application
1. Sur le dashboard Vercel, clique "Add New Project"
2. Tu vois ton dépôt `ma-cuisine` → clique "Import"
3. Laisse tout par défaut
4. Clique "Deploy" — attends 2-3 minutes
5. Tu obtiens une URL du type : `ma-cuisine-xxx.vercel.app` 🎉

---

## Étape D — Configurer Supabase (base de données + login)

### D1. Créer un compte Supabase
1. Va sur https://supabase.com
2. Clique "Start your project" → connecte-toi avec GitHub
3. Clique "New project"
4. Nom : `ma-cuisine`, choisis un mot de passe fort, région : `eu-central-1`
5. Clique "Create new project" — attends 2 minutes

### D2. Créer les tables
1. Dans Supabase, clique "SQL Editor" dans le menu gauche
2. Clique "New query"
3. Copie-colle TOUT le contenu du fichier `supabase-setup.sql`
4. Clique "Run" (bouton vert)
5. Tu dois voir "Success" ✅

### D3. Activer l'authentification par email
1. Dans Supabase → "Authentication" → "Providers"
2. "Email" doit être activé (c'est le cas par défaut)

### D4. Récupérer les clés API
1. Dans Supabase → "Settings" → "API"
2. Copie :
   - **Project URL** (commence par https://...)
   - **anon public key** (longue chaîne de caractères)

### D5. Ajouter les clés à Vercel
1. Dans Vercel → ton projet → "Settings" → "Environment Variables"
2. Ajoute ces deux variables :
   - Nom : `REACT_APP_SUPABASE_URL` → Valeur : ton Project URL
   - Nom : `REACT_APP_SUPABASE_ANON_KEY` → Valeur : ton anon key
3. Clique "Save"
4. Va dans "Deployments" → clique les "..." du dernier déploiement → "Redeploy"
5. Attends 2 minutes → l'app est prête ! ✅

---

## Étape E — Installer sur Android

1. Sur ton téléphone Android, ouvre **Chrome**
2. Va sur ton URL Vercel (ex: `ma-cuisine-xxx.vercel.app`)
3. Chrome affiche automatiquement une bannière "Ajouter à l'écran d'accueil"
4. Si la bannière n'apparaît pas : appuie sur les ⋮ (trois points) → "Ajouter à l'écran d'accueil"
5. L'icône 🍳 apparaît sur ton écran d'accueil — c'est ta vraie app !

---

## En cas de problème

Tu peux me montrer le message d'erreur que tu vois et je t'aide à le résoudre.

---

## Résumé des URLs importantes

| Service  | URL                          | À quoi ça sert        |
|----------|------------------------------|----------------------|
| GitHub   | github.com/TON-COMPTE/ma-cuisine | Stocke le code     |
| Vercel   | ma-cuisine-xxx.vercel.app    | L'app en ligne       |
| Supabase | supabase.com                 | Base de données      |

---

*Dernière mise à jour : avril 2026*
