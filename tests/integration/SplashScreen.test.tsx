import React from 'react';
import { render, screen } from '@testing-library/react-native';
import SplashScreen from '@/screens/SplashScreen';

describe('SplashScreen (integration)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders branding and invokes onFinish after the splash delay', () => {
    const onFinish = jest.fn();
    render(<SplashScreen onFinish={onFinish} />);

    expect(screen.getByTestId('splash-screen')).toBeTruthy();
    expect(screen.getByText(/Peak Transit/)).toBeTruthy();

    expect(onFinish).not.toHaveBeenCalled();
    jest.advanceTimersByTime(2000);
    expect(onFinish).toHaveBeenCalledTimes(1);
  });
});
