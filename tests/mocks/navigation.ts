import type { NavigationProp, ParamListBase } from '@react-navigation/native';

/**
 * Typed navigation double for screen-level component tests.
 */
export function createMockNavigation<T extends ParamListBase = ParamListBase>(
  overrides: Partial<NavigationProp<T>> = {},
): NavigationProp<T> {
  const navigate = jest.fn();
  const replace = jest.fn();
  const goBack = jest.fn();
  const reset = jest.fn();
  const setParams = jest.fn();
  const dispatch = jest.fn();
  const setOptions = jest.fn();
  const addListener = jest.fn(() => jest.fn());
  const isFocused = jest.fn(() => true);
  const canGoBack = jest.fn(() => false);
  const getId = jest.fn(() => 'mock-nav');
  const getParent = jest.fn();
  const getState = jest.fn(() => ({ key: 'mock', index: 0, routeNames: [], routes: [], type: 'stack', stale: false as const }));

  return {
    navigate,
    replace,
    goBack,
    reset,
    setParams,
    dispatch,
    setOptions,
    addListener,
    isFocused,
    canGoBack,
    getId,
    getParent,
    getState,
    ...overrides,
  } as NavigationProp<T>;
}
