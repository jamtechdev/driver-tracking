/**
 * Driver Tracking App
 * @format
 */

import React, { Component, lazy, Suspense, useEffect, type ErrorInfo, type ReactNode } from 'react';
import Orientation from 'react-native-orientation-locker';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, StatusBar, Text, View, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';

import { AuthProvider } from './src/context/AuthContext';
import { DriverModalProvider } from './src/context/DriverModalContext';
import { DriverModelProvider } from './src/context/DriverModelContext';
import { BrightnessProvider } from './src/context/BrightnessContext';
import { EmergencyProvider } from './src/context/EmergencyContext';
import { MessagingModalProvider } from './src/context/MessagingModalContext';
import { SettingsModalProvider } from './src/context/SettingsModalContext';
import { MapModalProvider } from './src/context/MapModalContext';
import { ChecklistModalProvider } from './src/context/ChecklistModalContext';
import { ReportIncidentModalProvider } from './src/context/ReportIncidentModalContext';
import { IncomingMessagesProvider } from './src/context/IncomingMessagesContext';
import { COLORS } from './src/theme/colors';
import SendMessageModal from './src/components/SendMessageModal';
import SettingsModal from './src/components/SettingsModal';
import MapModal from './src/components/MapModal';
import ChecklistModal from './src/components/ChecklistModal';
import ReportIncidentModal from './src/components/ReportIncidentModal';

class AppErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  state = { hasError: false, error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('App Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError && this.state.error) {
      return (
        <View style={errorStyles.container}>
          <Text style={errorStyles.title}>Something went wrong</Text>
          <Text style={errorStyles.message}>{this.state.error.message}</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

const errorStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1E2228',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  title: { fontSize: 18, fontWeight: '600', color: '#FFF', marginBottom: 12 },
  message: { fontSize: 14, color: '#9CA3AF', textAlign: 'center' },
});

const styles = StyleSheet.create({
  root: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  fill: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
});

// Auth Screens
import DriverSelectScreen from './src/screens/auth/DriverSelectScreen';
import PinEntryScreen from './src/screens/auth/PinEntryScreen';

// Main Screens - HomeScreen lazy-loaded (uses GradientPath which may crash on init)
const HomeScreen = lazy(() => import('./src/screens/home/HomeScreen'));
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
  useEffect(() => {
    Orientation.unlockAllOrientations();
  }, []);

  return (
    <AppErrorBoundary>
      <GestureHandlerRootView style={[styles.root, { backgroundColor: COLORS.background }]}>
        <SafeAreaProvider style={styles.fill}>
        <AuthProvider>
          <DriverModelProvider>
          <DriverModalProvider>
            <IncomingMessagesProvider>
            <BrightnessProvider>
            <EmergencyProvider>
            <MessagingModalProvider>
            <SettingsModalProvider>
            <MapModalProvider>
            <ChecklistModalProvider>
            <ReportIncidentModalProvider>
            <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
            <NavigationContainer>
              <Suspense fallback={
                <View style={[errorStyles.container, { padding: 24 }]}>
                  <ActivityIndicator size="large" color="#FFF" />
                  <Text style={[errorStyles.message, { marginTop: 16 }]}>Loading...</Text>
                </View>
              }>
              <Stack.Navigator
                initialRouteName="Home"
                screenOptions={{
                  headerStyle: { backgroundColor: COLORS.background },
                  headerTintColor: '#FFFFFF',
                  headerTitleStyle: { fontWeight: 'bold' },
                  contentStyle: { backgroundColor: COLORS.background, flex: 1 },
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
                <Stack.Screen name="Map" component={MapScreen} options={{ headerShown: false }} />
                <Stack.Screen name="RouteSelection" component={RouteSelectionScreen} options={{ title: 'Select Route' }} />
                <Stack.Screen name="RouteDetails" component={RouteDetailsScreen} options={{ title: 'Route Details' }} />
                <Stack.Screen name="PreTrip" component={PreTripScreen} options={{ title: 'Pre-Trip Inspection' }} />
                <Stack.Screen name="PostTrip" component={PostTripScreen} options={{ title: 'Post-Trip Inspection' }} />
                <Stack.Screen name="PassengerFare" component={PassengerFareScreen} options={{ title: 'Passenger & Fare' }} />
                <Stack.Screen name="Messaging" component={MessagingScreen} options={{ title: 'Messaging' }} />
                <Stack.Screen name="Settings" component={SettingsScreen} options={{ headerShown: false }} />
              </Stack.Navigator>
              </Suspense>
            </NavigationContainer>
            <SendMessageModal />
            <SettingsModal />
            <MapModal />
            <ChecklistModal />
            <ReportIncidentModal />
            <Toast />
            </ReportIncidentModalProvider>
            </ChecklistModalProvider>
            </MapModalProvider>
            </SettingsModalProvider>
            </MessagingModalProvider>
            </EmergencyProvider>
            </BrightnessProvider>
            </IncomingMessagesProvider>
          </DriverModalProvider>
          </DriverModelProvider>
          </AuthProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </AppErrorBoundary>
  );
}

export default App;
