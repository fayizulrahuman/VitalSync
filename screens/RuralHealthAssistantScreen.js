import React, { useState, useEffect, useContext } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Speech from 'expo-speech';
import { MedicineContext } from '../context/MedicineContext';
import { backupDataToCloud } from '../CloudSync';
import { auth } from '../firebaseConfig';
// --- EXPANDED SYMPTOM DATABASE (6 questions) ---
const SYMPTOMS_DATA = [
  {
    id: 'q1',
    question: 'Do you have a fever?',
    icon: 'thermometer',
    actions: [
      { icon: 'leaf', text: 'Rest and stay hydrated' },
      { icon: 'pill', text: 'Take paracetamol if needed' },
      { icon: 'doctor', text: 'Consult a doctor if it continues' }
    ],
    tip: 'Drink warm fluids, rest well and monitor your temperature.'
  },
  {
    id: 'q2',
    question: 'Do you have a severe cough?',
    icon: 'weather-windy',
    actions: [
      { icon: 'cup-water', text: 'Drink warm water or honey tea' },
      { icon: 'face-mask', text: 'Wear a mask to protect others' },
      { icon: 'hospital-building', text: 'Visit clinic if breathing is hard' }
    ],
    tip: 'Steam inhalation can help soothe a sore throat and clear your airways.'
  },
  {
    id: 'q3',
    question: 'Are you experiencing body aches?',
    icon: 'human-handsdown',
    actions: [
      { icon: 'bed', text: 'Get plenty of rest and sleep' },
      { icon: 'bottle-tonic-plus', text: 'Apply a warm compress' },
      { icon: 'pill', text: 'Take mild pain relievers' }
    ],
    tip: 'Gentle stretching and adequate sleep help muscles recover faster.'
  },
  {
    id: 'q4',
    question: 'Do you have shortness of breath or difficulty breathing?',
    icon: 'lungs',
    actions: [
      { icon: 'oxygen', text: 'Sit upright and try to stay calm' },
      { icon: 'alert', text: 'Seek immediate medical help if severe' },
      { icon: 'monitor', text: 'Monitor oxygen levels if possible' }
    ],
    tip: 'Difficulty breathing can be a sign of a serious condition – do not ignore it.'
  },
  {
    id: 'q5',
    question: 'Do you have a headache?',
    icon: 'head',
    actions: [
      { icon: 'water', text: 'Drink water (dehydration can cause headaches)' },
      { icon: 'sleep', text: 'Rest in a dark, quiet room' },
      { icon: 'pill', text: 'Consider paracetamol or ibuprofen' }
    ],
    tip: 'Most headaches improve with rest and hydration. If severe or with stiff neck, see a doctor.'
  },
  {
    id: 'q6',
    question: 'Do you feel nauseous or have vomiting / diarrhea?',
    icon: 'stomach',
    actions: [
      { icon: 'cup-water', text: 'Sip ORS solution or clear fluids' },
      { icon: 'food-apple', text: 'Eat bland foods like rice, banana' },
      { icon: 'doctor', text: 'Seek help if unable to keep fluids down' }
    ],
    tip: 'Diarrhea and vomiting can cause dehydration. Drink ORS even if you feel you cannot eat.'
  }
];

// --- ENHANCED DIAGNOSIS LOGIC (handles 6 symptoms) ---
const getDiagnosis = (answers) => {
  const fever = answers.q1 === 'yes';
  const cough = answers.q2 === 'yes';
  const aches = answers.q3 === 'yes';
  const breathless = answers.q4 === 'yes';
  const headache = answers.q5 === 'yes';
  const nausea = answers.q6 === 'yes';

  // --- Critical / emergency conditions ---
  if (breathless) {
    return {
      name: '⚠️ Possible Respiratory Distress',
      severity: 'High – Seek medical attention',
      advice: 'Shortness of breath can be a sign of pneumonia, asthma, COVID‑19, or heart issues. Do not delay – visit a doctor or hospital today.',
      selfCare: 'Sit upright, loosen tight clothing, use a fan for air circulation. Do not lie flat. Call emergency services if condition worsens.'
    };
  }

  // --- Combination patterns ---
  if (fever && cough && breathless) {
    return {
      name: 'Possible Pneumonia or Severe COVID‑19',
      severity: 'High – Urgent care recommended',
      advice: 'Fever, cough and difficulty breathing together require immediate medical evaluation. Go to the nearest health centre.',
      selfCare: 'Avoid self‑medication. Wear a mask to protect others, isolate yourself, and seek professional care.'
    };
  }

  if (fever && cough && (aches || headache)) {
    return {
      name: 'Likely Viral Respiratory Infection (e.g., Flu, COVID‑19)',
      severity: 'Moderate to High',
      advice: 'Rest, hydrate, take paracetamol for fever/pain. Monitor oxygen levels if possible. If breathing becomes difficult, go to hospital.',
      selfCare: 'Isolate, wear a mask, use a humidifier, and take warm fluids. Seek testing if available.'
    };
  }

  if (nausea && (fever || aches)) {
    return {
      name: 'Possible Gastroenteritis / Food Poisoning',
      severity: 'Moderate',
      advice: 'Focus on hydration (ORS). Avoid solid food for a few hours. If vomiting persists >24h or blood appears, see a doctor.',
      selfCare: 'Rest your stomach: start with small sips of water, then broth or rice water. Avoid dairy and spicy foods.'
    };
  }

  if (headache && (nausea || fever)) {
    return {
      name: 'Possible Migraine or Viral Illness',
      severity: 'Mild to Moderate',
      advice: 'Rest in a dark, quiet room. Apply a cold compress to forehead. If headache is severe with stiff neck or rash, see a doctor.',
      selfCare: 'Stay hydrated, avoid bright screens, and take paracetamol if tolerated.'
    };
  }

  if (fever && !cough && !breathless && !nausea) {
    return {
      name: 'Mild Fever – Possibly Early Infection',
      severity: 'Mild',
      advice: 'Monitor temperature, stay hydrated, rest. If fever exceeds 101°F (38.3°C) for more than 2 days, see a doctor.',
      selfCare: 'Sponge bath with lukewarm water, wear light clothing, and drink ORS solution.'
    };
  }

  if (cough && !fever && !breathless) {
    return {
      name: 'Dry / Productive Cough – Possible Allergy or Post‑Nasal Drip',
      severity: 'Mild',
      advice: 'Avoid dust and cold air. Try honey‑ginger tea. If blood appears or breathing becomes troubled, seek immediate care.',
      selfCare: 'Use a scarf to cover mouth in cold weather, avoid smoking, and elevate head while sleeping.'
    };
  }

  if (aches && !fever && !headache) {
    return {
      name: 'General Body Aches – Likely Fatigue / Overexertion',
      severity: 'Mild',
      advice: 'Take a warm bath, gentle stretches, and ensure good sleep. If accompanied by redness or swelling, consult a doctor.',
      selfCare: 'Apply a heating pad, stay hydrated, and avoid heavy lifting.'
    };
  }

  if (headache && !fever && !nausea) {
    return {
      name: 'Tension Headache or Dehydration',
      severity: 'Mild',
      advice: 'Drink 2‑3 glasses of water, rest in a dim room. If headaches become frequent or very severe, see a doctor.',
      selfCare: 'Practice neck stretches, reduce screen time, and maintain regular meal times.'
    };
  }

  if (nausea && !fever && !aches) {
    return {
      name: 'Mild Nausea – Possible Indigestion or Anxiety',
      severity: 'Mild',
      advice: 'Sip ginger tea or clear fluids. Eat small, bland meals (crackers, rice). If vomiting persists, seek medical advice.',
      selfCare: 'Avoid strong smells, lie down with head elevated, and breathe slowly.'
    };
  }

  // No significant symptoms
  return {
    name: 'No significant symptoms detected',
    severity: 'None',
    advice: 'You seem well! Continue maintaining good hygiene, balanced diet, and regular exercise.',
    selfCare: 'Stay active, drink water, and get 7-8 hours of sleep daily.'
  };
};

export default function RuralHealthAssistantScreen({ navigation }) {
  const { showAlert } = useContext(MedicineContext);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [isSyncing, setIsSyncing] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [diagnosis, setDiagnosis] = useState(null);

  const currentQ = SYMPTOMS_DATA[currentIndex];
  const nextQ = SYMPTOMS_DATA[currentIndex + 1];
  const totalQuestions = SYMPTOMS_DATA.length;

  useEffect(() => {
    loadAnswers();
  }, []);

  useEffect(() => {
    if (Object.keys(answers).length === totalQuestions) {
      const diag = getDiagnosis(answers);
      setDiagnosis(diag);
      setCompleted(true);
    } else {
      setCompleted(false);
    }
  }, [answers]);

  const loadAnswers = async () => {
    const saved = await AsyncStorage.getItem('@vital_sync_symptoms');
    if (saved) {
      const parsed = JSON.parse(saved);
      setAnswers(parsed);
      if (Object.keys(parsed).length === totalQuestions) {
        setCompleted(true);
        setDiagnosis(getDiagnosis(parsed));
      } else {
        const firstUnanswered = SYMPTOMS_DATA.findIndex(q => !parsed[q.id]);
        if (firstUnanswered !== -1) setCurrentIndex(firstUnanswered);
      }
    }
  };

  const saveAnswers = async (newAnswers) => {
    await AsyncStorage.setItem('@vital_sync_symptoms', JSON.stringify(newAnswers));
  };

  const handleAnswer = async (answer) => {
    const newAnswers = { ...answers, [currentQ.id]: answer };
    setAnswers(newAnswers);
    await saveAnswers(newAnswers);

    if (currentIndex < totalQuestions - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      showAlert("Checkup Complete", "Analyzing your symptoms...", "success");
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) setCurrentIndex(currentIndex - 1);
  };

  const resetCheckup = () => {
    setAnswers({});
    setCurrentIndex(0);
    setCompleted(false);
    setDiagnosis(null);
    AsyncStorage.removeItem('@vital_sync_symptoms');
    showAlert("Reset", "You can start a new symptom check.", "info");
  };

  const readQuestionOutLoud = () => {
    Speech.stop();
    Speech.speak(currentQ.question, { rate: 0.9, pitch: 1 });
  };

  const findNearbyHospitals = () => {
    const url = Platform.select({
      ios: 'maps://?q=nearby+hospitals+clinics',
      android: 'geo:0,0?q=nearby+hospitals+clinics'
    });
    Linking.canOpenURL(url).then(supported => {
      if (supported) Linking.openURL(url);
      else Linking.openURL('https://www.google.com/maps/search/nearby+hospitals+clinics');
    });
  };

  const callHelpline = () => {
    Linking.openURL('tel:108');
  };

  const handleSync = async () => {
    setIsSyncing(true);
    // 🛑 FIXED: Actually call the real cloud backup!
    if (auth.currentUser) {
      await backupDataToCloud(auth.currentUser.uid);
      showAlert("Synced", "Your offline data has been securely backed up.", "success");
    } else {
      showAlert("Error", "You must be logged in to sync data.", "error");
    }
    setIsSyncing(false);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconButton} onPress={() => { Speech.stop(); navigation.goBack(); }}>
          <Ionicons name="chevron-back" size={24} color="#1C1C1E" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Rural Health Assistant</Text>
          <Text style={styles.headerSubtitle}>Offline care. Always there.</Text>
        </View>
        <View style={styles.offlineBadge}>
          <Ionicons name="wifi-outline" size={12} color="#15803D" style={{marginRight: 4}} />
          <Text style={styles.offlineBadgeText}>Offline Ready</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {!completed ? (
          <>
            <View style={styles.checkerCard}>
              <View style={styles.checkerHeader}>
                <MaterialCommunityIcons name="stethoscope" size={20} color="#15803D" />
                <Text style={styles.checkerTitle}>Symptom Checker ({currentIndex+1}/{totalQuestions})</Text>
              </View>

              <View style={styles.questionArea}>
                <View style={styles.iconWrap}>
                  <MaterialCommunityIcons name={currentQ.icon} size={32} color="#15803D" />
                </View>
                <View style={{flex: 1}}>
                  <Text style={styles.questionText}>{currentQ.question}</Text>
                  <Text style={styles.questionSub}>Tap Yes or No – we’ll move to the next question.</Text>
                </View>
              </View>

              <View style={styles.answerRow}>
                <TouchableOpacity 
                  style={[styles.answerBtn, answers[currentQ.id] === 'yes' ? styles.answerBtnYes : styles.answerBtnOutline]} 
                  onPress={() => handleAnswer('yes')}
                >
                  <Text style={answers[currentQ.id] === 'yes' ? styles.answerTextWhite : styles.answerTextGreen}>Yes</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.answerBtn, answers[currentQ.id] === 'no' ? styles.answerBtnYes : styles.answerBtnOutline]} 
                  onPress={() => handleAnswer('no')}
                >
                  <Text style={answers[currentQ.id] === 'no' ? styles.answerTextWhite : styles.answerTextGreen}>No</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.readBtn} onPress={readQuestionOutLoud}>
                <Ionicons name="volume-high" size={18} color="#1C1C1E" style={{marginRight: 6}} />
                <Text style={styles.readBtnText}>Read Question</Text>
              </TouchableOpacity>

              <View style={styles.dotsRow}>
                {SYMPTOMS_DATA.map((_, idx) => (
                  <View key={idx} style={[styles.dot, currentIndex === idx && styles.dotActive]} />
                ))}
              </View>
            </View>

            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <View style={styles.greenCheckWrap}><Ionicons name="checkmark" size={14} color="#FFFFFF" /></View>
                <View style={{flex: 1, marginLeft: 10}}>
                  <Text style={styles.cardTitle}>Suggested Actions</Text>
                  <Text style={styles.cardSub}>Based on your last answer, you can:</Text>
                </View>
              </View>
              <View style={styles.actionsRow}>
                <View style={styles.actionsList}>
                  {currentQ.actions.map((act, i) => (
                    <View key={i} style={styles.actionListItem}>
                      <MaterialCommunityIcons name={act.icon} size={16} color="#15803D" style={{marginRight: 10, width: 20}} />
                      <Text style={styles.actionListText}>{act.text}</Text>
                    </View>
                  ))}
                </View>
                <View style={styles.kitPlaceholder}>
                  <MaterialCommunityIcons name="medical-bag" size={60} color="#34C759" />
                </View>
              </View>
            </View>

            <View style={[styles.card, {backgroundColor: '#FFFBEB', borderColor: '#FEF3C7'}]}>
              <View style={styles.cardHeaderRow}>
                <View style={styles.bulbIconWrap}><Ionicons name="bulb" size={16} color="#D97706" /></View>
                <Text style={[styles.cardTitle, {color: '#D97706', marginLeft: 10}]}>Health Tip</Text>
              </View>
              <View style={styles.tipsRow}>
                <Text style={styles.tipsText}>{currentQ.tip}</Text>
                <MaterialCommunityIcons name="tea" size={50} color="#FBBF24" />
              </View>
            </View>

            {nextQ && (
              <View style={styles.nextBanner}>
                <View style={{flex: 1}}>
                  <Text style={styles.nextBannerLabel}>Next Question</Text>
                  <Text style={styles.nextBannerTitle}>{nextQ.question}</Text>
                </View>
                <TouchableOpacity style={styles.nextBannerBtn} onPress={() => setCurrentIndex(currentIndex + 1)}>
                  <Text style={styles.nextBannerBtnText}>Skip {'>'}</Text>
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity 
              style={[styles.prevBtn, currentIndex === 0 && {opacity: 0.5}]} 
              onPress={handlePrev}
              disabled={currentIndex === 0}
            >
              <Text style={styles.prevBtnText}>{'<'} Previous</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <View style={[styles.checkerCard, {backgroundColor: '#E6F7E6'}]}>
              <View style={styles.checkerHeader}>
                <MaterialCommunityIcons name="clipboard-text" size={20} color="#15803D" />
                <Text style={styles.checkerTitle}>Symptom Analysis Complete</Text>
              </View>
              <View style={styles.diagnosisContainer}>
                <MaterialCommunityIcons name="heart-plus" size={48} color="#15803D" style={{marginBottom: 10}} />
                <Text style={styles.diagnosisName}>{diagnosis?.name}</Text>
                <View style={styles.severityBadge}>
                  <Text style={styles.severityText}>Severity: {diagnosis?.severity}</Text>
                </View>
                <Text style={styles.adviceText}>{diagnosis?.advice}</Text>
                <Text style={styles.selfCareTitle}>Self‑Care Tips:</Text>
                <Text style={styles.selfCareText}>{diagnosis?.selfCare}</Text>
              </View>
              <TouchableOpacity style={styles.resetBtn} onPress={resetCheckup}>
                <Text style={styles.resetBtnText}>Start New Checkup</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* Utility cards (visible in both modes) */}
        <View style={[styles.card, styles.rowCard]}>
          <View style={styles.pinIconWrap}>
            <Ionicons name="location" size={20} color="#FFFFFF" />
          </View>
          <View style={styles.rowCardText}>
            <Text style={styles.cardTitle}>Find Nearby Health Center</Text>
            <Text style={styles.cardSub}>Get directions to the nearest health center.</Text>
          </View>
          <TouchableOpacity style={styles.directionsBtn} onPress={findNearbyHospitals}>
            <Text style={styles.directionsText}>View Directions {'>'}</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.card, styles.rowCard]}>
          <View style={styles.phoneIconWrap}>
            <Ionicons name="call" size={20} color="#FFFFFF" />
          </View>
          <View style={styles.rowCardText}>
            <Text style={styles.cardTitle}>Emergency Help</Text>
            <Text style={styles.cardSub}>Need immediate assistance?</Text>
          </View>
          <TouchableOpacity style={styles.callBtn} onPress={callHelpline}>
            <Ionicons name="call" size={14} color="#FFFFFF" style={{marginRight: 4}}/>
            <Text style={styles.callText}>Call Helpline</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footerSync}>
          <Ionicons name="cloud-offline-outline" size={28} color="#15803D" style={{marginRight: 10}} />
          <View style={{flex: 1}}>
            <Text style={styles.footerText}>This app works offline. Your data is safe</Text>
            <Text style={styles.footerText}>and will sync when you're online.</Text>
          </View>
          <TouchableOpacity style={styles.syncBtn} onPress={handleSync}>
            <Ionicons name="sync" size={14} color="#15803D" style={{marginRight: 4}} />
            <Text style={styles.syncText}>{isSyncing ? "Syncing..." : "Sync Now"}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8F9FF' },
  scrollContent: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 40 },
  
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingHorizontal: 20 },
  iconButton: { width: 44, height: 44, backgroundColor: '#FFFFFF', borderRadius: 22, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 3 },
  headerTitleContainer: { alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#1C1C1E', marginBottom: 2 },
  headerSubtitle: { fontSize: 13, color: '#8E8E93', fontWeight: '500' },
  offlineBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#DCFCE7', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: '#BBF7D0' },
  offlineBadgeText: { color: '#15803D', fontSize: 11, fontWeight: '700' },

  card: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 18, marginBottom: 15, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 10, elevation: 2, borderWidth: 1, borderColor: '#F0F0F0' },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  cardTitle: { fontSize: 16, fontWeight: '800', color: '#1C1C1E', marginBottom: 2 },
  cardSub: { fontSize: 13, color: '#8E8E93' },

  checkerCard: { backgroundColor: '#F0FDF4', borderRadius: 24, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: '#DCFCE7' },
  checkerHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  checkerTitle: { fontSize: 16, fontWeight: '800', color: '#15803D', marginLeft: 8 },
  questionArea: { flexDirection: 'row', alignItems: 'center', marginBottom: 25 },
  iconWrap: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#DCFCE7', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  questionText: { fontSize: 18, fontWeight: '800', color: '#1C1C1E', marginBottom: 4 },
  questionSub: { fontSize: 13, color: '#636366', lineHeight: 18 },
  answerRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  answerBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  answerBtnYes: { backgroundColor: '#15803D', marginRight: 10 },
  answerBtnOutline: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D1D5DB', marginLeft: 10 },
  answerTextWhite: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  answerTextGreen: { color: '#1C1C1E', fontSize: 16, fontWeight: '700' },
  readBtn: { flexDirection: 'row', alignItems: 'center', alignSelf: 'center', backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2, marginBottom: 20 },
  readBtnText: { fontSize: 13, fontWeight: '700', color: '#1C1C1E' },
  dotsRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#D1D5DB', marginHorizontal: 4 },
  dotActive: { backgroundColor: '#15803D' },

  greenCheckWrap: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#15803D', justifyContent: 'center', alignItems: 'center' },
  actionsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  actionsList: { flex: 1 },
  actionListItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  actionListText: { fontSize: 14, color: '#48484A', flex: 1 },
  kitPlaceholder: { width: 80, height: 80, justifyContent: 'center', alignItems: 'center', backgroundColor: '#DCFCE7', borderRadius: 16, marginLeft: 10 },

  rowCard: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  rowCardText: { flex: 1, marginHorizontal: 15 },
  pinIconWrap: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#34C759', justifyContent: 'center', alignItems: 'center' },
  directionsBtn: { backgroundColor: '#15803D', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8 },
  directionsText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  
  phoneIconWrap: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#FF3B30', justifyContent: 'center', alignItems: 'center' },
  callBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FF3B30', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8 },
  callText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },

  bulbIconWrap: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#FEF3C7', justifyContent: 'center', alignItems: 'center' },
  tipsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 10 },
  tipsText: { flex: 1, fontSize: 14, color: '#92400E', lineHeight: 22, paddingRight: 10, fontWeight: '500' },

  nextBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#5E5CE6', borderRadius: 16, padding: 20, marginBottom: 15, shadowColor: '#5E5CE6', shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  nextBannerLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '600', marginBottom: 4 },
  nextBannerTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  nextBannerBtn: { backgroundColor: '#FFFFFF', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
  nextBannerBtnText: { color: '#5E5CE6', fontWeight: '800', fontSize: 14 },

  prevBtn: { backgroundColor: '#FFFFFF', paddingVertical: 16, borderRadius: 16, alignItems: 'center', marginBottom: 30, borderWidth: 1, borderColor: '#E5E5EA' },
  prevBtnText: { fontSize: 15, fontWeight: '700', color: '#636366' },

  footerSync: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0FDF4', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#DCFCE7' },
  footerText: { fontSize: 12, color: '#15803D', lineHeight: 18 },
  syncBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#DCFCE7', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  syncText: { color: '#15803D', fontSize: 12, fontWeight: '700' },

  // Completion / Diagnosis styles
  diagnosisContainer: { alignItems: 'center', marginVertical: 10 },
  diagnosisName: { fontSize: 20, fontWeight: '800', color: '#1C1C1E', textAlign: 'center', marginVertical: 8 },
  severityBadge: { backgroundColor: '#FFEDD5', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, marginBottom: 15 },
  severityText: { fontSize: 12, fontWeight: '700', color: '#9A3412' },
  adviceText: { fontSize: 15, color: '#48484A', textAlign: 'center', lineHeight: 22, marginBottom: 20 },
  selfCareTitle: { fontSize: 16, fontWeight: '800', color: '#15803D', alignSelf: 'flex-start', marginBottom: 6 },
  selfCareText: { fontSize: 14, color: '#636366', lineHeight: 20, marginBottom: 20 },
  resetBtn: { backgroundColor: '#15803D', paddingVertical: 12, borderRadius: 30, alignItems: 'center', marginTop: 10 },
  resetBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 }
});