import React, { useState, useEffect, useContext, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Modal, Animated, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Path, Circle, Defs, Stop, LinearGradient as SvgGradient } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av'; // ✅ back to expo-av
import { useFocusEffect } from '@react-navigation/native';
import { MedicineContext } from '../context/MedicineContext';
import { backupDataToCloud } from '../CloudSync';
import { auth } from '../firebaseConfig';

const MOODS = [
  { level: 1, label: 'Very Bad', color: '#FF3B30', emoji: '😡' },
  { level: 2, label: 'Bad', color: '#FF9500', emoji: '😟' },
  { level: 3, label: 'Okay', color: '#FFCC00', emoji: '😐' },
  { level: 4, label: 'Good', color: '#34C759', emoji: '🙂' },
  { level: 5, label: 'Great', color: '#32ADE6', emoji: '😄' },
];

export default function MentalHealthScreen({ navigation }) {
  const { showAlert } = useContext(MedicineContext);
  
  const [currentMood, setCurrentMood] = useState(4);
  const [moodHistory, setMoodHistory] = useState([3, 4, 3, 5, 4, 3, 4]); 
  const [streak, setStreak] = useState(0);
  const [tasksDone, setTasksDone] = useState({ mood: false, breathe: false, journal: false, checkin: false });
  const [graphWidth, setGraphWidth] = useState(Dimensions.get('window').width - 80);

  const [isBreathing, setIsBreathing] = useState(false);
  const [showHelpline, setShowHelpline] = useState(false);
  const [showSounds, setShowSounds] = useState(false);
  const [showInsights, setShowInsights] = useState(false);
  const [breathePhase, setBreathePhase] = useState('Inhale...');
  
  const breatheAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;

  // Audio state (expo-av)
  const [sound, setSound] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeTrack, setActiveTrack] = useState(null);

  // Load all data on mount
  useEffect(() => {
    loadDailyData();
    return () => {
      if (sound) {
        sound.unloadAsync().catch(() => {});
      }
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      checkJournalStreak();
    }, [])
  );

  const checkJournalStreak = async () => {
    const today = new Date().toDateString();
    const journalFlag = await AsyncStorage.getItem(`@vital_sync_journal_done_${today}`);
    if (journalFlag === 'true' && !tasksDone.journal) {
      markTaskDone('journal');
    }
  };

  const loadDailyData = async () => {
    const today = new Date().toDateString();
    
    const savedStreak = await AsyncStorage.getItem('@vital_sync_streak');
    const lastStreakDate = await AsyncStorage.getItem('@vital_sync_streak_date');
    if (savedStreak) setStreak(parseInt(savedStreak));

    const savedTasks = await AsyncStorage.getItem(`@vital_sync_tasks_${today}`);
    if (savedTasks) {
      setTasksDone(JSON.parse(savedTasks));
    }

    const savedMood = await AsyncStorage.getItem('@vital_sync_today_mood');
    if (savedMood) {
      setCurrentMood(parseInt(savedMood));
      updateGraph(parseInt(savedMood));
    }
  };

  const markTaskDone = async (taskName) => {
    const today = new Date().toDateString();
    const newTasks = { ...tasksDone, [taskName]: true };
    setTasksDone(newTasks);
    await AsyncStorage.setItem(`@vital_sync_tasks_${today}`, JSON.stringify(newTasks));

    if (newTasks.mood && newTasks.breathe && newTasks.journal && newTasks.checkin) {
      const lastStreakDate = await AsyncStorage.getItem('@vital_sync_streak_date');
      if (lastStreakDate !== today) {
        const newStreak = streak + 1;
        setStreak(newStreak);
        await AsyncStorage.setItem('@vital_sync_streak', newStreak.toString());
        await AsyncStorage.setItem('@vital_sync_streak_date', today);
        showAlert("Streak Increased! 🔥", `You have prioritized your mental health for ${newStreak} days in a row!`, "success");
      }
    }
    
    // 🛑 FIXED: Trigger cloud backup for tasks and streak
    if (auth.currentUser) backupDataToCloud(auth.currentUser.uid);
  };

  const handleSetMood = (level) => {
    setCurrentMood(level);
    AsyncStorage.setItem('@vital_sync_today_mood', level.toString());
    updateGraph(level);
    markTaskDone('mood');
    
    // 🛑 FIXED: Trigger cloud backup for mood
    if (auth.currentUser) backupDataToCloud(auth.currentUser.uid);
  };

  const updateGraph = (todayLevel) => {
    const newHistory = [...moodHistory];
    newHistory[6] = todayLevel;
    setMoodHistory(newHistory);
  };

  const handleCheckIn = () => {
    markTaskDone('checkin');
    showAlert("Checked In", "Great job prioritizing your mental health today!", "success");
  };

  // ----- Audio Functions (expo-av - working) -----
  // 🛑 FIXED: Use a Ref to hold the sound so it instantly updates and never overlaps
  const soundRef = useRef(null);

  const playAudio = async (trackNum) => {
    try {
      // Instantly kill any currently playing sound
      if (soundRef.current) {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }

      let audioSource;
      if (trackNum === 1) audioSource = require('../assets/relax1.mp3');
      else if (trackNum === 2) audioSource = require('../assets/relax2.mp3');
      else if (trackNum === 3) audioSource = require('../assets/relax3.mp3');

      const { sound: newSound } = await Audio.Sound.createAsync(
        audioSource,
        { shouldPlay: true, isLooping: true }
      );

      soundRef.current = newSound; // Save to Ref instantly
      setActiveTrack(trackNum);
      setIsPlaying(true);

    } catch (error) {
      console.error('Audio playback error:', error);
      showAlert('Audio Error', 'Could not play audio track.', 'error');
    }
  };

  const stopAudio = async () => {
    if (soundRef.current) {
      try {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
      } catch (e) {
        console.warn('Stop audio error', e);
      }
      soundRef.current = null;
    }
    setIsPlaying(false);
    setActiveTrack(null);
  };

  // Ensure audio stops if user leaves the screen
  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(() => {});
      }
    };
  },[]);

  // ----- Breathing exercise (unchanged) -----
  const startBreathingExercise = () => {
    setIsBreathing(true);
    let cycles = 0;
    const maxCycles = 3;

    const runCycle = () => {
      if (cycles >= maxCycles) {
        setIsBreathing(false);
        markTaskDone('breathe');
        showAlert("Great Job", "You completed your 1-minute breathing exercise.", "success");
        return;
      }

      setBreathePhase('Inhale...');
      Animated.parallel([
        Animated.timing(breatheAnim, { toValue: 2, duration: 4000, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 4000, useNativeDriver: true })
      ]).start(() => {
        setBreathePhase('Hold...');
        setTimeout(() => {
          setBreathePhase('Exhale...');
          Animated.parallel([
            Animated.timing(breatheAnim, { toValue: 1, duration: 8000, useNativeDriver: true }),
            Animated.timing(opacityAnim, { toValue: 0.5, duration: 8000, useNativeDriver: true })
          ]).start(() => {
            cycles++;
            runCycle();
          });
        }, 7000);
      });
    };
    runCycle();
  };

  const stopBreathingExercise = () => {
    setIsBreathing(false);
    breatheAnim.stopAnimation();
    opacityAnim.stopAnimation();
    breatheAnim.setValue(1);
  };

  // ----- Mood Insights -----
  const getMoodStats = () => {
    const validMoods = moodHistory.filter(m => m >= 1 && m <= 5);
    const avg = validMoods.reduce((a,b) => a+b,0) / validMoods.length;
    const mostFrequent = validMoods.sort((a,b) => 
      validMoods.filter(v => v===a).length - validMoods.filter(v => v===b).length
    ).pop();
    const moodName = MOODS.find(m => m.level === mostFrequent)?.label || 'Okay';
    return { average: avg.toFixed(1), mostFrequent: moodName };
  };

  // ----- SVG Graph -----
  const graphHeight = 120;
  const points = moodHistory.map((val, index) => {
    const x = (index / (moodHistory.length - 1)) * graphWidth;
    const y = graphHeight - ((val - 1) / 4) * graphHeight;
    return { x, y };
  });
  const linePath = points.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(' ');
  const areaPath = `${linePath} L ${graphWidth} ${graphHeight} L 0 ${graphHeight} Z`;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color="#1C1C1E" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Mental Health</Text>
          <Text style={styles.headerSubtitle}>Take care of your mind. You matter.</Text>
        </View>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Mood selector */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>How are you feeling today?</Text>
          <View style={styles.moodSelectorRow}>
            {MOODS.map((mood) => (
              <TouchableOpacity key={mood.level} style={styles.moodItem} onPress={() => handleSetMood(mood.level)}>
                <View style={[styles.emojiCircle, { backgroundColor: currentMood === mood.level ? mood.color : '#F2F2F7' }, currentMood === mood.level && styles.emojiCircleActive]}>
                  <Text style={styles.emojiText}>{mood.emoji}</Text>
                </View>
                <Text style={[styles.moodLabel, currentMood === mood.level && {color: mood.color, fontWeight: '800'}]}>{mood.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.sliderTrack}>
            <View style={[styles.sliderFill, { width: `${((currentMood - 1) / 4) * 100}%` }]} />
            <View style={[styles.sliderThumb, { left: `${((currentMood - 1) / 4) * 100}%` }]} />
          </View>
        </View>

        {/* Mood trend with working Insights button */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.sectionTitle}>This Week's Mood Trend</Text>
            <TouchableOpacity onPress={() => setShowInsights(true)}>
              <Text style={styles.linkText}>View Insights {'>'}</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.graphContainer}>
            <View style={styles.yAxisEmojis}>
              {MOODS.slice().reverse().map((m) => (
                <Text key={m.level} style={styles.yAxisEmoji}>{m.emoji}</Text>
              ))}
            </View>
            <View style={styles.graphBody} onLayout={(e) => setGraphWidth(e.nativeEvent.layout.width)}>
              <Svg width={graphWidth} height={graphHeight} style={{ overflow: 'visible' }}>
                <Defs>
                  <SvgGradient id="gradient" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor="#5E5CE6" stopOpacity="0.2" />
                    <Stop offset="1" stopColor="#5E5CE6" stopOpacity="0" />
                  </SvgGradient>
                </Defs>
                <Path d={areaPath} fill="url(#gradient)" />
                <Path d={linePath} fill="none" stroke="#5E5CE6" strokeWidth="2" />
                {points.map((p, i) => (
                  <Circle key={i} cx={p.x} cy={p.y} r="4" fill="#FFFFFF" stroke={i === 6 ? "#34C759" : "#5E5CE6"} strokeWidth="2" />
                ))}
              </Svg>
              <View style={styles.xAxisLabels}>
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, i) => (
                  <Text key={i} style={styles.xAxisText}>{day}</Text>
                ))}
              </View>
            </View>
          </View>
        </View>

        {/* Today's Focus */}
        <View style={styles.focusCard}>
          <View style={styles.focusIconWrap}>
            <MaterialCommunityIcons name="heart-pulse" size={32} color="#5E5CE6" />
          </View>
          <View style={styles.focusContent}>
            <Text style={styles.focusTitle}>Quote</Text>
            <Text style={styles.focusQuote}>"Small steps every day lead to big changes."</Text>
            <Text style={styles.focusSub}>Be kind to your mind.</Text>
          </View>
          <TouchableOpacity style={styles.checkInBtn} onPress={handleCheckIn}>
            <MaterialCommunityIcons name="pencil" size={16} color="#FFFFFF" style={{marginRight: 4}}/>
            <Text style={styles.checkInText}>Check-in</Text>
          </TouchableOpacity>
        </View>

        {/* Quick Actions */}
        <Text style={[styles.sectionTitle, {marginBottom: 10}]}>Quick Actions</Text>
        <View style={styles.gridContainer}>
          <TouchableOpacity style={[styles.gridItem, {backgroundColor: '#F4F4FF'}]} onPress={startBreathingExercise}>
            <MaterialCommunityIcons name="weather-windy" size={32} color="#5E5CE6" style={{marginBottom: 8}}/>
            <Text style={styles.gridItemTitle}>Breathe & Relax</Text>
            <Text style={styles.gridItemSub}>Calm your mind 4-7-8 breathing</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={[styles.gridItem, {backgroundColor: '#FFF0F0'}]} onPress={() => Linking.openURL('tel:')}>
            <MaterialCommunityIcons name="phone-in-talk" size={32} color="#FF3B30" style={{marginBottom: 8}}/>
            <Text style={styles.gridItemTitle}>Talk to Someone</Text>
            <Text style={styles.gridItemSub}>Call a friend or loved one</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.gridItem, {backgroundColor: '#F0FFF4'}]} onPress={() => navigation.navigate('Journal')}>
            <Ionicons name="leaf" size={32} color="#34C759" style={{marginBottom: 8}}/>
            <Text style={styles.gridItemTitle}>Daily Journal</Text>
            <Text style={styles.gridItemSub}>Write your thoughts</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.gridItem, {backgroundColor: '#F0F8FF'}]} onPress={() => setShowSounds(true)}>
            <Ionicons name="moon" size={32} color="#32ADE6" style={{marginBottom: 8}}/>
            <Text style={styles.gridItemTitle}>Sleep Sounds</Text>
            <Text style={styles.gridItemSub}>Relaxing sounds for better sleep</Text>
          </TouchableOpacity>
        </View>

        {/* Helpline Banner */}
        <View style={styles.helplineBanner}>
          <View style={{flex: 1}}>
            <Text style={styles.helplineTitle}>Need immediate help?</Text>
            <Text style={styles.helplineSub}>You are not alone. Reach out for support.</Text>
          </View>
          <TouchableOpacity style={styles.helplineBtn} onPress={() => setShowHelpline(true)}>
            <Ionicons name="call-outline" size={16} color="#FF3B30" />
            <Text style={styles.helplineBtnText}>Helpline Numbers {'>'}</Text>
          </TouchableOpacity>
        </View>

        {/* Streak Card */}
        <View style={styles.streakCard}>
          <View style={styles.streakIconWrap}>
             <MaterialCommunityIcons name="meditation" size={45} color="#5E5CE6" />
          </View>
          <View style={styles.streakContent}>
            <Text style={styles.streakTitle}>You're doing great!</Text>
            <Text style={styles.streakSub}>Complete Mood, Breathing, Check-in, and Journal to increase your streak!</Text>
          </View>
          <View style={styles.streakRingContainer}>
            <Svg width="50" height="50" viewBox="0 0 50 50">
              <Circle cx="25" cy="25" r="22" stroke="#E5E5EA" strokeWidth="4" fill="none" />
              <Circle cx="25" cy="25" r="22" stroke="#5E5CE6" strokeWidth="4" fill="none" strokeDasharray="138" strokeDashoffset={138 - (138 * ((streak > 0 ? streak : 0.1) / Math.max(streak, 7)))} strokeLinecap="round" />
            </Svg>
            <View style={styles.streakRingTextWrap}>
              <Text style={styles.streakRingNum}>{streak}</Text>
              <Text style={styles.streakRingSub}>Days in a row</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Insights Modal */}
      <Modal visible={showInsights} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Mood Insights</Text>
              <TouchableOpacity onPress={() => setShowInsights(false)}><Ionicons name="close" size={24} color="#1C1C1E" /></TouchableOpacity>
            </View>
            {(() => {
              const stats = getMoodStats();
              return (
                <>
                  <View style={styles.insightRow}>
                    <Text style={styles.insightLabel}>Average mood (last 7 days):</Text>
                    <Text style={styles.insightValue}>{stats.average} / 5</Text>
                  </View>
                  <View style={styles.insightRow}>
                    <Text style={styles.insightLabel}>Most frequent mood:</Text>
                    <Text style={styles.insightValue}>{stats.mostFrequent}</Text>
                  </View>
                  <View style={styles.insightRow}>
                    <Text style={styles.insightLabel}>Current streak:</Text>
                    <Text style={styles.insightValue}>{streak} days</Text>
                  </View>
                </>
              );
            })()}
          </View>
        </View>
      </Modal>

      {/* Breathing Modal */}
      <Modal visible={isBreathing} transparent animationType="fade">
        <View style={styles.breatheOverlay}>
          <Text style={styles.breatheTitle}>4-7-8 Breathing</Text>
          <Text style={styles.breathePhaseText}>{breathePhase}</Text>
          <Animated.View style={[styles.breatheCircle, { transform: [{ scale: breatheAnim }], opacity: opacityAnim }]}>
            <MaterialCommunityIcons name="weather-windy" size={50} color="#FFFFFF" />
          </Animated.View>
          <TouchableOpacity style={styles.stopBreatheBtn} onPress={stopBreathingExercise}>
            <Text style={styles.stopBreatheText}>End Session</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Helpline Modal */}
      <Modal visible={showHelpline} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Helpline Numbers</Text>
              <TouchableOpacity onPress={() => setShowHelpline(false)}><Ionicons name="close" size={24} color="#1C1C1E" /></TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.contactRow} onPress={() => Linking.openURL('tel:14416')}>
              <View><Text style={styles.contactName}>Tele MANAS</Text><Text style={styles.contactSub}>Govt. Mental Health Support</Text></View>
              <View style={styles.callIconBg}><Ionicons name="call" size={20} color="#FF3B30" /></View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.contactRow} onPress={() => Linking.openURL('tel:18005990019')}>
              <View><Text style={styles.contactName}>KIRAN Helpline</Text><Text style={styles.contactSub}>Mental Health Rehabilitation</Text></View>
              <View style={styles.callIconBg}><Ionicons name="call" size={20} color="#FF3B30" /></View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.contactRow} onPress={() => Linking.openURL('tel:9820466726')}>
              <View><Text style={styles.contactName}>AASRA</Text><Text style={styles.contactSub}>Suicide Prevention Counseling</Text></View>
              <View style={styles.callIconBg}><Ionicons name="call" size={20} color="#FF3B30" /></View>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Sleep Sounds Modal */}
      <Modal visible={showSounds} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Sleep Sounds</Text>
              <TouchableOpacity onPress={() => { stopAudio(); setShowSounds(false); }}><Ionicons name="close" size={24} color="#1C1C1E" /></TouchableOpacity>
            </View>
            <TouchableOpacity style={[styles.soundRow, activeTrack===1 && styles.soundRowActive]} onPress={() => playAudio(1)}>
              <Ionicons name="rainy-outline" size={24} color={activeTrack===1 ? "#FFFFFF" : "#5E5CE6"} />
              <Text style={[styles.soundText, activeTrack===1 && {color: '#FFFFFF'}]}>Heavy Rain & Thunder</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.soundRow, activeTrack===2 && styles.soundRowActive]} onPress={() => playAudio(2)}>
              <Ionicons name="leaf-outline" size={24} color={activeTrack===2 ? "#FFFFFF" : "#34C759"} />
              <Text style={[styles.soundText, activeTrack===2 && {color: '#FFFFFF'}]}>Forest Ambience</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.soundRow, activeTrack===3 && styles.soundRowActive]} onPress={() => playAudio(3)}>
              <Ionicons name="moon-outline" size={24} color={activeTrack===3 ? "#FFFFFF" : "#32ADE6"} />
              <Text style={[styles.soundText, activeTrack===3 && {color: '#FFFFFF'}]}>Deep Space Drone</Text>
            </TouchableOpacity>
            {isPlaying && (
              <TouchableOpacity style={styles.stopAudioBtn} onPress={stopAudio}>
                <Ionicons name="stop-circle" size={20} color="#FFFFFF" style={{marginRight: 8}} />
                <Text style={{color: '#FFFFFF', fontWeight: '800'}}>Stop Audio</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8F9FF' },
  scrollContent: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 50 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingHorizontal: 20 },
  iconButton: { width: 44, height: 44, backgroundColor: '#FFFFFF', borderRadius: 22, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 3 },
  headerTitleContainer: { alignItems: 'center' },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#1C1C1E', marginBottom: 2 },
  headerSubtitle: { fontSize: 13, color: '#8E8E93', fontWeight: '500' },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#1C1C1E', marginBottom: 15 },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  linkText: { fontSize: 13, fontWeight: '700', color: '#5E5CE6' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 20, marginBottom: 20, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 10, elevation: 2 },
  moodSelectorRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  moodItem: { alignItems: 'center' },
  emojiCircle: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  emojiCircleActive: { shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10, elevation: 5, transform: [{scale: 1.1}] },
  emojiText: { fontSize: 28 },
  moodLabel: { fontSize: 12, color: '#8E8E93', fontWeight: '600' },
  sliderTrack: { height: 6, backgroundColor: '#E5E5EA', borderRadius: 3, width: '100%', position: 'relative', marginTop: 10 },
  sliderFill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: '#5E5CE6', borderRadius: 3 },
  sliderThumb: { position: 'absolute', top: -5, width: 16, height: 16, borderRadius: 8, backgroundColor: '#5E5CE6', shadowColor: '#5E5CE6', shadowOpacity: 0.5, shadowRadius: 5, elevation: 3, marginLeft: -8 },
  graphContainer: { flexDirection: 'row', marginTop: 15 },
  yAxisEmojis: { justifyContent: 'space-between', paddingRight: 10, height: 120, paddingVertical: 0 },
  yAxisEmoji: { fontSize: 16 },
  graphBody: { flex: 1 },
  xAxisLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  xAxisText: { fontSize: 11, color: '#8E8E93', fontWeight: '600' },
  focusCard: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderRadius: 24, padding: 20, marginBottom: 20, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 10, elevation: 2 },
  focusIconWrap: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#F4F4FF', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  focusContent: { flex: 1, marginRight: 10 },
  focusTitle: { fontSize: 14, fontWeight: '800', color: '#1C1C1E', marginBottom: 4 },
  focusQuote: { fontSize: 13, color: '#636366', fontStyle: 'italic', marginBottom: 4, lineHeight: 18 },
  focusSub: { fontSize: 11, color: '#8E8E93' },
  checkInBtn: { flexDirection: 'row', backgroundColor: '#5E5CE6', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 16, alignItems: 'center' },
  checkInText: { color: '#FFFFFF', fontWeight: '700', fontSize: 12 },
  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 20 },
  gridItem: { width: '48%', padding: 20, borderRadius: 24, marginBottom: 15 },
  gridItemTitle: { fontSize: 15, fontWeight: '800', color: '#1C1C1E', marginBottom: 4 },
  gridItemSub: { fontSize: 12, color: '#636366', lineHeight: 16 },
  helplineBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, marginBottom: 20, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 10, elevation: 2 },
  helplineTitle: { fontSize: 15, fontWeight: '800', color: '#1C1C1E', marginBottom: 4 },
  helplineSub: { fontSize: 12, color: '#8E8E93' },
  helplineBtn: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#FFE5E5', backgroundColor: '#FFF0F0', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  helplineBtnText: { color: '#FF3B30', fontSize: 12, fontWeight: '800', marginLeft: 4 },
  streakCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 24, padding: 20, marginBottom: 20, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 10, elevation: 2 },
  streakIconWrap: { width: 60, height: 60, borderRadius: 20, backgroundColor: '#F4F4FF', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  streakContent: { flex: 1, paddingRight: 10 },
  streakTitle: { fontSize: 15, fontWeight: '800', color: '#1C1C1E', marginBottom: 4 },
  streakSub: { fontSize: 11, color: '#636366', lineHeight: 16 },
  streakRingContainer: { width: 50, height: 50, justifyContent: 'center', alignItems: 'center' },
  streakRingTextWrap: { position: 'absolute', alignItems: 'center' },
  streakRingNum: { fontSize: 18, fontWeight: '800', color: '#1C1C1E' },
  streakRingSub: { position: 'absolute', bottom: -25, fontSize: 9, color: '#8E8E93', fontWeight: '600', width: 60, textAlign: 'center' },
  breatheOverlay: { flex: 1, backgroundColor: 'rgba(94, 92, 230, 0.95)', justifyContent: 'center', alignItems: 'center' },
  breatheTitle: { fontSize: 28, fontWeight: '800', color: '#FFFFFF', marginBottom: 10 },
  breathePhaseText: { fontSize: 20, color: 'rgba(255,255,255,0.8)', marginBottom: 60 },
  breatheCircle: { width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  stopBreatheBtn: { position: 'absolute', bottom: 50, backgroundColor: '#FFFFFF', paddingHorizontal: 30, paddingVertical: 15, borderRadius: 24 },
  stopBreatheText: { color: '#5E5CE6', fontSize: 16, fontWeight: '800' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 25, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#1C1C1E' },
  contactRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#E5E5EA' },
  contactName: { fontSize: 16, fontWeight: '700', color: '#1C1C1E', marginBottom: 4 },
  contactSub: { fontSize: 13, color: '#8E8E93' },
  callIconBg: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFF0F0', justifyContent: 'center', alignItems: 'center' },
  soundRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8F9FF', padding: 16, borderRadius: 16, marginBottom: 10 },
  soundRowActive: { backgroundColor: '#5E5CE6' },
  soundText: { fontSize: 15, fontWeight: '700', color: '#1C1C1E', marginLeft: 12 },
  stopAudioBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FF3B30', padding: 16, borderRadius: 16, marginTop: 10 },
  insightRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  insightLabel: { fontSize: 15, fontWeight: '600', color: '#1C1C1E' },
  insightValue: { fontSize: 15, fontWeight: '800', color: '#5E5CE6' },
});