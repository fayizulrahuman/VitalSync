import React, { useState, useContext } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { MedicineContext } from '../context/MedicineContext';

export default function AddMedicineScreen({ navigation }) {
  const { addMedicine, showAlert } = useContext(MedicineContext);

  const [medName, setMedName] = useState('');
  const [dosage, setDosage] = useState('');
  const [timing, setTiming] = useState('After Food');
  const [totalQuantity, setTotalQuantity] = useState('');
  const [days, setDays] = useState('');

  // NEW: Multi-time frequency state
  const [frequencies, setFrequencies] = useState([
    { id: 'slot_morning', label: 'Morning', active: false, hour: '08', minute: '00', amPm: 'AM' },
    { id: 'slot_noon', label: 'Noon', active: false, hour: '01', minute: '00', amPm: 'PM' },
    { id: 'slot_evening', label: 'Evening', active: false, hour: '06', minute: '00', amPm: 'PM' },
    { id: 'slot_night', label: 'Night', active: false, hour: '09', minute: '00', amPm: 'PM' },
  ]);

  const toggleFreq = (index) => {
    const newFreqs = [...frequencies];
    newFreqs[index].active = !newFreqs[index].active;
    setFrequencies(newFreqs);
  };

  const updateFreqTime = (index, field, value) => {
    const newFreqs = [...frequencies];
    newFreqs[index][field] = value;
    setFrequencies(newFreqs);
  };

  const handleSave = () => {
    const activeTimes = frequencies.filter(f => f.active);

    if (!medName || !dosage || !totalQuantity) {
      showAlert("Missing Info", "Please fill in the medicine name, dosage, and total quantity.", "error");
      return;
    }

    if (activeTimes.length === 0) {
      showAlert("Missing Info", "Please select at least one time of day to take the medicine.", "error");
      return;
    }

    // Process times for the backend
    const processedTimes = activeTimes.map(f => {
      let notifHour = parseInt(f.hour || '0');
      if (f.amPm === 'PM' && notifHour !== 12) notifHour += 12;
      if (f.amPm === 'AM' && notifHour === 12) notifHour = 0;
      
      return {
        id: f.id,
        label: f.label,
        time: `${f.hour}:${f.minute} ${f.amPm}`,
        hour: notifHour,
        minute: parseInt(f.minute || '0')
      };
    });

    const newMed = {
      id: Math.random().toString(36).substr(2, 9),
      medName,
      dosage,
      timing,
      times: processedTimes, // Array of time slots
      totalQuantity: parseInt(totalQuantity),
      remainingQuantity: parseInt(totalQuantity),
      statusType: 'active',
      history: []
    };

    addMedicine(newMed);
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color="#1C1C1E" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add New Medicine</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        <Text style={styles.label}>Medicine Name</Text>
        <TextInput style={styles.input} placeholder="e.g. Paracetamol" value={medName} onChangeText={setMedName} />

        <Text style={styles.label}>Dosage (Amount per intake)</Text>
        <TextInput style={styles.input} placeholder="e.g. 1 Tablet, 10ml" value={dosage} onChangeText={setDosage} />

        {/* NEW FREQUENCY SELECTOR */}
        <Text style={styles.label}>Schedule (Times per day)</Text>
        {frequencies.map((freq, index) => (
          <View key={freq.id} style={[styles.freqCard, freq.active && styles.freqCardActive]}>
            <TouchableOpacity style={styles.freqHeader} onPress={() => toggleFreq(index)} activeOpacity={0.7}>
              <View style={styles.freqLeft}>
                <Ionicons name={freq.active ? "checkmark-circle" : "ellipse-outline"} size={26} color={freq.active ? "#5E5CE6" : "#C7C7CC"} />
                <Text style={[styles.freqTitle, freq.active && styles.freqTitleActive]}>{freq.label}</Text>
              </View>
              {freq.active && <Text style={styles.freqSelectedTime}>{freq.hour}:{freq.minute} {freq.amPm}</Text>}
            </TouchableOpacity>

            {freq.active && (
              <View style={styles.timeRow}>
                <TextInput style={styles.timeInput} placeholder="HH" keyboardType="numeric" maxLength={2} value={freq.hour} onChangeText={(val) => updateFreqTime(index, 'hour', val)} />
                <Text style={styles.colon}>:</Text>
                <TextInput style={styles.timeInput} placeholder="MM" keyboardType="numeric" maxLength={2} value={freq.minute} onChangeText={(val) => updateFreqTime(index, 'minute', val)} />
                
                <TouchableOpacity style={[styles.amPmBtn, freq.amPm === 'AM' && styles.amPmActive]} onPress={() => updateFreqTime(index, 'amPm', 'AM')}>
                  <Text style={[styles.amPmText, freq.amPm === 'AM' && styles.amPmTextActive]}>AM</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.amPmBtn, freq.amPm === 'PM' && styles.amPmActive]} onPress={() => updateFreqTime(index, 'amPm', 'PM')}>
                  <Text style={[styles.amPmText, freq.amPm === 'PM' && styles.amPmTextActive]}>PM</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ))}

        <Text style={styles.label}>Timing</Text>
        <View style={styles.row}>
          <TouchableOpacity style={[styles.radioBtn, timing === 'Before Food' && styles.radioBtnActive]} onPress={() => setTiming('Before Food')}>
            <Text style={[styles.radioText, timing === 'Before Food' && styles.radioTextActive]}>Before Food</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.radioBtn, timing === 'After Food' && styles.radioBtnActive]} onPress={() => setTiming('After Food')}>
            <Text style={[styles.radioText, timing === 'After Food' && styles.radioTextActive]}>After Food</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>Initial Stock (Total Pills/ml)</Text>
        <TextInput style={styles.input} placeholder="e.g. 30" keyboardType="numeric" value={totalQuantity} onChangeText={setTotalQuantity} />

        <Text style={styles.label}>Consume for (Days)</Text>
        <TextInput style={styles.input} placeholder="e.g. 15" keyboardType="numeric" value={days} onChangeText={setDays} />

      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
          <Text style={styles.saveBtnText}>Save Medicine</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8F9FF' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingHorizontal: 20 },
  iconButton: { width: 44, height: 44, backgroundColor: '#FFFFFF', borderRadius: 22, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 3 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#1C1C1E' },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 120 },
  label: { fontSize: 14, fontWeight: '700', color: '#1C1C1E', marginBottom: 8, marginTop: 20 },
  input: { backgroundColor: '#FFFFFF', padding: 16, borderRadius: 16, fontSize: 15, borderWidth: 1, borderColor: '#E5EDFF', fontWeight: '500' },
  
  // Freq Card Styles
  freqCard: { backgroundColor: '#FFFFFF', borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: '#E5EDFF', padding: 16 },
  freqCardActive: { borderColor: '#C5C8FF', backgroundColor: '#F8F9FF' },
  freqHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  freqLeft: { flexDirection: 'row', alignItems: 'center' },
  freqTitle: { fontSize: 16, fontWeight: '600', color: '#1C1C1E', marginLeft: 10 },
  freqTitleActive: { fontWeight: '800', color: '#5E5CE6' },
  freqSelectedTime: { fontSize: 14, fontWeight: '700', color: '#5E5CE6' },
  
  timeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 15, borderTopWidth: 1, borderTopColor: '#E5EDFF', paddingTop: 15 },
  timeInput: { backgroundColor: '#FFFFFF', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, fontSize: 18, fontWeight: '800', textAlign: 'center', width: 65, borderWidth: 1, borderColor: '#E5EDFF' },
  colon: { fontSize: 20, fontWeight: '800', marginHorizontal: 8, color: '#1C1C1E' },
  amPmBtn: { paddingVertical: 12, paddingHorizontal: 16, backgroundColor: '#FFFFFF', borderRadius: 12, marginLeft: 8, borderWidth: 1, borderColor: '#E5EDFF' },
  amPmActive: { backgroundColor: '#5E5CE6', borderColor: '#5E5CE6' },
  amPmText: { fontWeight: '700', color: '#8E8E93' },
  amPmTextActive: { color: '#FFFFFF' },
  
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  radioBtn: { flex: 1, padding: 16, backgroundColor: '#FFFFFF', borderRadius: 16, alignItems: 'center', marginRight: 10, borderWidth: 1, borderColor: '#E5EDFF' },
  radioBtnActive: { backgroundColor: '#5E5CE6', borderColor: '#5E5CE6' },
  radioText: { fontSize: 14, fontWeight: '700', color: '#8E8E93' },
  radioTextActive: { color: '#FFFFFF' },
  
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 20, paddingVertical: 15, backgroundColor: '#F8F9FF', borderTopWidth: 1, borderTopColor: '#E5EDFF' },
  saveBtn: { backgroundColor: '#5E5CE6', paddingVertical: 18, borderRadius: 20, alignItems: 'center', shadowColor: '#5E5CE6', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 5 },
  saveBtnText: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
});