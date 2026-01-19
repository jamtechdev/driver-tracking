/**
 * Authentication Navigator
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthStackParamList } from './types';
import LoginScreen from '@/screens/auth/LoginScreen';
import PinEntryScreen from '@/screens/auth/PinEntryScreen';
import SupervisorLoginScreen from '@/screens/auth/SupervisorLoginScreen';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export const AuthNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="PinEntry" component={PinEntryScreen} />
      <Stack.Screen name="SupervisorLogin" component={SupervisorLoginScreen} />
    </Stack.Navigator>
  );
};

