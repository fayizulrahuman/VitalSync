import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { backupDataToCloud } from '../CloudSync';
import { auth } from '../firebaseConfig';

export default function JournalScreen({ navigation }) {
  const [entry, setEntry] = useState('');
  const [pastEntries, setPastEntries] = useState([]);

  useEffect(() => {
    loadEntries();
  }, []);

  const loadEntries = async () => {
    const saved = await AsyncStorage.getItem('@vital_sync_journals');
    if (saved) setPastEntries(JSON.parse(saved));
  };

  const handleSave = async () => {
    if (!entry.trim()) return;

    const newEntry = {
      id: Date.now().toString(),
      text: entry.trim(),
      date: new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    };

    const updatedEntries = [newEntry, ...pastEntries];
    setPastEntries(updatedEntries);
    await AsyncStorage.setItem('@vital_sync_journals', JSON.stringify(updatedEntries));

    // ✅ Set flag for today's journal completion
    const today = new Date().toDateString();
    await AsyncStorage.setItem(`@vital_sync_journal_done_${today}`, 'true');

    // 🛑 TRIGGER CLOUD BACKUP
    if (auth.currentUser) {
      backupDataToCloud(auth.currentUser.uid);
    }

    setEntry('');
  };

  const deleteEntry = async (id) => {
    const updated = pastEntries.filter(e => e.id !== id);
    setPastEntries(updated);
    await AsyncStorage.setItem('@vital_sync_journals', JSON.stringify(updated));

    // 🛑 TRIGGER CLOUD BACKUP
    if (auth.currentUser) {
      backupDataToCloud(auth.currentUser.uid);
    }
  };
  
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color="#1C1C1E" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Daily Journal</Text>
        <View style={{ width: 44 }} />
      </View>

      <KeyboardAvoidingView style={{flex: 1}} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.textInput}
            placeholder="How are you feeling right now? Write your thoughts..."
            multiline
            value={entry}
            onChangeText={setEntry}
            textAlignVertical="top"
          />
          <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
            <Text style={styles.saveBtnText}>Save Entry</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.historyHeader}>
          <Text style={styles.historyTitle}>Past Entries</Text>
        </View>

        <FlatList
          data={pastEntries}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: 20, paddingBottom: 50 }}
          renderItem={({ item }) => (
            <View style={styles.entryCard}>
              <View style={styles.entryHeader}>
                <Text style={styles.entryDate}>{item.date}</Text>
                <TouchableOpacity onPress={() => deleteEntry(item.id)}>
                  <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                </TouchableOpacity>
              </View>
              <Text style={styles.entryText}>{item.text}</Text>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.emptyText}>No journals yet. Start writing today!</Text>}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// Styles unchanged (same as before)
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8F9FF' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20 },
  iconButton: { width: 44, height: 44, backgroundColor: '#FFFFFF', borderRadius: 22, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 3, marginTop: -20 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#1C1C1E' },
  inputContainer: { padding: 20, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E5E5EA' },
  textInput: { height: 120, backgroundColor: '#F4F4FF', borderRadius: 16, padding: 15, fontSize: 16, color: '#1C1C1E', marginBottom: 15 },
  saveBtn: { backgroundColor: '#5E5CE6', paddingVertical: 14, borderRadius: 16, alignItems: 'center' },
  saveBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  historyHeader: { paddingHorizontal: 20, paddingTop: 20 },
  historyTitle: { fontSize: 18, fontWeight: '800', color: '#1C1C1E' },
  entryCard: { backgroundColor: '#FFFFFF', padding: 16, borderRadius: 16, marginBottom: 15, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 8, elevation: 2 },
  entryHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  entryDate: { fontSize: 12, color: '#8E8E93', fontWeight: '600' },
  entryText: { fontSize: 15, color: '#48484A', lineHeight: 22 },
  emptyText: { textAlign: 'center', color: '#8E8E93', marginTop: 20 }
});