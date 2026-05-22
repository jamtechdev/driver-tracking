import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import LoginScreen from '@/screens/auth/LoginScreen';
import { createMockNavigation } from '../mocks/navigation';

describe('LoginScreen (integration)', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('navigates to PinEntry when credentials are submitted', () => {
    const navigation = createMockNavigation();
    render(<LoginScreen navigation={navigation} />);

    fireEvent.changeText(screen.getByPlaceholderText('Enter your driver ID'), 'driver1');
    fireEvent.changeText(screen.getByPlaceholderText('Enter your password'), 'secret');
    fireEvent.press(screen.getByText('Sign In'));

    expect(navigation.navigate).toHaveBeenCalledWith('PinEntry');
  });

  it('navigates to SupervisorLogin from footer action', () => {
    const navigation = createMockNavigation();
    render(<LoginScreen navigation={navigation} />);

    fireEvent.press(screen.getByText(/Supervisor Login/));

    expect(navigation.navigate).toHaveBeenCalledWith('SupervisorLogin');
  });
});
