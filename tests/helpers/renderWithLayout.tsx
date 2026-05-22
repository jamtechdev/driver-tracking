import React from 'react';
import { View } from 'react-native';
import { render, type RenderAPI, type RenderOptions } from '@testing-library/react-native';

/**
 * Host tree with explicit dimensions so ScrollView / lists mount children in Jest.
 */
export function renderWithLayout(
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
): RenderAPI {
  return render(ui, {
    ...options,
    wrapper: ({ children }) => (
      <View style={{ flex: 1, height: 900, width: 400 }}>{children}</View>
    ),
  });
}
