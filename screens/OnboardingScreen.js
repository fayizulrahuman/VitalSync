import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebaseConfig';
import { backupDataToCloud } from '../CloudSync';


export default function OnboardingScreen({ navigation }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [age, setAge] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [weight, setWeight] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleCompleteSignUp = async () => {
    if (!name || !email || !password || !bloodGroup) {
      return Alert.alert("Required Fields", "Name, Email, Password, and Blood Group are required.");
    }
    setIsLoading(true);
    try {
      const userCred = await createUserWithEmailAndPassword(auth, email, password);

      await AsyncStorage.setItem('@vital_user_name', name);
      await AsyncStorage.setItem('@vital_user_age', age || 'N/A');
      await AsyncStorage.setItem('@vital_user_bg', bloodGroup);
      await AsyncStorage.setItem('@vital_sync_blood', bloodGroup); 
      await AsyncStorage.setItem('@vital_sync_weight', weight || '0');
      
      const newId = `VTL-${Math.floor(Math.random() * 90000) + 10000}`;
      await AsyncStorage.setItem('@vital_health_id', newId);
      await AsyncStorage.setItem('@vital_user_avatar', JSON.stringify({ type: 'inbuilt', gender: 'male', index: 0 }));
      
      // 🛑 FIXED: Push to cloud right after creating the account!
      await backupDataToCloud(userCred.user.uid);

      await AsyncStorage.setItem('@vital_is_logged_in', 'true');
      navigation.replace('MainTabs'); 
    } catch (error) {
      Alert.alert("Registration Failed", error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <LinearGradient colors={['#E5EDFF', '#F4F7FF', '#E3EDFF']} style={StyleSheet.absoluteFillObject} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
      <SafeAreaView style={styles.safeArea}>
        <ScrollView showsVerticalScrollIndicator={false}>
          
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#1C1C1E" />
          </TouchableOpacity>

          <Text style={styles.title}>Create Profile</Text>
          <Text style={styles.subtitle}>Let's set up your essential health data.</Text>

          <View style={styles.formContainer}>
            <Text style={styles.label}>Account Details</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="mail-outline" size={20} color="#8E8E93" style={styles.icon} />
              <TextInput style={styles.input} placeholder="Email Address" keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail} />
            </View>
            <View style={styles.inputWrapper}>
              <Ionicons name="lock-closed-outline" size={20} color="#8E8E93" style={styles.icon} />
              <TextInput style={styles.input} placeholder="Create Password" secureTextEntry value={password} onChangeText={setPassword} />
            </View>

            <View style={styles.divider} />

            <Text style={styles.label}>Personal Details</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="person-outline" size={20} color="#8E8E93" style={styles.icon} />
              <TextInput style={styles.input} placeholder="Full Name" value={name} onChangeText={setName} />
            </View>

            <View style={styles.row}>
              <View style={[styles.inputGroup, { marginRight: 10 }]}>
                <View style={styles.inputWrapper}>
                  <TextInput style={styles.input} placeholder="Age" keyboardType="numeric" value={age} onChangeText={setAge} />
                </View>
              </View>
              <View style={[styles.inputGroup, { marginLeft: 10 }]}>
                <View style={styles.inputWrapper}>
                  <TextInput style={styles.input} placeholder="Blood (O+)" autoCapitalize="characters" value={bloodGroup} onChangeText={setBloodGroup} />
                </View>
              </View>
            </View>

            <View style={styles.inputWrapper}>
              <Ionicons name="scale-outline" size={20} color="#8E8E93" style={styles.icon} />
              <TextInput style={styles.input} placeholder="Current Weight (kg)" keyboardType="decimal-pad" value={weight} onChangeText={setWeight} />
            </View>

            <TouchableOpacity style={styles.primaryBtn} onPress={handleCompleteSignUp} disabled={isLoading}>
              <Text style={styles.primaryBtnText}>{isLoading ? "Creating Account..." : "Complete Sign Up"}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingHorizontal: 25 },
  backBtn: { width: 44, height: 44, backgroundColor: '#FFFFFF', borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginTop: 10, marginBottom: 20, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
  title: { fontSize: 32, fontWeight: '800', color: '#1C1C1E', marginBottom: 8 },
  subtitle: { fontSize: 15, color: '#8E8E93', marginBottom: 30 },
  
  formContainer: { backgroundColor: 'rgba(255,255,255,0.7)', padding: 25, borderRadius: 24, borderWidth: 1, borderColor: '#FFFFFF', marginBottom: 40 },
  label: { fontSize: 13, fontWeight: '800', color: '#1C1C1E', marginBottom: 12, marginTop: 5 },
  divider: { height: 1, backgroundColor: '#D1D1D6', marginVertical: 20 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  inputGroup: { flex: 1 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 16, paddingHorizontal: 15, height: 55, borderWidth: 1, borderColor: '#F0F0F0', marginBottom: 15 },
  icon: { marginRight: 10 },
  input: { flex: 1, fontSize: 16, color: '#1C1C1E', fontWeight: '500' },
  
  primaryBtn: { backgroundColor: '#34C759', borderRadius: 16, height: 55, justifyContent: 'center', alignItems: 'center', marginTop: 15, shadowColor: '#34C759', shadowOpacity: 0.3, shadowRadius: 10, elevation: 4 },
  primaryBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' }
});