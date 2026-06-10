# 🌿 VitalSync

**VitalSync** is a comprehensive, React Native-based mobile health and wellness application designed to centralize personal medical data, track daily wellness scores, and provide immediate access to essential health utilities. 

Built with a focus on modern UI/UX design and strict data security, VitalSync leverages Google Cloud and Firebase to ensure a seamless and protected experience for users managing their health journey.

## ✨ Core Features
* **Wellness Dashboard:** A dynamic, visual summary of your daily health metrics and overall wellness score.
* **Medicine Reminder:** Intelligent notifications to help users stay on track with their prescribed schedules.
* **Emergency Blood Network:** A rapid-response feature designed to connect users for emergency blood donations.
* **Mental Health Check-In:** Dedicated tools to monitor emotional well-being and provide supportive care routines.
* **Rural Health Assistant:** Offline-capable support tailored to provide essential health guidance to users in remote or Tier-2/Tier-3 areas.
* **Secure Authentication:** Seamless onboarding using Firebase Authentication and Google Sign-In.

## 🛠️ Tech Stack
* **Framework:** React Native (Expo)
* **Backend as a Service (BaaS):** Firebase (Authentication, Firestore, Storage)
* **Cloud Build:** Expo Application Services (EAS)
* **Version Control:** Git / GitHub (Private Repository)

## 🚀 Getting Started

### Prerequisites
* Node.js and npm installed.
* Expo CLI (`npm install -g expo-cli`).
* An active Firebase project with Android/Web apps registered.

### Local Installation
1. Clone the repository:
   ```bash
   git clone [https://github.com/fayizulrahuman/VitalSync.git](https://github.com/fayizulrahuman/VitalSync.git)
   cd VitalSync
### Install dependencies:

`npm install`

Set up your environment variables. Create a `.env` file in the root directory and add your Firebase credentials:

`EXPO_PUBLIC_FIREBASE_API_KEY=your_api_key`

`EXPO_PUBLIC_AUTH_DOMAIN=your_auth_domain`

`EXPO_PUBLIC_PROJECT_ID=your_project_id`

`EXPO_PUBLIC_STORAGE_BUCKET=your_storage_bucket`

`EXPO_PUBLIC_MESSAGING_SENDER_ID=your_messaging_sender_id`

`EXPO_PUBLIC_APP_ID=your_app_id`

`EXPO_PUBLIC_WEB_CLIENT_ID=your_web_client_id`

`EXPO_PUBLIC_ANDROID_CLIENT_ID=your_android_client_id`

Start the local development server:

`npx expo start`

## 📦 Building for Production
This project is configured for cloud compilation using Expo EAS. Sensitive keys are injected dynamically via EAS Secrets, ensuring they are never exposed in the source code.

Ensure your EAS environment variables are set via the CLI:

`eas env:create`

Run the Android build:

`eas build --platform android --profile preview`

## 🎨 UI/UX Design Notes
Features a custom, pure white splash screen tailored to bypass Android 12+ dark mode caching issues.

Incorporates modern, soft-glassmorphism elements and a clean, accessible color palette to reduce cognitive load during health emergencies.

## 👤 Author
Developed and maintained by Fayizul Rahuman.


---
