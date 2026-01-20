/**
 * Driver Tracking App
 * @format
 */

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Auth Screens
import LoginScreen from './src/screens/auth/LoginScreen';
import PinEntryScreen from './src/screens/auth/PinEntryScreen';
import SupervisorLoginScreen from './src/screens/auth/SupervisorLoginScreen';

// Main Screens
import HomeScreen from './src/screens/home/HomeScreen';
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
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      <NavigationContainer>
        <Stack.Navigator initialRouteName="Login">
          {/* Auth Stack */}
          <Stack.Screen 
            name="Login" 
            component={LoginScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen 
            name="PinEntry" 
            component={PinEntryScreen}
            options={{ title: 'Enter PIN' }}
          />
          <Stack.Screen 
            name="SupervisorLogin" 
            component={SupervisorLoginScreen}
            options={{ title: 'Supervisor Login' }}
          />
          
          {/* Main Stack */}
          <Stack.Screen 
            name="Home" 
            component={HomeScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen 
            name="Map" 
            component={MapScreen}
            options={{ title: 'Map' }}
          />
          <Stack.Screen 
            name="RouteSelection" 
            component={RouteSelectionScreen}
            options={{ title: 'Select Route' }}
          />
          <Stack.Screen 
            name="RouteDetails" 
            component={RouteDetailsScreen}
            options={{ title: 'Route Details' }}
          />
          <Stack.Screen 
            name="PreTrip" 
            component={PreTripScreen}
            options={{ title: 'Pre-Trip Inspection' }}
          />
          <Stack.Screen 
            name="PostTrip" 
            component={PostTripScreen}
            options={{ title: 'Post-Trip Inspection' }}
          />
          <Stack.Screen 
            name="PassengerFare" 
            component={PassengerFareScreen}
            options={{ title: 'Passenger & Fare' }}
          />
          <Stack.Screen 
            name="Messaging" 
            component={MessagingScreen}
            options={{ title: 'Messaging' }}
          />
          <Stack.Screen 
            name="Settings" 
            component={SettingsScreen}
            options={{ title: 'Settings' }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

export default App;
