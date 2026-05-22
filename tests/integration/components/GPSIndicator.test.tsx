import React from 'react';
import { render } from '@testing-library/react-native';
import GPSIndicator from '@/components/GPSIndicator';

describe('GPSIndicator', () => {
  it('renders with defaults', () => {
    const { toJSON } = render(<GPSIndicator />);
    expect(toJSON()).toBeTruthy();
  });
});
