/**
 * Persist Mapbox Navigation Android tweaks after npm install:
 * - custom puck scale
 * - voice guidance permanently muted / not requested
 */
const fs = require('fs');
const path = require('path');

const androidKt = path.join(
  __dirname,
  '..',
  'node_modules',
  '@pawan-pk',
  'react-native-mapbox-navigation',
  'android',
  'src',
  'main',
  'java',
  'com',
  'mapboxnavigation',
  'MapboxNavigationView.kt',
);

const iosSwift = path.join(
  __dirname,
  '..',
  'node_modules',
  '@pawan-pk',
  'react-native-mapbox-navigation',
  'ios',
  'MapboxNavigationView.swift',
);

const MARKER = 'DRIVER_TRACKING_PUCK_SCALE_V2';
const MUTE_MARKER = 'DRIVER_TRACKING_MUTE_VOICE_V1';

function patchAndroid() {
  if (!fs.existsSync(androidKt)) {
    console.warn('[patch-mapbox-puck] Android package not installed, skipping');
    return;
  }

  let source = fs.readFileSync(androidKt, 'utf8');

  if (!source.includes(MARKER)) {
    source = source.replace(
      /scaleExpression\s*=\s*com\.mapbox\.maps\.extension\.style\.expressions\.dsl\.generated\.literal\([^)]+\)/,
      `scaleExpression = "[\\"literal\\",1.65]" /* ${MARKER} */`,
    );

    const needleNoScale = `this.locationPuck = LocationPuck2D(
        bearingImage = ImageHolder.Companion.from(
          resolveDriverNavigationPuckIcon()
        )
      )`;

    const withScale = `this.locationPuck = LocationPuck2D(
        // ${MARKER}
        bearingImage = ImageHolder.Companion.from(
          resolveDriverNavigationPuckIcon()
        ),
        scaleExpression = "[\\"literal\\",1.65]",
      )`;

    if (source.includes(needleNoScale)) {
      source = source.replace(needleNoScale, withScale);
    } else if (source.includes('scaleExpression = "[\\"literal\\",1.65]"')) {
      source = source.replace(
        'scaleExpression = "[\\"literal\\",1.65]"',
        `scaleExpression = "[\\"literal\\",1.65]" // ${MARKER}`,
      );
    }
  }

  if (!source.includes(MUTE_MARKER)) {
    source = source.replace(
      /private var isVoiceInstructionsMuted = false/,
      `private var isVoiceInstructionsMuted = true // ${MUTE_MARKER}`,
    );
    source = source.replace(
      /\.voiceInstructions\(true\)/,
      `.voiceInstructions(false) // ${MUTE_MARKER}`,
    );
    // Keep unmute path muted
    if (source.includes('voiceInstructionsPlayer?.volume(SpeechVolume(1f))')) {
      source = source.replace(
        /binding\.soundButton\.unmuteAndExtend\(BUTTON_ANIMATION_DURATION\)\s*\n\s*voiceInstructionsPlayer\?\.volume\(SpeechVolume\(1f\)\)/g,
        `binding.soundButton.muteAndExtend(BUTTON_ANIMATION_DURATION)\n        voiceInstructionsPlayer?.volume(SpeechVolume(0f)) // ${MUTE_MARKER}`,
      );
    }
  }

  fs.writeFileSync(androidKt, source);
  console.log('[patch-mapbox-puck] Android patched');
}

function patchIos() {
  if (!fs.existsSync(iosSwift)) {
    console.warn('[patch-mapbox-puck] iOS package not installed, skipping');
    return;
  }

  let source = fs.readFileSync(iosSwift, 'utf8');
  if (source.includes(MUTE_MARKER)) {
    console.log('[patch-mapbox-puck] iOS mute already applied');
    return;
  }

  if (source.includes('NavigationSettings.shared.voiceMuted = strongSelf.mute')) {
    source = source.replace(
      'NavigationSettings.shared.voiceMuted = strongSelf.mute',
      `NavigationSettings.shared.voiceMuted = true // ${MUTE_MARKER}`,
    );
    fs.writeFileSync(iosSwift, source);
    console.log('[patch-mapbox-puck] iOS mute patched');
  } else if (source.includes('NavigationSettings.shared.voiceMuted = true')) {
    source = source.replace(
      'NavigationSettings.shared.voiceMuted = true',
      `NavigationSettings.shared.voiceMuted = true // ${MUTE_MARKER}`,
    );
    fs.writeFileSync(iosSwift, source);
    console.log('[patch-mapbox-puck] iOS mute marked');
  } else {
    console.warn('[patch-mapbox-puck] iOS mute line not found');
  }
}

patchAndroid();
patchIos();
