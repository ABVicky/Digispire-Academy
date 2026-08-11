# 🎓 Digispire Academy — Learning Management & Operations Platform

![React 18](https://img.shields.io/badge/React-18.x-61DAFB?logo=react&logoColor=black)
![Vite 6](https://img.shields.io/badge/Vite-6.x-646CFF?logo=vite&logoColor=white)
![Tailwind CSS 4](https://img.shields.io/badge/Tailwind-4.x-06B6D4?logo=tailwindcss&logoColor=white)
![Firebase 11](https://img.shields.io/badge/Firebase-11.x-FFCA28?logo=firebase&logoColor=black)
![PWA Ready](https://img.shields.io/badge/PWA-Supported-5A0FC8?logo=pwa&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-emerald)

**Digispire Academy** is a modern, high-performance Learning Management System (LMS) and Operations Console designed for educational institutions, academies, and internship providers. Built with React 18, Vite 6, Tailwind CSS, and Firebase Firestore, Digispire Academy provides real-time course tracking, QR-based live attendance broadcasting, media resource hub, and student performance analytics.

---

## 🌟 Key Features & Modules

### 1. 📊 Course Completion & Pacing Velocity Report (`/admin/completion-reports`)
- **Real-Time Pacing Velocity Matrix**: Automatically calculates student progress against time elapsed (`Ahead of Schedule 🚀`, `On Track 🟢`, `Behind Schedule ⚠️`, `Completed 🏆`).
- **Module-by-Module Breakdown**: Visual progress bar, stepper dots, and topic completion percentages per module.
- **Student Drill-down Inspector**: Modal inspection tab detailing topic-level credit status and mentor assignments.
- **Dual View Modes**: Switch seamlessly between interactive **Cards Grid** and compact **Data Table**.
- **Data Export**: One-click CSV export of student pacing reports.

### 2. 📲 Live Attendance Console (`/admin/attendance`)
- **QR Code Broadcaster**: Generates live entry passes with dynamic 6-digit verification codes and session expiration countdown timers.
- **Real-Time Check-In Stream**: Live feed displaying student avatars, ID badges, track tags (Morning, Evening, Internship), and check-in timestamps.
- **Multi-Batch & Internship Support**: Supports academic course tracks as well as internship daily attendance logging.
- **Automated Schedules & Holiday Calendar**: Set recurring batch class schedules, mark official holidays, and handle cancelled sessions.
- **Student Attendance Inspector**: Detailed attendance calendar and percentage summary per student.

### 3. 📚 Media & Resource Hub (`/admin/content` & `/student/content`)
- **In-App Interactive Media Player Modal**: Supports inline YouTube video streaming (`iframe`) and Google Drive file preview frames directly inside the app.
- **📌 Pinned Featured Notes**: Admins can pin priority study materials to the top of student feeds.
- **Category Filter Tabs**: Multi-tab filtering for PDFs, Google Drive links, YouTube videos, bookmarks, and pinned resources.
- **Smart URL Type Auto-Detection**: Automatically identifies resource types (PDF, Google Drive, YouTube, Web Link) upon paste.

### 4. 👨‍🎓 Student Workspace (`/student/*`)
- **Student Dashboard**: Live attendance summary badge, course progress, and recent announcements.
- **Resource Center**: Access pinned study notes, downloadable PDFs, and embedded video lectures.
- **Task & Submissions Portal**: Submit project links and view feedback from educators.
- **Digital ID Card**: Interactive ID card with generated QR code for live attendance scanning.

### 5. 🛡️ Executive Admin Dashboard (`/admin/dashboard`)
- **High-Level Metrics**: Active enrollment stats, overall attendance %, upcoming schedule, and recent submissions.
- **WhatsApp Attendance Broadcast Generator**: Generates formatted daily attendance summaries ready for one-click WhatsApp sharing.

---

## 🛠️ Technology Stack

| Layer | Technology Used |
| :--- | :--- |
| **Frontend Framework** | React 18 (Hooks, Context API, `useMemo`, `useCallback`) |
| **Build Tool & HMR** | Vite 6 |
| **Styling & UI** | Tailwind CSS 4, Lucide React Icons |
| **Backend & Database** | Firebase Firestore (Realtime Listeners & Queries) |
| **Authentication** | Firebase Auth (Email/Password & Role-based Access Control) |
| **Progressive Web App** | Vite PWA Plugin (`vite-plugin-pwa`), Workbox Service Worker |
| **Export Utilities** | Custom CSV Exporter (`utils/csvExport.js`) |

---

## 📁 Repository Directory Structure

```
digispire-app/
├── public/                     # Static branding assets, logo, manifest
├── src/
│   ├── components/             # Reusable UI components (AttendanceCalendar, Modals, Navbar)
│   ├── context/                # React AuthContext & Global State Providers
│   ├── layouts/                # AdminLayout, StudentLayout, AuthLayout
│   ├── pages/                  # Page Views
│   │   ├── admin/              # Admin pages (Attendance, Content, Completion, Staff, Students)
│   │   ├── student/            # Student pages (Dashboard, Content, Submissions, Profile)
│   │   └── Auth/               # Login, Register, Password Reset
│   ├── utils/                  # Attendance calculation engine, CSV export, Haptic feedback
│   ├── App.jsx                 # Central Application Router & Role Protection
│   ├── firebase.js             # Firebase Service Initialization
│   └── main.jsx                # Application Entry Point & Service Worker Registration
├── index.html                  # HTML5 Shell
├── vite.config.js              # Vite & PWA Build Configuration
└── package.json                # Project Dependencies & Scripts
```

---

## 🚀 Quick Start Guide

### Prerequisites
- **Node.js**: `v18.0.0` or higher
- **npm**: `v9.0.0` or higher
- **Firebase Project**: Firestore Database & Auth enabled

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/ABVicky/Digispire-Academy.git
cd Digispire-Academy/digispire-app
npm install
```

### 2. Configure Firebase Environment
Create or edit `src/firebase.js` with your Firebase web app configuration keys:

```javascript
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.firebasestorage.app",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
```

### 3. Run Development Server
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### 4. Build for Production
```bash
npm run build
```
The optimized production bundle will be generated in the `dist/` directory.

---

## 📊 Firestore Database Schema Overview

- **`users`**: Contains user profiles, roles (`admin`, `educator`, `student`), batch assignments, mentor IDs, and joining dates.
- **`courses`**: Course metadata, track names, duration in days.
- **`modules`**: Curriculum modules linked to `courseId`.
- **`topics`**: Topic credits linked to `moduleId` and array of `completedStudents`.
- **`content`**: Resource library items (URLs, types, subjects, `isPinned`, click counts).
- **`attendance`**: Daily attendance records (`studentId`, `date`, `status`, `coveredCourse`, `coveredModule`).
- **`batches`**: Batch schedule configurations, timings, active days.
- **`qr_sessions`**: Active live QR broadcaster verification tokens.

---

## 📱 Mobile Responsiveness & PWA Support

Digispire Academy is **100% mobile-responsive** across smartphones, tablets, and desktop displays:
- **Mobile Stacked Cards View**: Data tables automatically switch to touch-friendly card layouts on mobile viewports (`< 768px`).
- **Offline PWA**: Full offline caching capabilities using Vite PWA and Workbox service workers.

---

## 📄 License
Distributed under the **MIT License**. See `LICENSE` for details.

---
*Maintained with ❤️ for Digispire Academy.*
