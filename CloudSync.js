import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebaseConfig';

// List of all the local keys we want to back up
const VITAL_KEYS = [
  '@vital_user_name', 
  '@vital_user_age', 
  '@vital_user_bg', 
  '@vital_health_id',
  '@vital_sync_weight', 
  '@vital_sync_step_goal', 
  '@vital_sync_hr', 
  '@vital_sync_spo2',
  '@vital_sync_emergency_contacts',
  '@vital_sync_journals',
  '@vital_sync_symptoms',
  '@vital_sync_donors_full',
  '@vital_sync_streak',         
  '@vital_sync_streak_date',
  '@vital_sync_today_mood',
  '@vital_sync_meds',
  '@vital_user_avatar'
];

// 1. PULL FROM CLOUD (Used when logging in)
export const restoreDataFromCloud = async (uid) => {
  try {
    const docRef = doc(db, 'users', uid);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const cloudData = docSnap.data();
      
      // Loop through cloud data and save it locally
      const storagePromises = Object.keys(cloudData).map(key => 
        AsyncStorage.setItem(key, String(cloudData[key]))
      );
      
      await Promise.all(storagePromises);
      console.log("Data successfully restored from cloud!");
      return true;
    } else {
      console.log("No cloud backup found for this user.");
      return false;
    }
  } catch (error) {
    console.error("Error restoring data:", error);
    return false;
  }
};

// 2. PUSH TO CLOUD (Used when saving data)
export const backupDataToCloud = async (uid) => {
  if (!uid) return;
  
  try {
    let currentData = {};
    
    // Read all relevant data from AsyncStorage
    for (let key of VITAL_KEYS) {
      const val = await AsyncStorage.getItem(key);
      if (val !== null) currentData[key] = val;
    }

    currentData.lastUpdated = new Date().toISOString();

    // Push it all to Firestore under their unique User ID
    const docRef = doc(db, 'users', uid);
    await setDoc(docRef, currentData, { merge: true });
    
    console.log("Data silently backed up to cloud!");
  } catch (error) {
    console.error("Error backing up data:", error);
  }
};