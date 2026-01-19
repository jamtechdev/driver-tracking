/**
 * Supervisor Mode Navigator
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SupervisorStackParamList } from './types';

const Stack = createNativeStackNavigator<SupervisorStackParamList>();

export const SupervisorNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: true,
      }}
    >
      {/* Supervisor screens will be added in later milestones */}
      <Stack.Screen name="Dashboard" component={() => null} />
      <Stack.Screen name="DriverManagement" component={() => null} />
      <Stack.Screen name="RouteManagement" component={() => null} />
    </Stack.Navigator>
  );
};

