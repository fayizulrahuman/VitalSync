import React, { useState, useContext, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Vibration } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { MedicineContext } from '../context/MedicineContext';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function MedicineDetailsScreen({ route, navigation }) {
  const { medicines, markAsTaken, deleteMedicine, showAlert } = useContext(MedicineContext);
  
  const pillId = route.params?.pillId;
  const timeId = route.params?.timeId;

  const pillData = medicines.find(m => m.id === pillId);
  const timeSlot = pillData?.times.find(t => t.id === timeId) || pillData?.times[0];

  // 1. Dedicated State for the Toggle and Notification ID
  const [isReminderOn, setIsReminderOn] = useState(false);
  const [notificationId, setNotificationId] = useState(null);

  useEffect(() => {
    // 2. Load the actual saved state for THIS specific pill and time
    const loadReminderState = async () => {
      if (!pillData || !timeSlot) return;
      
      const storageKey = `@reminder_state_${pillData.id}_${timeSlot.id}`;
      const idKey = `@reminder_id_${pillData.id}_${timeSlot.id}`;
      
      const savedState = await AsyncStorage.getItem(storageKey);
      const savedId = await AsyncStorage.getItem(idKey);
      
      if (savedState !== null) {
        setIsReminderOn(JSON.parse(savedState));
      } else {
        // Default to ON if never set
        setIsReminderOn(true); 
      }
      
      if (savedId) {
        setNotificationId(savedId);
      }
    };
    loadReminderState();
  }, [pillData, timeSlot]);

  if (!pillData || !timeSlot) {
    return <View style={styles.safeArea}><Text style={{textAlign: 'center', marginTop: 50}}>Pill not found</Text></View>;
  }

  const todayStr = new Date().toDateString();
  const historyKey = `${todayStr}-${timeSlot.id}`;
  const isCompleted = pillData.history.includes(historyKey);

  const handleDelete = () => {
    showAlert("Delete Medicine", `Are you sure you want to completely remove ${pillData.medName}?`, "error", [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => {
            deleteMedicine(pillData.id);
            navigation.goBack();
        }}
    ]);
  };

  const handleTake = () => markAsTaken(pillData.id, timeSlot.id);

  // 3. The actual scheduling function that calculates the precise time
  const scheduleMedicineNotification = async (medName, timeString) => {
    try {
      const now = new Date();
      const targetTime = new Date();
      
      const [timeStr, period] = timeString.split(' ');
      let [hours, minutes] = timeStr.split(':').map(Number);
      
      if (period === 'PM' && hours < 12) hours += 12;
      if (period === 'AM' && hours === 12) hours = 0;
      
      targetTime.setHours(hours, minutes, 0, 0); 
      
      if (targetTime <= now) {
        targetTime.setDate(targetTime.getDate() + 1);
      }
      
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: "💊 Time for Medication",
          body: `Please take your ${pillData.dosage} of ${medName}.`,
          sound: true,
        },
        trigger: {
          date: targetTime,
          channelId: 'medicine-reminders', // Ensure this channel is created in App.js
        },
      });
      
      return id;
    } catch (error) {
      console.error("Failed to schedule notification:", error);
      return null;
    }
  };

  // 4. The dedicated Toggle Handler
  const handleToggleChange = async (newValue) => {
    setIsReminderOn(newValue); 
    
    const storageKey = `@reminder_state_${pillData.id}_${timeSlot.id}`;
    const idKey = `@reminder_id_${pillData.id}_${timeSlot.id}`;
    
    await AsyncStorage.setItem(storageKey, JSON.stringify(newValue));

    if (newValue === true) {
      // User turned it ON
      const newId = await scheduleMedicineNotification(pillData.medName, timeSlot.time);
      if (newId) {
        setNotificationId(newId);
        await AsyncStorage.setItem(idKey, newId);
        showAlert("Reminder Set", `We'll remind you at ${timeSlot.time}`, "success");
      }
    } else {
      // User turned it OFF
      if (notificationId) {
        await Notifications.cancelScheduledNotificationAsync(notificationId);
        setNotificationId(null);
        await AsyncStorage.removeItem(idKey);
      }
      // No alert shown when turning off for a cleaner UX
    }
  };

  const renderHistory = () => {
    const days = [];
    for (let i = 0; i < 5; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateString = d.toDateString(); 
      const isTaken = pillData.history.includes(`${dateString}-${timeSlot.id}`);
      
      days.unshift(
        <HistoryDay 
          key={i} 
          day={d.toLocaleDateString('en-US', {weekday: 'short'})} 
          date={`${d.getDate()} ${d.toLocaleDateString('en-US', {month: 'short'})}`} 
          status={isTaken ? 'taken' : (i === 0 && !isCompleted ? 'pending' : 'missed')} 
        />
      );
    }
    return days;
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color="#1C1C1E" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Medication Details</Text>
          <Text style={styles.headerSubtitle}>Know your medicine, stay safe.</Text>
        </View>
        <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}><Ionicons name="trash-outline" size={20} color="#FF3B30" /></TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={styles.imagePlaceholder}>
               <MaterialCommunityIcons name="pill" size={60} color="#5E5CE6" />
            </View>
            <View style={styles.heroInfo}>
              <Text style={styles.medName}>{pillData.medName}</Text>
              <Text style={styles.medDosage}>{pillData.dosage}</Text>
              <View style={styles.timeBadgeRow}>
                <View style={styles.timeBadge}>
                  <Ionicons name="time-outline" size={16} color="#5E5CE6" style={{marginRight: 4}} />
                  <Text style={styles.timeBadgeText}>{timeSlot.time}</Text>
                </View>
                <View style={styles.freqBadge}>
                  <Ionicons name="sunny-outline" size={16} color="#5E5CE6" style={{marginRight: 4}} />
                  <Text style={styles.freqBadgeText}>{timeSlot.label}</Text>
                </View>
              </View>
            </View>
          </View>
          <View style={styles.infoBanner}>
            <Ionicons name="information-circle-outline" size={20} color="#5E5CE6" style={{marginTop: 2}} />
            <View style={styles.infoBannerTextWrap}>
              <Text style={styles.infoBannerTitle}>Stock Status</Text>
              <Text style={styles.infoBannerSub}>You have {pillData.remainingQuantity} doses left out of {pillData.totalQuantity}.</Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <MaterialCommunityIcons name="clipboard-text-outline" size={20} color="#1C1C1E" />
            <Text style={styles.cardTitle}>How to Take</Text>
          </View>
          <View style={styles.howToTakeRow}>
            <View style={{flex: 1}}>
              <Text style={styles.bodyText}>Take {pillData.dosage.toLowerCase()} with water {pillData.timing.toLowerCase()}.</Text>
              <Text style={styles.bodyText}>Do not crush or chew.</Text>
            </View>
            <Ionicons name="water-outline" size={40} color="#8E8E93" style={{marginLeft: 15}} />
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="notifications-outline" size={20} color="#5E5CE6" />
            <Text style={[styles.cardTitle, {color: '#5E5CE6'}]}>Reminders</Text>
          </View>
          <Text style={[styles.bodyTextSmall, {marginBottom: 15}]}>We'll remind you before it's time.</Text>
          
          <View style={styles.toggleRow}>
            <View style={{flexDirection: 'row', alignItems: 'center'}}>
              <Ionicons name="time-outline" size={18} color="#1C1C1E" style={{marginRight: 8}} />
              <Text style={styles.toggleLabel}>Daily Notifications {isReminderOn ? 'On' : 'Off'}</Text>
            </View>
            {/* 5. Attach the new handler to the switch */}
            <Switch 
              value={isReminderOn} 
              onValueChange={handleToggleChange}
              trackColor={{ false: '#E5E5EA', true: '#5E5CE6' }}
              thumbColor={'#FFFFFF'}
            />
          </View>
        </View>

        <View style={styles.card}>
          <View style={[styles.cardHeader, {justifyContent: 'space-between'}]}>
            <View style={{flexDirection: 'row', alignItems: 'center'}}>
              <Ionicons name="time-outline" size={20} color="#5E5CE6" />
              <Text style={[styles.cardTitle, {color: '#1C1C1E'}]}>History</Text>
            </View>
          </View>
          <View style={styles.historyRow}>
            {renderHistory()}
          </View>
        </View>

      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity 
          style={[styles.primaryBtn, isCompleted && {backgroundColor: '#34C759'}]} 
          onPress={handleTake}
          disabled={isCompleted}
        >
          <Ionicons name="checkmark" size={24} color="#FFFFFF" style={{marginRight: 8}} />
          <Text style={styles.primaryBtnText}>{isCompleted ? "Taken" : "I've Taken It"}</Text>
        </TouchableOpacity>
        
        {!isCompleted && (
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => showAlert("Snoozed", "We will remind you again in 15 minutes.", "info")}>
            <Ionicons name="notifications-outline" size={18} color="#5E5CE6" style={{marginRight: 8}} />
            <Text style={styles.secondaryBtnText}>Remind Me Later</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const HistoryDay = ({ day, date, status }) => {
  const isTaken = status === 'taken';
  const isMissed = status === 'missed';
  let color = '#E5E5EA'; 
  if (isTaken) color = '#34C759';
  if (isMissed) color = '#FF3B30';

  return (
    <View style={styles.historyItem}>
      <Text style={styles.historyDay}>{day}</Text>
      <Text style={styles.historyDate}>{date}</Text>
      <View style={[styles.historyDot, { backgroundColor: color }]}>
        <Ionicons name={isTaken ? "checkmark" : (isMissed ? "close" : "time-outline")} size={14} color="#FFFFFF" />
      </View>
      <Text style={[styles.historyStatus, { color: color }]}>
        {isTaken ? 'Taken' : (isMissed ? 'Missed' : 'Pending')}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8F9FF' },
  scrollContent: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 150 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingHorizontal: 20 },
  iconButton: { width: 44, height: 44, backgroundColor: '#FFFFFF', borderRadius: 22, justifyContent: 'center', alignItems: 'center', shadowColor: '#000000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 3 },
  deleteButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 11, paddingVertical: 11, borderRadius: 25, borderWidth: 1.5, borderColor: '#FFE5E5', backgroundColor: '#FFF0F0' },

  headerTitleContainer: { alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#1C1C1E', marginBottom: 2 },
  headerSubtitle: { fontSize: 13, color: '#8E8E93' },
  heroCard: { backgroundColor: '#EAEBFF', borderRadius: 24, padding: 20, marginBottom: 15, borderWidth: 1, borderColor: '#FFFFFF' },
  heroTopRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  imagePlaceholder: { width: 120, height: 120, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  heroInfo: { flex: 1 },
  medName: { fontSize: 24, fontWeight: '800', color: '#1C1C1E', marginBottom: 4 },
  medDosage: { fontSize: 16, color: '#636366', marginBottom: 12 },
  timeBadgeRow: { flexDirection: 'row', alignItems: 'center' },
  timeBadge: { flexDirection: 'row', alignItems: 'center', marginRight: 12 },
  timeBadgeText: { fontSize: 15, fontWeight: '700', color: '#5E5CE6' },
  freqBadge: { flexDirection: 'row', alignItems: 'center' },
  freqBadgeText: { fontSize: 13, color: '#636366' },
  infoBanner: { flexDirection: 'row', backgroundColor: '#FFFFFF', padding: 15, borderRadius: 16 },
  infoBannerTextWrap: { flex: 1, marginLeft: 10 },
  infoBannerTitle: { fontSize: 13, fontWeight: '700', color: '#1C1C1E', marginBottom: 2 },
  infoBannerSub: { fontSize: 12, color: '#636366', lineHeight: 18 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, marginBottom: 15, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 10, elevation: 2 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  cardTitle: { fontSize: 16, fontWeight: '800', color: '#1C1C1E', marginLeft: 8 },
  bodyText: { fontSize: 14, color: '#48484A', lineHeight: 22, marginBottom: 4 },
  bodyTextSmall: { fontSize: 13, color: '#48484A', lineHeight: 20 },
  howToTakeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F8F9FF', padding: 12, borderRadius: 16 },
  toggleLabel: { fontSize: 14, fontWeight: '500', color: '#1C1C1E' },
  viewAllText: { fontSize: 13, fontWeight: '700', color: '#5E5CE6', marginRight: 4 },
  historyRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  historyItem: { alignItems: 'center', backgroundColor: '#F8F9FF', paddingVertical: 12, paddingHorizontal: 8, borderRadius: 12, width: '19%' },
  historyDay: { fontSize: 12, fontWeight: '600', color: '#1C1C1E', marginBottom: 2 },
  historyDate: { fontSize: 10, color: '#8E8E93', marginBottom: 8 },
  historyDot: { width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
  historyStatus: { fontSize: 10, fontWeight: '600' },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 20, paddingVertical: 15, backgroundColor: '#F8F9FF' },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#5E5CE6', paddingVertical: 16, borderRadius: 20, marginBottom: 10, shadowColor: '#5E5CE6', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 5 } },
  primaryBtnText: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  secondaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', paddingVertical: 16, borderRadius: 20, borderWidth: 1, borderColor: '#E5EDFF' },
  secondaryBtnText: { color: '#5E5CE6', fontSize: 16, fontWeight: '700' },
});