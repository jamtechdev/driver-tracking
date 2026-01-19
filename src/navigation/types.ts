/**
 * Navigation Type Definitions
 */

import { NavigatorScreenParams } from '@react-navigation/native';

export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Main: NavigatorScreenParams<MainTabParamList>;
  Supervisor: NavigatorScreenParams<SupervisorStackParamList>;
};

export type AuthStackParamList = {
  Login: undefined;
  PinEntry: { driverId: string };
  SupervisorLogin: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Map: undefined;
  Messages: undefined;
  Settings: undefined;
};

export type MainStackParamList = {
  Tabs: NavigatorScreenParams<MainTabParamList>;
  RouteSelection: undefined;
  RouteDetails: { routeId: string };
  PassengerFare: { routeId: string; stopId?: string };
  PreTrip: { routeId: string };
  PostTrip: { routeId: string };
};

export type SupervisorStackParamList = {
  Dashboard: undefined;
  DriverManagement: undefined;
  RouteManagement: undefined;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}

