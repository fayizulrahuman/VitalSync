import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { Image, Linking, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const QUICK_ACTIONS = [
  { id: 'appt', title: 'Book\nAppointment', icon: 'calendar', color: '#5E5CE6', actionType: 'url', target: 'https://ors.gov.in/orsportal/selectAppointment' },
  { id: 'records', title: 'Health\nRecords', icon: 'shield-checkmark', color: '#34C759', actionType: 'nav', target: 'Profile' },
  { id: 'consult', title: 'Consult\nDoctor', icon: 'chatbubble-ellipses', color: '#007AFF', actionType: 'url', target: 'https://esanjeevani.mohfw.gov.in/' },
  { id: 'emergency', title: 'Emergency\nHelpline', icon: 'warning', color: '#FF9500', actionType: 'url', target: 'tel:108' },
];

const INBUILT_AVATARS = {
  male: [
    require('../assets/avatars/male1.jpeg'), require('../assets/avatars/male2.jpeg'), require('../assets/avatars/male3.jpeg'),
    require('../assets/avatars/male4.jpeg'), require('../assets/avatars/male5.jpeg'), require('../assets/avatars/male6.jpeg'),
    require('../assets/avatars/male7.jpeg'), require('../assets/avatars/male8.jpeg'), require('../assets/avatars/male9.jpeg'),
    require('../assets/avatars/male10.jpeg'), require('../assets/avatars/male11.jpeg'), require('../assets/avatars/male12.jpeg'),
  ],
  female: [
    require('../assets/avatars/female1.jpeg'), require('../assets/avatars/female2.jpeg'), require('../assets/avatars/female3.jpeg'),
    require('../assets/avatars/female4.jpeg'), require('../assets/avatars/female5.jpeg'), require('../assets/avatars/female6.jpeg'),
    require('../assets/avatars/female7.jpeg'), require('../assets/avatars/female8.jpeg'), require('../assets/avatars/female9.jpeg'),
    require('../assets/avatars/female10.jpeg'), require('../assets/avatars/female11.jpeg'), require('../assets/avatars/female12.jpeg'),
  ]
};

export default function HomeScreen({ navigation }) {
  const [userName, setUserName] = useState('User');
  const [healthScore, setHealthScore] = useState(85);
  const [summaryText, setSummaryText] = useState({ title: "Loading...", sub: "Fetching your vitals." });
  const [notifications, setNotifications] = useState([]);
  const [avatar, setAvatar] = useState({ type: 'inbuilt', gender: 'male', index: 0 });
  const [isNotifVisible, setIsNotifVisible] = useState(false);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadData();
    });
    loadData(); 
    return unsubscribe;
  }, [navigation]);

  const loadData = async () => {
    try {
      const savedName = await AsyncStorage.getItem('@vital_user_name');
      if (savedName) setUserName(savedName);

      const savedAvatar = await AsyncStorage.getItem('@vital_user_avatar');
      if (savedAvatar) setAvatar(JSON.parse(savedAvatar));

      const stepsStr = await AsyncStorage.getItem('@vital_sync_steps_total');
      const goalStr = await AsyncStorage.getItem('@vital_sync_step_goal');
      const hrStr = await AsyncStorage.getItem('@vital_sync_hr');
      const spo2Str = await AsyncStorage.getItem('@vital_sync_spo2');

      const steps = stepsStr ? parseInt(stepsStr) : 0;
      const goal = goalStr ? parseInt(goalStr) : 8000;
      const hr = hrStr ? parseInt(hrStr) : 72;
      const spo2 = spo2Str ? parseInt(spo2Str) : 98;

      const activeAlerts = [];
      
      // 1. Vital Alerts
      if (hr < 60 || hr > 100) {
        activeAlerts.push({ id: 1, title: 'Heart Rate Alert', desc: `Your heart rate is currently ${hr} bpm. Please rest and monitor your vitals.`, time: 'Just Now', icon: 'heart-pulse', color: '#FF3B30', bg: '#FFE5E5' });
      }
      if (spo2 < 95) {
        activeAlerts.push({ id: 2, title: 'Low Oxygen Warning', desc: `Your SpO2 level dropped to ${spo2}%. If you feel breathless, consult a doctor.`, time: 'Just Now', icon: 'water', color: '#FF3B30', bg: '#FFE5E5' });
      }
      if (steps < goal) {
        activeAlerts.push({ id: 3, title: 'Step Goal Pending', desc: `You are ${goal - steps} steps away from your daily goal. Keep moving!`, time: 'Today', icon: 'shoe-sneaker', color: '#5E5CE6', bg: '#EAEBFF' });
      }

      // 2. MEDICINE ALERTS (NEW LOGIC)
      const medsStr = await AsyncStorage.getItem('@vital_sync_meds');
      if (medsStr) {
        const meds = JSON.parse(medsStr);
        const now = new Date();
        const currentMins = now.getHours() * 60 + now.getMinutes();
        const todayStr = now.toDateString();

        meds.forEach(med => {
          med.times.forEach(timeSlot => {
            const historyKey = `${todayStr}-${timeSlot.id}`;
            const isTaken = med.history.includes(historyKey);
            const medMins = timeSlot.hour * 60 + timeSlot.minute;

            if (!isTaken) {
              if (medMins < currentMins) {
                // Missed Medication
                activeAlerts.push({
                  id: `med-missed-${med.id}-${timeSlot.id}`,
                  title: 'Missed Medication',
                  desc: `You missed your ${timeSlot.time} dose of ${med.medName}.`,
                  time: timeSlot.time,
                  icon: 'pill',
                  color: '#FF9500', 
                  bg: '#FFF5E5'
                });
              } else if (medMins <= currentMins + 120) {
                // Upcoming within 2 hours
                activeAlerts.push({
                  id: `med-upcoming-${med.id}-${timeSlot.id}`,
                  title: 'Upcoming Medication',
                  desc: `Take ${med.dosage} of ${med.medName} at ${timeSlot.time}.`,
                  time: timeSlot.time,
                  icon: 'clock-outline',
                  color: '#32ADE6', 
                  bg: '#F0F8FF'
                });
              }
            }
          });
        });
      }

      setNotifications(activeAlerts);

      // 3. Health Score
      let score = 0;
      score += Math.min(40, (steps / goal) * 40); 
      if (hr >= 60 && hr <= 100) score += 30; else score += 15; 
      if (spo2 >= 95) score += 30; else score += 15; 

      const finalScore = Math.round(score);
      setHealthScore(finalScore);

      if (finalScore >= 80) {
        setSummaryText({ title: "You're doing great!", sub: "Stay consistent and take care." });
      } else if (finalScore >= 50) {
        setSummaryText({ title: "Keep it up!", sub: "Small steps lead to big changes." });
      } else {
        setSummaryText({ title: "Needs Attention", sub: "Check your vitals and get some rest." });
      }
    } catch (e) {
      console.log(e);
    }
  };

  const getAvatarSource = () => {
    if (avatar.type === 'uri') return { uri: avatar.uri };
    return INBUILT_AVATARS[avatar.gender]?.[avatar.index] || INBUILT_AVATARS.male[0];
  };

  const handleQuickAction = (action) => {
    if (action.actionType === 'url') {
      Linking.openURL(action.target).catch((err) => console.error("Couldn't load page", err));
    } else if (action.actionType === 'nav') {
      navigation.navigate(action.target);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#E5EDFF', '#F4F7FF', '#E3EDFF']} style={StyleSheet.absoluteFillObject} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
      
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <Image source={getAvatarSource()} style={styles.avatar} />
              <View>
                <Text style={styles.greetingText}>Hello, {userName}</Text>
                <Text style={styles.subtitleText}>Your health, our priority.</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.bellIcon} onPress={() => setIsNotifVisible(true)}>
              <Ionicons name="notifications-outline" size={24} color="#1C1C1E" />
              {notifications.length > 0 && <View style={styles.notificationBadge} />}
            </TouchableOpacity>
          </View>

          <View style={styles.summaryCard}>
            <View style={styles.heartIconBox}>
              <Ionicons name="heart-outline" size={28} color="#5E5CE6" />
            </View>
            <View style={styles.summaryTextContainer}>
              <Text style={styles.summaryLabel}>Health Summary</Text>
              <Text style={styles.summaryTitle}>{summaryText.title}</Text>
              <Text style={styles.summarySub}>{summaryText.sub}</Text>
            </View>
            <View style={styles.scoreContainer}>
              <View style={styles.progressRing}>
                <Text style={{display: 'none'}}>Ring</Text>
              </View>
              <View style={styles.scoreTextWrapper}>
                <Text style={styles.scorePercent}>{healthScore}%</Text>
                <Text style={styles.scoreLabel}>Wellness Score</Text>
              </View>
            </View>
          </View>

          <View style={styles.gridContainer}>
            <FeatureCard 
              title="Medicine Reminder" 
              subtitle="Stay on track with your medicines." 
              buttonText="View Reminders"
              topIcon="alarm"
              imageSource={require('../assets/2.png')} 
              imageStyle={styles.medicineImage} 
              colors={['#C5C8FF', '#9E9CF6']} 
              onPress={() => navigation.navigate('MainTabs', { screen: 'Reminders' })}
            />
            <FeatureCard 
              title="Emergency Blood" 
              subtitle="Give or find blood in emergencies." 
              buttonText="Get Started"
              buttonColor="#FF3B30"
              topIcon="water"
              imageSource={require('../assets/1.png')} 
              imageStyle={styles.bloodImage}
              colors={['#FFD1D1', '#FF9E9E']} 
              onPress={() => navigation.navigate('EmergencyBlood')}
            />
            <FeatureCard 
              title="Mental Health" 
              subtitle="Check your mood and take care of your mind." 
              buttonText="Check-In Now"
              buttonColor="#00A896"
              topIcon="emoticon-happy-outline"
              imageSource={require('../assets/3.png')} 
              imageStyle={styles.brainImage}
              colors={['#C2F0E5', '#95D9C8']} 
              onPress={() => navigation.navigate('MentalHealth')}
            />
            <FeatureCard 
              title="Rural Health Assistant" 
              subtitle="Offline support for you and your family." 
              buttonText="Start Now"
              buttonColor="#D97706"
              topIcon="leaf"
              imageSource={require('../assets/4.png')} 
              imageStyle={styles.houseImage}
              colors={['#FDE6C8', '#F5CD9B']} 
              onPress={() => navigation.navigate('RuralHealthAssistant')}
            />
          </View>

          <View style={styles.quickActionHeader}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickActionsContainer}>
            {QUICK_ACTIONS.map((action) => (
              <QuickActionIcon 
                key={action.id}
                icon={action.icon} 
                label={action.title} 
                color={action.color} 
                onPress={() => handleQuickAction(action)}
              />
            ))}
          </ScrollView>

        </ScrollView>

        {/* --- MODAL: NOTIFICATIONS --- */}
        <Modal visible={isNotifVisible} transparent animationType="slide">
          <View style={styles.modalOverlayBottom}>
            <View style={styles.bottomSheet}>
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>Alerts & Notifications</Text>
                <TouchableOpacity onPress={() => setIsNotifVisible(false)}>
                  <Ionicons name="close-circle" size={28} color="#C7C7CC" />
                </TouchableOpacity>
              </View>

              <ScrollView style={{maxHeight: 400}} showsVerticalScrollIndicator={false}>
                {notifications.length > 0 ? (
                  notifications.map((notif) => (
                    <View key={notif.id} style={styles.notifCard}>
                      <View style={[styles.notifIcon, {backgroundColor: notif.bg}]}>
                        <MaterialCommunityIcons name={notif.icon} size={20} color={notif.color} />
                      </View>
                      <View style={{flex: 1}}>
                        <Text style={styles.notifTime}>{notif.time}</Text>
                        <Text style={styles.notifTitle}>{notif.title}</Text>
                        <Text style={styles.notifDesc}>{notif.desc}</Text>
                      </View>
                    </View>
                  ))
                ) : (
                  <View style={styles.emptyNotifContainer}>
                    <Ionicons name="checkmark-circle-outline" size={48} color="#34C759" />
                    <Text style={styles.emptyNotifTitle}>All Caught Up!</Text>
                    <Text style={styles.emptyNotifSub}>Your vitals are stable and no new alerts were found.</Text>
                  </View>
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>

      </SafeAreaView>
    </View>
  );
}

const FeatureCard = ({ title, subtitle, buttonText, buttonColor = '#5E5CE6', topIcon, imageSource, imageStyle, colors, onPress }) => (
  <TouchableOpacity style={styles.featureCardWrapper} activeOpacity={0.9} onPress={onPress}>
    <LinearGradient colors={colors} style={styles.featureCard} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
      <View style={styles.cardTopRightIcon}>
        <MaterialCommunityIcons name={topIcon} size={18} color="rgba(0,0,0,0.4)" />
      </View>
      
      {/* 🛑 FIXED: pointerEvents="none" prevents the transparent image edges from stealing touches */}
      <View style={styles.imageContainer} pointerEvents="none">
        <Image source={imageSource} style={[styles.cardImageBase, imageStyle]} />
      </View>
      
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardSubtitle}>{subtitle}</Text>
      <View style={styles.cardButton}>
        <Text style={[styles.cardButtonText, { color: buttonColor }]}>{buttonText}</Text>
        <Ionicons name="chevron-forward" size={14} color={buttonColor} />
      </View>
    </LinearGradient>
  </TouchableOpacity>
);

const QuickActionIcon = ({ icon, label, color, onPress }) => (
  <TouchableOpacity style={styles.quickActionWrapper} activeOpacity={0.9} onPress={onPress}>
    <View style={[styles.quickActionCircle, { backgroundColor: color }]}>
      <Ionicons name={icon} size={24} color="#FFFFFF" />
    </View>
    <Text style={styles.quickActionLabel} numberOfLines={2} textAlign="center">{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 40 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, marginTop: -10 },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 50, height: 50, borderRadius: 25, marginRight: 12, borderWidth: 2, borderColor: '#FFFFFF' },
  greetingText: { fontSize: 18, fontWeight: '700', color: '#1C1C1E', marginBottom: 2 },
  subtitleText: { fontSize: 13, color: '#636366' },
  bellIcon: { width: 44, height: 44, justifyContent: 'center', alignItems: 'flex-end' },
  notificationBadge: { position: 'absolute', top: 10, right: 4, width: 10, height: 10, backgroundColor: '#FF3B30', borderRadius: 5, borderWidth: 2, borderColor: '#F4F7FF' },
  
  summaryCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: 24, padding: 16, marginBottom: 25, borderWidth: 1, borderColor: '#FFFFFF', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10 },
  heartIconBox: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  summaryTextContainer: { flex: 1 },
  summaryLabel: { fontSize: 11, color: '#8E8E93', fontWeight: '600', textTransform: 'uppercase', marginBottom: 2 },
  summaryTitle: { fontSize: 16, fontWeight: '700', color: '#1C1C1E', marginBottom: 2 },
  summarySub: { fontSize: 12, color: '#636366' },
  scoreContainer: { flexDirection: 'row', alignItems: 'center' },
  progressRing: { width: 50, height: 50, borderRadius: 25, borderWidth: 3, borderColor: '#34C759', marginRight: 8, borderLeftColor: '#E5E5EA' },
  scoreTextWrapper: { alignItems: 'center' },
  scorePercent: { fontSize: 18, fontWeight: '800', color: '#1C1C1E' },
  scoreLabel: { fontSize: 10, color: '#8E8E93' },

  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 20 },
  featureCardWrapper: { width: '48%', marginBottom: 15, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 5 },
  featureCard: { borderRadius: 24, padding: 16, height: 210, borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)' },
  cardTopRightIcon: { position: 'absolute', top: 12, right: 12, width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.3)', justifyContent: 'center', alignItems: 'center' },
  
  // 🛑 FIXED: Using percentages ensures the invisible hit-box NEVER bleeds out of the card!
  imageContainer: { 
    height: 100, // Locks the maximum height 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginVertical: -2 
  },
  cardImageBase: { 
    alignSelf: 'center',
    height: '100%', // Scales perfectly to the 90px container
    resizeMode: 'contain'
  },
  
  // Notice these are percentages now, not fixed pixels like "250"
  medicineImage: { width: 150, height: 200 },
  bloodImage: { width: 130, height: 200 },
  brainImage: { width: 175, height: 200 },
  houseImage: { width: 250, height: 250 },
  
  cardTitle: { fontSize: 15, fontWeight: '800', color: '#FFFFFF', marginBottom: 4, textShadowColor: 'rgba(0,0,0,0.1)', textShadowOffset: {width: 0, height: 1}, textShadowRadius: 2 },
  cardSubtitle: { fontSize: 11, color: 'rgba(255, 255, 255, 0.9)', fontWeight: '500', marginBottom: 12, lineHeight: 14 },
  cardButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', paddingVertical: 8, borderRadius: 16, marginTop: 'auto' },
  cardButtonText: { fontSize: 12, fontWeight: '700', marginRight: 4 },

  quickActionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#1C1C1E' },
  
  quickActionsContainer: { marginBottom: 20 },
  quickActionWrapper: { alignItems: 'center', width: 75, marginRight: 15 },
  quickActionCircle: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', marginBottom: 8, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 5, elevation: 3 },
  quickActionLabel: { fontSize: 11, color: '#636366', fontWeight: '500', textAlign: 'center', lineHeight: 14 },

  modalOverlayBottom: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  bottomSheet: { backgroundColor: '#F8F9FF', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 25, paddingBottom: 50 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  sheetTitle: { fontSize: 20, fontWeight: '800', color: '#1C1C1E' },
  
  notifCard: { flexDirection: 'row', backgroundColor: '#FFFFFF', padding: 15, borderRadius: 16, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 5, elevation: 1 },
  notifIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  notifTime: { fontSize: 10, color: '#8E8E93', fontWeight: '700', marginBottom: 4 },
  notifTitle: { fontSize: 15, fontWeight: '800', color: '#1C1C1E', marginBottom: 4 },
  notifDesc: { fontSize: 13, color: '#636366', lineHeight: 18 },
  
  emptyNotifContainer: { alignItems: 'center', paddingVertical: 40 },
  emptyNotifTitle: { fontSize: 18, fontWeight: '800', color: '#1C1C1E', marginTop: 15, marginBottom: 5 },
  emptyNotifSub: { fontSize: 14, color: '#8E8E93', textAlign: 'center', paddingHorizontal: 20 }
});