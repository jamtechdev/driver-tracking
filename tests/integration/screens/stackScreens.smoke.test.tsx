import React from 'react';
import { screen, fireEvent } from '@testing-library/react-native';
import RouteSelectionScreen from '@/screens/route/RouteSelectionScreen';
import RouteDetailsScreen from '@/screens/route/RouteDetailsScreen';
import PreTripScreen from '@/screens/inspection/PreTripScreen';
import PostTripScreen from '@/screens/inspection/PostTripScreen';
import PassengerFareScreen from '@/screens/passenger/PassengerFareScreen';
import SupervisorLoginScreen from '@/screens/auth/SupervisorLoginScreen';
import { createMockNavigation } from '../../mocks/navigation';
import { renderWithLayout } from '../../helpers/renderWithLayout';

describe('stack / form screens (smoke)', () => {
  it('RouteSelectionScreen renders and navigates', () => {
    const nav = createMockNavigation();
    renderWithLayout(<RouteSelectionScreen navigation={nav} />);
    expect(screen.getByText('Select Route')).toBeTruthy();
    fireEvent.press(screen.getByText('Route 101'));
    expect(nav.navigate).toHaveBeenCalledWith('RouteDetails', { routeId: 'route1' });
  });

  it('RouteDetailsScreen shows title', () => {
    renderWithLayout(<RouteDetailsScreen />);
    expect(screen.getByText('Route Details')).toBeTruthy();
  });

  it('PreTripScreen shows title', () => {
    renderWithLayout(<PreTripScreen />);
    expect(screen.getByText('Pre-Trip Inspection')).toBeTruthy();
  });

  it('PostTripScreen shows title', () => {
    renderWithLayout(<PostTripScreen />);
    expect(screen.getByText('Post-Trip Inspection')).toBeTruthy();
  });

  it('PassengerFareScreen shows title', () => {
    renderWithLayout(<PassengerFareScreen />);
    expect(screen.getByText('Passenger & Fare')).toBeTruthy();
  });

  it('SupervisorLoginScreen submits', () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    const nav = createMockNavigation();
    renderWithLayout(<SupervisorLoginScreen navigation={nav} />);
    fireEvent.changeText(screen.getByPlaceholderText('Enter supervisor ID'), 'sup1');
    fireEvent.changeText(screen.getByPlaceholderText('Enter your password'), 'pw');
    fireEvent.press(screen.getByText('Sign In'));
    expect(nav.replace).toHaveBeenCalledWith('Home');
  });
});
