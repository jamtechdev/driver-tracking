/**
 * Main App Navigator
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MainStackParamList, MainTabParamList } from './types';
import HomeScreen from '@/screens/home/HomeScreen';
import MapScreen from '@/screens/map/MapScreen';
import MessagingScreen from '@/screens/messaging/MessagingScreen';
import SettingsScreen from '@/screens/settings/SettingsScreen';
import RouteSelectionScreen from '@/screens/route/RouteSelectionScreen';
import RouteDetailsScreen from '@/screens/route/RouteDetailsScreen';
import PassengerFareScreen from '@/screens/passenger/PassengerFareScreen';
import PreTripScreen from '@/screens/inspection/PreTripScreen';
import PostTripScreen from '@/screens/inspection/PostTripScreen';

const Tab = createBottomTabNavigator<MainTabParamList>();
const Stack = createNativeStackNavigator<MainStackParamList>();

const TabNavigator: React.FC = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: '#8E8E93',
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Map" component={MapScreen} />
      <Tab.Screen name="Messages" component={MessagingScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
};

export const MainNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: true,
      }}
    >
      <Stack.Screen name="Tabs" component={TabNavigator} options={{ headerShown: false }} />
      <Stack.Screen name="RouteSelection" component={RouteSelectionScreen} />
      <Stack.Screen name="RouteDetails" component={RouteDetailsScreen} />
      <Stack.Screen name="PassengerFare" component={PassengerFareScreen} />
      <Stack.Screen name="PreTrip" component={PreTripScreen} />
      <Stack.Screen name="PostTrip" component={PostTripScreen} />
    </Stack.Navigator>
  );
};

