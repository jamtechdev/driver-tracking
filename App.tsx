/**
 * Driver Tracking App
 * @format
 */

import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from './src/context/AuthContext';
import { DriverModalProvider } from './src/context/DriverModalContext';
import { BrightnessProvider } from './src/context/BrightnessContext';
import { EmergencyProvider } from './src/context/EmergencyContext';

// Auth Screens
import DriverSelectScreen from './src/screens/auth/DriverSelectScreen';
import PinEntryScreen from './src/screens/auth/PinEntryScreen';

// Main Screens
import HomeScreen from './src/screens/home/HomeScreen';
import SupervisorHomeScreen from './src/screens/supervisor/SupervisorHomeScreen';
import MapScreen from './src/screens/map/MapScreen';
import RouteSelectionScreen from './src/screens/route/RouteSelectionScreen';
import RouteDetailsScreen from './src/screens/route/RouteDetailsScreen';
import PreTripScreen from './src/screens/inspection/PreTripScreen';
import PostTripScreen from './src/screens/inspection/PostTripScreen';
import PassengerFareScreen from './src/screens/passenger/PassengerFareScreen';
import MessagingScreen from './src/screens/messaging/MessagingScreen';
import SettingsScreen from './src/screens/settings/SettingsScreen';

const Stack = createNativeStackNavigator();

function App(): React.JSX.Element {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <DriverModalProvider>
            <BrightnessProvider>
            <EmergencyProvider>
            <StatusBar barStyle="light-content" backgroundColor="#1E2228" />
            <NavigationContainer>
              <Stack.Navigator
                initialRouteName="Home"
                screenOptions={{
                  headerStyle: { backgroundColor: '#1E2228' },
                  headerTintColor: '#FFFFFF',
                  headerTitleStyle: { fontWeight: 'bold' },
                  contentStyle: { backgroundColor: '#1E2228' },
                  animation: 'slide_from_right',
                  animationDuration: 300,
                }}
              >
                <Stack.Screen
                  name="DriverSelect"
                  component={DriverSelectScreen}
                  options={{ headerShown: false }}
                />
                <Stack.Screen
                  name="PinEntry"
                  component={PinEntryScreen as React.ComponentType<any>}
                  options={{ headerShown: false }}
                />
                <Stack.Screen
                  name="Home"
                  component={HomeScreen}
                  options={{ headerShown: false }}
                />
                <Stack.Screen
                  name="SupervisorHome"
                  component={SupervisorHomeScreen}
                  options={{ headerShown: false }}
                />
                <Stack.Screen name="Map" component={MapScreen} options={{ title: 'Map' }} />
                <Stack.Screen name="RouteSelection" component={RouteSelectionScreen} options={{ title: 'Select Route' }} />
                <Stack.Screen name="RouteDetails" component={RouteDetailsScreen} options={{ title: 'Route Details' }} />
                <Stack.Screen name="PreTrip" component={PreTripScreen} options={{ title: 'Pre-Trip Inspection' }} />
                <Stack.Screen name="PostTrip" component={PostTripScreen} options={{ title: 'Post-Trip Inspection' }} />
                <Stack.Screen name="PassengerFare" component={PassengerFareScreen} options={{ title: 'Passenger & Fare' }} />
                <Stack.Screen name="Messaging" component={MessagingScreen} options={{ title: 'Messaging' }} />
                <Stack.Screen name="Settings" component={SettingsScreen} options={{ headerShown: false }} />
              </Stack.Navigator>
            </NavigationContainer>
            </EmergencyProvider>
            </BrightnessProvider>
          </DriverModalProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default App;
