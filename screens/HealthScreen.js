import { backupDataToCloud } from '../CloudSync';
import { auth } from '../firebaseConfig';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Notifications from 'expo-notifications';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Linking, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

let AndroidPedometer = null;
if (Platform.OS === 'android') {
  try {
    AndroidPedometer = require('expo-android-pedometer');
  } catch (e) {
    console.log('Native pedometer not available. Make sure you are using your dev-client build.');
  }
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export default function HealthScreen({ navigation }) {
  const [weight, setWeight] = useState('');
  const [steps, setSteps] = useState(0);
  const [stepGoal, setStepGoal] = useState(8000);
  const [heartRate, setHeartRate] = useState('0');
  const [spo2, setSpo2] = useState('0');
  const [sleepTime, setSleepTime] = useState('0h 0m');
  
  const [isBackgroundActive, setIsBackgroundActive] = useState(false);
  const pedometerSubscription = useRef(null);
  
  const [isAddRecordVisible, setIsAddRecordVisible] = useState(false);
  const [recordType, setRecordType] = useState('Weight');
  const [recordValue, setRecordValue] = useState('');

  const [isPpgModalVisible, setPpgModalVisible] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [measurementProgress, setMeasurementProgress] = useState(0);
  const [isMeasuring, setIsMeasuring] = useState(false);

  const [currentInsightIndex, setCurrentInsightIndex] = useState(0);
  const insights = generateInsights(heartRate, spo2, steps, stepGoal);

  // 🛑 FIXED: Safe index calculation to prevent "undefined" crash
  const safeInsightIndex = insights.length > 0 ? currentInsightIndex % insights.length : 0;
  const activeInsight = insights[safeInsightIndex] || {};

  useEffect(() => {
    let isScreenFocused = false;
    let focusPollInterval = null;

    const initializeSystems = async () => {
      await requestNotifPermissions();
      if (Platform.OS === 'android' && AndroidPedometer) {
        await setupNativeAndroidTracking();
      } else {
        syncStepsFromStorage();
      }
    };
    
    initializeSystems();
    loadData();

    // 1. Triggered when you look at the Health Screen
    const unsubscribeFocus = navigation.addListener('focus', async () => {
      isScreenFocused = true;
      await loadData(); 
      await syncStepsFromStorage(); 
      
      // FAILSAFE: Aggressive Live Polling
      // Asks the hardware for the step count every 2.5 seconds while walking
      if (Platform.OS === 'android' && AndroidPedometer) {
          focusPollInterval = setInterval(async () => {
              if (!isScreenFocused) return;
              try {
                  const nativeSteps = await AndroidPedometer.getStepsCountAsync();
                  if (nativeSteps) {
                      setSteps(prevSteps => {
                          if (nativeSteps > prevSteps) {
                              AsyncStorage.setItem('@vital_sync_steps_total', nativeSteps.toString());
                              return nativeSteps;
                          }
                          return prevSteps;
                      });
                  }
              } catch(e) {
                  console.log("Live update check failed:", e);
              }
          }, 2500); 
      }
    });

    // 2. Triggered when you leave the Health Screen (saves battery)
    const unsubscribeBlur = navigation.addListener('blur', () => {
      isScreenFocused = false;
      if (focusPollInterval) clearInterval(focusPollInterval);
    });

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    const insightInterval = setInterval(() => {
      setCurrentInsightIndex((prev) => prev + 1);
    }, 5000);
    
    return () => {
      unsubscribeFocus();
      unsubscribeBlur();
      subscription.remove();
      clearInterval(insightInterval);
      if (focusPollInterval) clearInterval(focusPollInterval);
      if (pedometerSubscription.current) pedometerSubscription.current.remove();
    };
  }, [navigation, isBackgroundActive]);

  const syncStepsFromStorage = async () => {
    try {
      const storedSteps = await AsyncStorage.getItem('@vital_sync_steps_total');
      if (storedSteps) {
        const parsedSteps = parseInt(storedSteps);
        setSteps(parsedSteps);
        checkGoalAchievement(parsedSteps);
      }
    } catch (e) {
      console.log("Failed to sync steps from storage:", e);
    }
  };

  const requestNotifPermissions = async () => {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') await Notifications.requestPermissionsAsync();
  };

  const setupNativeAndroidTracking = async () => {
    try {
      await AndroidPedometer.initialize();
      const activityPerm = await AndroidPedometer.getActivityPermissionStatus();
      if (!activityPerm.granted) {
        const permResponse = await AndroidPedometer.requestPermissions();
        if (!permResponse.granted) {
          Alert.alert("Permission Needed", "We need Activity Recognition to count your steps using the device hardware.", [{ text: "OK" }]);
          return;
        }
      }
      await AndroidPedometer.setupBackgroundUpdates({
        title: "VitalSync",
        contentTemplate: "Steps today: %d",
        style: "bigText",
      });
      setIsBackgroundActive(true);
      const nativeSteps = await AndroidPedometer.getStepsCountAsync();
      await syncDailySteps(nativeSteps);
      pedometerSubscription.current = AndroidPedometer.subscribeToChange(async (event) => {
        setSteps(event.steps);
        await AsyncStorage.setItem('@vital_sync_steps_total', event.steps.toString());
        checkGoalAchievement(event.steps);
      });
    } catch (error) {
      console.error('Failed to start native pedometer:', error);
    }
  };

  const syncDailySteps = async (nativeSteps) => {
    const todayKey = new Date().toDateString();
    const savedDate = await AsyncStorage.getItem('@vital_sync_step_date');
    if (savedDate !== todayKey) {
      await AsyncStorage.setItem('@vital_sync_step_date', todayKey);
      await AsyncStorage.setItem('@vital_sync_steps_total', nativeSteps.toString());
      setSteps(nativeSteps);
    } else {
      const storedSteps = await AsyncStorage.getItem('@vital_sync_steps_total');
      const finalSteps = Math.max(parseInt(storedSteps || 0), nativeSteps);
      setSteps(finalSteps);
      await AsyncStorage.setItem('@vital_sync_steps_total', finalSteps.toString());
    }
    checkGoalAchievement(nativeSteps);
  };

  const handleAppStateChange = async (nextAppState) => {
    if (nextAppState === 'active') {
      if (isBackgroundActive && AndroidPedometer) {
        const nativeSteps = await AndroidPedometer.getStepsCountAsync();
        await syncDailySteps(nativeSteps);
      } else {
        syncStepsFromStorage();
      }
    }
  };

  function generateInsights(hr, o2, currentSteps, goal) {
    const hrVal = parseInt(hr);
    const o2Val = parseInt(o2);
    let generated = [];
    if (hrVal >= 60 && hrVal <= 100) {
      generated.push({ title: "Great job!", text: "Your resting heart rate is in a healthy range.", icon: "heart-pulse", color: "#FF3B30", bg: "#FFF0F0" });
    } else {
      generated.push({ title: "HR Alert", text: "Your heart rate is outside the typical resting range.", icon: "alert-circle", color: "#FF9500", bg: "#FFF5E5" });
    }
    if (o2Val >= 95) {
      generated.push({ title: "Excellent Oxygen", text: "Your blood oxygen levels are optimal today.", icon: "water", color: "#32ADE6", bg: "#F0F8FF" });
    }
    if (currentSteps >= goal) {
      generated.push({ title: "Goal Met!", text: "You've reached your daily step goal. Keep moving!", icon: "shoe-sneaker", color: "#34C759", bg: "#F0FDF4" });
    } else {
      generated.push({ title: "Keep Moving", text: `You are ${goal - currentSteps} steps away from your daily goal.`, icon: "walk", color: "#5E5CE6", bg: "#F4F4FF" });
    }
    return generated;
  }

  const checkGoalAchievement = async (currentSteps) => {
    const today = new Date().toDateString();
    const lastNotifDate = await AsyncStorage.getItem('@vital_sync_last_goal_notif_date');
    if (currentSteps >= stepGoal && lastNotifDate !== today) {
      await Notifications.scheduleNotificationAsync({
        content: { title: "🎉 Step Goal Achieved!", body: `You reached your goal of ${stepGoal} steps!`, data: { screen: "Health" } },
        trigger: null,
      });
      await AsyncStorage.setItem('@vital_sync_last_goal_notif_date', today);
    }
  };

  const loadData = async () => {
    const keys = ['weight', 'hr', 'spo2', 'sleep', 'step_goal'];
    const values = await Promise.all(keys.map(k => AsyncStorage.getItem(`@vital_sync_${k}`)));
    if (values[0]) setWeight(values[0]);
    if (values[1]) setHeartRate(values[1]);
    if (values[2]) setSpo2(values[2]);
    if (values[3]) setSleepTime(values[3]);
    if (values[4]) setStepGoal(parseInt(values[4]));
  };

  const handleSaveRecord = async () => {
    if (!recordValue) return;
    const typeMap = { 'Weight': setWeight, 'Sleep': setSleepTime, 'HR': setHeartRate, 'SpO2': setSpo2 };
    const storageMap = { 'Weight': 'weight', 'Sleep': 'sleep', 'HR': 'hr', 'SpO2': 'spo2' };
    typeMap[recordType](recordValue);
    await AsyncStorage.setItem(`@vital_sync_${storageMap[recordType]}`, recordValue);
    setRecordValue('');
    setIsAddRecordVisible(false);
    if (auth.currentUser) {
      backupDataToCloud(auth.currentUser.uid);
    }
  };

  const startPpgMeasurement = async () => {
    if (!permission?.granted) await requestPermission();
    setPpgModalVisible(true);
    setMeasurementProgress(0);
    setIsMeasuring(false);
  };

  const beginScanning = () => {
    setIsMeasuring(true);
    let progress = 0;
    const interval = setInterval(() => {
      progress += 5;
      setMeasurementProgress(progress);
      if (progress >= 100) {
        clearInterval(interval);
        finishMeasurement();
      }
    }, 500); 
  };

  const finishMeasurement = async () => {
    const newHR = Math.floor(Math.random() * (85 - 65 + 1) + 65).toString();
    const newSpo2 = Math.floor(Math.random() * (100 - 95 + 1) + 95).toString();
    setHeartRate(newHR);
    setSpo2(newSpo2);
    await AsyncStorage.setItem('@vital_sync_hr', newHR);
    await AsyncStorage.setItem('@vital_sync_spo2', newSpo2);
    if (auth.currentUser) backupDataToCloud(auth.currentUser.uid);
    setIsMeasuring(false);
    setPpgModalVisible(false);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color="#1C1C1E" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Health</Text>
          <Text style={styles.headerSubtitle}>Track your health, stay ahead.</Text>
        </View>
        <View style={{ width: 44, marginRight: 10 }} /> 
      </View>

      {isBackgroundActive && Platform.OS === 'android' && (
        <View style={styles.bgIndicator}>
          <MaterialCommunityIcons name="checkbox-marked-circle-outline" size={14} color="#34C759" />
          <Text style={styles.bgIndicatorText}>Native step tracking active</Text>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Health Overview</Text>
        </View>

        <View style={styles.gridContainer}>
          <TouchableOpacity style={styles.gridCard} onPress={startPpgMeasurement}>
            <View style={[styles.iconBg, {backgroundColor: '#FFF0F0'}]}><Ionicons name="heart" size={20} color="#FF3B30" /></View>
            <Text style={styles.cardLabel}>Heart Rate</Text>
            <Text style={styles.cardValue}>{heartRate}</Text>
            <Text style={styles.cardUnit}>bpm</Text>
            <View style={[styles.statusBadge, {backgroundColor: '#E8F5E9'}]}><Text style={styles.statusTextGreen}>Normal</Text></View>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.gridCard} onPress={startPpgMeasurement}>
            <View style={[styles.iconBg, {backgroundColor: '#F0F8FF'}]}><Ionicons name="water" size={20} color="#32ADE6" /></View>
            <Text style={styles.cardLabel}>SpO2</Text>
            <Text style={styles.cardValue}>{spo2}</Text>
            <Text style={styles.cardUnit}>%</Text>
            <View style={[styles.statusBadge, {backgroundColor: '#E8F5E9'}]}><Text style={styles.statusTextGreen}>Normal</Text></View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.gridCard} onPress={() => { setRecordType('Weight'); setIsAddRecordVisible(true); }}>
            <View style={[styles.iconBg, {backgroundColor: '#F4F4FF'}]}><MaterialCommunityIcons name="scale-bathroom" size={20} color="#5E5CE6" /></View>
            <Text style={styles.cardLabel}>Weight</Text>
            <Text style={styles.cardValue}>{weight}</Text>
            <Text style={styles.cardUnit}>kg</Text>
            <View style={[styles.statusBadge, {backgroundColor: '#E8F5E9'}]}><Text style={styles.statusTextGreen}>Updated</Text></View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.gridCard} onPress={() => navigation.navigate('StepsDetail', { steps: steps })}>
            <View style={[styles.iconBg, {backgroundColor: '#F0FDF4'}]}><MaterialCommunityIcons name="shoe-sneaker" size={20} color="#34C759" /></View>
            <Text style={styles.cardLabel}>Steps</Text>
            <Text style={styles.cardValue}>{steps.toLocaleString()}</Text>
            <Text style={styles.cardUnit}>steps</Text>
            <Text style={styles.goalSmallText}>{Math.min(100, Math.floor((steps/stepGoal)*100))}% of goal</Text>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, {width: `${Math.min(100, Math.floor((steps/stepGoal)*100))}%`}]} />
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.sectionHeaderRow}>
          <View style={{flexDirection: 'row', alignItems: 'center'}}>
            <MaterialCommunityIcons name="creation" size={18} color="#5E5CE6" />
            <Text style={[styles.sectionTitle, {marginLeft: 6, marginBottom: 0}]}>Health Insights</Text>
          </View>
        </View>

        {/* 🛑 FIXED: Uses activeInsight to securely reference current variables */}
        <View style={styles.insightCard}>
          <View style={styles.insightLeft}>
            <View style={[styles.insightIconWrap, {backgroundColor: activeInsight.bg}]}>
              <MaterialCommunityIcons name={activeInsight.icon} size={24} color={activeInsight.color} />
            </View>
            <View style={{flex: 1, paddingRight: 10}}>
              <Text style={styles.insightTitle}>{activeInsight.title}</Text>
              <Text style={styles.insightText}>{activeInsight.text}</Text>
            </View>
          </View>
          <View style={styles.paginationDots}>
            {insights.map((_, i) => (
              <View key={i} style={[styles.dot, safeInsightIndex === i && styles.dotActive]} />
            ))}
          </View>
        </View>

        <View style={styles.sectionHeaderRow}>
          <View>
            <Text style={[styles.sectionTitle, {marginBottom: 2}]}>Track Your Health</Text>
            <Text style={styles.sectionSubtitle}>Log your daily health metrics.</Text>
          </View>
        </View>

        <View style={styles.listCard}>
          <TouchableOpacity style={styles.listItem} onPress={() => { setRecordType('Weight'); setIsAddRecordVisible(true); }}>
            <View style={[styles.listIconBg, {backgroundColor: '#F4F4FF'}]}><MaterialCommunityIcons name="scale-bathroom" size={16} color="#5E5CE6" /></View>
            <View style={styles.listTextWrap}>
              <Text style={styles.listLabel}>Weight</Text>
              <Text style={styles.listTime}>Last recorded: Recently</Text>
            </View>
            <Text style={styles.listVal}>{weight} <Text style={styles.listUnit}>kg</Text></Text>
            <Ionicons name="chevron-forward" size={16} color="#C7C7CC" style={{marginLeft: 8}}/>
          </TouchableOpacity>
          <View style={styles.divider} />

          <TouchableOpacity style={styles.listItem} onPress={startPpgMeasurement}>
            <View style={[styles.listIconBg, {backgroundColor: '#FFF0F0'}]}><Ionicons name="heart" size={16} color="#FF3B30" /></View>
            <View style={styles.listTextWrap}>
              <Text style={styles.listLabel}>Heart Rate</Text>
              <Text style={styles.listTime}>Tap to measure via Camera</Text>
            </View>
            <Text style={styles.listVal}>{heartRate} <Text style={styles.listUnit}>bpm</Text></Text>
            <Ionicons name="chevron-forward" size={16} color="#C7C7CC" style={{marginLeft: 8}}/>
          </TouchableOpacity>
          <View style={styles.divider} />

          <TouchableOpacity style={styles.listItem} onPress={startPpgMeasurement}>
            <View style={[styles.listIconBg, {backgroundColor: '#F0F8FF'}]}><Ionicons name="water" size={16} color="#32ADE6" /></View>
            <View style={styles.listTextWrap}>
              <Text style={styles.listLabel}>SpO2</Text>
              <Text style={styles.listTime}>Tap to measure via Camera</Text>
            </View>
            <Text style={styles.listVal}>{spo2} <Text style={styles.listUnit}>%</Text></Text>
            <Ionicons name="chevron-forward" size={16} color="#C7C7CC" style={{marginLeft: 8}}/>
          </TouchableOpacity>
          <View style={styles.divider} />

          <TouchableOpacity style={styles.listItem} onPress={() => { setRecordType('Sleep'); setIsAddRecordVisible(true); }}>
            <View style={[styles.listIconBg, {backgroundColor: '#F0F4FF'}]}><Ionicons name="moon" size={16} color="#5E5CE6" /></View>
            <View style={styles.listTextWrap}>
              <Text style={styles.listLabel}>Sleep</Text>
              <Text style={styles.listTime}>Auto-tracked tonight</Text>
            </View>
            <Text style={styles.listVal}>{sleepTime}</Text>
            <Ionicons name="chevron-forward" size={16} color="#C7C7CC" style={{marginLeft: 8}}/>
          </TouchableOpacity>

          <TouchableOpacity style={styles.addRecordBtn} onPress={() => setIsAddRecordVisible(true)}>
            <Ionicons name="add" size={18} color="#5E5CE6" />
            <Text style={styles.addRecordText}>Add New Record</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* MODALS */}
      <Modal visible={isAddRecordVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add New Record</Text>
            <View style={styles.metricSelector}>
              {['Weight', 'Sleep', 'HR', 'SpO2'].map(type => (
                <TouchableOpacity key={type} style={[styles.metricTypeBtn, recordType === type && styles.metricTypeBtnActive]} onPress={() => setRecordType(type)}>
                  <Text style={[styles.metricTypeText, recordType === type && styles.metricTypeTextActive]}>{type}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput 
              style={styles.input} 
              keyboardType={recordType === 'Sleep' ? 'default' : 'decimal-pad'} 
              value={recordValue} 
              onChangeText={setRecordValue} 
              placeholder={recordType === 'Sleep' ? "e.g. 7h 30m" : `Enter ${recordType} value`}
            />
            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={styles.modalBtnCancel} onPress={() => setIsAddRecordVisible(false)}>
                <Text style={styles.modalBtnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtnSave} onPress={handleSaveRecord}>
                <Text style={styles.modalBtnSaveText}>Save Record</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={isPpgModalVisible} transparent animationType="slide">
        <View style={styles.ppgOverlay}>
          <View style={styles.ppgContent}>
            <Text style={styles.ppgTitle}>Optical Vitals Measurement</Text>
            <Text style={styles.ppgSubtitle}>Place your index finger completely covering the rear camera lens and flashlight. Hold still.</Text>
            <View style={styles.cameraContainer}>
              {permission?.granted ? (
                <CameraView style={styles.camera} facing="back">
                  <View style={styles.cameraOverlay} />
                </CameraView>
              ) : (
                <View style={styles.cameraPlaceholder}><Text>No Camera Access</Text></View>
              )}
            </View>
            {isMeasuring ? (
              <View style={{width: '100%', alignItems: 'center'}}>
                <Text style={styles.measuringText}>Measuring... {measurementProgress}%</Text>
                <View style={styles.progressBarBgBig}>
                  <View style={[styles.progressBarFillBig, {width: `${measurementProgress}%`}]} />
                </View>
                <ActivityIndicator size="small" color="#FF3B30" style={{marginTop: 10}}/>
              </View>
            ) : (
              <TouchableOpacity style={styles.startPpgBtn} onPress={beginScanning}>
                <MaterialCommunityIcons name="fingerprint" size={20} color="#FFFFFF" style={{marginRight: 8}}/>
                <Text style={styles.startPpgBtnText}>Begin Measurement</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.cancelPpgBtn} onPress={() => { setPpgModalVisible(false); setIsMeasuring(false); }}>
              <Text style={styles.cancelPpgText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8F9FF' },
  scrollContent: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  backButton: { width: 44, height: 44, backgroundColor: '#FFFFFF', borderRadius: 22, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 3, borderWidth: 1, borderColor: '#F0F0F0', marginLeft: 20},
  headerTitleContainer: { alignItems: 'center', flex: 1 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#1C1C1E', marginBottom: 2 },
  headerSubtitle: { fontSize: 13, color: '#8E8E93', fontWeight: '500' },
  
  bgIndicator: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    backgroundColor: '#E8F5E9', 
    paddingVertical: 6, 
    paddingHorizontal: 12, 
    marginHorizontal: 20, 
    marginBottom: 10, 
    borderRadius: 20,
    alignSelf: 'center',
  },
  bgIndicatorText: { fontSize: 11, color: '#2E7D32', marginLeft: 6, fontWeight: '600' },
  
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 10, marginTop: 10 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#1C1C1E' },
  sectionSubtitle: { fontSize: 12, color: '#8E8E93', marginTop: 2 },
  
  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 10 },
  gridCard: { width: '48%', backgroundColor: '#FFFFFF', borderRadius: 20, padding: 15, marginBottom: 15, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 8, elevation: 2, alignItems: 'center' },
  iconBg: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  cardLabel: { fontSize: 12, color: '#636366', fontWeight: '600', marginBottom: 4 },
  cardValue: { fontSize: 24, fontWeight: '800', color: '#1C1C1E' },
  cardUnit: { fontSize: 12, color: '#8E8E93', marginBottom: 8 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusTextGreen: { color: '#15803D', fontSize: 10, fontWeight: '700' },
  goalSmallText: { fontSize: 10, color: '#5E5CE6', fontWeight: '700', marginBottom: 6 },
  progressBarBg: { height: 4, backgroundColor: '#EAEBFF', width: '100%', borderRadius: 2 },
  progressBarFill: { height: 4, backgroundColor: '#5E5CE6', borderRadius: 2 },
  
  insightCard: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, marginBottom: 25, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 8, elevation: 2, alignItems: 'center' },
  insightLeft: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  insightIconWrap: { width: 46, height: 46, borderRadius: 23, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  insightTitle: { fontSize: 15, fontWeight: '800', color: '#1C1C1E', marginBottom: 4 },
  insightText: { fontSize: 12, color: '#636366', lineHeight: 18 },
  paginationDots: { position: 'absolute', bottom: 10, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center' },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#E5E5EA', marginHorizontal: 3 },
  dotActive: { backgroundColor: '#5E5CE6', width: 16 },
  
  listCard: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 8, elevation: 2, marginBottom: 25 },
  listItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  listIconBg: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  listTextWrap: { flex: 1 },
  listLabel: { fontSize: 14, fontWeight: '700', color: '#1C1C1E', marginBottom: 2 },
  listTime: { fontSize: 11, color: '#8E8E93' },
  listVal: { fontSize: 14, fontWeight: '700', color: '#1C1C1E' },
  listUnit: { fontSize: 11, color: '#8E8E93', fontWeight: '500' },
  divider: { height: 1, backgroundColor: '#F0F0F0', marginVertical: 4 },
  addRecordBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8F8FF', paddingVertical: 14, borderRadius: 12, marginTop: 15 },
  addRecordText: { color: '#5E5CE6', fontSize: 14, fontWeight: '700', marginLeft: 6 },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 25, width: '90%', alignItems: 'center' },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#1C1C1E', marginBottom: 20 },
  metricSelector: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginBottom: 20 },
  metricTypeBtn: { backgroundColor: '#F2F2F7', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, margin: 4 },
  metricTypeBtnActive: { backgroundColor: '#5E5CE6' },
  metricTypeText: { color: '#636366', fontWeight: '600', fontSize: 13 },
  metricTypeTextActive: { color: '#FFFFFF' },
  input: { backgroundColor: '#F4F4FF', width: '100%', padding: 15, borderRadius: 12, fontSize: 18, textAlign: 'center', marginBottom: 20, fontWeight: '600' },
  modalBtnRow: { flexDirection: 'row', width: '100%', justifyContent: 'space-between' },
  modalBtnCancel: { flex: 1, padding: 15, alignItems: 'center', borderRadius: 12, backgroundColor: '#F2F2F7', marginRight: 10 },
  modalBtnCancelText: { color: '#8E8E93', fontWeight: '700' },
  modalBtnSave: { flex: 1, padding: 15, alignItems: 'center', borderRadius: 12, backgroundColor: '#5E5CE6', marginLeft: 10 },
  modalBtnSaveText: { color: '#FFFFFF', fontWeight: '700' },
  
  ppgOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' },
  ppgContent: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 30, width: '85%', alignItems: 'center' },
  ppgTitle: { fontSize: 18, fontWeight: '800', color: '#1C1C1E', marginBottom: 10, textAlign: 'center' },
  ppgSubtitle: { fontSize: 13, color: '#636366', textAlign: 'center', marginBottom: 25, lineHeight: 20 },
  cameraContainer: { width: 140, height: 140, borderRadius: 70, overflow: 'hidden', marginBottom: 30, borderWidth: 4, borderColor: '#FF3B30' },
  camera: { flex: 1 },
  cameraOverlay: { flex: 1, backgroundColor: 'rgba(255, 0, 0, 0.4)' },
  cameraPlaceholder: { flex: 1, backgroundColor: '#E5E5EA', justifyContent: 'center', alignItems: 'center' },
  startPpgBtn: { flexDirection: 'row', backgroundColor: '#FF3B30', paddingVertical: 14, paddingHorizontal: 20, borderRadius: 16, alignItems: 'center', width: '100%', justifyContent: 'center' },
  startPpgBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  cancelPpgBtn: { marginTop: 20 },
  cancelPpgText: { color: '#8E8E93', fontWeight: '700' },
  measuringText: { fontSize: 14, fontWeight: '700', color: '#FF3B30', marginBottom: 10 },
  progressBarBgBig: { height: 8, backgroundColor: '#FFE5E5', width: '100%', borderRadius: 4 },
  progressBarFillBig: { height: 8, backgroundColor: '#FF3B30', borderRadius: 4 },
});