# DIGISPIRE Academy — Setup & Running Guide

## Prerequisites
- Node.js 18+
- Firebase project (see below)

## 1. Firebase Setup

1. Go to [https://console.firebase.google.com](https://console.firebase.google.com)
2. Create a new project named **digispire-academy**
3. Enable the following services:
   - **Authentication** → Sign-in methods → Enable **Email/Password** and **Phone**
   - **Firestore Database** → Start in test mode
   - **Storage** → Start in test mode
4. Go to **Project Settings → General → Your apps → Web App**
5. Copy the Firebase config and paste it into `src/firebase.js`:

```js
const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "..."
};
```

## 2. Create Admin Users

After Firebase is set up:

1. Go to **Firebase Console → Authentication → Add User**
2. Add up to 3 admin users with email/password
3. Go to **Firestore → Create collection `users`**
4. For each admin, add a document with their Firebase Auth UID as the document ID:

```json
{
  "name": "Admin Name",
  "email": "admin@digispire.in",
  "role": "admin"
}
```

> Students are created through the Admin Panel → Students page. Their Firestore document is created there.  
> For student login (phone OTP), the student must exist in Firestore with `role: "student"`.

## 3. Running Locally

```bash
cd digispire-app
npm install
npm run dev
```

App runs at: **http://localhost:5173**

## 4. Building for Production

```bash
npm run build
```

Output is in `dist/`. Deploy to Firebase Hosting:

```bash
npm install -g firebase-tools
firebase login
firebase init hosting   # set public dir to "dist", configure as SPA
firebase deploy
```

## 5. Project Structure

```
digispire-app/
├── public/
│   └── logo.png
├── src/
│   ├── context/         # AuthContext
│   ├── components/      # ProtectedRoute
│   ├── layouts/         # AdminLayout, StudentLayout
│   ├── pages/
│   │   ├── LoginPage.jsx
│   │   ├── admin/       # Dashboard, Students, Attendance, Courses, Content
│   │   └── student/     # Dashboard, Attendance, Courses, Content
│   ├── firebase.js      # Firebase initialization
│   ├── App.jsx          # Router + routes
│   └── index.css        # Tailwind + brand theme
├── index.html           # PWA meta tags
└── vite.config.js       # Vite + PWA plugin config
```

## 6. PWA Installation

- **Android (Chrome):** Visit site → tap "Add to Home Screen" in browser menu
- **iOS (Safari):** Visit site → tap Share → "Add to Home Screen"

## 7. Firestore Security Rules (Recommended before going live)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
    match /attendance/{id} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
    }
    match /{document=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
  }
}
```
