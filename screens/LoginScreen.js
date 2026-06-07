import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { makeRedirectUri } from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import { GoogleAuthProvider, sendPasswordResetEmail, signInWithCredential, signInWithEmailAndPassword } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth } from '../firebaseConfig';

WebBrowser.maybeCompleteAuthSession();

// 🛑 IMPORTANT: Replace these with your actual keys from Google Cloud Console
const WEB_CLIENT_ID = '182625049503-6t62o5j3f2dp8ng9os0uekgtkj0vclbu.apps.googleusercontent.com';
const ANDROID_CLIENT_ID = 'YOUR_ANDROID_CLIENT_ID.apps.googleusercontent.com';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Custom Alert State
  const [customAlert, setCustomAlert] = useState({ visible: false, title: '', message: '', type: 'info' });

  const showWarning = (title, message, type = 'info') => {
    setCustomAlert({ visible: true, title, message, type });
  };

  // --- Google Auth Setup ---
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: WEB_CLIENT_ID,
    androidClientId: ANDROID_CLIENT_ID,
    redirectUri: makeRedirectUri({ scheme: 'vitalsync' }),
  });

  useEffect(() => {
    if (response?.type === 'success') {
      const { id_token } = response.params;
      const credential = GoogleAuthProvider.credential(id_token);
      
      signInWithCredential(auth, credential)
        .then(async (userCred) => {
          await syncDefaultUserData(userCred.user.displayName || 'User', 'UNKNOWN');
          navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
        })
        .catch(error => showWarning("Google Login Failed", error.message, "error"));
    }
  }, [response]);

  const handleGoogleLogin = () => {
    // Safety check to prevent the Error 400 crash!
    if (WEB_CLIENT_ID.includes('YOUR_WEB_CLIENT_ID')) {
      showWarning(
        "Configuration Missing", 
        "Please replace the placeholder Client IDs in LoginScreen.js with your actual Google Cloud IDs to enable Google Sign-In.", 
        "warning"
      );
      return;
    }
    promptAsync();
  };

  const handleEmailLogin = async () => {
    if (!email || !password) return showWarning("Missing Details", "Please enter both your email and password.", "warning");
    setIsLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      await AsyncStorage.setItem('@vital_is_logged_in', 'true');
      navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] }); 
    } catch (error) {
      let errorMsg = "Login failed. Please try again.";
      if (error.code === 'auth/invalid-credential') errorMsg = "Incorrect email or password.";
      showWarning("Login Failed", errorMsg, "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    await syncDefaultUserData('Guest User', 'O+');
    navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
  };

  const handleForgotPassword = async () => {
    if (!email) return showWarning("Missing Email", "Please enter your email address first so we know where to send the link.", "warning");
    try {
      await sendPasswordResetEmail(auth, email);
      showWarning("Email Sent", "Check your inbox for password reset instructions.", "success");
    } catch (error) {
      showWarning("Error", error.message, "error");
    }
  };

  const syncDefaultUserData = async (name, bloodGroup) => {
    await AsyncStorage.setItem('@vital_user_name', name);
    await AsyncStorage.setItem('@vital_user_bg', bloodGroup);
    await AsyncStorage.setItem('@vital_is_logged_in', 'true');
    const existingAvatar = await AsyncStorage.getItem('@vital_user_avatar');
    if (!existingAvatar) {
      await AsyncStorage.setItem('@vital_user_avatar', JSON.stringify({ type: 'inbuilt', gender: 'male', index: 0 }));
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <LinearGradient colors={['#E5EDFF', '#F4F7FF', '#E3EDFF']} style={StyleSheet.absoluteFillObject} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
      
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.headerContainer}>
          <View style={styles.logoBox}>
            <Ionicons name="pulse" size={40} color="#5E5CE6" />
          </View>
          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>Sign in to access your health dashboard.</Text>
        </View>

        <View style={styles.formContainer}>
          <View style={styles.inputWrapper}>
            <Ionicons name="mail-outline" size={20} color="#8E8E93" style={styles.inputIcon} />
            <TextInput style={styles.input} placeholder="Email Address" keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail} />
          </View>

          <View style={styles.inputWrapper}>
            <Ionicons name="lock-closed-outline" size={20} color="#8E8E93" style={styles.inputIcon} />
            <TextInput style={styles.input} placeholder="Password" secureTextEntry={!showPassword} value={password} onChangeText={setPassword} />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
              <Ionicons name={showPassword ? "eye-outline" : "eye-off-outline"} size={20} color="#8E8E93" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.forgotBtn} onPress={handleForgotPassword}>
            <Text style={styles.forgotText}>Forgot Password?</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.primaryBtn} onPress={handleEmailLogin} disabled={isLoading}>
            <Text style={styles.primaryBtnText}>{isLoading ? "Signing In..." : "Sign In"}</Text>
          </TouchableOpacity>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity style={styles.googleBtn} onPress={handleGoogleLogin}>
            <Ionicons name="logo-google" size={20} color="#DB4437" />
            <Text style={styles.googleBtnText}>Continue with Google</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.guestBtn} onPress={handleGuestLogin}>
            <Text style={styles.guestBtnText}>Continue as Guest</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footerContainer}>
          <Text style={styles.footerText}>Don't have an account? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Onboarding')}>
            <Text style={styles.footerLink}>Sign Up</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

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
            <TouchableOpacity 
              style={[styles.alertBtnOk, customAlert.type === 'error' ? {backgroundColor: '#FF3B30'} : customAlert.type === 'warning' ? {backgroundColor: '#FF9500'} : {backgroundColor: '#5E5CE6'}]} 
              onPress={() => setCustomAlert({visible: false})}
            >
              <Text style={styles.alertBtnOkText}>Okay</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingHorizontal: 25, justifyContent: 'space-between' },
  headerContainer: { marginTop: 60, alignItems: 'center' },
  logoBox: { width: 70, height: 70, backgroundColor: '#FFFFFF', borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: 20, shadowColor: '#5E5CE6', shadowOpacity: 0.2, shadowRadius: 15, elevation: 5 },
  title: { fontSize: 28, fontWeight: '800', color: '#1C1C1E', marginBottom: 8 },
  subtitle: { fontSize: 15, color: '#8E8E93' },
  
  formContainer: { marginTop: 40, backgroundColor: 'rgba(255,255,255,0.7)', padding: 25, borderRadius: 24, borderWidth: 1, borderColor: '#FFFFFF' },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 16, paddingHorizontal: 15, marginBottom: 15, height: 55, borderWidth: 1, borderColor: '#F0F0F0' },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 16, color: '#1C1C1E', fontWeight: '500' },
  forgotBtn: { alignSelf: 'flex-end', marginBottom: 25 },
  forgotText: { color: '#5E5CE6', fontWeight: '600', fontSize: 13 },
  
  primaryBtn: { backgroundColor: '#5E5CE6', borderRadius: 16, height: 55, justifyContent: 'center', alignItems: 'center', shadowColor: '#5E5CE6', shadowOpacity: 0.3, shadowRadius: 10, elevation: 4 },
  primaryBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 25 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#D1D1D6' },
  dividerText: { marginHorizontal: 15, color: '#8E8E93', fontWeight: '600', fontSize: 12 },
  
  googleBtn: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderRadius: 16, height: 55, justifyContent: 'center', alignItems: 'center', marginBottom: 15, borderWidth: 1, borderColor: '#E5E5EA' },
  googleBtnText: { color: '#1C1C1E', fontSize: 15, fontWeight: '700', marginLeft: 10 },
  guestBtn: { backgroundColor: 'transparent', height: 50, justifyContent: 'center', alignItems: 'center' },
  guestBtnText: { color: '#8E8E93', fontSize: 15, fontWeight: '700' },
  
  footerContainer: { flexDirection: 'row', justifyContent: 'center', marginBottom: 30 },
  footerText: { color: '#8E8E93', fontSize: 14 },
  footerLink: { color: '#5E5CE6', fontSize: 14, fontWeight: '800' },

  modalOverlayCenter: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  alertCard: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 30, width: '80%', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 15, elevation: 5 },
  alertIconWrap: { width: 70, height: 70, borderRadius: 35, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  alertTitle: { fontSize: 20, fontWeight: '800', color: '#1C1C1E', marginBottom: 10, textAlign: 'center' },
  alertMessage: { fontSize: 14, color: '#636366', textAlign: 'center', marginBottom: 25, lineHeight: 20 },
  alertBtnOk: { width: '100%', paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  alertBtnOkText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
});