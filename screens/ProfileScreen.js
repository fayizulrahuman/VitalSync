import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import * as IntentLauncher from 'expo-intent-launcher';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Sharing from 'expo-sharing'; // <-- NEW IMPORT HERE
import { useEffect, useState } from 'react';
import { Image, Linking, Modal, Platform, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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

export default function ProfileScreen({ navigation }) {
  const [name, setName] = useState('Fayizul Rahuman');
  const [age, setAge] = useState('21');
  const [bloodGroup, setBloodGroup] = useState('O+');
  const [weight, setWeight] = useState('68.5'); 
  const [healthId, setHealthId] = useState('');
  const [avatar, setAvatar] = useState({ type: 'inbuilt', gender: 'male', index: 0 });

  const [hr, setHr] = useState('69');
  const [spo2, setSpo2] = useState('97');
  const [steps, setSteps] = useState('55');

  const [shareData, setShareData] = useState(true);
  const [biometric, setBiometric] = useState(false);

  const [activeTab, setActiveTab] = useState('records'); 
  const [activeMenuModal, setActiveMenuModal] = useState(null); 
  const [isEditProfileVisible, setIsEditProfileVisible] = useState(false);
  const [isAvatarModalVisible, setIsAvatarModalVisible] = useState(false);
  const [avatarGenderTab, setAvatarGenderTab] = useState('male');
  
  const [customAlert, setCustomAlert] = useState({ visible: false, title: '', message: '', type: 'info', onConfirm: null });

  const [records, setRecords] = useState([]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadProfileData();
    });
    loadProfileData();
    return unsubscribe;
  }, [navigation]);

  const loadProfileData = async () => {
    try {
      let savedId = await AsyncStorage.getItem('@vital_health_id');
      if (!savedId) {
        savedId = `VTL-${Math.floor(Math.random() * 90000) + 10000}`;
        await AsyncStorage.setItem('@vital_health_id', savedId);
      }
      setHealthId(savedId);

      const savedName = await AsyncStorage.getItem('@vital_user_name');
      const savedAge = await AsyncStorage.getItem('@vital_user_age');
      const savedBg = await AsyncStorage.getItem('@vital_user_bg');
      const savedAvatar = await AsyncStorage.getItem('@vital_user_avatar');
      const savedRecords = await AsyncStorage.getItem('@vital_medical_records');
      
      const savedShare = await AsyncStorage.getItem('@vital_share_data');
      const savedBio = await AsyncStorage.getItem('@vital_biometric_lock');
      
      if (savedName) setName(savedName);
      if (savedAge) setAge(savedAge);
      if (savedBg) setBloodGroup(savedBg);
      if (savedAvatar) setAvatar(JSON.parse(savedAvatar));
      if (savedRecords) setRecords(JSON.parse(savedRecords));
      
      if (savedShare !== null) setShareData(savedShare === 'true');
      if (savedBio !== null) setBiometric(savedBio === 'true');

      const savedWeight = await AsyncStorage.getItem('@vital_sync_weight');
      const savedHr = await AsyncStorage.getItem('@vital_sync_hr');
      const savedSpo2 = await AsyncStorage.getItem('@vital_sync_spo2');
      const savedSteps = await AsyncStorage.getItem('@vital_sync_steps_total');

      if (savedWeight) setWeight(savedWeight);
      if (savedHr) setHr(savedHr);
      if (savedSpo2) setSpo2(savedSpo2);
      if (savedSteps) setSteps(savedSteps);
    } catch (e) {
      console.log("Error loading profile:", e);
    }
  };

  const showWarning = (title, message, type = 'info', onConfirm = null) => {
    setCustomAlert({ visible: true, title, message, type, onConfirm });
  };

  const handleShareDataToggle = async (value) => {
    setShareData(value);
    await AsyncStorage.setItem('@vital_share_data', value.toString());
  };

  const handleBiometricToggle = async (value) => {
    if (value) {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      
      if (!hasHardware || !isEnrolled) {
        showWarning("Not Available", "Your device does not have biometrics set up.", "error");
        return;
      }
      
      const auth = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to enable App Lock',
        fallbackLabel: 'Use Passcode',
      });

      if (auth.success) {
        setBiometric(true);
        await AsyncStorage.setItem('@vital_biometric_lock', 'true');
      }
    } else {
      setBiometric(false);
      await AsyncStorage.setItem('@vital_biometric_lock', 'false');
    }
  };

  const openLink = (url) => {
    Linking.canOpenURL(url).then(supported => {
      if (supported) Linking.openURL(url);
      else showWarning("Error", "Could not open the link.", "error");
    });
  };

  const handleRateUs = () => {
    const storeUrl = Platform.OS === 'ios' 
      ? 'itms-apps://itunes.apple.com/app/idYOUR_APP_ID' 
      : 'market://details?id=com.fayiz.vitalsync';
    openLink(storeUrl);
  };

  const handleTerms = () => {
    openLink('https://policies.google.com/terms'); 
  };

  const saveProfileDetails = async () => {
    await AsyncStorage.setItem('@vital_user_name', name);
    await AsyncStorage.setItem('@vital_user_age', age);
    await AsyncStorage.setItem('@vital_user_bg', bloodGroup);
    setIsEditProfileVisible(false);
  };

  const handleAvatarSelect = async (gender, index) => {
    const newAvatar = { type: 'inbuilt', gender, index };
    setAvatar(newAvatar);
    await AsyncStorage.setItem('@vital_user_avatar', JSON.stringify(newAvatar));
    setIsAvatarModalVisible(false);
  };

  const pickImageFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showWarning('Permission Needed', 'We need gallery permissions to change your avatar.', 'error');
      return;
    }
    let result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.5 });
    if (!result.canceled) {
      const newAvatar = { type: 'uri', uri: result.assets[0].uri };
      setAvatar(newAvatar);
      await AsyncStorage.setItem('@vital_user_avatar', JSON.stringify(newAvatar));
      setIsAvatarModalVisible(false);
    }
  };

  const handleUploadRecord = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        
        // Remove the forced .pdf fallback to prevent corrupting image uploads
        const fileName = file.name || `Record_${Date.now()}`;
        const permanentUri = FileSystem.documentDirectory + fileName.replace(/\s+/g, '_');
        
        await FileSystem.copyAsync({
          from: file.uri,
          to: permanentUri
        });

        const newRecord = {
          id: Date.now().toString(),
          title: file.name || 'Uploaded Document',
          date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
          doctor: 'Self Uploaded',
          uri: permanentUri,
          mimeType: file.mimeType // <-- SAVE THE EXACT MIME TYPE DIRECTLY FROM THE OS
        };
        
        const updatedRecords = [newRecord, ...records];
        setRecords(updatedRecords);
        await AsyncStorage.setItem('@vital_medical_records', JSON.stringify(updatedRecords));
        showWarning('Success', 'Medical record uploaded securely!', 'success');
      }
    } catch (error) {
      console.log(error);
      showWarning('Upload Failed', 'There was an issue uploading your file.', 'error');
    }
  };

  const deleteRecord = (id) => {
    showWarning('Delete Record', 'Are you sure you want to delete this record? This cannot be undone.', 'warning', async () => {
      const updatedRecords = records.filter(r => r.id !== id);
      setRecords(updatedRecords);
      await AsyncStorage.setItem('@vital_medical_records', JSON.stringify(updatedRecords));
      setCustomAlert({ visible: false });
    });
  };

  // --- UPDATED: Securely opening local files via Sharing API ---
  const openRecord = async (record) => {
    if (!record || !record.uri) {
      showWarning('Unavailable', 'This is a sample record and cannot be opened.', 'info');
      return;
    }

    const uri = record.uri;

    try {
      const fileInfo = await FileSystem.getInfoAsync(uri);
      if (!fileInfo.exists) {
        showWarning('File Missing', 'This file was moved or deleted from your device storage.', 'error');
        return;
      }

      // 1. Get exact MIME type from the saved record, with a smart fallback
      let exactMimeType = record.mimeType;
      if (!exactMimeType) {
        const lowerUri = uri.toLowerCase();
        if (lowerUri.endsWith('.pdf')) exactMimeType = 'application/pdf';
        else if (lowerUri.endsWith('.jpg') || lowerUri.endsWith('.jpeg')) exactMimeType = 'image/jpeg';
        else if (lowerUri.endsWith('.png')) exactMimeType = 'image/png';
        else exactMimeType = '*/*';
      }

      if (Platform.OS === 'android') {
        const contentUri = await FileSystem.getContentUriAsync(uri);

        try {
          // 2. Launch Android Native Viewer with the EXACT type
          await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
            data: contentUri,
            flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
            type: exactMimeType,
          });
        } catch (intentErr) {
           console.log("Intent Viewer failed:", intentErr);
           // 3. Fallback to Sharing if the viewer intent is blocked
           await Sharing.shareAsync(uri, { mimeType: exactMimeType });
        }
      } else {
        // iOS Native Sharing API handles both images and PDFs automatically
        await Sharing.shareAsync(uri, { mimeType: exactMimeType });
      }
    } catch (e) {
      console.log("File Open Error:", e);
      showWarning('Cannot Open File', 'No compatible app found to view this document.', 'error');
    }
  };

  const handleLogout = () => {
    showWarning("Log Out", "Are you sure you want to log out of your account?", "warning", async () => {
      setCustomAlert({ visible: false });
      await AsyncStorage.removeItem('@vital_is_logged_in');
      navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
    });
  };

  const getAvatarSource = () => {
    if (avatar.type === 'uri') return { uri: avatar.uri };
    return INBUILT_AVATARS[avatar.gender]?.[avatar.index] || INBUILT_AVATARS.male[0];
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        <View style={styles.headerSection}>
          <TouchableOpacity style={styles.avatarContainer} onPress={() => setIsAvatarModalVisible(true)}>
            <Image source={getAvatarSource()} style={styles.avatarImage} />
            <View style={styles.editAvatarBadge}>
              <Ionicons name="camera" size={14} color="#FFFFFF" />
            </View>
          </TouchableOpacity>
          <Text style={styles.userName}>{name}</Text>
          <View style={styles.healthIdBadge}>
            <MaterialCommunityIcons name="card-account-details-outline" size={14} color="#5E5CE6" />
            <Text style={styles.healthIdText}>ID: {healthId}</Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <TouchableOpacity style={styles.statBox} onPress={() => setIsEditProfileVisible(true)}>
            <Text style={styles.statValue}>{age}</Text>
            <Text style={styles.statLabel}>Age</Text>
          </TouchableOpacity>
          <View style={styles.statDivider} />
          <TouchableOpacity style={styles.statBox} onPress={() => setIsEditProfileVisible(true)}>
            <Text style={styles.statValue}>{bloodGroup}</Text>
            <Text style={styles.statLabel}>Blood Group</Text>
          </TouchableOpacity>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{weight} <Text style={{fontSize: 12}}>kg</Text></Text>
            <Text style={styles.statLabel}>Weight (Health)</Text>
          </View>
        </View>

        <View style={styles.tabContainer}>
          <TouchableOpacity style={[styles.tabBtn, activeTab === 'records' && styles.tabBtnActive]} onPress={() => setActiveTab('records')}>
            <Text style={[styles.tabText, activeTab === 'records' && styles.tabTextActive]}>Medical Records</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tabBtn, activeTab === 'summary' && styles.tabBtnActive]} onPress={() => setActiveTab('summary')}>
            <Text style={[styles.tabText, activeTab === 'summary' && styles.tabTextActive]}>Health Summary</Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'records' ? (
          <View style={styles.tabContent}>
            {records.map(rec => (
              <TouchableOpacity key={rec.id} style={styles.recordCard} onPress={() => openRecord(rec)}>
                <View style={styles.recordIconWrap}>
                  <Ionicons name="document-text" size={24} color="#5E5CE6" />
                </View>
                <View style={{flex: 1}}>
                  <Text style={styles.recordTitle} numberOfLines={1}>{rec.title}</Text>
                  <Text style={styles.recordSub}>{rec.doctor} • {rec.date}</Text>
                </View>
                <TouchableOpacity onPress={() => deleteRecord(rec.id)} style={styles.deleteIconBtn}>
                  <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                </TouchableOpacity>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.addRecordBtn} onPress={handleUploadRecord}>
              <Ionicons name="add" size={18} color="#5E5CE6" />
              <Text style={styles.addRecordText}>Upload Medical Record</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.tabContent}>
            <View style={styles.summaryGrid}>
              <View style={styles.summaryBox}>
                <View style={[styles.summaryIconBg, {backgroundColor: '#FFF0F0'}]}><Ionicons name="heart" size={24} color="#FF3B30" /></View>
                <Text style={styles.summaryBoxVal}>{hr} <Text style={{fontSize:12}}>bpm</Text></Text>
                <View style={[styles.statusBadge, {backgroundColor: '#E8F5E9'}]}><Text style={styles.statusTextGreen}>Normal</Text></View>
              </View>
              <View style={styles.summaryBox}>
                <View style={[styles.summaryIconBg, {backgroundColor: '#F0F8FF'}]}><Ionicons name="water" size={24} color="#32ADE6" /></View>
                <Text style={styles.summaryBoxVal}>{spo2} <Text style={{fontSize:12}}>%</Text></Text>
                <View style={[styles.statusBadge, {backgroundColor: '#E8F5E9'}]}><Text style={styles.statusTextGreen}>Normal</Text></View>
              </View>
              <View style={styles.summaryBox}>
                <View style={[styles.summaryIconBg, {backgroundColor: '#F0FDF4'}]}><MaterialCommunityIcons name="shoe-sneaker" size={24} color="#34C759" /></View>
                <Text style={styles.summaryBoxVal}>{steps}</Text>
                <Text style={{fontSize: 10, color: '#5E5CE6', fontWeight: '700', marginTop: 4}}>steps</Text>
              </View>
            </View>
          </View>
        )}

        <View style={styles.menuSection}>
          <Text style={styles.menuTitle}>Settings & Preferences</Text>
          
          <TouchableOpacity style={styles.menuItem} onPress={() => setActiveMenuModal('Personal')}>
            <View style={[styles.menuIconBg, {backgroundColor: '#F4F4FF'}]}><Ionicons name="person-outline" size={18} color="#5E5CE6"/></View>
            <Text style={styles.menuItemText}>Personal Info</Text>
            <Ionicons name="chevron-forward" size={18} color="#C7C7CC" />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.menuItem} onPress={() => setActiveMenuModal('Privacy')}>
            <View style={[styles.menuIconBg, {backgroundColor: '#FFF0F0'}]}><Ionicons name="shield-checkmark-outline" size={18} color="#FF3B30"/></View>
            <Text style={styles.menuItemText}>Privacy & Security</Text>
            <Ionicons name="chevron-forward" size={18} color="#C7C7CC" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={() => setActiveMenuModal('Help')}>
            <View style={[styles.menuIconBg, {backgroundColor: '#F0F8FF'}]}><Ionicons name="help-circle-outline" size={18} color="#32ADE6"/></View>
            <Text style={styles.menuItemText}>Help & Support</Text>
            <Ionicons name="chevron-forward" size={18} color="#C7C7CC" />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.menuItem, {borderBottomWidth: 0}]} onPress={handleLogout}>
            <View style={[styles.menuIconBg, {backgroundColor: '#FFF5E5'}]}><Ionicons name="log-out-outline" size={18} color="#FF9500"/></View>
            <Text style={[styles.menuItemText, {color: '#FF3B30'}]}>Log Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Custom Alert Modal */}
      <Modal visible={customAlert.visible} transparent animationType="fade">
        <View style={styles.modalOverlayCenter}>
          <View style={styles.alertCard}>
            <View style={[styles.alertIconWrap, customAlert.type === 'error' ? {backgroundColor: '#FFE5E5'} : customAlert.type === 'warning' ? {backgroundColor: '#FFF5E5'} : {backgroundColor: '#EAEBFF'}]}>
              <Ionicons 
                name={customAlert.type === 'error' ? 'close-circle' : customAlert.type === 'warning' ? 'warning' : 'checkmark-circle'} 
                size={36} 
                color={customAlert.type === 'error' ? '#FF3B30' : customAlert.type === 'warning' ? '#FF9500' : '#5E5CE6'} 
              />
            </View>
            <Text style={styles.alertTitle}>{customAlert.title}</Text>
            <Text style={styles.alertMessage}>{customAlert.message}</Text>
            <View style={styles.alertBtnRow}>
              {customAlert.type === 'warning' && (
                <TouchableOpacity style={styles.alertBtnCancel} onPress={() => setCustomAlert({visible: false})}>
                  <Text style={styles.alertBtnCancelText}>Cancel</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity 
                style={[styles.alertBtnOk, customAlert.type === 'error' ? {backgroundColor: '#FF3B30'} : customAlert.type === 'warning' ? {backgroundColor: '#FF9500'} : {backgroundColor: '#5E5CE6'}]} 
                onPress={() => {
                  if (customAlert.onConfirm) customAlert.onConfirm();
                  else setCustomAlert({visible: false});
                }}
              >
                <Text style={styles.alertBtnOkText}>Okay</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Dynamic Menu Cards Modal */}
      <Modal visible={activeMenuModal !== null} transparent animationType="fade">
        <View style={styles.modalOverlayCenter}>
          <View style={styles.centerMenuContent}>
            
            <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20}}>
              <Text style={styles.modalTitle}>
                {activeMenuModal === 'Personal' ? 'Personal Info' : 
                 activeMenuModal === 'Privacy' ? 'Privacy & Security' : 
                 activeMenuModal === 'Connect' ? 'Connect with me' : 'Help & Support'}
              </Text>
              <TouchableOpacity onPress={() => {
                if (activeMenuModal === 'Connect') setActiveMenuModal('Help');
                else setActiveMenuModal(null);
              }}>
                <Ionicons name="close" size={24} color="#8E8E93" />
              </TouchableOpacity>
            </View>
            
            {activeMenuModal === 'Personal' && (
              <View>
                <Text style={styles.infoText}>Name: <Text style={styles.infoVal}>{name}</Text></Text>
                <Text style={styles.infoText}>Age: <Text style={styles.infoVal}>{age}</Text></Text>
                <Text style={styles.infoText}>Blood Group: <Text style={styles.infoVal}>{bloodGroup}</Text></Text>
                <Text style={styles.infoText}>Health ID: <Text style={styles.infoVal}>{healthId}</Text></Text>
              </View>
            )}

            {activeMenuModal === 'Privacy' && (
              <View>
                <View style={styles.toggleRow}>
                  <Text style={styles.toggleLabel}>Share Data with Doctors</Text>
                  <Switch 
                    value={shareData} 
                    onValueChange={handleShareDataToggle} 
                    trackColor={{ false: "#E5E5EA", true: "#34C759" }} 
                    thumbColor={Platform.OS === 'android' ? "#007AFF" : undefined}
                  />
                </View>
                <View style={styles.toggleRow}>
                  <Text style={styles.toggleLabel}>Biometric App Lock</Text>
                  <Switch 
                    value={biometric} 
                    onValueChange={handleBiometricToggle} 
                    trackColor={{ false: "#E5E5EA", true: "#34C759" }} 
                    thumbColor={Platform.OS === 'android' ? "#007AFF" : undefined}
                  />
                </View>
                <Text style={styles.privacyFooter}>Your medical data is encrypted securely locally on your device.</Text>
              </View>
            )}

            {activeMenuModal === 'Help' && (
              <View>
                <TouchableOpacity style={styles.helpRow} onPress={() => setActiveMenuModal('Connect')}>
                  <Ionicons name="mail" size={20} color="#5E5CE6" />
                  <Text style={styles.helpText}>Contact Support</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.helpRow} onPress={handleTerms}>
                  <Ionicons name="document-text" size={20} color="#5E5CE6" />
                  <Text style={styles.helpText}>Terms of Service</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.helpRow} onPress={handleRateUs}>
                  <Ionicons name="star" size={20} color="#5E5CE6" />
                  <Text style={styles.helpText}>Rate Us</Text>
                </TouchableOpacity>
              </View>
            )}

            {activeMenuModal === 'Connect' && (
              <View>
                <TouchableOpacity style={styles.connectRow} onPress={() => openLink('fayizulrahuman2005@gmail.com')}>
                  <View style={[styles.connectIconBg, {backgroundColor: '#FFF0F0'}]}><Ionicons name="mail" size={20} color="#FF3B30" /></View>
                  <Text style={styles.connectText}>Email Support</Text>
                  <Ionicons name="open-outline" size={18} color="#8E8E93" />
                </TouchableOpacity>

                <TouchableOpacity style={styles.connectRow} onPress={() => openLink('https://instagram.com/fa.yix')}>
                  <View style={[styles.connectIconBg, {backgroundColor: '#FFF5F8'}]}><Ionicons name="logo-instagram" size={20} color="#E1306C" /></View>
                  <Text style={styles.connectText}>Instagram</Text>
                  <Ionicons name="open-outline" size={18} color="#8E8E93" />
                </TouchableOpacity>

                <TouchableOpacity style={styles.connectRow} onPress={() => openLink('https://linkedin.com/in/fayizulrahuman')}>
                  <View style={[styles.connectIconBg, {backgroundColor: '#F0F8FF'}]}><Ionicons name="logo-linkedin" size={20} color="#0077B5" /></View>
                  <Text style={styles.connectText}>LinkedIn</Text>
                  <Ionicons name="open-outline" size={18} color="#8E8E93" />
                </TouchableOpacity>

                <TouchableOpacity style={styles.connectRow} onPress={() => openLink('https://github.com/fayizulrahuman')}>
                  <View style={[styles.connectIconBg, {backgroundColor: '#F2F2F7'}]}><Ionicons name="logo-github" size={20} color="#1C1C1E" /></View>
                  <Text style={styles.connectText}>GitHub</Text>
                  <Ionicons name="open-outline" size={18} color="#8E8E93" />
                </TouchableOpacity>

                <TouchableOpacity style={styles.connectCloseBtn} onPress={() => setActiveMenuModal('Help')}>
                  <Text style={styles.connectCloseText}>Close</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Avatar Modal */}
      <Modal visible={isAvatarModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlayBottom}>
          <View style={styles.bottomSheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Choose Avatar</Text>
              <TouchableOpacity onPress={() => setIsAvatarModalVisible(false)}>
                <Ionicons name="close-circle" size={28} color="#C7C7CC" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.galleryBtn} onPress={pickImageFromGallery}>
              <Ionicons name="image-outline" size={20} color="#5E5CE6" />
              <Text style={styles.galleryBtnText}>Select from Device Gallery</Text>
            </TouchableOpacity>

            <View style={styles.avatarTabRow}>
              <TouchableOpacity style={[styles.avatarTab, avatarGenderTab === 'male' && styles.avatarTabActive]} onPress={() => setAvatarGenderTab('male')}>
                <Text style={[styles.avatarTabText, avatarGenderTab === 'male' && styles.avatarTabTextActive]}>Male</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.avatarTab, avatarGenderTab === 'female' && styles.avatarTabActive]} onPress={() => setAvatarGenderTab('female')}>
                <Text style={[styles.avatarTabText, avatarGenderTab === 'female' && styles.avatarTabTextActive]}>Female</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.avatarGrid}>
              {INBUILT_AVATARS[avatarGenderTab].map((imgReq, index) => (
                <TouchableOpacity key={index} onPress={() => handleAvatarSelect(avatarGenderTab, index)} style={styles.avatarGridItem}>
                  <Image source={imgReq} style={styles.avatarGridImg} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Edit Profile Modal */}
      <Modal visible={isEditProfileVisible} transparent animationType="fade">
        <View style={styles.modalOverlayCenter}>
          <View style={styles.centerMenuContent}>
            <Text style={styles.modalTitle}>Edit Profile</Text>
            
            <Text style={styles.inputLabel}>Full Name</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} />
            
            <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
              <View style={{width: '48%'}}>
                <Text style={styles.inputLabel}>Age</Text>
                <TextInput style={styles.input} value={age} onChangeText={setAge} keyboardType="number-pad" />
              </View>
              <View style={{width: '48%'}}>
                <Text style={styles.inputLabel}>Blood Group</Text>
                <TextInput style={styles.input} value={bloodGroup} onChangeText={setBloodGroup} autoCapitalize="characters" />
              </View>
            </View>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={styles.modalBtnCancel} onPress={() => setIsEditProfileVisible(false)}>
                <Text style={styles.modalBtnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtnSave} onPress={saveProfileDetails}>
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
  scrollContent: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 },
  
  // Header
  headerSection: { alignItems: 'center', marginBottom: 25 },
  avatarContainer: { position: 'relative', marginBottom: 15 },
  avatarImage: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#E5E5EA', borderWidth: 4, borderColor: '#FFFFFF' },
  editAvatarBadge: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#5E5CE6', width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: '#F8F9FF' },
  userName: { fontSize: 22, fontWeight: '800', color: '#1C1C1E', marginBottom: 6 },
  healthIdBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EAEBFF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  healthIdText: { color: '#5E5CE6', fontSize: 13, fontWeight: '700', marginLeft: 4, letterSpacing: 0.5 },

  // Stats Row
  statsRow: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderRadius: 20, paddingVertical: 15, marginBottom: 25, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 10, elevation: 2 },
  statBox: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: '800', color: '#1C1C1E', marginBottom: 2 },
  statLabel: { fontSize: 11, color: '#8E8E93', fontWeight: '500' },
  statDivider: { width: 1, backgroundColor: '#F0F0F0', height: '80%', alignSelf: 'center' },

  // Tabs
  tabContainer: { flexDirection: 'row', backgroundColor: '#EAEBFF', borderRadius: 16, padding: 4, marginBottom: 20 },
  tabBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 12 },
  tabBtnActive: { backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
  tabText: { fontSize: 13, fontWeight: '600', color: '#8E8E93' },
  tabTextActive: { color: '#5E5CE6', fontWeight: '700' },

  // Tab Content
  tabContent: { minHeight: 180, marginBottom: 25 },
  recordCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', padding: 15, borderRadius: 16, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 5, elevation: 1 },
  recordIconWrap: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#F4F4FF', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  recordTitle: { fontSize: 15, fontWeight: '700', color: '#1C1C1E', marginBottom: 2 },
  recordSub: { fontSize: 12, color: '#8E8E93' },
  deleteIconBtn: { padding: 5 },
  addRecordBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F4F4FF', paddingVertical: 16, borderRadius: 16, marginTop: 5, borderWidth: 1, borderColor: '#5E5CE6', borderStyle: 'dashed' },
  addRecordText: { color: '#5E5CE6', fontSize: 14, fontWeight: '700', marginLeft: 6 },
  
  summaryGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryBox: { width: '31%', backgroundColor: '#FFFFFF', padding: 15, borderRadius: 16, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 8, elevation: 2 },
  summaryIconBg: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  summaryBoxVal: { fontSize: 18, fontWeight: '800', color: '#1C1C1E', marginBottom: 6 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusTextGreen: { color: '#15803D', fontSize: 10, fontWeight: '700' },

  // Menu Section
  menuSection: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 10, elevation: 2 },
  menuTitle: { fontSize: 16, fontWeight: '800', color: '#1C1C1E', marginBottom: 15 },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  menuIconBg: { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  menuItemText: { flex: 1, fontSize: 15, fontWeight: '600', color: '#1C1C1E' },

  // Modals - Custom Alerts & Cards
  modalOverlayCenter: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  centerMenuContent: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 25, width: '85%', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 15, elevation: 5 },
  
  alertCard: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 30, width: '80%', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 15, elevation: 5 },
  alertIconWrap: { width: 70, height: 70, borderRadius: 35, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  alertTitle: { fontSize: 20, fontWeight: '800', color: '#1C1C1E', marginBottom: 10, textAlign: 'center' },
  alertMessage: { fontSize: 14, color: '#636366', textAlign: 'center', marginBottom: 25, lineHeight: 20 },
  alertBtnRow: { flexDirection: 'row', width: '100%', justifyContent: 'center', gap: 10 },
  alertBtnCancel: { flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: '#F2F2F7', alignItems: 'center' },
  alertBtnCancelText: { color: '#8E8E93', fontWeight: '700', fontSize: 15 },
  alertBtnOk: { flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  alertBtnOkText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },

  modalTitle: { fontSize: 20, fontWeight: '800', color: '#1C1C1E' },
  inputLabel: { fontSize: 12, color: '#8E8E93', fontWeight: '600', marginBottom: 4, marginLeft: 4 },
  input: { backgroundColor: '#F4F4FF', padding: 15, borderRadius: 12, fontSize: 16, color: '#1C1C1E', fontWeight: '600', marginBottom: 15 },
  modalBtnRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  modalBtnCancel: { flex: 1, padding: 15, alignItems: 'center', borderRadius: 12, backgroundColor: '#F2F2F7', marginRight: 8 },
  modalBtnCancelText: { color: '#8E8E93', fontWeight: '700' },
  modalBtnSave: { flex: 1, padding: 15, alignItems: 'center', borderRadius: 12, backgroundColor: '#5E5CE6', marginLeft: 8 },
  modalBtnSaveText: { color: '#FFFFFF', fontWeight: '700' },

  // Avatar Modal
  modalOverlayBottom: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  bottomSheet: { backgroundColor: '#F8F9FF', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 25, paddingBottom: 50, maxHeight: '80%' },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  sheetTitle: { fontSize: 20, fontWeight: '800', color: '#1C1C1E' },
  galleryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#EAEBFF', padding: 15, borderRadius: 14, marginBottom: 20 },
  galleryBtnText: { color: '#5E5CE6', fontWeight: '700', marginLeft: 8 },
  avatarTabRow: { flexDirection: 'row', marginBottom: 15 },
  avatarTab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: '#E5E5EA' },
  avatarTabActive: { borderBottomColor: '#5E5CE6' },
  avatarTabText: { fontSize: 14, fontWeight: '600', color: '#8E8E93' },
  avatarTabTextActive: { color: '#5E5CE6', fontWeight: '700' },
  avatarGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  avatarGridItem: { width: '30%', aspectRatio: 1, marginBottom: 15, borderRadius: 16, overflow: 'hidden' },
  avatarGridImg: { width: '100%', height: '100%' },

  // Menu Modal Styling
  infoText: { fontSize: 14, color: '#8E8E93', marginBottom: 12 },
  infoVal: { color: '#1C1C1E', fontWeight: '700', fontSize: 15 },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  toggleLabel: { fontSize: 16, fontWeight: '600', color: '#1C1C1E' },
  privacyFooter: { color: '#8E8E93', fontSize: 12, marginTop: 20, textAlign: 'center', lineHeight: 18 },
  
  helpRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F4F4FF', padding: 16, borderRadius: 16, marginBottom: 12 },
  helpText: { fontSize: 16, fontWeight: '600', color: '#1C1C1E', marginLeft: 15 },

  // Connect With Me Styling
  connectRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  connectIconBg: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  connectText: { flex: 1, fontSize: 16, color: '#1C1C1E', fontWeight: '500' },
  connectCloseBtn: { marginTop: 25, paddingVertical: 15, alignItems: 'center' },
  connectCloseText: { color: '#5E5CE6', fontSize: 16, fontWeight: '700' },
});