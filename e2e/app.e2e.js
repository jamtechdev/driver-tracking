/**
 * Detox E2E smoke test (iOS Simulator + Android emulator / device).
 * Prerequisite: `npm run e2e:build:ios` or `npm run e2e:build:android`.
 */
describe('DriverTracking app', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  it('shows splash then the home shell', async () => {
    await waitFor(element(by.id('splash-screen')))
      .toBeVisible()
      .withTimeout(8000);

    await waitFor(element(by.id('home-container')))
      .toBeVisible()
      .withTimeout(20000);
  });
});
