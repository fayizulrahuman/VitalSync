import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

// --- Native Notification Handler ---
// This tells the OS to show the banner and play a sound even when the app is open
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Screens
import AddMedicineScreen from './screens/AddMedicineScreen';
import DonorsListScreen from './screens/DonorsListScreen';
import EmergencyBloodScreen from './screens/EmergencyBloodScreen';
import HealthScreen from './screens/HealthScreen';
import HomeScreen from './screens/HomeScreen';
import JournalScreen from './screens/JournalScreen';
import MedicineDetailsScreen from './screens/MedicineDetailsScreen';
import MentalHealthScreen from './screens/MentalHealthScreen';
import ProfileScreen from './screens/ProfileScreen';
import RemindersScreen from './screens/RemindersScreen';
import RuralHealthAssistantScreen from './screens/RuralHealthAssistantScreen';
import StepsScreen from './screens/StepsScreen';

// Auth Screens
import LoginScreen from './screens/LoginScreen';
import OnboardingScreen from './screens/OnboardingScreen';

// Context
import { MedicineProvider } from './context/MedicineContext';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: '#5E5CE6', 
        tabBarInactiveTintColor: '#8E8E93',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 0,
          elevation: 10,
          shadowColor: '#000',
          shadowOpacity: 0.05,
          shadowRadius: 15,
          height: 85,
          paddingBottom: 25,
          paddingTop: 10,
        },
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          if (route.name === 'Home') iconName = focused ? 'home' : 'home-outline';
          else if (route.name === 'Health') iconName = focused ? 'pulse' : 'pulse-outline';
          else if (route.name === 'Reminders') iconName = focused ? 'calendar' : 'calendar-outline';
          else if (route.name === 'Profile') iconName = focused ? 'person' : 'person-outline';
          return <Ionicons name={iconName} size={size + 2} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Health" component={HealthScreen} />
      <Tab.Screen name="Reminders" component={RemindersScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [initialRoute, setInitialRoute] = useState('Login');

  useEffect(() => {
    checkLoginStatus();
  }, []);

  const checkLoginStatus = async () => {
    try {
      const isLoggedIn = await AsyncStorage.getItem('@vital_is_logged_in');
      if (isLoggedIn === 'true') {
        setInitialRoute('MainTabs');
      } else {
        setInitialRoute('Login');
      }
    } catch (e) {
      setInitialRoute('Login');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#5E5CE6" />
      </View>
    );
  }

  return (
    <MedicineProvider>
      <NavigationContainer>
        <Stack.Navigator initialRouteName={initialRoute} screenOptions={{ headerShown: false, headerShadowVisible: false }}>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
          <Stack.Screen name="MainTabs" component={TabNavigator} />
          <Stack.Screen name="MentalHealth" component={MentalHealthScreen} />
          <Stack.Screen name="RuralHealthAssistant" component={RuralHealthAssistantScreen} />
          <Stack.Screen name="DonorsList" component={DonorsListScreen} />
          <Stack.Screen name="EmergencyBlood" component={EmergencyBloodScreen} />
          <Stack.Screen name="MedicineDetails" component={MedicineDetailsScreen} />
          <Stack.Screen name="Journal" component={JournalScreen} />
          <Stack.Screen name="StepsDetail" component={StepsScreen} />
          <Stack.Screen name="AddMedicine" component={AddMedicineScreen} /> 
        </Stack.Navigator>
      </NavigationContainer>
    </MedicineProvider>
  );
}