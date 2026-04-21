/**
 * Main App Navigator
 * Handles navigation between Auth, Main, and Supervisor flows
 */

import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from './types';
import { AuthNavigator } from './AuthNavigator';
import { MainNavigator } from './MainNavigator';
import { SupervisorNavigator } from './SupervisorNavigator';
import { useAppSelector } from '@/store/hooks';
import { useAuth } from '@/context/AuthContext';

const Stack = createNativeStackNavigator<RootStackParamList>();

export const AppNavigator: React.FC = () => {
  const { isAuthenticated, isSupervisorMode } = useAppSelector((state: any) => state.auth);
  const linking = {
    prefixes: ['drivertracking://'],
    config: {
      screens: {
        Main: 'main',
        Auth: 'auth',
      },
    },
  };

  return (
    <NavigationContainer linking={linking}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          <Stack.Screen name="Auth" component={AuthNavigator} />
          // ) : isSupervisorMode ? (
          //   <Stack.Screen name="Supervisor" component={SupervisorNavigator} />
        )
          : (
            <Stack.Screen name="Main" component={MainNavigator} />
          )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

