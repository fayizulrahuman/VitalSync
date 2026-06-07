import React, { useContext, useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import { MedicineContext } from '../context/MedicineContext';

export default function RemindersScreen({ navigation }) {
  const { medicines, lowStockMedicines, markAsTaken, showAlert } = useContext(MedicineContext);
  const [nextDose, setNextDose] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Flattens the medicines array so each time slot is its own distinct item in the list
  const allScheduleItems = medicines.flatMap(med => 
    med.times.map(timeSlot => ({ ...med, timeSlot }))
  );

  useEffect(() => {
    if (allScheduleItems.length === 0) {
      setNextDose(null);
      return;
    }
    const todayStr = currentTime.toDateString();
    const currentMins = currentTime.getHours() * 60 + currentTime.getMinutes();

    let upcomingMeds = allScheduleItems.filter(item => !item.history.includes(`${todayStr}-${item.timeSlot.id}`));
    
    if (upcomingMeds.length === 0) {
      setNextDose(null); 
      return;
    }

    upcomingMeds.sort((a, b) => (a.timeSlot.hour * 60 + a.timeSlot.minute) - (b.timeSlot.hour * 60 + b.timeSlot.minute));
    let next = upcomingMeds.find(item => (item.timeSlot.hour * 60 + item.timeSlot.minute) >= currentMins);
    if (!next) next = upcomingMeds[0];

    setNextDose(next);
  }, [medicines, currentTime]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color="#1C1C1E" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Medicine Reminder</Text>
          <Text style={styles.headerSubtitle}>Stay on track, stay healthy.</Text>
        </View>
        <View style={{ width: 44 }}></View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {nextDose ? (
          <View style={styles.heroCard}>
            <View style={styles.heroTopRow}>
              <View style={styles.heroLeft}>
                <View style={styles.timeBadgeRow}>
                  <View style={styles.clockIconBox}>
                    <Ionicons name="time" size={18} color="#FFFFFF" />
                  </View>
                  <Text style={styles.nextDoseLabel}>Next Dose</Text>
                </View>
                <Text style={styles.heroTime}>{nextDose.timeSlot.time}</Text>
                <Text style={styles.heroMedName}>{nextDose.medName}</Text>
                <Text style={styles.heroDosage}>{nextDose.dosage} ({nextDose.timeSlot.label})</Text>
              </View>
              <View style={styles.heroImagePlaceholder}>
                 <Text style={{color: '#8E8E93', fontSize: 10, textAlign: 'center'}}>3D Asset</Text>
              </View>
            </View>
            <View style={styles.heroBannerCard}>
              <View style={styles.heroBannerIconWrap}>
                <Ionicons name="notifications-outline" size={16} color="#5E5CE6" />
              </View>
              <Text style={styles.heroBannerText}>We'll remind you 10 mins before</Text>
            </View>
          </View>
        ) : (
          <View style={[styles.heroCard, { alignItems: 'center', paddingVertical: 40 }]}>
            <Ionicons name="checkmark-circle" size={64} color="#34C759" style={{marginBottom: 10}}/>
            <Text style={styles.heroTime}>All Caught Up!</Text>
            <Text style={styles.heroSubtitle}>You've taken all your medicines for today.</Text>
          </View>
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Today's Schedule</Text>
        </View>

        <View style={styles.scheduleList}>
          {allScheduleItems.length === 0 ? (
            <Text style={{textAlign: 'center', color: '#8E8E93', marginTop: 20}}>No medicines added yet.</Text>
          ) : (
            allScheduleItems
              .sort((a, b) => (a.timeSlot.hour * 60 + a.timeSlot.minute) - (b.timeSlot.hour * 60 + b.timeSlot.minute))
              .map((item) => (
                <ScheduleItem 
                  key={`${item.id}-${item.timeSlot.id}`} 
                  data={item} 
                  currentTime={currentTime}
                  markAsTaken={() => markAsTaken(item.id, item.timeSlot.id)} 
                  showAlert={showAlert}
                />
            ))
          )}
        </View>

        <View style={styles.refillCard}>
          <View style={styles.refillImagePlaceholder}>
            <MaterialCommunityIcons name="shopping" size={32} color="#5E5CE6" />
          </View>
          <View style={styles.refillTextContainer}>
            <Text style={styles.refillTitle}>Refill Reminder</Text>
            <Text style={styles.refillSub}>{lowStockMedicines.length} medicines are running low</Text>
            <TouchableOpacity style={styles.orderNowBtn} onPress={() => showAlert("Pharmacy", "Connecting to nearest pharmacy...", "info")}>
              <Text style={styles.orderNowText}>Order Now</Text>
              <Ionicons name="chevron-forward" size={14} color="#5E5CE6" />
            </TouchableOpacity>
          </View>

          <View style={styles.refillRingContainer}>
            <Svg width="64" height="64" viewBox="0 0 64 64">
              <Circle cx="32" cy="32" r="28" stroke="#F4F7FF" strokeWidth="6" fill="none" />
              <Circle 
                cx="32" 
                cy="32" 
                r="28" 
                stroke="#5E5CE6" 
                strokeWidth="6" 
                fill="none" 
                strokeDasharray="176" 
                strokeDashoffset={medicines.length === 0 ? 176 : 176 - (176 * (lowStockMedicines.length / medicines.length))} 
                strokeLinecap="round" 
              />
            </Svg>
            <View style={styles.refillRingText}>
              <Text style={styles.ringValue}>{lowStockMedicines.length}<Text style={styles.ringTotal}>/{medicines.length}</Text></Text>
              <Text style={styles.ringLabel}>Low Stock</Text>
            </View>
          </View>
        </View>

        <View style={styles.tipCard}>
          <View style={styles.tipImagePlaceholder}>
            <Ionicons name="shield-checkmark" size={28} color="#34C759" />
          </View>
          <View style={styles.tipTextContainer}>
            <Text style={styles.tipTitle}>Health Tip</Text>
            <Text style={styles.tipSub}>Taking your medicines on time helps you recover faster.</Text>
          </View>
          <TouchableOpacity style={styles.learnMoreBtn} onPress={() => showAlert("Health Tip", "Consistent timing maintains the drug level in your body, improving effectiveness and reducing side effects.", "info")}>
            <Text style={styles.learnMoreText}>Learn More</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('AddMedicine')}>
        <Ionicons name="add" size={32} color="#FFFFFF" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const ScheduleItem = ({ data, currentTime, markAsTaken, showAlert }) => {
  const navigation = useNavigation();
  
  const todayStr = currentTime.toDateString();
  const currentMins = currentTime.getHours() * 60 + currentTime.getMinutes();
  const medMins = data.timeSlot.hour * 60 + data.timeSlot.minute;

  const isCompleted = data.history.includes(`${todayStr}-${data.timeSlot.id}`);
  const isUpcoming = !isCompleted && medMins > currentMins;
  const isActive = !isCompleted && !isUpcoming;

  return (
    <TouchableOpacity 
      activeOpacity={0.8} 
      style={[styles.scheduleItem, isActive && styles.scheduleItemActive]}
      // Pass both IDs so Details Screen knows EXACTLY which time slot to show!
      onPress={() => navigation.navigate('MedicineDetails', { pillId: data.id, timeId: data.timeSlot.id })}
    >
      <View style={styles.timeColumn}>
        <Text style={[styles.timeText, isActive && styles.timeTextActive, isUpcoming && styles.timeTextUpcoming]}>{data.timeSlot.time}</Text>
        <View style={styles.statusRow}>
          <Ionicons 
            name={isCompleted ? "checkmark-circle" : "time-outline"} 
            size={14} 
            color={isCompleted ? "#34C759" : (isUpcoming ? "#5E5CE6" : "#FF9500")} 
          />
          <Text style={[
            styles.statusText, 
            isCompleted && styles.statusTextCompleted,
            isUpcoming && styles.statusTextUpcoming,
            isActive && styles.statusTextPending
          ]}>
            {isCompleted ? 'Completed' : (isUpcoming ? 'Upcoming' : 'Pending')}
          </Text>
        </View>
      </View>

      <View style={styles.pillImagePlaceholder}>
        <MaterialCommunityIcons name="pill" size={28} color="#C7C7CC" />
      </View>

      <View style={styles.medInfoColumn}>
        <Text style={styles.medName}>{data.medName}</Text>
        <Text style={styles.medDesc}>{data.dosage}</Text>
        <Text style={styles.medDesc}>{data.timeSlot.label}</Text>
      </View>

      <View style={styles.actionColumn}>
        {isActive && (
          <TouchableOpacity style={styles.activeBtn} onPress={markAsTaken}>
            <Ionicons name="checkmark" size={16} color="#FFFFFF" style={{marginRight: 4}} />
            <Text style={styles.activeBtnText}>Take</Text>
          </TouchableOpacity>
        )}
        
        {isUpcoming && (
          <TouchableOpacity style={styles.upcomingBtn} onPress={() => showAlert("Reminder Set", "We will notify you when it's time.", "success")}>
            <Ionicons name="notifications-outline" size={14} color="#5E5CE6" style={{marginRight: 4}} />
            <Text style={styles.upcomingBtnText}>Remind Me</Text>
          </TouchableOpacity>
        )}

        {isCompleted && (
          <View style={styles.completedBtnRow}>
            <View style={styles.completedCheckCircle}>
              <Ionicons name="checkmark" size={14} color="#FFFFFF" />
            </View>
            <Ionicons name="chevron-forward" size={20} color="#C7C7CC" style={{marginLeft: 8}} />
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8F9FF' },
  scrollContent: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 100 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
  iconButton: { width: 44, height: 44, backgroundColor: '#FFFFFF', borderRadius: 22, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 3 , marginLeft: 20 },
  headerTitleContainer: { alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#1C1C1E', marginBottom: 2 },
  headerSubtitle: { fontSize: 13, color: '#8E8E93' },
  heroCard: { backgroundColor: '#FFFFFF', borderRadius: 28, padding: 20, marginBottom: 30, shadowColor: '#5E5CE6', shadowOpacity: 0.08, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 6, borderWidth: 1, borderColor: '#FFFFFF' },
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  heroLeft: { flex: 1 },
  timeBadgeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  clockIconBox: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#5E5CE6', justifyContent: 'center', alignItems: 'center', marginRight: 8, shadowColor: '#5E5CE6', shadowOpacity: 0.3, shadowRadius: 5, elevation: 2 },
  nextDoseLabel: { fontSize: 14, fontWeight: '800', color: '#5E5CE6' },
  heroTime: { fontSize: 32, fontWeight: '800', color: '#1C1C1E', marginBottom: 4, letterSpacing: -0.5 },
  heroSubtitle: { fontSize: 14, color: '#8E8E93', textAlign: 'center' },
  heroMedName: { fontSize: 16, fontWeight: '700', color: '#1C1C1E', marginBottom: 2 },
  heroDosage: { fontSize: 14, color: '#8E8E93', fontWeight: '500' },
  heroImagePlaceholder: { width: 110, height: 110, backgroundColor: '#F4F7FF', borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  heroBannerCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F4F7FF', paddingVertical: 14, paddingHorizontal: 16, borderRadius: 16 },
  heroBannerIconWrap: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', marginRight: 10, shadowColor: '#5E5CE6', shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  heroBannerText: { fontSize: 13, fontWeight: '700', color: '#5E5CE6' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#1C1C1E' },
  scheduleList: { marginBottom: 30 },
  scheduleItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', padding: 18, borderRadius: 24, marginBottom: 15, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 3 },
  scheduleItemActive: { borderLeftWidth: 5, borderLeftColor: '#5E5CE6', paddingLeft: 13 },
  timeColumn: { width: 85 },
  timeText: { fontSize: 18, fontWeight: '800', color: '#1C1C1E', marginBottom: 4 },
  timeTextActive: { color: '#1C1C1E' },
  timeTextUpcoming: { color: '#5E5CE6' }, 
  statusRow: { flexDirection: 'row', alignItems: 'center' },
  statusText: { fontSize: 12, fontWeight: '700', marginLeft: 4 },
  statusTextCompleted: { color: '#34C759' },
  statusTextUpcoming: { color: '#5E5CE6' },
  statusTextPending: { color: '#FF9500' },
  pillImagePlaceholder: { width: 54, height: 54, borderRadius: 18, backgroundColor: '#F8F9FF', justifyContent: 'center', alignItems: 'center', marginRight: 15, borderWidth: 1, borderColor: '#E5E5EA' },
  medInfoColumn: { flex: 1 },
  medName: { fontSize: 16, fontWeight: '800', color: '#1C1C1E', marginBottom: 2 },
  medDesc: { fontSize: 13, color: '#8E8E93', marginBottom: 2, fontWeight: '500' },
  actionColumn: { alignItems: 'flex-end', justifyContent: 'center' },
  activeBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#5E5CE6', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 14, shadowColor: '#5E5CE6', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  activeBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  upcomingBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#E5EDFF', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 14 },
  upcomingBtnText: { color: '#5E5CE6', fontSize: 12, fontWeight: '800' },
  completedBtnRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  completedCheckCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#34C759', justifyContent: 'center', alignItems: 'center', shadowColor: '#34C759', shadowOpacity: 0.3, shadowRadius: 6, elevation: 3 },
  refillCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', padding: 20, borderRadius: 24, marginBottom: 20, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 15, shadowOffset: { width: 0, height: 6 }, elevation: 3 },
  refillImagePlaceholder: { width: 64, height: 64, marginRight: 16, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F4F7FF', borderRadius: 20 },
  refillTextContainer: { flex: 1 },
  refillTitle: { fontSize: 16, fontWeight: '800', color: '#5E5CE6', marginBottom: 4 },
  refillSub: { fontSize: 13, color: '#1C1C1E', marginBottom: 10, fontWeight: '500' },
  orderNowBtn: { flexDirection: 'row', alignItems: 'center' },
  orderNowText: { fontSize: 14, fontWeight: '800', color: '#5E5CE6', marginRight: 4 },
  refillRingContainer: { width: 64, height: 64, justifyContent: 'center', alignItems: 'center' },
  refillRingText: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  ringValue: { fontSize: 18, fontWeight: '800', color: '#1C1C1E' },
  ringTotal: { fontSize: 12, fontWeight: '600', color: '#8E8E93' },
  ringLabel: { fontSize: 9, fontWeight: '700', color: '#8E8E93', marginTop: -2 },
  tipCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', padding: 18, borderRadius: 24, marginBottom: 20, shadowColor: '#34C759', shadowOpacity: 0.06, shadowRadius: 15, shadowOffset: { width: 0, height: 6 }, elevation: 3, borderWidth: 1, borderColor: '#E8F5E9' },
  tipImagePlaceholder: { width: 54, height: 54, borderRadius: 18, backgroundColor: '#E8F5E9', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  tipTextContainer: { flex: 1, marginRight: 10 },
  tipTitle: { fontSize: 15, fontWeight: '800', color: '#34C759', marginBottom: 4 },
  tipSub: { fontSize: 12, color: '#636366', lineHeight: 18, fontWeight: '500' },
  learnMoreBtn: { borderWidth: 2, borderColor: '#34C759', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14 },
  learnMoreText: { fontSize: 12, fontWeight: '800', color: '#34C759' },
  fab: { position: 'absolute', bottom: 30, right: 20, width: 64, height: 64, borderRadius: 32, backgroundColor: '#5E5CE6', justifyContent: 'center', alignItems: 'center', shadowColor: '#5E5CE6', shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 8 }
});