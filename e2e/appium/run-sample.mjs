/**
 * Minimal Appium 2 + WebdriverIO sample (run Appium server separately).
 *
 * Usage:
 *   1. Build the app (same artifacts as Detox).
 *   2. Start server: `appium` (Appium 2.x)
 *   3. `npm run test:e2e:appium:android` or `test:e2e:appium:ios`
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { remote } from 'webdriverio';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '../..');

const flavor = process.argv[2] === 'ios' ? 'ios' : 'android';
const capFile =
  flavor === 'ios'
    ? path.join(__dirname, 'capabilities.ios.json')
    : path.join(__dirname, 'capabilities.android.json');

const raw = JSON.parse(readFileSync(capFile, 'utf8'));
const capabilities = {
  ...raw,
  'appium:app': path.resolve(rootDir, raw['appium:app'].replace(/^\.\//, '')),
};

const driver = await remote({
  hostname: process.env.APPIUM_HOST ?? '127.0.0.1',
  port: Number(process.env.APPIUM_PORT ?? 4723),
  path: '/',
  logLevel: 'error',
  capabilities,
});

try {
  const splash = await driver.$('~splash-screen');
  await splash.waitForDisplayed({ timeout: 15000 });

  const home = await driver.$('~home-container');
  await home.waitForDisplayed({ timeout: 25000 });
  console.log('Appium smoke: splash → home OK');
} finally {
  await driver.deleteSession();
}
