import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal,
  TextInput, ScrollView, ActivityIndicator, Alert,
  Platform, AppState, Linking
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Rect, Line, Text as SvgText } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { backupDataToCloud } from '../CloudSync';
import { auth } from '../firebaseConfig';

// Import pedometer modules
import { Pedometer } from 'expo-sensors';

// Conditionally import Android pedometer (only for development build)
let AndroidPedometer = null;
if (Platform.OS === 'android') {
  try {
    AndroidPedometer = require('expo-android-pedometer');
  } catch (e) {
    console.log('expo-android-pedometer not available in Expo Go');
  }
}

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export default function StepsScreen({ navigation, route }) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [dailySteps, setDailySteps] = useState(0);
  const [chartData, setChartData] = useState([0, 0, 0, 0, 0, 0, 0]);
  const [isLoading, setIsLoading] = useState(false);

  const [goal, setGoal] = useState(8000);
  const [isGoalModalVisible, setGoalModalVisible] = useState(false);
  const [newGoal, setNewGoal] = useState(goal.toString());

  const [isBackgroundActive, setIsBackgroundActive] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState('checking');
  
  // Custom Alert State
  const [customAlert, setCustomAlert] = useState({ visible: false, title: '', message: '' });

  const pedometerSubscription = useRef(null);
  const appState = useRef(AppState.currentState);
  let lastStepTime = useRef(0);

  const formatDateKey = (dateObj) => {
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Request notification permissions on mount
  useEffect(() => {
    const requestNotificationPermissions = async () => {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') {
        console.log('Notification permissions not granted');
      }
    };
    
    requestNotificationPermissions();
  }, []);

  // Load saved goal
  useEffect(() => {
    const loadGoal = async () => {
      const savedGoal = await AsyncStorage.getItem('@vital_sync_step_goal');
      if (savedGoal) {
        setGoal(parseInt(savedGoal));
        setNewGoal(savedGoal);
      }
    };
    loadGoal();
  }, []);

  // Initialize background tracking for development build
  useEffect(() => {
    const initBackgroundTracking = async () => {
      if (Platform.OS === 'android' && AndroidPedometer) {
        await setupAndroidBackgroundTracking();
      }
    };
    
    initBackgroundTracking();

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      subscription.remove();
      stopLiveStepTracking();
    };
  }, []);

  const setupAndroidBackgroundTracking = async () => {
    try {
      const initialized = await AndroidPedometer.initialize();
      console.log('Pedometer initialized:', initialized);

      const activityPerm = await AndroidPedometer.getActivityPermissionStatus();
      
      if (!activityPerm.granted) {
        const permResponse = await AndroidPedometer.requestPermissions();
        if (!permResponse.granted) {
          setPermissionStatus('denied');
          Alert.alert(
            'Permission Required',
            'Step counting needs activity recognition permission to work in background.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open Settings', onPress: () => Linking.openSettings() }
            ]
          );
          return;
        }
      }

      if (Platform.Version >= 33) {
        const notifPerm = await AndroidPedometer.getNotificationPermissionStatus();
        if (!notifPerm.granted) {
          await AndroidPedometer.requestNotificationPermissions();
        }
      }

      setPermissionStatus('granted');

      await AndroidPedometer.setupBackgroundUpdates({
        title: "Step Counter Active",
        contentTemplate: "You've taken %d steps today",
        style: "bigText",
      });

      setIsBackgroundActive(true);

      await showStepNotification(dailySteps);

      const unsubscribe = AndroidPedometer.subscribeToChange(async (event) => {
        const todayKey = formatDateKey(new Date());
        await AsyncStorage.setItem(`@vital_steps_${todayKey}`, event.steps.toString());
        await AsyncStorage.setItem('@vital_sync_steps_total', event.steps.toString());
        
        const currentViewKey = formatDateKey(selectedDate);
        if (currentViewKey === todayKey) {
          setDailySteps(event.steps);
          generateDynamicChart(event.steps);
        }
      });

      global.__pedometerUnsubscribe = unsubscribe;

    } catch (error) {
      console.error('Android pedometer setup failed:', error);
      setPermissionStatus('error');
    }
  };

  const showStepNotification = async (steps) => {
    try {
      const percentage = Math.round((steps / goal) * 100);
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "Step Update",
          body: `You've taken ${steps.toLocaleString()} steps today (${percentage}% of your goal)!`,
          data: { screen: "Steps" },
        },
        trigger: null, 
      });
    } catch (error) {
      console.log('Notification error:', error);
    }
  };

  const startLiveStepTracking = async (initialStepsForToday) => {
    stopLiveStepTracking();
    
    const todayKey = formatDateKey(new Date());
    
    if (isBackgroundActive && Platform.OS === 'android' && AndroidPedometer) {
      console.log('Background tracking already active');
      return;
    }
    
    try {
      const { status } = await Pedometer.requestPermissionsAsync();
      
      if (status === 'granted') {
        pedometerSubscription.current = Pedometer.watchStepCount(result => {
          const totalStepsNow = initialStepsForToday + result.steps;
          updateUIAndStorage(totalStepsNow, todayKey);
        });
      } else {
        startAccelerometerFallback(initialStepsForToday);
      }
    } catch (error) {
      console.log("Tracking error:", error);
      startAccelerometerFallback(initialStepsForToday);
    }
  };

  const startAccelerometerFallback = (initialSteps = 0) => {
    const { Accelerometer } = require('expo-sensors');
    let currentSteps = initialSteps;
    const todayKey = formatDateKey(new Date());
    
    Accelerometer.setUpdateInterval(150);
    pedometerSubscription.current = Accelerometer.addListener(accelerometerData => {
      const { x, y, z } = accelerometerData;
      const magnitude = Math.sqrt(x * x + y *y + z * z);
      
      if (magnitude > 1.2) {
        const now = Date.now();
        if (now - lastStepTime.current > 400) {
          lastStepTime.current = now;
          currentSteps += 1;
          updateUIAndStorage(currentSteps, todayKey);
        }
      }
    });
  };

  const updateUIAndStorage = (total, key) => {
    setDailySteps(total);
    generateDynamicChart(total);
    AsyncStorage.setItem(`@vital_steps_${key}`, total.toString());
    AsyncStorage.setItem('@vital_sync_steps_total', total.toString());
  };

  const stopLiveStepTracking = () => {
    if (pedometerSubscription.current) {
      pedometerSubscription.current.remove();
      pedometerSubscription.current = null;
    }
  };

  const handleAppStateChange = async (nextAppState) => {
    if (nextAppState === 'active') {
      const todayKey = formatDateKey(new Date());
      const selectedKey = formatDateKey(selectedDate);
      
      if (selectedKey === todayKey) {
        await refreshTodaySteps();
      }
    }
    appState.current = nextAppState;
  };

  const refreshTodaySteps = async () => {
    const todayKey = formatDateKey(new Date());
    
    if (Platform.OS === 'android' && AndroidPedometer && isBackgroundActive) {
      try {
        const nativeSteps = await AndroidPedometer.getStepsCountAsync();
        setDailySteps(nativeSteps);
        generateDynamicChart(nativeSteps);
        await AsyncStorage.setItem(`@vital_steps_${todayKey}`, nativeSteps.toString());
      } catch (e) {
        console.log('Refresh failed:', e);
      }
    }
  };

  const loadStepsForSelectedDate = async () => {
    setIsLoading(true);
    const dateKey = formatDateKey(selectedDate);
    const todayKey = formatDateKey(new Date());

    try {
      let savedSteps = await AsyncStorage.getItem(`@vital_steps_${dateKey}`);
      let parsedSteps = savedSteps ? parseInt(savedSteps) : 0;
      
      if (dateKey === todayKey && Platform.OS === 'android' && AndroidPedometer) {
        try {
          const nativeSteps = await AndroidPedometer.getStepsCountAsync();
          if (nativeSteps > parsedSteps) {
            parsedSteps = nativeSteps;
            await AsyncStorage.setItem(`@vital_steps_${dateKey}`, parsedSteps.toString());
          }
        } catch (e) {
          console.log('Could not get native steps:', e);
        }
      }
      
      setDailySteps(parsedSteps);
      generateDynamicChart(parsedSteps);

      if (dateKey === todayKey) {
        startLiveStepTracking(parsedSteps);
      } else {
        stopLiveStepTracking();
      }
    } catch (error) {
      console.log("Storage error:", error);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadStepsForSelectedDate();
    return () => stopLiveStepTracking();
  }, [selectedDate]);

  const generateDynamicChart = (totalSteps) => {
    if (totalSteps === 0) {
      setChartData([0, 0, 0, 0, 0, 0, 0]);
      return;
    }
    let weights = [0.02, 0.03, 0.20, 0.35, 0.25, 0.10, 0.05];
    weights = weights.map(w => w * (0.8 + Math.random() * 0.4));
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    const distribution = weights.map(w => Math.floor(totalSteps * (w / totalWeight)));
    setChartData(distribution);
  };

  const changeDate = (days) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(selectedDate.getDate() + days);
    setSelectedDate(newDate);
  };

  const isToday = new Date().toDateString() === selectedDate.toDateString();

  const getDateLabel = () => {
    if (isToday) return "Today";
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (yesterday.toDateString() === selectedDate.toDateString()) return "Yesterday";
    return selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const saveGoal = async () => {
    const parsedGoal = parseInt(newGoal);
    if (!isNaN(parsedGoal) && parsedGoal > 0) {
      setGoal(parsedGoal);
      await AsyncStorage.setItem('@vital_sync_step_goal', parsedGoal.toString());
      
      if (auth.currentUser) backupDataToCloud(auth.currentUser.uid);
    }
    setGoalModalVisible(false);
  };

  const sendTestNotification = async () => {
    await showStepNotification(dailySteps);
    setCustomAlert({ 
      visible: true, 
      title: "Notification Sent", 
      message: "Check your notification shade!" 
    });
  };

  // --- DYNAMIC STEP CALCULATIONS (Updated Formulas) ---
  const distanceMeters = Math.floor(dailySteps * 0.75);
  const distanceDisplay = distanceMeters >= 1000 ? (distanceMeters / 1000).toFixed(2) + 'KM' : distanceMeters + 'M';
  const caloriesBurned = Math.floor(dailySteps * 0.04);
  const totalSeconds = Math.floor(dailySteps * 0.54);
  const durationMins = Math.floor(totalSeconds / 60);
  const durationSecs = totalSeconds % 60;
  
  const chartHeight = 150;
  const maxBarValue = Math.max(...chartData, 100);
  const yAxisMid = Math.floor(maxBarValue / 2);
  const yAxisMax = maxBarValue;
  const timeLabels = ['0', '4', '8', '12', '16', '20', '24'];

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color="#1C1C1E" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Steps</Text>
        <TouchableOpacity onPress={sendTestNotification} style={styles.notifBtn}>
          <Ionicons name="notifications-outline" size={22} color="#34C759" />
        </TouchableOpacity>
      </View>

      {isBackgroundActive && Platform.OS === 'android' && (
        <View style={styles.bgIndicator}>
          <MaterialCommunityIcons name="checkbox-marked-circle-outline" size={14} color="#34C759" />
          <Text style={styles.bgIndicatorText}>Background tracking active</Text>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.dateNavRow}>
          <TouchableOpacity style={styles.dateArrow} onPress={() => changeDate(-1)}>
            <Ionicons name="chevron-back" size={20} color="#1C1C1E" />
          </TouchableOpacity>
          <Text style={styles.dateLabelText}>{getDateLabel()}</Text>
          <TouchableOpacity 
            style={[styles.dateArrow, isToday && { opacity: 0.2 }]} 
            onPress={() => changeDate(1)}
            disabled={isToday}
          >
            <Ionicons name="chevron-forward" size={20} color="#1C1C1E" />
          </TouchableOpacity>
        </View>

        <View style={styles.chartContainer}>
          <Svg width="100%" height={chartHeight + 30}>
            <Line x1="5%" y1="20" x2="85%" y2="20" stroke="#E5E5EA" strokeWidth="1" strokeDasharray="4 4" />
            <SvgText x="88%" y="24" fill="#8E8E93" fontSize="10" fontWeight="600">{yAxisMax}</SvgText>
            
            <Line x1="5%" y1="80" x2="85%" y2="80" stroke="#E5E5EA" strokeWidth="1" strokeDasharray="4 4" />
            <SvgText x="88%" y="84" fill="#8E8E93" fontSize="10" fontWeight="600">{yAxisMid}</SvgText>

            <Line x1="5%" y1="140" x2="85%" y2="140" stroke="#E5E5EA" strokeWidth="1" />
            <SvgText x="88%" y="144" fill="#8E8E93" fontSize="10" fontWeight="600">0</SvgText>

            {chartData.map((val, i) => {
              const barHeight = Math.max((val / maxBarValue) * 120, 2); 
              const yPos = 140 - barHeight;
              const xPos = `${8 + (i * 12.5)}%`;

              return (
                <Rect key={i} x={xPos} y={yPos} width="12" height={barHeight} fill={val > 0 ? "#34C759" : "#E5E5EA"} rx="6" />
              );
            })}

            {timeLabels.map((time, i) => (
              <SvgText key={i} x={`${10 + (i * 12.5)}%`} y={chartHeight + 20} fill="#8E8E93" fontSize="10" fontWeight="600" textAnchor="middle">
                {time}
              </SvgText>
            ))}
          </Svg>
        </View>

        <View style={styles.mainCard}>
          {isLoading ? (
            <ActivityIndicator size="large" color="#34C759" style={{marginVertical: 30}} />
          ) : (
            <>
              <Text style={styles.cardSubtitle}>Step count</Text>
              <Text style={styles.stepCountText}>{dailySteps.toLocaleString()}</Text>
              <Text style={styles.goalText}>Goal: {goal} steps</Text>
              <TouchableOpacity style={styles.changeGoalBtn} onPress={() => setGoalModalVisible(true)}>
                <Text style={styles.changeGoalBtnText}>Change goal</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Dynamic Bottom Metrics Row */}
        <View style={styles.metricsCard}>
          <View style={styles.metricItem}>
            <View style={[styles.iconCircle, {backgroundColor: '#FFF0F0'}]}>
              <MaterialCommunityIcons name="clock-outline" size={20} color="#FF3B30" />
            </View>
            <Text style={styles.metricValue}>
              {durationMins}<Text style={styles.metricUnitSmall}>M</Text> {durationSecs}<Text style={styles.metricUnitSmall}>S</Text>
            </Text>
            <Text style={styles.metricLabel}>Duration</Text>
          </View>
          
          <View style={styles.metricItem}>
            <View style={[styles.iconCircle, {backgroundColor: '#F0F8FF'}]}>
              <MaterialCommunityIcons name="map-marker-outline" size={20} color="#32ADE6" />
            </View>
            <Text style={styles.metricValue}>{distanceDisplay}</Text>
            <Text style={styles.metricLabel}>Distance</Text>
          </View>
          
          <View style={styles.metricItem}>
            <View style={[styles.iconCircle, {backgroundColor: '#FFF5E5'}]}>
              <MaterialCommunityIcons name="fire" size={20} color="#FF9500" />
            </View>
            <Text style={styles.metricValue}>
              {caloriesBurned}<Text style={styles.metricUnitSmall}>KCAL</Text>
            </Text>
            <Text style={styles.metricLabel}>Calories</Text>
          </View>
        </View>
        
      </ScrollView>

      {/* FIXED Redesigned Premium Goal Modal Layout */}
      <Modal visible={isGoalModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlayCenter}>
          <View style={styles.premiumGoalCard}>
            <View style={styles.goalIconCircle}>
              <MaterialCommunityIcons name="target" size={32} color="#34C759" />
            </View>
            <Text style={styles.modalTitle}>Set Daily Step Goal</Text>
            <Text style={styles.modalSubtitle}>Adjust your daily activity targets to stay on track.</Text>
            
            <View style={styles.inputWrapper}>
              <TextInput 
                style={styles.premiumInput} 
                keyboardType="number-pad" 
                value={newGoal} 
                onChangeText={setNewGoal} 
                maxLength={5}
                placeholder="8000"
                placeholderTextColor="#C7C7CC"
              />
              <Text style={styles.inputUnitText}>steps</Text>
            </View>
            
            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={styles.modalBtnCancel} onPress={() => setGoalModalVisible(false)}>
                <Text style={styles.modalBtnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtnSave} onPress={saveGoal}>
                <Text style={styles.modalBtnSaveText}>Save Target</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Custom Alert Modal */}
      <Modal visible={customAlert.visible} transparent animationType="fade">
        <View style={styles.modalOverlayCenter}>
          <View style={styles.alertCard}>
            <View style={[styles.alertIconWrap, {backgroundColor: '#E8F5E9'}]}>
              <Ionicons name="checkmark-circle" size={36} color="#34C759" />
            </View>
            <Text style={styles.alertTitle}>{customAlert.title}</Text>
            <Text style={styles.alertMessage}>{customAlert.message}</Text>
            
            <View style={styles.alertBtnRow}>
              <TouchableOpacity 
                style={styles.alertBtnOk} 
                onPress={() => setCustomAlert({ ...customAlert, visible: false })}
              >
                <Text style={styles.alertBtnOkText}>Okay</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8F9FF' },
  scrollContent: { paddingBottom: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 10 },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 3},
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#1C1C1E' },
  notifBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 3},
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
  dateNavRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: 40, marginTop: 10, marginBottom: 20 },
  dateArrow: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
  dateLabelText: { fontSize: 16, fontWeight: '800', color: '#1C1C1E' },
  chartContainer: { height: 180, width: '100%', marginBottom: 15 },
  mainCard: { minHeight: 180, justifyContent: 'center', backgroundColor: '#FFFFFF', borderRadius: 24, marginHorizontal: 20, padding: 25, alignItems: 'center', marginBottom: 20, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 15, elevation: 3, borderWidth: 1, borderColor: '#F0F0F0' },
  cardSubtitle: { color: '#8E8E93', fontSize: 14, marginBottom: 10, fontWeight: '700' },
  stepCountText: { color: '#1C1C1E', fontSize: 56, fontWeight: '800', marginBottom: 5 },
  goalText: { color: '#8E8E93', fontSize: 14, marginBottom: 25, fontWeight: '600' },
  changeGoalBtn: { backgroundColor: '#34C759', paddingVertical: 14, paddingHorizontal: 40, borderRadius: 16, width: '100%', alignItems: 'center' },
  changeGoalBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  
  // Custom Centered Modals Overlay
  modalOverlayCenter: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  
  // Premium Goal Modal Card Styling
  premiumGoalCard: { 
    backgroundColor: '#FFFFFF', 
    borderRadius: 28, 
    padding: 25, 
    width: '85%', 
    alignItems: 'center', 
    shadowColor: '#000', 
    shadowOpacity: 0.15, 
    shadowRadius: 20, 
    elevation: 8 
  },
  goalIconCircle: { 
    width: 64, 
    height: 64, 
    borderRadius: 32, 
    backgroundColor: '#E8F5E9', 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginBottom: 16 
  },
  modalTitle: { 
    fontSize: 19, 
    fontWeight: '800', 
    color: '#1C1C1E', 
    marginBottom: 6,
    textAlign: 'center'
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#8E8E93',
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 10,
    lineHeight: 18
  },
  inputWrapper: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F4F4FF',
    borderRadius: 16,
    paddingHorizontal: 20,
    marginBottom: 25,
    height: 56,
  },
  premiumInput: { 
    flex: 1,
    color: '#1C1C1E', 
    fontSize: 20, 
    fontWeight: '800',
    paddingVertical: 0
  },
  inputUnitText: {
    fontSize: 14,
    color: '#5E5CE6',
    fontWeight: '700',
    marginLeft: 10
  },
  modalBtnRow: { 
    flexDirection: 'row', 
    width: '100%', 
    gap: 12
  },
  modalBtnCancel: { 
    flex: 1, 
    height: 50,
    justifyContent: 'center',
    alignItems: 'center', 
    borderRadius: 14, 
    backgroundColor: '#F2F2F7'
  },
  modalBtnCancelText: { 
    color: '#8E8E93', 
    fontWeight: '700', 
    fontSize: 15 
  },
  modalBtnSave: { 
    flex: 1, 
    height: 50,
    justifyContent: 'center',
    alignItems: 'center', 
    borderRadius: 14, 
    backgroundColor: '#34C759'
  },
  modalBtnSaveText: { 
    color: '#FFFFFF', 
    fontWeight: '700', 
    fontSize: 15 
  },

  // Alert Card Styling
  alertCard: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 30, width: '80%', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 15, elevation: 5 },
  alertIconWrap: { width: 70, height: 70, borderRadius: 35, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  alertTitle: { fontSize: 20, fontWeight: '800', color: '#1C1C1E', marginBottom: 10, textAlign: 'center' },
  alertMessage: { fontSize: 14, color: '#636366', textAlign: 'center', marginBottom: 25, lineHeight: 20 },
  alertBtnRow: { flexDirection: 'row', width: '100%', justifyContent: 'center' },
  alertBtnOk: { flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center', backgroundColor: '#5E5CE6' },
  alertBtnOkText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },

  // Metrics Dashboard Row Styles
  metricsCard: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderRadius: 24, marginHorizontal: 20, padding: 20, justifyContent: 'space-around', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 15, elevation: 3, borderWidth: 1, borderColor: '#F0F0F0' },
  metricItem: { alignItems: 'center', flex: 1 },
  iconCircle: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  metricValue: { color: '#1C1C1E', fontSize: 18, fontWeight: '800', marginBottom: 4 },
  metricUnitSmall: { fontSize: 10, color: '#8E8E93', fontWeight: '700' },
  metricLabel: { color: '#8E8E93', fontSize: 12, fontWeight: '600' }
});