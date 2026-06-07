import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, Modal, 
  TextInput, ScrollView, ActivityIndicator, Alert, 
  Platform, AppState 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Rect, Line, Text as SvgText } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Pedometer } from 'expo-sensors';

// Conditionally import platform-specific modules
let AndroidPedometer = null;
if (Platform.OS === 'android') {
  try {
    AndroidPedometer = require('expo-android-pedometer');
  } catch (e) {
    console.log('expo-android-pedometer not installed');
  }
}

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

  const pedometerSubscription = useRef(null);
  const appState = useRef(AppState.currentState);

  const formatDateKey = (dateObj) => {
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

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

  // Initialize background step counting for development build
  useEffect(() => {
    const initBackgroundTracking = async () => {
      if (Platform.OS === 'android' && AndroidPedometer) {
        await setupAndroidBackgroundTracking();
      } else if (Platform.OS === 'ios') {
        await setupIOSBackgroundTracking();
      }
    };
    
    initBackgroundTracking();

    // Handle app state changes
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      subscription.remove();
      stopLiveStepTracking();
    };
  }, []);

  // Load steps when date changes
  useEffect(() => {
    const loadStepsForSelectedDate = async () => {
      setIsLoading(true);
      const dateKey = formatDateKey(selectedDate);
      const todayKey = formatDateKey(new Date());

      try {
        // First try to get steps from AsyncStorage
        let savedSteps = await AsyncStorage.getItem(`@vital_steps_${dateKey}`);
        let parsedSteps = savedSteps ? parseInt(savedSteps) : 0;
        
        // For today, also check native pedometer for most accurate count
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

        // Only start live tracking for today's view
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

    loadStepsForSelectedDate();
  }, [selectedDate]);

  const setupAndroidBackgroundTracking = async () => {
    try {
      // Initialize the pedometer module
      const initialized = await AndroidPedometer.initialize();
      console.log('Pedometer initialized:', initialized);

      // Check and request permissions
      const activityPerm = await AndroidPedometer.getActivityPermissionStatus();
      const notifPerm = await AndroidPedometer.getNotificationPermissionStatus();
      
      if (!activityPerm.granted) {
        const permResponse = await AndroidPedometer.requestPermissions();
        if (!permResponse.granted) {
          setPermissionStatus('denied');
          Alert.alert(
            'Permission Required',
            'Step counting needs activity recognition permission to work in background.'
          );
          return;
        }
      }

      if (!notifPerm.granted && Platform.Version >= 33) {
        await AndroidPedometer.requestNotificationPermissions();
      }

      setPermissionStatus('granted');

      // Setup background updates with persistent notification
      await AndroidPedometer.setupBackgroundUpdates({
        title: "Step Counter Active",
        contentTemplate: "Today's steps: %d",
        style: "bigText",
      });

      setIsBackgroundActive(true);

      // Subscribe to real-time updates (works in foreground and background)
      const unsubscribe = AndroidPedometer.subscribeToChange(async (event) => {
        const todayKey = formatDateKey(new Date());
        await AsyncStorage.setItem(`@vital_steps_${todayKey}`, event.steps.toString());
        await AsyncStorage.setItem('@vital_sync_steps_total', event.steps.toString());
        
        // Update UI if we're on today's view
        const currentViewKey = formatDateKey(selectedDate);
        if (currentViewKey === todayKey) {
          setDailySteps(event.steps);
          generateDynamicChart(event.steps);
        }
      });

      // Store for cleanup
      global.__pedometerUnsubscribe = unsubscribe;

    } catch (error) {
      console.error('Android pedometer setup failed:', error);
      setPermissionStatus('error');
      // Fall back to accelerometer method
      startAccelerometerFallback();
    }
  };

  const setupIOSBackgroundTracking = async () => {
    try {
      const { status } = await Pedometer.requestPermissionsAsync();
      if (status !== 'granted') {
        setPermissionStatus('denied');
        return;
      }
      setPermissionStatus('granted');
      
      // iOS uses periodic fetching via background tasks
      // Steps are already tracked by HealthKit/CoreMotion
      // We just need to sync when app becomes active
      
      // Get today's steps from pedometer
      const end = new Date();
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const result = await Pedometer.getStepCountAsync(start, end);
      if (result && result.steps) {
        const todayKey = formatDateKey(new Date());
        await AsyncStorage.setItem(`@vital_steps_${todayKey}`, result.steps.toString());
        const currentViewKey = formatDateKey(selectedDate);
        if (currentViewKey === todayKey) {
          setDailySteps(result.steps);
          generateDynamicChart(result.steps);
        }
      }
      
      setIsBackgroundActive(true);
    } catch (error) {
      console.error('iOS pedometer setup failed:', error);
      startAccelerometerFallback();
    }
  };

  const startLiveStepTracking = async (initialStepsForToday) => {
    stopLiveStepTracking();
    
    const todayKey = formatDateKey(new Date());
    
    // If we have native background tracking active, don't start duplicate tracking
    if (isBackgroundActive && Platform.OS === 'android' && AndroidPedometer) {
      console.log('Background tracking already active');
      return;
    }
    
    try {
      const { status } = await Pedometer.requestPermissionsAsync();
      
      if (status === 'granted') {
        // Use official Pedometer for foreground tracking
        pedometerSubscription.current = Pedometer.watchStepCount(result => {
          const totalStepsNow = initialStepsForToday + result.steps;
          updateUIAndStorage(totalStepsNow, todayKey);
        });
      } else {
        // Fallback to accelerometer for devices without step counter
        startAccelerometerFallback(initialStepsForToday);
      }
    } catch (error) {
      console.log("Tracking error:", error);
      startAccelerometerFallback(initialStepsForToday);
    }
  };

  const startAccelerometerFallback = (initialSteps = 0) => {
    // This is the fallback method you already had
    // Import Accelerometer dynamically to avoid issues
    const { Accelerometer } = require('expo-sensors');
    let lastStepTime = useRef(0);
    let currentSteps = initialSteps;
    const todayKey = formatDateKey(new Date());
    
    Accelerometer.setUpdateInterval(150);
    pedometerSubscription.current = Accelerometer.addListener(accelerometerData => {
      const { x, y, z } = accelerometerData;
      const magnitude = Math.sqrt(x * x + y * y + z * z);
      
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

  const handleAppStateChange = (nextAppState) => {
    if (nextAppState === 'active') {
      // App came to foreground - refresh steps
      const todayKey = formatDateKey(new Date());
      const selectedKey = formatDateKey(selectedDate);
      
      if (selectedKey === todayKey) {
        refreshTodaySteps();
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
    } else if (Platform.OS === 'ios') {
      try {
        const end = new Date();
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        const result = await Pedometer.getStepCountAsync(start, end);
        if (result && result.steps) {
          setDailySteps(result.steps);
          generateDynamicChart(result.steps);
          await AsyncStorage.setItem(`@vital_steps_${todayKey}`, result.steps.toString());
        }
      } catch (e) {
        console.log('Refresh failed:', e);
      }
    }
  };

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

  const durationMinutes = Math.floor(dailySteps / 100);
  const durationSeconds = Math.floor((dailySteps % 100) * 0.6);
  const distanceMeters = Math.floor(dailySteps * 0.76);
  const calories = Math.floor(dailySteps * 0.04);

  const saveGoal = async () => {
    const parsedGoal = parseInt(newGoal);
    if (!isNaN(parsedGoal) && parsedGoal > 0) {
      setGoal(parsedGoal);
      await AsyncStorage.setItem('@vital_sync_step_goal', parsedGoal.toString());
    }
    setGoalModalVisible(false);
  };

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
        <View style={{ width: 44 }} />
      </View>

      {/* Background tracking indicator */}
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

        <View style={styles.metricsCard}>
          <View style={styles.metricItem}>
            <View style={[styles.iconCircle, {backgroundColor: '#FFF0F0'}]}>
              <MaterialCommunityIcons name="clock-outline" size={20} color="#FF3B30" />
            </View>
            <Text style={styles.metricValue}>{durationMinutes}<Text style={styles.metricUnit}>M</Text> {durationSeconds}<Text style={styles.metricUnit}>S</Text></Text>
            <Text style={styles.metricLabel}>Duration</Text>
          </View>
          
          <View style={styles.metricItem}>
            <View style={[styles.iconCircle, {backgroundColor: '#F0F8FF'}]}>
              <MaterialCommunityIcons name="map-marker-outline" size={20} color="#32ADE6" />
            </View>
            <Text style={styles.metricValue}>{distanceMeters}<Text style={styles.metricUnit}>M</Text></Text>
            <Text style={styles.metricLabel}>Distance</Text>
          </View>
          
          <View style={styles.metricItem}>
            <View style={[styles.iconCircle, {backgroundColor: '#FFF5E5'}]}>
              <MaterialCommunityIcons name="fire" size={20} color="#FF9500" />
            </View>
            <Text style={styles.metricValue}>{calories}<Text style={styles.metricUnit}>KCAL</Text></Text>
            <Text style={styles.metricLabel}>Calories</Text>
          </View>
        </View>
        
      </ScrollView>

      <Modal visible={isGoalModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Set Step Goal</Text>
            <TextInput 
              style={styles.input} 
              keyboardType="number-pad" 
              value={newGoal} 
              onChangeText={setNewGoal} 
              maxLength={5}
            />
            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={styles.modalBtnCancel} onPress={() => setGoalModalVisible(false)}>
                <Text style={styles.modalBtnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtnSave} onPress={saveGoal}>
                <Text style={styles.modalBtnSaveText}>Save</Text>
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
  metricsCard: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderRadius: 24, marginHorizontal: 20, padding: 20, justifyContent: 'space-around', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 15, elevation: 3, borderWidth: 1, borderColor: '#F0F0F0' },
  metricItem: { alignItems: 'center', flex: 1 },
  iconCircle: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  metricValue: { color: '#1C1C1E', fontSize: 18, fontWeight: '800', marginBottom: 4 },
  metricUnit: { fontSize: 11, color: '#8E8E93', fontWeight: '700' },
  metricLabel: { color: '#8E8E93', fontSize: 12, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'hsla(0, 0%, 0%, 0.50)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 25, width: '80%', alignItems: 'center' },
  modalTitle: { color: '#1C1C1E', fontSize: 18, fontWeight: '800', marginBottom: 20 },
  input: { backgroundColor: '#F4F4FF', color: '#1C1C1E', width: '100%', padding: 15, borderRadius: 16, fontSize: 22, textAlign: 'center', marginBottom: 25, fontWeight: '800' },
  modalBtnRow: { flexDirection: 'row', width: '100%', justifyContent: 'space-between' },
  modalBtnCancel: { flex: 1, padding: 16, alignItems: 'center', borderRadius: 16, backgroundColor: '#F2F2F7', marginRight: 10 },
  modalBtnCancelText: { color: '#8E8E93', fontWeight: '800', fontSize: 15 },
  modalBtnSave: { flex: 1, padding: 16, alignItems: 'center', borderRadius: 16, backgroundColor: '#34C759', marginLeft: 10 },
  modalBtnSaveText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 }
});