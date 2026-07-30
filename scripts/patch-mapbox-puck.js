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
  let changed = false;

  if (!source.includes(MUTE_MARKER)) {
    if (source.includes('NavigationSettings.shared.voiceMuted = strongSelf.mute')) {
      source = source.replace(
        'NavigationSettings.shared.voiceMuted = strongSelf.mute',
        `NavigationSettings.shared.voiceMuted = true // ${MUTE_MARKER}`,
      );
      changed = true;
      console.log('[patch-mapbox-puck] iOS mute patched');
    } else if (source.includes('NavigationSettings.shared.voiceMuted = true')) {
      source = source.replace(
        'NavigationSettings.shared.voiceMuted = true',
        `NavigationSettings.shared.voiceMuted = true // ${MUTE_MARKER}`,
      );
      changed = true;
      console.log('[patch-mapbox-puck] iOS mute marked');
    } else {
      console.warn('[patch-mapbox-puck] iOS mute line not found');
    }
  } else {
    console.log('[patch-mapbox-puck] iOS mute already applied');
  }

  const fallbackMarker = 'DRIVER_TRACKING_MAP_MATCHING_FALLBACK_V1';
  if (!source.includes(fallbackMarker)) {
    if (
      source.includes('embedWithMapMatching(matching)') &&
      source.includes('Directions.shared.calculateRoutes(matching: options)')
    ) {
      // Prefer agency Map Matching, but fall back to Directions so the blue route line still shows.
      const oldEmbedTail = `        // DRIVER_TRACKING_MAP_MATCHING_V1: prefer agency shape when provided
        if let matching = parseRouteCoordinates(), matching.count >= 2 {
            embedWithMapMatching(matching)
            return
        }

        let originWaypoint = Waypoint(coordinate: CLLocationCoordinate2D(latitude: startOrigin[1] as! CLLocationDegrees, longitude: startOrigin[0] as! CLLocationDegrees))
        var waypointsArray = [originWaypoint]

        // Add Waypoints
        waypointsArray.append(contentsOf: waypoints)

        let destinationWaypoint = Waypoint(coordinate: CLLocationCoordinate2D(latitude: destination[1] as! CLLocationDegrees, longitude: destination[0] as! CLLocationDegrees), name: destinationTitle as String)
        waypointsArray.append(destinationWaypoint)

        let options = NavigationRouteOptions(waypoints: waypointsArray, profileIdentifier: .automobileAvoidingTraffic)

        let locale = self.language.replacingOccurrences(of: "-", with: "_")
        options.locale = Locale(identifier: locale)
        options.distanceMeasurementSystem =  distanceUnit == "imperial" ? .imperial : .metric
        options.includesAlternativeRoutes = false // DRIVER_TRACKING_NO_ALTERNATES_V1

        Directions.shared.calculateRoutes(options: options) { [weak self] result in
            self?.handleRouteResponse(result)
        }
    }`;

      const newEmbedTail = `        // DRIVER_TRACKING_MAP_MATCHING_V1: prefer agency shape when provided
        if let matching = parseRouteCoordinates(), matching.count >= 2 {
            embedWithMapMatching(matching)
            return
        }

        embedWithDirections()
    }

    /// Directions stop→stop route (also used when Map Matching fails so blue line still shows).
    // ${fallbackMarker}
    private func embedWithDirections() {
        guard startOrigin.count == 2 && destination.count == 2 else {
            embedding = false
            return
        }

        let originWaypoint = Waypoint(coordinate: CLLocationCoordinate2D(latitude: startOrigin[1] as! CLLocationDegrees, longitude: startOrigin[0] as! CLLocationDegrees))
        var waypointsArray = [originWaypoint]

        waypointsArray.append(contentsOf: waypoints)

        let destinationWaypoint = Waypoint(coordinate: CLLocationCoordinate2D(latitude: destination[1] as! CLLocationDegrees, longitude: destination[0] as! CLLocationDegrees), name: destinationTitle as String)
        waypointsArray.append(destinationWaypoint)

        let options = NavigationRouteOptions(waypoints: waypointsArray, profileIdentifier: .automobileAvoidingTraffic)

        let locale = self.language.replacingOccurrences(of: "-", with: "_")
        options.locale = Locale(identifier: locale)
        options.distanceMeasurementSystem =  distanceUnit == "imperial" ? .imperial : .metric
        options.includesAlternativeRoutes = false // DRIVER_TRACKING_NO_ALTERNATES_V1

        Directions.shared.calculateRoutes(options: options) { [weak self] result in
            self?.handleRouteResponse(result)
        }
    }`;

      if (source.includes(oldEmbedTail)) {
        source = source.replace(oldEmbedTail, newEmbedTail);
        changed = true;
      }

      const oldMatchingCb = `        Directions.shared.calculateRoutes(matching: options) { [weak self] result in
            self?.handleRouteResponse(result)
        }
    }`;

      const newMatchingCb = `        Directions.shared.calculateRoutes(matching: options) { [weak self] result in
            guard let strongSelf = self else { return }
            // ${fallbackMarker}: keep blue Directions line if match fails
            switch result {
            case .failure:
                strongSelf.embedWithDirections()
            case .success(let response):
                let routes = response.routeResponse.routes ?? []
                if routes.isEmpty {
                    strongSelf.embedWithDirections()
                } else {
                    strongSelf.handleRouteResponse(result)
                }
            }
        }
    }`;

      if (source.includes(oldMatchingCb) && !source.includes(fallbackMarker)) {
        source = source.replace(oldMatchingCb, newMatchingCb);
        changed = true;
      }

      if (source.includes(fallbackMarker)) {
        console.log('[patch-mapbox-puck] iOS Map Matching → Directions fallback patched');
      } else {
        console.warn('[patch-mapbox-puck] iOS Map Matching fallback pattern not found');
      }
    } else {
      console.warn('[patch-mapbox-puck] iOS Map Matching methods missing — skip fallback patch');
    }
  } else {
    console.log('[patch-mapbox-puck] iOS Map Matching fallback already applied');
  }

  if (changed) {
    fs.writeFileSync(iosSwift, source);
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
patchAndroidMapMatchingReroute();
patchAndroidMapMatchingTrainingV2();
patchAndroidNavCamera3d();
patchAndroidOffRouteBridge();
patchAndroidOverviewRouteVisible();
patchIos();
patchIosOffRouteTraining();
patchNotificationSoftFail();
patchMapboxJsOffRoute();
patchNewArchCodegenDefault();
patchViewManagerNewArchProps();

/**
 * Legacy V1 kept Map Matching reroute enabled. Training mode needs it disabled.
 */
function patchAndroidMapMatchingReroute() {
  if (!fs.existsSync(androidKt)) return;
  let source = fs.readFileSync(androidKt, 'utf8');
  const marker = 'DRIVER_TRACKING_MAP_MATCHING_REROUTE_V1';
  if (source.includes(marker) || source.includes('DRIVER_TRACKING_MAP_MATCHING_TRAINING_V2')) {
    console.log('[patch-mapbox-puck] Android Map Matching reroute already applied');
    return;
  }

  if (!source.includes('disableRerouteAwayFromMatchedPath()')) {
    console.warn('[patch-mapbox-puck] disableRerouteAwayFromMatchedPath not found — skip');
    return;
  }

  // Prefer the already-split helper form if present from a prior manual edit.
  if (!source.includes('disableContinuousAlternativesOnly()')) {
    source = source.replace(
      /\/\*\* Keep guidance on the matched agency path; avoid Directions shortcuts on off-route\. \*\/\s*private fun disableRerouteAwayFromMatchedPath\(\) \{\s*try \{\s*val method = mapboxNavigation\?\.javaClass\?\.methods\?\.firstOrNull \{ candidate ->\s*candidate\.name == "setRerouteEnabled" && candidate\.parameterTypes\.size == 1\s*\}\s*method\?\.invoke\(mapboxNavigation, false\)\s*\} catch \(_: Throwable\) \{\s*\/\/ Older \/ alternate SDK builds — continuous-alternatives disable below still helps\.\s*\}\s*try \{\s*val method = mapboxNavigation\?\.javaClass\?\.methods\?\.firstOrNull \{ candidate ->\s*candidate\.name == "setContinuousAlternativesEnabled" &&\s*candidate\.parameterTypes\.size == 1\s*\}\s*method\?\.invoke\(mapboxNavigation, false\)\s*\} catch \(_: Throwable\) \{\s*\/\/ no-op\s*\}\s*\}/,
      `/** Keep guidance on the matched agency path; avoid Directions shortcuts on off-route. */
  private fun disableRerouteAwayFromMatchedPath() {
    try {
      val method = mapboxNavigation?.javaClass?.methods?.firstOrNull { candidate ->
        candidate.name == "setRerouteEnabled" && candidate.parameterTypes.size == 1
      }
      method?.invoke(mapboxNavigation, false)
    } catch (_: Throwable) {
      // Older / alternate SDK builds — continuous-alternatives disable below still helps.
    }
    disableContinuousAlternativesOnly()
  }

  // ${marker}
  private fun disableContinuousAlternativesOnly() {
    try {
      val method = mapboxNavigation?.javaClass?.methods?.firstOrNull { candidate ->
        candidate.name == "setContinuousAlternativesEnabled" &&
          candidate.parameterTypes.size == 1
      }
      method?.invoke(mapboxNavigation, false)
    } catch (_: Throwable) {
      // no-op
    }
  }`,
    );
  }

  source = source.replace(
    /disableRerouteAwayFromMatchedPath\(\)\s*\n\s*setRouteAndStartNavigation\(primary\)/,
    `// ${marker}:
          // Do NOT disable reroute — off-path GPS (simulator / noisy fix) freezes guidance.
          // Still suppress continuous alternate route lines.
          disableContinuousAlternativesOnly()
          setRouteAndStartNavigation(primary)`,
  );

  if (!source.includes(marker) && !source.includes('disableContinuousAlternativesOnly()')) {
    console.warn('[patch-mapbox-puck] Android Map Matching reroute patch did not apply');
    return;
  }

  fs.writeFileSync(androidKt, source, 'utf8');
  console.log('[patch-mapbox-puck] Android Map Matching reroute patched');
}

/**
 * Client/training: Map Matching must disable silent Directions reroute and keep
 * the agency path. Off-route is a feature to score, not a bug to hide.
 */
function patchAndroidMapMatchingTrainingV2() {
  if (!fs.existsSync(androidKt)) return;
  let source = fs.readFileSync(androidKt, 'utf8');
  const unstuckMarker = 'DRIVER_TRACKING_MAP_MATCHING_UNSTUCK_V3';
  if (source.includes(unstuckMarker)) {
    console.log('[patch-mapbox-puck] Android Map Matching unstuck V3 already applied');
    return;
  }

  // Prefer unstuck V3: never globally disable reroute (freezes TBT off-path).
  if (
    source.includes('disableRerouteAwayFromMatchedPath()') &&
    source.includes('setRouteAndStartNavigation(primary)')
  ) {
    source = source.replace(
      /\/\/ DRIVER_TRACKING_MAP_MATCHING_TRAINING_V2:[\s\S]*?disableRerouteAwayFromMatchedPath\(\)\s*\n\s*setRouteAndStartNavigation\(primary\)/,
      `// ${unstuckMarker}:
          // Do NOT call setRerouteEnabled(false). Map-matched routes already use
          // RerouteDisabled (no Directions shortcut). Global disable freezes TBT
          // when GPS is slightly off the line (simulators / noisy fixes).
          // OffRouteObserver still surfaces "return to route" for training.
          disableContinuousAlternativesOnly()
          setRouteAndStartNavigation(primary)`,
    );
    source = source.replace(
      /\/\/ DRIVER_TRACKING_MAP_MATCHING_REROUTE_V1:[\s\S]*?disableContinuousAlternativesOnly\(\)\s*\n\s*setRouteAndStartNavigation\(primary\)/,
      `// ${unstuckMarker}:
          disableContinuousAlternativesOnly()
          setRouteAndStartNavigation(primary)`,
    );
    if (!source.includes(unstuckMarker) && source.includes('disableRerouteAwayFromMatchedPath()\n          setRouteAndStartNavigation')) {
      source = source.replace(
        /disableRerouteAwayFromMatchedPath\(\)\s*\n\s*setRouteAndStartNavigation\(primary\)/,
        `// ${unstuckMarker}:
          disableContinuousAlternativesOnly()
          setRouteAndStartNavigation(primary)`,
      );
    }
  }

  if (source.includes('.tidy(true)')) {
    source = source.replace('.tidy(true)', '.tidy(false)');
  }

  if (!source.includes(unstuckMarker) && !source.includes('disableContinuousAlternativesOnly()\n          setRouteAndStartNavigation')) {
    console.warn('[patch-mapbox-puck] Android Map Matching unstuck V3 pattern not found');
    return;
  }

  if (!source.includes(unstuckMarker)) {
    source = source.replace(
      'disableContinuousAlternativesOnly()\n          setRouteAndStartNavigation(primary)',
      `// ${unstuckMarker}\n          disableContinuousAlternativesOnly()\n          setRouteAndStartNavigation(primary)`,
    );
  }

  fs.writeFileSync(androidKt, source, 'utf8');
  console.log('[patch-mapbox-puck] Android Map Matching unstuck V3 patched');
}

/**
 * Always draw the MapScreen-style full agency path as the only visible route line.
 * SDK per-leg line is kept transparent so TBT still works without the short wrong stub.
 */
function patchAndroidOverviewRouteVisible() {
  if (!fs.existsSync(androidKt)) return;
  let source = fs.readFileSync(androidKt, 'utf8');
  const marker = 'DRIVER_TRACKING_OVERVIEW_ROUTE_V3';
  if (source.includes(marker)) {
    console.log('[patch-mapbox-puck] Android overview route visibility V3 already applied');
    return;
  }

  // Prefer replacing V2 observer block; fall back to V1.
  const oldObserverV2 = `// DRIVER_TRACKING_OVERVIEW_ROUTE_V2:
      // Always draw the full agency overview (MapScreen-style path) AND the SDK
      // active-leg route line. Previously overview-only skipped the SDK line, and
      // when the custom layer failed the driver saw no route path at all.
      if (overviewRouteCoordinates.size >= 2) {
        ensureAgencyOverviewRouteLine()
      }
      routeLineApi.setNavigationRoutes(primaryOnly) { value ->
        binding.mapView.mapboxMap.style?.apply {
          routeLineView.renderRouteDrawData(this, value)
          // Re-assert overview above route-line mutations if it was dropped.
          if (overviewRouteCoordinates.size >= 2) {
            ensureAgencyOverviewRouteLine(this)
          }
        }
      }`;

  const oldObserverV1 = `// DRIVER_TRACKING_OVERVIEW_ROUTE_V1:
      // Full agency line is drawn once. Skip redrawing the short per-leg route line
      // so TBT can rematch each stop without flickering the visible path.
      if (overviewRouteCoordinates.size >= 2) {
        ensureAgencyOverviewRouteLine()
      } else {
        routeLineApi.setNavigationRoutes(primaryOnly) { value ->
          binding.mapView.mapboxMap.style?.apply {
            routeLineView.renderRouteDrawData(this, value)
          }
        }
      }`;

  const newObserver = `// ${marker}:
      // Draw the full MapScreen agency path. Hide the short per-leg SDK stub so
      // drivers only see the complete published route (same as MapScreen).
      if (overviewRouteCoordinates.size >= 2) {
        ensureAgencyOverviewRouteLine()
        routeLineApi.clearRouteLine { value ->
          binding.mapView.mapboxMap.style?.let { style ->
            routeLineView.renderClearRouteLineValue(style, value)
            ensureAgencyOverviewRouteLine(style)
          }
        }
      } else {
        routeLineApi.setNavigationRoutes(primaryOnly) { value ->
          binding.mapView.mapboxMap.style?.apply {
            routeLineView.renderRouteDrawData(this, value)
          }
        }
      }`;

  if (source.includes(oldObserverV2)) {
    source = source.replace(oldObserverV2, newObserver);
  } else if (source.includes(oldObserverV1)) {
    source = source.replace(oldObserverV1, newObserver);
  } else if (!source.includes(marker)) {
    console.warn('[patch-mapbox-puck] overview routesObserver pattern not found');
  }

  fs.writeFileSync(androidKt, source, 'utf8');
  console.log('[patch-mapbox-puck] Android overview route visibility V3 patched');
}

function patchAndroidNavCamera3d() {
  if (!fs.existsSync(androidKt)) return;
  let source = fs.readFileSync(androidKt, 'utf8');
  const marker = 'DRIVER_TRACKING_NAV_CAMERA_3D_V1';
  if (source.includes(marker)) {
    console.log('[patch-mapbox-puck] Android nav camera 3D already applied');
    return;
  }

  if (source.includes('configureGoogleMapsStyleCamera')) {
    source = source.replace(
      /private fun configureGoogleMapsStyleCamera\(isLandscape: Boolean\) \{[\s\S]*?\n  \}/,
      `private fun configureGoogleMapsStyleCamera(isLandscape: Boolean) {
    val metrics = Resources.getSystem().displayMetrics
    val horizontal = 40.0 * metrics.density
    val top = if (isLandscape) 30.0 * metrics.density else 100.0 * metrics.density
    val bottom = metrics.heightPixels * 0.58
    viewportDataSource.followingPadding = EdgeInsets(top, horizontal, bottom, horizontal)
    // ${marker}: zoomed-in pitched following (not flat overview)
    viewportDataSource.options.followingFrameOptions.apply {
      maximizeViewableGeometryWhenPitchZero = false
      defaultPitch = 50.0
      maxZoom = 17.5
    }
    viewportDataSource.followingPitchPropertyOverride(50.0)
    viewportDataSource.evaluate()
  }`,
    );
  }

  source = source.replace(
    /\.zoom\(14\.0\)\s*\n\s*\.center\(origin\)/,
    `.zoom(16.5)\n      .pitch(50.0)\n      .center(origin)`,
  );

  if (!source.includes(marker)) {
    console.warn('[patch-mapbox-puck] Android nav camera 3D pattern not found');
    return;
  }

  fs.writeFileSync(androidKt, source, 'utf8');
  console.log('[patch-mapbox-puck] Android nav camera 3D patched');
}

function patchAndroidOffRouteBridge() {
  if (!fs.existsSync(androidKt)) return;
  let source = fs.readFileSync(androidKt, 'utf8');
  const marker = 'DRIVER_TRACKING_OFF_ROUTE_V1';
  if (source.includes(marker)) {
    console.log('[patch-mapbox-puck] Android off-route bridge already applied');
  } else {
    if (!source.includes('import com.mapbox.navigation.core.trip.session.OffRouteObserver')) {
      source = source.replace(
        'import com.mapbox.navigation.core.trip.session.LocationObserver\n',
        'import com.mapbox.navigation.core.trip.session.LocationObserver\nimport com.mapbox.navigation.core.trip.session.OffRouteObserver\n',
      );
    }

    if (!source.includes('offRouteObserver')) {
      source = source.replace(
        /private val arrivalObserver = object : ArrivalObserver \{[\s\S]*?^\s*\}\n/,
        (match) => `${match}
  // ${marker}: bridge off-route for training (no silent recalculate)
  private val offRouteObserver = OffRouteObserver { offRoute ->
    val event = Arguments.createMap()
    event.putBoolean("offRoute", offRoute)
    context
      .getJSModule(RCTEventEmitter::class.java)
      .receiveEvent(id, "onOffRoute", event)
  }
`,
      );
    }

    if (!source.includes('registerOffRouteObserver')) {
      source = source.replace(
        'mapboxNavigation?.registerVoiceInstructionsObserver(voiceInstructionsObserver)',
        `mapboxNavigation?.registerVoiceInstructionsObserver(voiceInstructionsObserver)
    mapboxNavigation?.registerOffRouteObserver(offRouteObserver)`,
      );
    }

    if (!source.includes('unregisterOffRouteObserver')) {
      source = source.replace(
        'mapboxNavigation?.unregisterVoiceInstructionsObserver(voiceInstructionsObserver)',
        `mapboxNavigation?.unregisterVoiceInstructionsObserver(voiceInstructionsObserver)
    mapboxNavigation?.unregisterOffRouteObserver(offRouteObserver)`,
      );
    }

    fs.writeFileSync(androidKt, source, 'utf8');
    console.log('[patch-mapbox-puck] Android off-route bridge patched');
  }

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
  let manager = fs.readFileSync(managerPath, 'utf8');
  if (!manager.includes('"onOffRoute"')) {
    manager = manager.replace(
      '"onRouteProgressChange", MapBuilder.of("registrationName", "onRouteProgressChange"),\n    )',
      `"onRouteProgressChange", MapBuilder.of("registrationName", "onRouteProgressChange"),
      // ${marker}
      "onOffRoute", MapBuilder.of("registrationName", "onOffRoute"),
    )`,
    );
    fs.writeFileSync(managerPath, manager, 'utf8');
    console.log('[patch-mapbox-puck] Android onOffRoute event registered');
  }
}

function patchIosOffRouteTraining() {
  if (!fs.existsSync(iosSwift)) return;
  let source = fs.readFileSync(iosSwift, 'utf8');
  const marker = 'DRIVER_TRACKING_OFF_ROUTE_V1';
  if (source.includes(marker) && source.includes('shouldRerouteFrom')) {
    console.log('[patch-mapbox-puck] iOS off-route training already applied');
  } else {
    if (!source.includes('@objc var onOffRoute')) {
      source = source.replace(
        '@objc var onArrive: RCTDirectEventBlock?',
        `@objc var onArrive: RCTDirectEventBlock?\n    // ${marker}\n    @objc var onOffRoute: RCTDirectEventBlock?`,
      );
    }
    if (!source.includes('lastOffRouteSignalAt')) {
      source = source.replace(
        'var embedding: Bool',
        `var embedding: Bool\n    // ${marker}\n    private var lastOffRouteSignalAt: Date?`,
      );
    }
    if (!source.includes('reroutesProactively = false') && !source.includes('shouldRerouteFrom')) {
      // shouldRerouteFrom returning false is the supported training hook
    }
    if (!source.includes('shouldRerouteFrom')) {
      source = source.replace(
        /public func navigationViewController\(_ navigationViewController: NavigationViewController, didArriveAt waypoint: Waypoint\) -> Bool \{[\s\S]*?return true;\s*\n\s*\}/,
        (match) => `${match}

    // ${marker} + TRAINING_V2: surface off-route; do not auto-reroute
    public func navigationViewController(_ navigationViewController: NavigationViewController, shouldRerouteFrom location: CLLocation) -> Bool {
        lastOffRouteSignalAt = Date()
        onOffRoute?(["offRoute": true])
        return false
    }`,
      );
    }
    if (!source.includes('lastOffRouteSignalAt') || !source.includes('onOffRoute?(["offRoute": false])')) {
      // Progress clear handled if shouldReroute block added; ensure didUpdate clears
      if (
        source.includes('onRouteProgressChange?([') &&
        !source.includes('onOffRoute?(["offRoute": false])')
      ) {
        source = source.replace(
          /("distanceRemaining": progress\.distanceRemaining\s*\n\s*\])\n\s*\}/,
          `$1
        ])
        if let last = lastOffRouteSignalAt, Date().timeIntervalSince(last) > 2.0 {
            lastOffRouteSignalAt = nil
            onOffRoute?(["offRoute": false])
        }
    }`,
        );
      }
    }
    fs.writeFileSync(iosSwift, source, 'utf8');
    console.log('[patch-mapbox-puck] iOS off-route training patched');
  }

  const iosManager = path.join(
    __dirname,
    '..',
    'node_modules',
    '@pawan-pk',
    'react-native-mapbox-navigation',
    'ios',
    'MapboxNavigationViewManager.m',
  );
  if (fs.existsSync(iosManager)) {
    let mgr = fs.readFileSync(iosManager, 'utf8');
    if (!mgr.includes('onOffRoute')) {
      mgr = mgr.replace(
        'RCT_EXPORT_VIEW_PROPERTY(onArrive, RCTDirectEventBlock)\n',
        'RCT_EXPORT_VIEW_PROPERTY(onArrive, RCTDirectEventBlock)\nRCT_EXPORT_VIEW_PROPERTY(onOffRoute, RCTDirectEventBlock)\n',
      );
      fs.writeFileSync(iosManager, mgr, 'utf8');
      console.log('[patch-mapbox-puck] iOS onOffRoute export patched');
    }
  }
}

function patchMapboxJsOffRoute() {
  const marker = 'DRIVER_TRACKING_OFF_ROUTE_V1';
  for (const file of mapboxJsFiles) {
    if (!fs.existsSync(file)) continue;
    let source = fs.readFileSync(file, 'utf8');
    if (source.includes('onOffRoute') && source.includes(marker)) continue;
    if (!source.includes('onArrive') || !source.includes('onCancelNavigation')) continue;

    if (!source.includes('onOffRoute,')) {
      source = source.replace(
        /onCancelNavigation,\s*\n\s*onError,/,
        `onCancelNavigation,\n      onError,\n      onOffRoute,`,
      );
    }
    if (!source.includes('onOffRoute: event =>') && !source.includes('onOffRoute={(event)')) {
      source = source.replace(
        /onArrive: event => onArrive\?\.?\(event\.nativeEvent\),/,
        `onArrive: event => onArrive?.(event.nativeEvent),\n        // ${marker}\n        onOffRoute: event => onOffRoute?.(event.nativeEvent),`,
      );
      source = source.replace(
        /onArrive=\{\(event\) => onArrive\?\.\(event\.nativeEvent\)\}/,
        `onArrive={(event) => onArrive?.(event.nativeEvent)}\n          // ${marker}\n          onOffRoute={(event) => onOffRoute?.(event.nativeEvent)}`,
      );
    }
    if (source !== fs.readFileSync(file, 'utf8')) {
      fs.writeFileSync(file, source, 'utf8');
      console.log('[patch-mapbox-puck] JS onOffRoute patched:', path.basename(file));
    }
  }

  const typesPath = path.join(
    __dirname,
    '..',
    'node_modules',
    '@pawan-pk',
    'react-native-mapbox-navigation',
    'src',
    'types.ts',
  );
  if (fs.existsSync(typesPath)) {
    let types = fs.readFileSync(typesPath, 'utf8');
    if (!types.includes('onOffRoute?:')) {
      types = types.replace(
        'onArrive?: (event: NativeEvent<WaypointEvent>) => void;\n};',
        `onArrive?: (event: NativeEvent<WaypointEvent>) => void;\n  /** Fired when the puck leaves / returns to the active matched route. */\n  onOffRoute?: (event: NativeEvent<{ offRoute: boolean }>) => void;\n};`,
      );
      types = types.replace(
        'onArrive?: (point: WaypointEvent) => void;\n}',
        `onArrive?: (point: WaypointEvent) => void;\n  onOffRoute?: (event: { offRoute: boolean }) => void;\n}`,
      );
      fs.writeFileSync(typesPath, types, 'utf8');
      console.log('[patch-mapbox-puck] types onOffRoute patched');
    }
  }
}

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
