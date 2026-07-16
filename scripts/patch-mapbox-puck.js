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
const NOTIF_SOFT_MARKER = 'DRIVER_TRACKING_NOTIF_SOFT_V1';
const FGS_SAFE_MARKER = 'DRIVER_TRACKING_FGS_SAFE_V1';
const STOP_LABELS_MARKER = 'DRIVER_TRACKING_STOP_LABELS_V1';

const mapboxJsFiles = [
  path.join(
    __dirname,
    '..',
    'node_modules',
    '@pawan-pk',
    'react-native-mapbox-navigation',
    'lib',
    'commonjs',
    'MapboxNavigation.cjs',
  ),
  path.join(
    __dirname,
    '..',
    'node_modules',
    '@pawan-pk',
    'react-native-mapbox-navigation',
    'src',
    'MapboxNavigation.tsx',
  ),
];

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

  if (!source.includes(FGS_SAFE_MARKER)) {
    source = source.replace(
      /mapboxNavigation\?\.startTripSession\(withForegroundService = true\)\s*\n\s*navigationCamera\.requestNavigationCameraToFollowing\(\)/,
      `// ${FGS_SAFE_MARKER}: some Android 13+/14 devices throw if FGS cannot start
    try {
      mapboxNavigation?.startTripSession(withForegroundService = true)
    } catch (e: Exception) {
      try {
        mapboxNavigation?.startTripSession(withForegroundService = false)
      } catch (e2: Exception) {
        sendErrorToReact("Unable to start navigation session: \${e2.message ?: e.message}")
        return
      }
    }
    navigationCamera.requestNavigationCameraToFollowing()`,
    );
  }

  source = patchStopNameLabels(source);

  fs.writeFileSync(androidKt, source);
  console.log('[patch-mapbox-puck] Android patched');
}

/**
 * Show stop names on the navigation map (not just grey waypoint dots).
 * Requires a rebuild of the native Android app after npm install.
 */
function patchStopNameLabels(source) {
  if (source.includes(STOP_LABELS_MARKER)) {
    console.log('[patch-mapbox-puck] Stop name labels already applied');
    return source;
  }

  if (!source.includes('fun rebuildStopLabels()') || !source.includes('ensureStopLabelOverlay')) {
    console.warn(
      '[patch-mapbox-puck] Stop label helpers missing from MapboxNavigationView.kt — skip label patch',
    );
    return source;
  }

  let next = source;

  // Previously labels were cleared when the route started — reverse that.
  next = next.replace(
    /navigationCamera\.requestNavigationCameraToFollowing\(\)\s*\n\s*clearStopLabelOverlay\(\)/,
    `navigationCamera.requestNavigationCameraToFollowing()

    // ${STOP_LABELS_MARKER}: show stop names (grey Mapbox dots alone are hard to use)
    ensureStopLabelOverlay()
    rebuildStopLabels()
    subscribeStopLabelCamera()`,
  );

  if (!next.includes(STOP_LABELS_MARKER)) {
    // Fallback when clearStopLabelOverlay line was already removed
    next = next.replace(
      /navigationCamera\.requestNavigationCameraToFollowing\(\)/,
      `navigationCamera.requestNavigationCameraToFollowing()

    // ${STOP_LABELS_MARKER}: show stop names (grey Mapbox dots alone are hard to use)
    ensureStopLabelOverlay()
    rebuildStopLabels()
    subscribeStopLabelCamera()`,
    );
  }

  if (!next.includes('keep name bubbles aligned to the active stop')) {
    next = next.replace(
      /binding\.tripProgressView\.render\(\s*tripProgressApi\.getTripProgress\(routeProgress\)\s*\)\s*\n\s*\n\s*val event = Arguments\.createMap\(\)/,
      `binding.tripProgressView.render(
      tripProgressApi.getTripProgress(routeProgress)
    )

    // ${STOP_LABELS_MARKER}: keep name bubbles aligned to the active stop
    val legIndex = routeProgress.currentLegProgress?.legIndex ?: 0
    if (legIndex != activeLegIndex) {
      activeLegIndex = legIndex
      refreshStopLabelViews()
    } else {
      updateStopLabelPositions()
    }

    val event = Arguments.createMap()`,
    );
  }

  // Upgrade single-label overlay → current + upcoming name bubbles
  if (next.includes('createStopLabelView(currentLabel)') && !next.includes('createStopLabelView(label, isCurrent)')) {
    next = next.replace(
      /private fun rebuildStopLabels\(\) \{[\s\S]*?private fun subscribeStopLabelCamera\(\)/,
      STOP_LABEL_METHODS + '\n\n  private fun subscribeStopLabelCamera()',
    );
  }

  if (!next.includes(STOP_LABELS_MARKER)) {
    console.warn('[patch-mapbox-puck] Stop name label wiring did not apply');
  } else {
    console.log('[patch-mapbox-puck] Stop name labels patched');
  }
  return next;
}

const STOP_LABEL_METHODS = `private fun rebuildStopLabels() {
    val labels = mutableListOf<DriverStopLabel>()
    waypoints.forEachIndexed { index, point ->
      val raw = waypointLegs.getOrNull(index)?.name?.trim().orEmpty()
      val name = if (raw.isNotEmpty()) raw else "Stop \${index + 1}"
      labels.add(DriverStopLabel(point, name, index))
    }
    destination?.let { point ->
      val raw = destinationTitle.trim()
      val name = if (raw.isNotEmpty() && !raw.equals("Destination", ignoreCase = true)) {
        raw
      } else {
        "Stop \${waypoints.size + 1}"
      }
      labels.add(DriverStopLabel(point, name, waypoints.size))
    }
    stopLabels = labels
    lastRenderedLegIndex = -1
    refreshStopLabelViews()
  }

  private fun refreshStopLabelViews() {
    val overlay = stopLabelOverlay ?: return
    overlay.removeAllViews()
    if (stopLabels.isEmpty()) return

    // Current destination + upcoming stops (cap clutter on long multi-stop trips)
    val fromIndex = activeLegIndex.coerceIn(0, stopLabels.lastIndex)
    val visible = stopLabels.drop(fromIndex).take(8)
    visible.forEachIndexed { offset, label ->
      val isCurrent = offset == 0
      overlay.addView(createStopLabelView(label, isCurrent))
    }
    lastRenderedLegIndex = activeLegIndex
    updateStopLabelPositions()
  }

  private fun resolveDriverStopPinIcon(): Int {
    val customPin = context.resources.getIdentifier(
      "driver_stop_pin_marker",
      "drawable",
      context.packageName,
    )
    return if (customPin != 0) {
      customPin
    } else {
      android.R.drawable.ic_menu_mylocation
    }
  }

  private fun createStopLabelView(label: DriverStopLabel, isCurrent: Boolean): LinearLayout {
    val container = LinearLayout(context).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER_HORIZONTAL
      layoutParams = FrameLayout.LayoutParams(
        FrameLayout.LayoutParams.WRAP_CONTENT,
        FrameLayout.LayoutParams.WRAP_CONTENT,
      )
      tag = label.stopIndex
      elevation = if (isCurrent) dp(12).toFloat() else dp(8).toFloat()
    }

    val borderColor = if (isCurrent) {
      Color.parseColor("#EA4335")
    } else {
      Color.parseColor("#1A73E8")
    }
    val textSizeSp = if (isCurrent) 14f else 12f
    val maxWidthDp = if (isCurrent) 280 else 200

    val nameBubble = TextView(context).apply {
      text = label.name
      setTextColor(Color.parseColor("#202124"))
      setTextSize(TypedValue.COMPLEX_UNIT_SP, textSizeSp)
      setTypeface(typeface, Typeface.BOLD)
      maxLines = 3
      isSingleLine = false
      ellipsize = android.text.TextUtils.TruncateAt.END
      gravity = Gravity.CENTER
      maxWidth = dp(maxWidthDp)
      setPadding(dp(10), dp(7), dp(10), dp(7))
      background = roundedDrawable(
        Color.WHITE,
        borderColor,
        dp(8).toFloat(),
        borderWidth = dp(2),
      )
    }

    val pinSize = if (isCurrent) dp(40) to dp(50) else dp(28) to dp(36)
    val pinMarker = ImageView(context).apply {
      layoutParams = LinearLayout.LayoutParams(pinSize.first, pinSize.second).apply {
        topMargin = dp(2)
        gravity = Gravity.CENTER_HORIZONTAL
      }
      setImageResource(resolveDriverStopPinIcon())
      scaleType = ImageView.ScaleType.FIT_CENTER
      contentDescription = label.name
      alpha = if (isCurrent) 1f else 0.92f
    }

    container.addView(nameBubble)
    container.addView(pinMarker)
    return container
  }

  private fun roundedDrawable(
    fillColor: Int,
    strokeColor: Int,
    radius: Float,
    borderWidth: Int = dp(1),
  ): GradientDrawable =
    GradientDrawable().apply {
      shape = GradientDrawable.RECTANGLE
      cornerRadius = radius
      setColor(fillColor)
      setStroke(borderWidth, strokeColor)
    }

  private fun updateStopLabelPositions() {
    val overlay = stopLabelOverlay ?: return
    val mapboxMap = binding.mapView.mapboxMap
    if (stopLabels.isEmpty()) return

    if (overlay.childCount == 0 || lastRenderedLegIndex != activeLegIndex) {
      refreshStopLabelViews()
      return
    }

    val fromIndex = activeLegIndex.coerceIn(0, stopLabels.lastIndex)
    val visible = stopLabels.drop(fromIndex).take(8)

    for (i in 0 until overlay.childCount) {
      val child = overlay.getChildAt(i) as? LinearLayout ?: continue
      val label = visible.getOrNull(i) ?: continue

      child.measure(
        MeasureSpec.makeMeasureSpec(dp(280), MeasureSpec.AT_MOST),
        MeasureSpec.makeMeasureSpec(0, MeasureSpec.UNSPECIFIED),
      )

      val screen = mapboxMap.pixelForCoordinate(label.point)
      val width = child.measuredWidth
      val height = child.measuredHeight
      child.x = screen.x.toFloat() - width / 2f
      child.y = screen.y.toFloat() - height.toFloat()
      val onScreen =
        screen.x >= -width &&
          screen.y >= -height &&
          screen.x <= overlay.width + width &&
          screen.y <= overlay.height + height
      child.visibility = if (onScreen) View.VISIBLE else View.INVISIBLE
    }
  }`;

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

/**
 * Do not treat POST_NOTIFICATIONS denial as a fatal onError — that closed our
 * navigation overlay and looked like a crash on Android 13+ devices.
 */
function patchNotificationSoftFail() {
  let patched = 0;
  for (const file of mapboxJsFiles) {
    if (!fs.existsSync(file)) continue;
    let source = fs.readFileSync(file, 'utf8');
    if (source.includes(NOTIF_SOFT_MARKER)) {
      patched += 1;
      continue;
    }
    if (!source.includes('Notification permission is not granted.')) continue;

    const next = source.replace(
      /const errorMessage = 'Notification permission is not granted\.';\s*console\.warn\(errorMessage\);\s*this\.props\.onError\?\.\(\{\s*message:\s*errorMessage\s*\}\);/,
      `// ${NOTIF_SOFT_MARKER}\n        const errorMessage = 'Notification permission is not granted.';\n        console.warn(errorMessage + ' Continuing navigation.');`,
    );

    if (next === source) {
      console.warn('[patch-mapbox-puck] Notification soft-fail pattern missed:', path.basename(file));
      continue;
    }
    fs.writeFileSync(file, next, 'utf8');
    patched += 1;
    console.log('[patch-mapbox-puck] Notification soft-fail patched:', path.basename(file));
  }
  if (patched === 0) {
    console.warn('[patch-mapbox-puck] Notification soft-fail patch target not found');
  }
}

patchAndroid();
patchIos();
patchNotificationSoftFail();
patchNewArchCodegenDefault();
patchViewManagerNewArchProps();

/**
 * New Arch codegen expects setDistanceUnit / setLanguage / stubs for unused
 * NativeComponent props. Upstream names (setDirectionUnit / setLocal) break
 * :compileReleaseKotlin.
 */
function patchViewManagerNewArchProps() {
  const managerPath = path.join(
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
    'MapboxNavigationViewManager.kt',
  );
  if (!fs.existsSync(managerPath)) return;
  let source = fs.readFileSync(managerPath, 'utf8');
  const marker = 'DRIVER_TRACKING_VIEWMANAGER_NEWARCH_V1';
  if (source.includes(marker)) {
    console.log('[patch-mapbox-puck] ViewManager NewArch props already applied');
    return;
  }

  if (source.includes('override fun setDirectionUnit')) {
    source = source.replace(
      /@ReactProp\(name = "distanceUnit"\)\s*\n\s*override fun setDirectionUnit\(/,
      `@ReactProp(name = "distanceUnit")\n  // ${marker}\n  override fun setDistanceUnit(`,
    );
  }
  if (source.includes('override fun setLocal')) {
    source = source.replace(
      /@ReactProp\(name = "language"\)\s*\n\s*override fun setLocal\(view: MapboxNavigationView\?, language: String\?\) \{\s*\n\s*if \(language !== null\) \{\s*\n\s*view\?\.setLocal\(language\)\s*\n\s*\}\s*\n\s*\}/,
      `@ReactProp(name = "language")
  override fun setLanguage(view: MapboxNavigationView?, value: String?) {
    if (value != null) {
      view?.setLocal(value)
    }
  }`,
    );
  }

  if (!source.includes('override fun setSeparateLegs')) {
    const stubs = `
  // ${marker}: stubs required by codegen MapboxNavigationViewManagerInterface
  @ReactProp(name = "separateLegs", defaultBoolean = true)
  override fun setSeparateLegs(view: MapboxNavigationView?, value: Boolean) {
  }

  @ReactProp(name = "shouldSimulateRoute", defaultBoolean = false)
  override fun setShouldSimulateRoute(view: MapboxNavigationView?, value: Boolean) {
  }

  @ReactProp(name = "showsEndOfRouteFeedback", defaultBoolean = false)
  override fun setShowsEndOfRouteFeedback(view: MapboxNavigationView?, value: Boolean) {
  }

  @ReactProp(name = "hideStatusView", defaultBoolean = false)
  override fun setHideStatusView(view: MapboxNavigationView?, value: Boolean) {
  }

`;
    source = source.replace(
      /\n  companion object \{\n    const val NAME = "MapboxNavigationView"/,
      `${stubs}  companion object {\n    const val NAME = "MapboxNavigationView"`,
    );
  }

  if (!source.includes(marker)) {
    // Ensure marker is present even if only stubs were needed after a prior rename
    source = source.replace(
      'override fun setDistanceUnit(',
      `// ${marker}\n  override fun setDistanceUnit(`,
    );
  }

  fs.writeFileSync(managerPath, source, 'utf8');
  console.log('[patch-mapbox-puck] ViewManager NewArch props patched');
}

/**
 * RN 0.82+ always uses New Architecture. Library must generate codegen/jni
 * or app CMake fails with missing RNMapboxNavigationViewSpec path.
 */
function patchNewArchCodegenDefault() {
  const gradlePath = path.join(
    __dirname,
    '..',
    'node_modules',
    '@pawan-pk',
    'react-native-mapbox-navigation',
    'android',
    'build.gradle',
  );
  if (!fs.existsSync(gradlePath)) return;
  let source = fs.readFileSync(gradlePath, 'utf8');
  const marker = 'DRIVER_TRACKING_NEWARCH_DEFAULT_V1';
  if (source.includes(marker)) {
    console.log('[patch-mapbox-puck] NewArch default already applied');
    return;
  }
  const from = `def isNewArchitectureEnabled() {
  return rootProject.hasProperty("newArchEnabled") && rootProject.getProperty("newArchEnabled") == "true"
}`;
  const to = `def isNewArchitectureEnabled() {
  // ${marker}: RN 0.82+ New Arch default — always emit codegen JNI for CMake
  if (rootProject.hasProperty("newArchEnabled")) {
    return rootProject.getProperty("newArchEnabled") == "true"
  }
  return true
}`;
  if (!source.includes(from)) {
    console.warn('[patch-mapbox-puck] isNewArchitectureEnabled() pattern not found');
    return;
  }
  fs.writeFileSync(gradlePath, source.replace(from, to), 'utf8');
  console.log('[patch-mapbox-puck] NewArch codegen default patched');
}
