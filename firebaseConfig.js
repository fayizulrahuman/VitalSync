import { initializeApp, getApp, getApps } from 'firebase/app';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

// 1. Replace with your actual Firebase project keys
const firebaseConfig = {
  apiKey: "AIzaSyCMmzLx_C9lp4MoEcpagjTAWna3TWV8pjQ",
  authDomain: "vital-sync-9525e.firebaseapp.com",
  projectId: "vital-sync-9525e",
  storageBucket: "vital-sync-9525e.firebasestorage.app",
  messagingSenderId: "220826507850",
  appId: "1:220826507850:web:48597f7f58d12b401764b3"
};


// 2. Safely initialize the app to prevent duplicate errors
let app;
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

// 3. Initialize Auth with AsyncStorage persistence
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});

export { auth };