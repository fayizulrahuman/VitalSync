import React, { createContext, useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';

export const MedicineContext = createContext();

export const MedicineProvider = ({ children }) => {
  const [medicines, setMedicines] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [alertConfig, setAlertConfig] = useState(null);

  const showAlert = (title, message, type = 'info', buttons = []) => {
    setAlertConfig({ title, message, type, buttons });
  };
  const closeAlert = () => setAlertConfig(null);

  useEffect(() => {
    const loadMedicines = async () => {
      try {
        // Request Notification Permissions on load
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        if (existingStatus !== 'granted') {
          await Notifications.requestPermissionsAsync();
        }

        const storedMeds = await AsyncStorage.getItem('@vital_sync_meds');
        if (storedMeds) {
          const parsed = JSON.parse(storedMeds);
          const migrated = parsed.map(m => {
            if (!m.times) return { ...m, times: [{ id: 'legacy', label: 'Dose', time: m.time, hour: m.hour, minute: m.minute }] };
            return m;
          });
          setMedicines(migrated);
        }
      } catch (error) {
        console.error("Failed to load medicines", error);
      } finally {
        setIsLoaded(true);
      }
    };
    loadMedicines();
  }, []);

  useEffect(() => {
    if (isLoaded) {
      AsyncStorage.setItem('@vital_sync_meds', JSON.stringify(medicines));
    }
  }, [medicines, isLoaded]);

  const lowStockMedicines = medicines.filter(med => med.remainingQuantity <= 5);

  // --- NATIVE NOTIFICATION SCHEDULER ---
  const addMedicine = async (newMed) => {
    // 1. Schedule Native Push Notifications for every time slot
    let updatedTimes = [];
    for (let timeSlot of newMed.times) {
      let notifId = null;
      try {
        notifId = await Notifications.scheduleNotificationAsync({
          content: {
            title: "💊 Time for your medicine!",
            body: `Please take your ${newMed.dosage} of ${newMed.medName} (${newMed.timing}).`,
            sound: true,
          },
          trigger: {
            hour: timeSlot.hour,
            minute: timeSlot.minute,
            repeats: true, // Rings every day at this exact time!
          },
        });
      } catch (e) {
        console.log("Notif Error", e);
      }
      updatedTimes.push({ ...timeSlot, notificationId: notifId });
    }

    const medWithNotifs = { ...newMed, times: updatedTimes };
    setMedicines(prev => [...prev, medWithNotifs]);
    showAlert("Success", `${newMed.medName} added! We will notify you when it's time.`, 'success');
  };

  const deleteMedicine = async (id) => {
    const medToDelete = medicines.find(m => m.id === id);
    if (medToDelete) {
      // 2. Cancel the native alarms so they don't ring after deletion
      for (let timeSlot of medToDelete.times) {
        if (timeSlot.notificationId) {
          await Notifications.cancelScheduledNotificationAsync(timeSlot.notificationId);
        }
      }
    }
    setMedicines(prev => prev.filter(med => med.id !== id));
    showAlert("Deleted", "Medicine and its reminders have been successfully removed.", 'error');
  };

  const markAsTaken = (id, timeSlotId) => {
    const today = new Date().toDateString();
    const historyKey = `${today}-${timeSlotId}`;

    setMedicines(prev => prev.map(med => {
      if (med.id === id) {
        if (med.history.includes(historyKey)) return med; 
        return {
          ...med,
          remainingQuantity: med.remainingQuantity > 0 ? med.remainingQuantity - 1 : 0, 
          history: [...med.history, historyKey] 
        };
      }
      return med;
    }));
  };

  return (
    <MedicineContext.Provider value={{ medicines, lowStockMedicines, addMedicine, deleteMedicine, markAsTaken, showAlert }}>
      {children}
      <Modal transparent visible={!!alertConfig} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={[styles.iconWrap, 
              alertConfig?.type === 'success' && {backgroundColor: '#E8F5E9'},
              alertConfig?.type === 'error' && {backgroundColor: '#FFEBEE'},
              alertConfig?.type === 'warning' && {backgroundColor: '#FFF3E0'},
              alertConfig?.type === 'info' && {backgroundColor: '#F4F7FF'}
            ]}>
              <Ionicons 
                name={
                  alertConfig?.type === 'success' ? "checkmark-circle" :
                  alertConfig?.type === 'error' ? "trash" :
                  alertConfig?.type === 'warning' ? "alarm" : "information-circle"
                } 
                size={36} 
                color={
                  alertConfig?.type === 'success' ? "#34C759" :
                  alertConfig?.type === 'error' ? "#FF3B30" :
                  alertConfig?.type === 'warning' ? "#FF9500" : "#5E5CE6"
                } 
              />
            </View>
            <Text style={styles.modalTitle}>{alertConfig?.title}</Text>
            <Text style={styles.modalMessage}>{alertConfig?.message}</Text>
            <View style={styles.buttonRow}>
              {!alertConfig?.buttons || alertConfig?.buttons.length === 0 ? (
                <TouchableOpacity style={styles.primaryBtn} onPress={closeAlert}>
                  <Text style={styles.primaryBtnText}>Got it</Text>
                </TouchableOpacity>
              ) : (
                alertConfig.buttons.map((btn, index) => (
                  <TouchableOpacity key={index} style={[styles.btnBase, btn.style === 'cancel' ? styles.secondaryBtn : (btn.style === 'destructive' ? styles.destructiveBtn : styles.primaryBtn), index > 0 && { marginLeft: 12 }]} onPress={() => { if (btn.onPress) btn.onPress(); closeAlert(); }}>
                    <Text style={[styles.btnTextBase, btn.style === 'cancel' ? styles.secondaryBtnText : styles.primaryBtnText]}>{btn.text}</Text>
                  </TouchableOpacity>
                ))
              )}
            </View>
          </View>
        </View>
      </Modal>
    </MedicineContext.Provider>
  );
};

const styles = StyleSheet.create({
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  modalCard: { width: '85%', backgroundColor: '#FFFFFF', borderRadius: 32, padding: 24, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 10 },
  iconWrap: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 22, fontWeight: '800', color: '#1C1C1E', marginBottom: 8, textAlign: 'center' },
  modalMessage: { fontSize: 15, color: '#636366', textAlign: 'center', marginBottom: 24, lineHeight: 22 },
  buttonRow: { flexDirection: 'row', width: '100%', justifyContent: 'space-between' },
  btnBase: { flex: 1, paddingVertical: 16, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  btnTextBase: { fontSize: 15, fontWeight: '800' },
  primaryBtn: { backgroundColor: '#5E5CE6', shadowColor: '#5E5CE6', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  primaryBtnText: { color: '#FFFFFF' },
  secondaryBtn: { backgroundColor: '#F4F7FF' },
  secondaryBtnText: { color: '#5E5CE6' },
  destructiveBtn: { backgroundColor: '#FF3B30', shadowColor: '#FF3B30', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
});