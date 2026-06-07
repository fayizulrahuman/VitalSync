import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { useContext, useEffect, useState } from 'react';
import { Linking, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MedicineContext } from '../context/MedicineContext';

export default function EmergencyBloodScreen({ navigation }) {
  const { showAlert } = useContext(MedicineContext);

  const [locationEnabled, setLocationEnabled] = useState(false);
  const [bloodGroup, setBloodGroup] = useState('O+');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedChip, setSelectedChip] = useState(null);
  
  // FIX: Start empty to prevent overriding storage on reload
  const [contacts, setContacts] = useState([]); 

  const [modalVisible, setModalVisible] = useState(false);
  const [newContactName, setNewContactName] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [newContactRelation, setNewContactRelation] = useState('');

  useEffect(() => {
    const loadData = async () => {
      const savedBg = await AsyncStorage.getItem('@vital_sync_blood');
      if (savedBg) setBloodGroup(savedBg);
      
      const savedLocationPref = await AsyncStorage.getItem('@vital_sync_location_enabled');
      if (savedLocationPref === 'true') setLocationEnabled(true);
      
      const savedContacts = await AsyncStorage.getItem('@vital_sync_emergency_contacts');
      if (savedContacts) {
        setContacts(JSON.parse(savedContacts));
      } 
    };
    loadData();
  }, []);

  const handleSOS = () => Linking.openURL('tel:108');

  const handleEnableLocation = async () => {
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      showAlert("Permission Denied", "We need location access to find nearby blood donors.", "error");
      return;
    }
    setLocationEnabled(true);
    await AsyncStorage.setItem('@vital_sync_location_enabled', 'true');
    showAlert("Location Enabled", "We can now locate nearby donors.", "success");
  };

  const handleDisableLocation = async () => {
    setLocationEnabled(false);
    await AsyncStorage.setItem('@vital_sync_location_enabled', 'false');
    showAlert("Location Disabled", "Location services turned off.", "info");
  };

  // FIX: Save directly inside the delete action
  const handleDeleteContact = (id, name) => {
    showAlert("Remove Contact", `Remove ${name} from emergency contacts?`, "error", [
        { text: "Cancel", style: "cancel" },
        { text: "Remove", style: "destructive", onPress: () => {
            const updated = contacts.filter(c => c.id !== id);
            setContacts(updated);
            AsyncStorage.setItem('@vital_sync_emergency_contacts', JSON.stringify(updated));
            showAlert("Removed", "Contact removed.", "success");
          } 
        }
      ]
    );
  };

  // FIX: Save directly inside the add action
  const handleAddContact = () => {
    if (!newContactName.trim() || !newContactPhone.trim()) {
      showAlert("Missing Info", "Please enter both name and phone number.", "error");
      return;
    }

    const newContact = {
      id: Date.now().toString(),
      name: newContactName.trim().toUpperCase(),
      phone: newContactPhone.trim(),
      initial: newContactName.trim().charAt(0).toUpperCase(),
      relation: newContactRelation.trim().toUpperCase() || "FRIEND"
    };
    
    const updated = [...contacts, newContact];
    setContacts(updated);
    AsyncStorage.setItem('@vital_sync_emergency_contacts', JSON.stringify(updated)); // Save safely!
    
    setNewContactName(''); setNewContactPhone(''); setNewContactRelation('');
    setModalVisible(false);
    showAlert("Contact Added", `${newContact.name} has been added.`, "success");
  };

  const handleUpdateBloodGroup = () => {
    const types = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];
    const nextIndex = (types.indexOf(bloodGroup) + 1) % types.length;
    const newBg = types[nextIndex];
    setBloodGroup(newBg);
    AsyncStorage.setItem('@vital_sync_blood', newBg);
  };

  const searchGovernmentBloodBank = () => {
    Linking.openURL(`https://eraktkosh.mohfw.gov.in/BLDAHIMS/bloodbank/stockAvailability.cnt`);
  };

  const callContact = (phone) => Linking.openURL(`tel:${phone.replace(/[\s\-\(\)]/g, '')}`);
  const smsContact = (phone) => Linking.openURL(`sms:${phone.replace(/[\s\-\(\)]/g, '')}`);

  const chips = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()}><Ionicons name="chevron-back" size={24} color="#1C1C1E" /></TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Emergency Blood</Text>
          <Text style={styles.headerSubtitle}>Get help. Save a life.</Text>
        </View>
        <TouchableOpacity style={styles.sosButton} onPress={handleSOS}><Ionicons name="call" size={16} color="#FF3B30" /><Text style={styles.sosText}>SOS</Text></TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCardWrapper}>
          <LinearGradient colors={['#FF5E5E', '#E62E2E']} style={styles.heroGradient}>
            <View style={styles.heroTop}>
              <View style={styles.heroIconBox}><Ionicons name="water" size={28} color="#FF3B30" /></View>
              <View style={styles.heroTextContent}>
                <Text style={styles.heroTitle}>Need Blood Urgently?</Text>
                <Text style={styles.heroSub}>Request blood or find nearby donors.</Text>
              </View>
              <TouchableOpacity style={styles.requestBtn} onPress={() => showAlert("Request Sent", "Notifying nearby donors.", "success")}>
                <Text style={styles.requestBtnText}>Request Blood</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
          
          {!locationEnabled ? (
            <TouchableOpacity style={styles.locationStrip} onPress={handleEnableLocation}>
              <View style={{flexDirection: 'row', alignItems: 'center'}}><Ionicons name="location" size={16} color="#FFFFFF" style={{marginRight: 6}} /><Text style={styles.locationStripText}>Enable location to find donors faster.</Text></View>
              <Text style={styles.locationStripAction}>Enable {'>'}</Text>
            </TouchableOpacity>
          ) : (
            <View style={[styles.locationStrip, {backgroundColor: '#34C759'}]}>
              <View style={{flexDirection: 'row', alignItems: 'center'}}><Ionicons name="location" size={16} color="#FFFFFF" style={{marginRight: 6}} /><Text style={styles.locationStripText}>Location enabled. Scanning nearby...</Text></View>
              <TouchableOpacity onPress={handleDisableLocation}><Text style={[styles.locationStripAction, {color: '#FFFFFF'}]}>Disable</Text></TouchableOpacity>
            </View>
          )}
        </View>

        <View style={styles.searchSection}>
          <View style={styles.sectionHeaderWrap}><Ionicons name="search" size={20} color="#FF3B30" style={{marginRight: 6}}/><Text style={styles.sectionTitle}>Find Blood Near You</Text></View>
          <Text style={styles.sectionSub}>Search for donors or blood banks in your area.</Text>

          <View style={styles.searchRow}>
            <View style={styles.searchInputWrap}>
              <TextInput style={styles.searchInput} placeholder="Enter blood group (e.g., O+)" value={searchQuery} onChangeText={setSearchQuery} />
              <Ionicons name="search" size={20} color="#C7C7CC" />
            </View>
            <TouchableOpacity style={styles.useLocationBtn} onPress={handleEnableLocation}><Ionicons name="locate" size={16} color="#FF3B30" /><Text style={styles.useLocationText}>My Location</Text></TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.govtSearchBtn} onPress={searchGovernmentBloodBank}>
            <Ionicons name="business" size={16} color="#FFFFFF" />
            <Text style={styles.govtSearchBtnText}>Search on Govt. Blood Bank</Text>
          </TouchableOpacity>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
            {chips.map(chip => (
              <TouchableOpacity key={chip} style={[styles.chip, selectedChip === chip && styles.chipActive]} onPress={() => setSelectedChip(selectedChip === chip ? null : chip)}>
                <Text style={[styles.chipText, selectedChip === chip && styles.chipTextActive]}>{chip}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.myBloodCard}>
          <View style={styles.myBloodLeft}>
            <View style={styles.myBloodHeader}><Ionicons name="water" size={18} color="#FF3B30" /><Text style={styles.myBloodTitle}>My Blood Group</Text></View>
            <Text style={styles.myBloodValue}>{bloodGroup}</Text>
            <Text style={styles.myBloodSub}>{bloodGroup.includes('+') ? 'Positive' : 'Negative'}</Text>
          </View>
          <TouchableOpacity style={styles.updateBgWrap} onPress={handleUpdateBloodGroup}>
            <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 4}}><MaterialCommunityIcons name="pencil" size={16} color="#FF3B30" /><Text style={styles.updateBgText}>Update Blood Group</Text></View>
            <Text style={styles.updateBgSub}>Keeping this updated helps us find compatible donors.</Text>
            <Ionicons name="chevron-forward" size={16} color="#1C1C1E" style={{position: 'absolute', right: 0, top: 15}} />
          </TouchableOpacity>
        </View>

        {/* EMERGENCY CONTACTS */}
        <View style={styles.contactsSection}>
          <View style={styles.sectionHeaderRow}>
            <View style={{flexDirection: 'row', alignItems: 'center'}}><Ionicons name="call" size={20} color="#FF3B30" style={{marginRight: 6}}/><Text style={styles.sectionTitle}>Emergency Contacts</Text></View>
            <TouchableOpacity onPress={() => setModalVisible(true)}><Text style={styles.manageText}>Add Contact</Text></TouchableOpacity>
          </View>

          {contacts.map((contact) => (
            <View key={contact.id} style={styles.contactCard}>
              <View style={styles.contactAvatar}><Text style={styles.contactAvatarText}>{contact.initial}</Text></View>
              <View style={styles.contactInfo}>
                <Text style={styles.contactName}>{contact.name}</Text>
                <Text style={styles.contactRelation}>{contact.relation}</Text>
                <Text style={styles.contactPhone}>{contact.phone}</Text>
              </View>
              <View style={styles.contactActions}>
                <TouchableOpacity style={styles.actionBtnSoft} onPress={() => callContact(contact.phone)}><Ionicons name="call" size={18} color="#FF3B30" /></TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtnSoft, {backgroundColor: '#F2F2F7'}]} onPress={() => handleDeleteContact(contact.id, contact.name)}><Ionicons name="trash" size={18} color="#8E8E93" /></TouchableOpacity>
              </View>
            </View>
          ))}
        </View>

        {/* NEW DONORS DIRECTORY NAVIGATION CARD */}
        <TouchableOpacity style={styles.directoryCard} onPress={() => navigation.navigate('DonorsList')} activeOpacity={0.8}>
          <View style={styles.directoryLeft}>
            <View style={styles.directoryIconBox}>
              <Ionicons name="people" size={24} color="#FFFFFF" />
            </View>
            <View>
              <Text style={styles.directoryTitle}>Donors Directory</Text>
              <Text style={styles.directorySub}>Browse 200+ registered donors & volunteers</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#1C1C1E" />
        </TouchableOpacity>

      </ScrollView>

      <Modal animationType="slide" transparent={true} visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Emergency Contact</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}><Ionicons name="close" size={24} color="#1C1C1E" /></TouchableOpacity>
            </View>
            <View style={styles.modalInputGroup}>
              <Text style={styles.modalLabel}>Name</Text>
              <TextInput style={styles.modalInput} placeholder="e.g., John Doe" value={newContactName} onChangeText={setNewContactName} autoCapitalize="characters" />
            </View>
            <View style={styles.modalInputGroup}>
              <Text style={styles.modalLabel}>Relation</Text>
              <TextInput style={styles.modalInput} placeholder="e.g., Father, Friend" value={newContactRelation} onChangeText={setNewContactRelation} autoCapitalize="characters" />
            </View>
            <View style={styles.modalInputGroup}>
              <Text style={styles.modalLabel}>Phone Number</Text>
              <TextInput style={styles.modalInput} placeholder="e.g., 9876543210" value={newContactPhone} onChangeText={setNewContactPhone} keyboardType="phone-pad" />
            </View>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setModalVisible(false)}><Text style={styles.modalCancelText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={styles.modalAddBtn} onPress={handleAddContact}><Text style={styles.modalAddText}>Add Contact</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FAFAFA' },
  scrollContent: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 50 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingHorizontal: 20 },
  iconButton: { width: 44, height: 44, backgroundColor: '#FFFFFF', borderRadius: 22, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 3 },
  headerTitleContainer: { alignItems: 'center' },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#1C1C1E', marginBottom: 2 },
  headerSubtitle: { fontSize: 13, color: '#8E8E93', fontWeight: '500' },
  sosButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: '#FFE5E5', backgroundColor: '#FFF0F0' },
  sosText: { color: '#FF3B30', fontWeight: '800', marginLeft: 4, fontSize: 13 },
  heroCardWrapper: { borderRadius: 24, overflow: 'hidden', marginBottom: 25, shadowColor: '#FF3B30', shadowOpacity: 0.2, shadowRadius: 15, shadowOffset: {width: 0, height: 8}, elevation: 8 },
  heroGradient: { padding: 20, paddingBottom: 25 },
  heroTop: { flexDirection: 'row', alignItems: 'center' },
  heroIconBox: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  heroTextContent: { flex: 1 },
  heroTitle: { fontSize: 18, fontWeight: '800', color: '#FFFFFF', marginBottom: 4 },
  heroSub: { fontSize: 13, color: 'rgba(255,255,255,0.9)', lineHeight: 18 },
  requestBtn: { backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 16, marginLeft: 10 },
  requestBtnText: { color: '#FF3B30', fontWeight: '800', fontSize: 13 },
  locationStrip: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#D72626', paddingVertical: 12, paddingHorizontal: 20 },
  locationStripText: { color: '#FFFFFF', fontSize: 12, fontWeight: '500' },
  locationStripAction: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  searchSection: { marginBottom: 25 },
  sectionHeaderWrap: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: '#1C1C1E' },
  sectionSub: { fontSize: 13, color: '#8E8E93', marginBottom: 15 },
  searchRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  searchInputWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 16, paddingHorizontal: 15, height: 50, borderWidth: 1, borderColor: '#F0F0F0', marginRight: 10 },
  searchInput: { flex: 1, fontSize: 14, color: '#1C1C1E' },
  useLocationBtn: { flexDirection: 'row', alignItems: 'center' },
  useLocationText: { color: '#FF3B30', fontSize: 12, fontWeight: '700', marginLeft: 4 },
  searchActionRow: { marginBottom: 15 },
  govtSearchBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FF3B30', paddingVertical: 12, borderRadius: 16, gap: 8 },
  govtSearchBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700', marginLeft: 8 },
  chipsScroll: { flexDirection: 'row' },
  chip: { paddingHorizontal: 20, paddingVertical: 12, backgroundColor: '#FFFFFF', borderRadius: 12, marginRight: 10, borderWidth: 1, borderColor: '#F0F0F0' },
  chipActive: { backgroundColor: '#FF3B30', borderColor: '#FF3B30' },
  chipText: { fontSize: 15, fontWeight: '700', color: '#1C1C1E' },
  chipTextActive: { color: '#FFFFFF' },
  myBloodCard: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderRadius: 24, padding: 20, marginBottom: 25, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 10, elevation: 3, borderWidth: 1, borderColor: '#F8F9FF' },
  myBloodLeft: { flex: 1, borderRightWidth: 1, borderRightColor: '#F0F0F0', paddingRight: 15 },
  myBloodHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  myBloodTitle: { fontSize: 13, fontWeight: '700', color: '#1C1C1E', marginLeft: 6 },
  myBloodValue: { fontSize: 36, fontWeight: '800', color: '#FF3B30', marginBottom: 2 },
  myBloodSub: { fontSize: 13, color: '#8E8E93', fontWeight: '500' },
  updateBgWrap: { flex: 1.2, paddingLeft: 15, justifyContent: 'center' },
  updateBgText: { fontSize: 13, fontWeight: '700', color: '#FF3B30', marginLeft: 6 },
  updateBgSub: { fontSize: 12, color: '#8E8E93', lineHeight: 18, marginTop: 4, paddingRight: 15 },
  contactsSection: { marginBottom: 20 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  manageText: { color: '#FF3B30', fontWeight: '700', fontSize: 14 },
  contactCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 20, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 8, elevation: 2 },
  contactAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFE5E5', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  contactAvatarText: { color: '#FF3B30', fontSize: 18, fontWeight: '800' },
  contactInfo: { flex: 1 },
  contactName: { fontSize: 16, fontWeight: '700', color: '#1C1C1E', marginBottom: 2 },
  contactRelation: { fontSize: 12, color: '#FF3B30', fontWeight: '500', marginBottom: 2 },
  contactPhone: { fontSize: 13, color: '#8E8E93', fontWeight: '500' },
  contactActions: { flexDirection: 'row' },
  actionBtnSoft: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#FFF0F0', justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
  
  // NEW: Donors Directory Card
  directoryCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFFFFF', padding: 20, borderRadius: 24, marginBottom: 30, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 3, borderWidth: 1, borderColor: '#F0F0F0' },
  directoryLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  directoryIconBox: { width: 48, height: 48, borderRadius: 16, backgroundColor: '#FF3B30', justifyContent: 'center', alignItems: 'center', marginRight: 15, shadowColor: '#FF3B30', shadowOpacity: 0.3, shadowRadius: 8 },
  directoryTitle: { fontSize: 16, fontWeight: '800', color: '#1C1C1E', marginBottom: 4 },
  directorySub: { fontSize: 12, color: '#8E8E93', fontWeight: '500' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 20, width: '85%', maxWidth: 400 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#1C1C1E' },
  modalInputGroup: { marginBottom: 16 },
  modalLabel: { fontSize: 14, fontWeight: '600', color: '#1C1C1E', marginBottom: 8 },
  modalInput: { borderWidth: 1, borderColor: '#E5E5EA', borderRadius: 12, padding: 12, fontSize: 16, backgroundColor: '#F9F9FB' },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginTop: 8 },
  modalCancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: '#F2F2F7', alignItems: 'center' },
  modalCancelText: { color: '#8E8E93', fontWeight: '600', fontSize: 16 },
  modalAddBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: '#FF3B30', alignItems: 'center' },
  modalAddText: { color: '#FFFFFF', fontWeight: '600', fontSize: 16 }
});