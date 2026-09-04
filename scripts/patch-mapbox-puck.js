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
patchAndroidNavCameraGlobeV3();
patchAndroidNavInitV1();
patchAndroidOffRouteBridge();
patchAndroidOverviewRouteVisible();
patchAndroidDisableRerouteCompletely();
patchNativeAgencyPathProps();
patchAndroidLightBlueAgencyNavV2();
patchAndroidPuckDarkAndAboveRoute();
patchAndroidHudTimingAndChrome();
patchAndroidPuckTelemetry();
patchAndroidStopBusMarkersV3();
patchIos();
patchIosOffRouteTraining();
patchNotificationSoftFail();
patchMapboxJsOffRoute();
patchNewArchCodegenDefault();
patchViewManagerNewArchProps();

/**
 * Red teardrop bus-pin markers (user asset) — tip anchored on each stop.
 */
function patchAndroidStopBusMarkersV3() {
  if (!fs.existsSync(androidKt)) return;
  let source = fs.readFileSync(androidKt, 'utf8');
  const marker = 'DRIVER_TRACKING_STOP_MARKERS_V4';
  if (
    source.includes(marker) &&
    source.includes('dt-stop-bus-pin-v4') &&
    source.includes('icon-anchor') &&
    source.includes('"bottom"')
  ) {
    console.log('[patch-mapbox-puck] Android stop bus pin V4 already applied');
    return;
  }

  if (!source.includes('import android.graphics.Bitmap')) {
    source = source.replace(
      'import android.graphics.Color\n',
      'import android.graphics.Bitmap\nimport android.graphics.Canvas\nimport android.graphics.Color\n',
    );
  } else if (!source.includes('import android.graphics.Canvas')) {
    source = source.replace(
      'import android.graphics.Bitmap\n',
      'import android.graphics.Bitmap\nimport android.graphics.Canvas\n',
    );
  }

  const lon = '${point.longitude()}';
  const lat = '${point.latitude()}';
  const err = '${e.message}';
  const helper = `
  /**
   * Teardrop bus-pin stop markers (waypoints + destination) — tip points at the stop.
   */
  private fun ensureStopBusStyleImage(
    style: com.mapbox.maps.Style,
    imageId: String,
  ) {
    try {
      if (style.hasStyleImage(imageId)) {
        style.removeStyleImage(imageId)
      }
    } catch (_: Throwable) {
      // Older Maps builds — try addImage anyway
    }
    val resId = context.resources.getIdentifier(
      "driver_stop_bus_marker",
      "drawable",
      context.packageName,
    )
    if (resId == 0) {
      Log.w("MapboxNavigationView", "driver_stop_bus_marker drawable missing")
      return
    }
    val drawable = context.getDrawable(resId) ?: return
    // Pin is taller than wide — keep aspect so the tip anchors cleanly
    val density = resources.displayMetrics.density
    val widthPx = (36f * density).toInt().coerceIn(72, 120)
    val heightPx = (48f * density).toInt().coerceIn(96, 160)
    val bitmap = Bitmap.createBitmap(widthPx, heightPx, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bitmap)
    drawable.setBounds(0, 0, widthPx, heightPx)
    drawable.draw(canvas)
    style.addImage(imageId, bitmap)
  }

  private fun ensureStopMarkers(
    style: com.mapbox.maps.Style? = binding.mapView.mapboxMap.style,
  ) {
    // ${marker}: red teardrop bus pin (bottom-anchored)
    val mapStyle = style ?: return
    try {
      val features = mutableListOf<String>()
      waypoints.forEach { point ->
        features.add(
          ${'"""'}{"type":"Feature","properties":{"kind":"stop"},"geometry":{"type":"Point","coordinates":[${lon},${lat}]}}${'}'}${'"""'},
        )
      }
      destination?.let { point ->
        features.add(
          ${'"""'}{"type":"Feature","properties":{"kind":"dest"},"geometry":{"type":"Point","coordinates":[${lon},${lat}]}}${'}'}${'"""'},
        )
      }
      if (features.isEmpty()) return

      val geoJson =
        ${'"""'}{"type":"FeatureCollection","features":[\${features.joinToString(",")}]${'}'}${'"""'}
      val sourceId = "dt-stop-markers-src"
      val circleId = "dt-stop-markers-circle"
      val labelId = "dt-stop-markers-label"
      val symbolId = "dt-stop-markers-icon"
      val imageId = "dt-stop-bus-pin-v4"

      // Drop older numbered / centered-icon layers
      listOf(labelId, circleId, symbolId).forEach { id ->
        if (mapStyle.styleLayerExists(id)) {
          mapStyle.removeStyleLayer(id)
        }
      }

      ensureStopBusStyleImage(mapStyle, imageId)

      val sourceProps = hashMapOf<String, com.mapbox.bindgen.Value>(
        "type" to com.mapbox.bindgen.Value.valueOf("geojson"),
        "data" to com.mapbox.bindgen.Value.valueOf(geoJson),
      )
      if (mapStyle.styleSourceExists(sourceId)) {
        mapStyle.setStyleSourceProperty(
          sourceId,
          "data",
          com.mapbox.bindgen.Value.valueOf(geoJson),
        )
      } else {
        mapStyle.addStyleSource(sourceId, com.mapbox.bindgen.Value.valueOf(sourceProps))
      }

      if (!mapStyle.styleLayerExists(symbolId)) {
        val iconLayout = hashMapOf(
          "icon-image" to com.mapbox.bindgen.Value.valueOf(imageId),
          "icon-size" to com.mapbox.bindgen.Value.valueOf(1.0),
          "icon-allow-overlap" to com.mapbox.bindgen.Value.valueOf(true),
          "icon-ignore-placement" to com.mapbox.bindgen.Value.valueOf(true),
          // Tip of the teardrop pin sits on the stop coordinate
          "icon-anchor" to com.mapbox.bindgen.Value.valueOf("bottom"),
        )
        val symbolLayer = hashMapOf(
          "id" to com.mapbox.bindgen.Value.valueOf(symbolId),
          "type" to com.mapbox.bindgen.Value.valueOf("symbol"),
          "source" to com.mapbox.bindgen.Value.valueOf(sourceId),
          "layout" to com.mapbox.bindgen.Value.valueOf(iconLayout),
        )
        mapStyle.addStyleLayer(com.mapbox.bindgen.Value.valueOf(symbolLayer), null)
      }
    } catch (e: Throwable) {
      Log.w("MapboxNavigationView", "ensureStopMarkers failed: ${err}")
    }
  }
`;

  if (source.includes('private fun ensureStopMarkers(') || source.includes('private fun ensureStopBusStyleImage(')) {
    // Replace from bus-image helper (V2+) or numbered markers through setLocal
    if (source.includes('private fun ensureStopBusStyleImage(')) {
      source = source.replace(
        /\/\*\*[\s\S]*?Teardrop bus-pin stop markers[\s\S]*?private fun ensureStopMarkers\([\s\S]*?\n  \}\n\n  fun setLocal/,
        `${helper.trimStart()}\n\n  fun setLocal`,
      );
      if (!source.includes(marker)) {
        source = source.replace(
          /private fun ensureStopBusStyleImage\([\s\S]*?\n  private fun ensureStopMarkers\([\s\S]*?\n  \}\n\n  fun setLocal/,
          `${helper.trimStart()}\n\n  fun setLocal`,
        );
      }
    }
    if (!source.includes(marker)) {
      source = source.replace(
        /\/\*\*[\s\S]*?(?:Numbered stop markers|Bus-icon stop markers)[\s\S]*?private fun ensureStopMarkers\([\s\S]*?\n  \}\n\n  fun setLocal/,
        `${helper.trimStart()}\n\n  fun setLocal`,
      );
    }
    if (!source.includes(marker)) {
      source = source.replace(
        /private fun ensureStopMarkers\([\s\S]*?\n  \}\n\n  fun setLocal/,
        `${helper.trimStart()}\n\n  fun setLocal`,
      );
    }
  } else {
    source = source.replace(
      /\n  fun setLocal\(language: String\) \{/,
      `\n${helper}  fun setLocal(language: String) {`,
    );
  }

  if (!source.includes(marker)) {
    console.warn('[patch-mapbox-puck] Android stop bus pin V4 did not apply');
    return;
  }

  fs.writeFileSync(androidKt, source, 'utf8');
  console.log('[patch-mapbox-puck] Android stop bus pin V4 patched');
}

/**
 * Emit Mapbox leg duration to JS + hide native sound/recenter (clash with React close).
 */
function patchAndroidHudTimingAndChrome() {
  if (!fs.existsSync(androidKt)) return;
  let source = fs.readFileSync(androidKt, 'utf8');
  const legMarker = 'DRIVER_TRACKING_LEG_DURATION_V1';
  const chromeMarker = 'DRIVER_TRACKING_HIDE_NATIVE_CHROME_V1';

  if (
    source.includes(legMarker) &&
    source.includes(chromeMarker) &&
    !source.includes('binding.soundButton.visibility = View.VISIBLE')
  ) {
    // Still refresh JS types if needed
    const typesFiles = [
      path.join(
        __dirname,
        '..',
        'node_modules',
        '@pawan-pk',
        'react-native-mapbox-navigation',
        'src',
        'types.ts',
      ),
      path.join(
        __dirname,
        '..',
        'node_modules',
        '@pawan-pk',
        'react-native-mapbox-navigation',
        'lib',
        'typescript',
        'src',
        'types.d.ts',
      ),
    ];
    for (const typesPath of typesFiles) {
      if (!fs.existsSync(typesPath)) continue;
      let types = fs.readFileSync(typesPath, 'utf8');
      if (!types.includes('legDurationRemaining')) {
        types = types.replace(
          'distanceRemaining: number;',
          'distanceRemaining: number;\n  /** Current Mapbox leg duration remaining (seconds). */\n  legDurationRemaining?: number;',
        );
        fs.writeFileSync(typesPath, types, 'utf8');
      }
    }
    console.log('[patch-mapbox-puck] Android HUD timing + chrome already applied');
    return;
  }

  if (!source.includes(legMarker)) {
    const needle = `event.putDouble(
      "distanceRemaining",
      legRemaining ?: routeProgress.distanceRemaining.toDouble(),
    )
    val legName = routeProgress.currentLegProgress?.legDestination?.name`;
    const replacement = `event.putDouble(
      "distanceRemaining",
      legRemaining ?: routeProgress.distanceRemaining.toDouble(),
    )
    // ${legMarker}: current-leg ETA for bottom sheet / banner sync
    val legDuration = routeProgress.currentLegProgress?.durationRemaining
    if (legDuration != null && legDuration.isFinite() && legDuration >= 0.0) {
      event.putDouble("legDurationRemaining", legDuration.toDouble())
    }
    val legName = routeProgress.currentLegProgress?.legDestination?.name`;
    if (source.includes(needle)) {
      source = source.replace(needle, replacement);
    } else {
      console.warn('[patch-mapbox-puck] leg duration bridge pattern not found');
    }
  }

  if (!source.includes(chromeMarker) || source.includes('binding.soundButton.visibility = View.VISIBLE')) {
    source = source.replace(
      /\/\/ show UI elements[\s\S]*?binding\.tripProgressCard\.visibility = View\.INVISIBLE/,
      `// show UI elements — React HUD owns chrome; hide native buttons that clash with close FAB
    // ${chromeMarker}
    binding.soundButton.visibility = View.GONE
    binding.recenter.visibility = View.GONE
    // Hide overview button — it zoomed to globe / suggested alternates.
    binding.routeOverview.visibility = View.GONE
    binding.tripProgressCard.visibility = View.GONE
    binding.maneuverView.visibility = View.GONE`,
    );

    if (source.includes('binding.recenter.visibility = View.VISIBLE')) {
      source = source.replace(
        /navigationCamera\.registerNavigationCameraStateChangeObserver \{ navigationCameraState ->[\s\S]*?\n      \}/,
        `navigationCamera.registerNavigationCameraStateChangeObserver { navigationCameraState ->
        // ${chromeMarker}: React close FAB owns top-right — never show recenter
        binding.recenter.visibility = View.GONE
        binding.soundButton.visibility = View.GONE
        when (navigationCameraState) {
          NavigationCameraState.TRANSITION_TO_FOLLOWING,
          NavigationCameraState.FOLLOWING,
          NavigationCameraState.TRANSITION_TO_OVERVIEW,
          NavigationCameraState.OVERVIEW,
          NavigationCameraState.IDLE -> {
            // no-op: native chrome stays hidden
          }
        }
      }`,
      );
    }
  }

  // JS types
  const typesFiles = [
    path.join(
      __dirname,
      '..',
      'node_modules',
      '@pawan-pk',
      'react-native-mapbox-navigation',
      'src',
      'types.ts',
    ),
    path.join(
      __dirname,
      '..',
      'node_modules',
      '@pawan-pk',
      'react-native-mapbox-navigation',
      'lib',
      'typescript',
      'src',
      'types.d.ts',
    ),
  ];
  for (const typesPath of typesFiles) {
    if (!fs.existsSync(typesPath)) continue;
    let types = fs.readFileSync(typesPath, 'utf8');
    if (!types.includes('legDurationRemaining')) {
      types = types.replace(
        'distanceRemaining: number;',
        'distanceRemaining: number;\n  /** Current Mapbox leg duration remaining (seconds). */\n  legDurationRemaining?: number;',
      );
      fs.writeFileSync(typesPath, types, 'utf8');
    }
  }

  fs.writeFileSync(androidKt, source, 'utf8');
  console.log('[patch-mapbox-puck] Android HUD timing + chrome patched');
}

/**
 * Include puck speed on onLocationChange so vehicle/update matches Mapbox.
 */
function patchAndroidPuckTelemetry() {
  if (!fs.existsSync(androidKt)) return;
  let source = fs.readFileSync(androidKt, 'utf8');
  const marker = 'DRIVER_TRACKING_PUCK_TELEMETRY_V1';
  if (source.includes(marker)) {
    console.log('[patch-mapbox-puck] Android puck telemetry already applied');
    return;
  }
  const needle = `event.putDouble("heading", enhancedLocation.bearing ?: 0.0)
      event.putDouble("accuracy", enhancedLocation.horizontalAccuracy ?: 0.0)
      context
        .getJSModule(RCTEventEmitter::class.java)
        .receiveEvent(id, "onLocationChange", event)`;
  const replacement = `event.putDouble("heading", enhancedLocation.bearing ?: 0.0)
      event.putDouble("accuracy", enhancedLocation.horizontalAccuracy ?: 0.0)
      // ${marker}: speed (m/s) for admin vehicle/update
      val puckSpeed = enhancedLocation.speed
      if (puckSpeed != null && puckSpeed.isFinite() && puckSpeed >= 0.0) {
        event.putDouble("speed", puckSpeed)
      }
      context
        .getJSModule(RCTEventEmitter::class.java)
        .receiveEvent(id, "onLocationChange", event)`;
  if (!source.includes(needle)) {
    console.warn('[patch-mapbox-puck] puck telemetry pattern not found');
    return;
  }
  source = source.replace(needle, replacement);
  fs.writeFileSync(androidKt, source, 'utf8');

  const typesFiles = [
    path.join(__dirname, '..', 'node_modules', '@pawan-pk', 'react-native-mapbox-navigation', 'src', 'types.ts'),
    path.join(
      __dirname,
      '..',
      'node_modules',
      '@pawan-pk',
      'react-native-mapbox-navigation',
      'lib',
      'typescript',
      'src',
      'types.d.ts',
    ),
  ];
  for (const typesPath of typesFiles) {
    if (!fs.existsSync(typesPath)) continue;
    let types = fs.readFileSync(typesPath, 'utf8');
    if (!types.includes('speed?: number') && types.includes('accuracy: number;')) {
      types = types.replace(
        'accuracy: number;',
        'accuracy: number;\n  /** Speed in m/s when provided by the native Mapbox location matcher. */\n  speed?: number;',
      );
      fs.writeFileSync(typesPath, types, 'utf8');
    }
  }
  console.log('[patch-mapbox-puck] Android puck telemetry patched');
}

/**
 * Custom blue/white puck above agency route + forced night map style.
 */
function patchAndroidPuckDarkAndAboveRoute() {
  if (!fs.existsSync(androidKt)) return;
  let source = fs.readFileSync(androidKt, 'utf8');
  const marker = 'DRIVER_TRACKING_PUCK_DARK_V1';
  const stackMarker = 'DRIVER_TRACKING_PUCK_ABOVE_ROUTE_V1';

  if (
    source.includes(marker) &&
    source.includes(stackMarker) &&
    source.includes('NAVIGATION_NIGHT_STYLE') &&
    source.includes('resolveDriverNavigationPuckIcon') &&
    source.includes('keepRouteLayersBelowPuck')
  ) {
    console.log('[patch-mapbox-puck] Android puck dark + above-route already applied');
    return;
  }

  if (!source.includes('import com.mapbox.maps.LayerPosition')) {
    source = source.replace(
      'import com.mapbox.maps.ImageHolder\n',
      'import com.mapbox.maps.ImageHolder\nimport com.mapbox.maps.LayerPosition\n',
    );
  }

  if (source.includes('NavigationStyles.NAVIGATION_DAY_STYLE')) {
    source = source.replace(
      /NavigationStyles\.NAVIGATION_DAY_STYLE/g,
      'NavigationStyles.NAVIGATION_NIGHT_STYLE',
    );
  }

  if (!source.includes(marker) || !source.includes('resolveDriverNavigationPuckIcon')) {
    if (!source.includes('fun resolveDriverNavigationPuckIcon')) {
      const helpers = `
  private fun resolveDriverNavigationPuckIcon(): Int {
    // ${marker}: blue chevron + white rim from app drawable
    val custom = context.resources.getIdentifier(
      "driver_navigation_puck",
      "drawable",
      context.packageName,
    )
    return if (custom != 0) {
      custom
    } else {
      com.mapbox.navigation.ui.maps.R.drawable.mapbox_navigation_puck_icon
    }
  }

  private fun findLocationPuckLayerId(style: com.mapbox.maps.Style): String? {
    val candidates = listOf(
      "mapbox-location-indicator-layer",
      "mapbox-location-bearing-layer",
      "mapbox-location-top-layer",
      "mapbox-location-stroke-layer",
      "mapbox-location-shadow-layer",
      "mapbox-location-accuracy-layer",
    )
    return candidates.firstOrNull { style.styleLayerExists(it) }
  }

  private fun layerPositionBelowPuck(style: com.mapbox.maps.Style): LayerPosition? {
    val puckLayer = findLocationPuckLayerId(style)
    if (puckLayer != null) {
      return LayerPosition(null, puckLayer, null)
    }
    if (style.styleLayerExists("road-label-navigation")) {
      return LayerPosition(null, "road-label-navigation", null)
    }
    return null
  }

  private fun keepRouteLayersBelowPuck(style: com.mapbox.maps.Style) {
    // ${stackMarker}
    val below = findLocationPuckLayerId(style) ?: return
    listOf(
      "dt-agency-overview-casing",
      "dt-agency-overview-layer",
    ).forEach { id ->
      if (style.styleLayerExists(id)) {
        try {
          style.moveStyleLayer(id, LayerPosition(null, below, null))
        } catch (_: Throwable) {
        }
      }
    }
  }

`;
      if (source.includes('private fun startNavigation()')) {
        source = source.replace(
          'private fun startNavigation() {',
          `${helpers}  private fun startNavigation() {`,
        );
      }
    }

    const puckBlock = `binding.mapView.location.apply {
      setLocationProvider(navigationLocationProvider)
      this.locationPuck = LocationPuck2D(
        // DRIVER_TRACKING_PUCK_SCALE_V2
        bearingImage = ImageHolder.Companion.from(
          resolveDriverNavigationPuckIcon()
        ),
        scaleExpression = "[\\"literal\\",1.65]",
      )
      puckBearingEnabled = true
      enabled = true
    }
    binding.mapView.mapboxMap.style?.let { keepRouteLayersBelowPuck(it) }
    binding.mapView.post {
      binding.mapView.mapboxMap.style?.let { keepRouteLayersBelowPuck(it) }
    }
    binding.mapView.postDelayed({
      binding.mapView.mapboxMap.style?.let { keepRouteLayersBelowPuck(it) }
    }, 400)`;

    source = source.replace(
      /binding\.mapView\.location\.apply \{[\s\S]*?puckBearingEnabled = true\s*\n\s*enabled = true\s*\n\s*\}/,
      puckBlock,
    );

    // Mark loadStyle comment if night style is present
    if (
      source.includes('NAVIGATION_NIGHT_STYLE') &&
      !source.includes(marker)
    ) {
      source = source.replace(
        'binding.mapView.mapboxMap.loadStyle(NavigationStyles.NAVIGATION_NIGHT_STYLE)',
        `// ${marker}: always night / dark navigation map\n    binding.mapView.mapboxMap.loadStyle(NavigationStyles.NAVIGATION_NIGHT_STYLE)`,
      );
    }
  }

  if (source.includes('mapStyle.addStyleLayer(com.mapbox.bindgen.Value.valueOf(layerProps), null)')) {
    source = source.replace(
      /val casingId = "dt-agency-overview-casing"\s*\n\s*val layerId = "dt-agency-overview-layer"/,
      `val casingId = "dt-agency-overview-casing"
      val layerId = "dt-agency-overview-layer"
      // ${stackMarker}`,
    );
    source = source.replace(
      `mapStyle.addStyleLayer(com.mapbox.bindgen.Value.valueOf(layerProps), null)
        }
      }

      // Wider Google-nav style path so drivers can see the lane clearly
      upsertLineLayer(casingId, overviewRouteCasingColor, 14.0)
      upsertLineLayer(layerId, overviewRouteColor, 8.0)
      overviewLayerReady = true`,
      `val belowPuck = layerPositionBelowPuck(mapStyle)
          mapStyle.addStyleLayer(com.mapbox.bindgen.Value.valueOf(layerProps), belowPuck)
        }
      }

      // Wider Google-nav style path so drivers can see the lane clearly
      upsertLineLayer(casingId, overviewRouteCasingColor, 14.0)
      upsertLineLayer(layerId, overviewRouteColor, 8.0)
      keepRouteLayersBelowPuck(mapStyle)
      overviewLayerReady = true`,
    );
  } else if (
    source.includes('keepRouteLayersBelowPuck(mapStyle)') &&
    !source.includes(stackMarker)
  ) {
    source = source.replace(
      'private fun keepRouteLayersBelowPuck(style: com.mapbox.maps.Style) {',
      `private fun keepRouteLayersBelowPuck(style: com.mapbox.maps.Style) {
    // ${stackMarker}`,
    );
  }

  // Prefer belowPuck when the upsert already uses a local variable pattern from a prior partial apply
  if (
    source.includes('fun upsertLineLayer') &&
    source.includes('dt-agency-overview-layer') &&
    !source.includes('layerPositionBelowPuck(mapStyle)')
  ) {
    source = source.replace(
      /fun upsertLineLayer\(\s*id: String,\s*color: String,\s*width: Double,\s*\) \{/,
      `val belowPuck = layerPositionBelowPuck(mapStyle)

      fun upsertLineLayer(
        id: String,
        color: String,
        width: Double,
      ) {`,
    );
    source = source.replace(
      /mapStyle\.addStyleLayer\(com\.mapbox\.bindgen\.Value\.valueOf\(layerProps\), null\)/g,
      (match, offset) => {
        // Only rewrite agency overview addStyleLayer calls near overview source id
        const windowStart = Math.max(0, offset - 800);
        const window = source.slice(windowStart, offset);
        if (window.includes('dt-agency-overview-src')) {
          return 'mapStyle.addStyleLayer(com.mapbox.bindgen.Value.valueOf(layerProps), belowPuck)';
        }
        return match;
      },
    );
  }

  fs.writeFileSync(androidKt, source, 'utf8');
  console.log('[patch-mapbox-puck] Android puck dark + above-route patched');
}

/**
 * Maps v11 globe: NavigationCamera FOLLOWING often never leaves world view in this RN
 * embed. Hard-lock camera with setCamera every GPS fix + force mercator projection.
 */
function patchAndroidNavCameraGlobeV3() {
  if (!fs.existsSync(androidKt)) return;
  let source = fs.readFileSync(androidKt, 'utf8');
  const marker = 'DRIVER_TRACKING_NAV_CAMERA_GLOBE_V3';
  if (source.includes(marker) && source.includes('lockStreetCameraToLocation')) {
    console.log('[patch-mapbox-puck] Android nav camera globe V3 already applied');
    return;
  }

  if (!source.includes('lastEnhancedLocation')) {
    source = source.replace(
      /private var locale = Locale\.getDefault\(\)/,
      `private var locale = Locale.getDefault()\n  // ${marker}\n  private var lastEnhancedLocation: Location? = null`,
    );
  }

  // Replace location-observer camera block with hard lock
  source = source.replace(
    /override fun onNewLocationMatcherResult\(locationMatcherResult: LocationMatcherResult\) \{[\s\S]*?receiveEvent\(id, "onLocationChange", event\)\s*\n\s*\}/,
    `override fun onNewLocationMatcherResult(locationMatcherResult: LocationMatcherResult) {
      val enhancedLocation = locationMatcherResult.enhancedLocation
      lastEnhancedLocation = enhancedLocation
      navigationLocationProvider.changePosition(
        location = enhancedLocation,
        keyPoints = locationMatcherResult.keyPoints,
      )
      viewportDataSource.onLocationChanged(enhancedLocation)
      viewportDataSource.evaluate()
      // ${marker}: hard-lock street 3D to puck every fix
      lockStreetCameraToLocation(enhancedLocation)
      firstLocationUpdateReceived = true
      val event = Arguments.createMap()
      event.putDouble("longitude", enhancedLocation.longitude)
      event.putDouble("latitude", enhancedLocation.latitude)
      event.putDouble("heading", enhancedLocation.bearing ?: 0.0)
      event.putDouble("accuracy", enhancedLocation.horizontalAccuracy ?: 0.0)
      context
        .getJSModule(RCTEventEmitter::class.java)
        .receiveEvent(id, "onLocationChange", event)
    }`,
  );

  source = source.replace(
    /\/\/ Recenter Camera[\s\S]*?val initialCameraOptions = CameraOptions\.Builder\(\)\s*\n\s*\.zoom\([^)]+\)\s*\n(?:\s*\.pitch\([^)]+\)\s*\n)?\s*\.center\(origin\)\s*\n\s*\.build\(\)/,
    `// Recenter Camera — street-level 3D
    // ${marker}
    val initialCameraOptions = CameraOptions.Builder()
      .zoom(17.0)
      .pitch(50.0)
      .center(origin)
      .build()`,
  );

  if (!source.includes('followingPitchPropertyOverride(50.0)')) {
    source = source.replace(
      /viewportDataSource\.followingPadding = followingPadding\n    \}/,
      `viewportDataSource.followingPadding = followingPadding
    }
    // ${marker}
    viewportDataSource.options.followingFrameOptions.apply {
      maximizeViewableGeometryWhenPitchZero = false
      defaultPitch = 50.0
      maxZoom = 18.0
    }
    viewportDataSource.followingPitchPropertyOverride(50.0)`,
    );
  }

  source = source.replace(
    /binding\.mapView\.mapboxMap\.loadStyle\(NavigationStyles\.NAVIGATION_DAY_STYLE\) \{[\s\S]*?\n    \}/,
    `binding.mapView.mapboxMap.loadStyle(NavigationStyles.NAVIGATION_DAY_STYLE) { style ->
      routeLineView.initializeLayers(style)
      // DRIVER_TRACKING_NAV_CAMERA_GLOBE_V3: force mercator — globe projection ignores street zoom
      try {
        val mercator = hashMapOf<String, com.mapbox.bindgen.Value>(
          "type" to com.mapbox.bindgen.Value.valueOf("mercator"),
        )
        style.setStyleProjection(com.mapbox.bindgen.Value.valueOf(mercator))
      } catch (_: Throwable) {
      }
      origin?.let { start -> lockStreetCameraToPoint(start) }
    }`,
  );

  source = source.replace(
    /binding\.recenter\.setOnClickListener \{[\s\S]*?\n    \}/,
    `binding.recenter.setOnClickListener {
      // ${marker}
      origin?.let { lockStreetCameraToPoint(it) }
      forceStreetLevelFollowingCamera(instant = true)
      binding.routeOverview.showTextAndExtend(BUTTON_ANIMATION_DURATION)
    }`,
  );

  source = source.replace(
    /binding\.routeOverview\.setOnClickListener \{[\s\S]*?\n    \}/,
    `binding.routeOverview.setOnClickListener {
      // Keep street follow — overview zooms to globe with long agency routes
      forceStreetLevelFollowingCamera(instant = true)
      binding.recenter.showTextAndExtend(BUTTON_ANIMATION_DURATION)
    }`,
  );

  source = source.replace(
    /viewportDataSource\.onRouteChanged\(routeUpdateResult\.navigationRoutes\.first\(\)\)\s*\n\s*viewportDataSource\.evaluate\(\)\s*\n(?:\s*\/\/[^\n]*\n\s*forceStreetLevelFollowingCamera\([^\)]*\)\s*\n)?/,
    `viewportDataSource.onRouteChanged(routeUpdateResult.navigationRoutes.first())
      viewportDataSource.evaluate()
      // ${marker}: do not overview — keeps Maps v11 on the globe
      origin?.let { start -> lockStreetCameraToPoint(start) }
`,
  );

  source = source.replace(
    /mapboxNavigation\?\.startTripSession\(withForegroundService = true\)\s*\n(?:\s*\/\/[^\n]*\n)*(?:\s*origin\?\.let[^\n]*\n)?(?:\s*forceStreetLevelFollowingCamera[^\n]*\n)?(?:\s*navigationCamera\.requestNavigationCameraToFollowing\(\)\s*\n)?/,
    `mapboxNavigation?.startTripSession(withForegroundService = true)
    // ${marker}
    origin?.let { lockStreetCameraToPoint(it) }
    forceStreetLevelFollowingCamera(instant = true)
`,
  );

  if (!source.includes('private fun lockStreetCameraToPoint')) {
    source = source.replace(
      /private fun startRoute\(\)/,
      `private fun lockStreetCameraToPoint(point: Point, bearing: Double? = null) {
    // ${marker}
    try {
      navigationCamera.requestNavigationCameraToIdle()
    } catch (_: Throwable) {
    }
    val builder = CameraOptions.Builder()
      .center(point)
      .zoom(17.0)
      .pitch(50.0)
    if (bearing != null) {
      builder.bearing(bearing)
    }
    binding.mapView.mapboxMap.setCamera(builder.build())
  }

  private fun lockStreetCameraToLocation(location: Location) {
    val bearing = location.bearing?.toDouble()
    lockStreetCameraToPoint(
      Point.fromLngLat(location.longitude, location.latitude),
      bearing,
    )
  }

  private fun forceStreetLevelFollowingCamera(instant: Boolean = false) {
    // ${marker}
    lastEnhancedLocation?.let {
      lockStreetCameraToLocation(it)
      return
    }
    origin?.let { lockStreetCameraToPoint(it) }
  }

  private fun startRoute()`,
    );
  } else {
    // Upgrade existing forceStreetLevelFollowingCamera body to hard-lock
    source = source.replace(
      /private fun forceStreetLevelFollowingCamera\(instant: Boolean = false\) \{[\s\S]*?\n  \}/,
      `private fun forceStreetLevelFollowingCamera(instant: Boolean = false) {
    // ${marker}
    lastEnhancedLocation?.let {
      lockStreetCameraToLocation(it)
      return
    }
    origin?.let { lockStreetCameraToPoint(it) }
  }`,
    );
  }

  if (!source.includes(marker)) {
    console.warn('[patch-mapbox-puck] Android nav camera globe V3 patterns not fully matched');
  }

  fs.writeFileSync(androidKt, source, 'utf8');
  console.log('[patch-mapbox-puck] Android nav camera globe V3 patched');
}

/**
 * Upstream only calls initNavigation() from setDirectionUnit. On New Arch, that prop
 * often arrives BEFORE startOrigin/destination → early return → MapView stays on
 * default globe forever while React HUD still works from Google location.
 */
function patchAndroidNavInitV1() {
  if (!fs.existsSync(androidKt)) return;
  let source = fs.readFileSync(androidKt, 'utf8');
  const marker = 'DRIVER_TRACKING_NAV_INIT_V1';
  if (source.includes(marker) && source.includes('navigationInitialized')) {
    console.log('[patch-mapbox-puck] Android nav init V1 already applied');
    return;
  }

  if (!source.includes('navigationInitialized')) {
    source = source.replace(
      /private var lastEnhancedLocation: Location\? = null/,
      `private var lastEnhancedLocation: Location? = null
  /** Prevents double-start; also gates prop-order races (distanceUnit before origin). */
  private var navigationInitialized = false
  private var nativeChromeWired = false`,
    );
    if (!source.includes('navigationInitialized')) {
      source = source.replace(
        /private var locale = Locale\.getDefault\(\)/,
        `private var locale = Locale.getDefault()
  private var lastEnhancedLocation: Location? = null
  // ${marker}
  private var navigationInitialized = false
  private var nativeChromeWired = false`,
      );
    }
  }

  // Soft-defer instead of hard error when origin not ready
  source = source.replace(
    /private fun initNavigation\(\) \{\s*\n\s*if \(origin == null \|\| destination == null\) \{\s*\n\s*sendErrorToReact\("origin and destination are required"\)\s*\n\s*return\s*\n\s*\}/,
    `private fun initNavigation() {
    if (navigationInitialized) {
      return
    }
    if (origin == null || destination == null) {
      // ${marker}: props often arrive out of order — wait for both
      android.util.Log.w("MapboxNavigationView", "initNavigation deferred — origin/destination not ready yet")
      return
    }
    navigationInitialized = true`,
  );

  // If already partially patched with navigationInitialized check missing the setter retries:
  if (!source.includes(`${marker}: props can arrive`)) {
    source = source.replace(
      /fun setStartOrigin\(origin: Point\?\) \{\s*\n\s*this\.origin = origin\s*\n\s*\}/,
      `fun setStartOrigin(origin: Point?) {
    this.origin = origin
    // ${marker}: props can arrive after distanceUnit — retry start
    initNavigation()
  }`,
    );
    source = source.replace(
      /fun setDestination\(destination: Point\?\) \{\s*\n\s*this\.destination = destination\s*\n\s*\}/,
      `fun setDestination(destination: Point?) {
    this.destination = destination
    // ${marker}
    initNavigation()
  }`,
    );
  }

  fs.writeFileSync(androidKt, source, 'utf8');
  console.log('[patch-mapbox-puck] Android nav init V1 patched');
}

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
 * Agency polyline is the only visible path (MapScreen geometry + color).
 * SDK Directions/congestion line is cleared / painted transparent so TBT can
 * still run without the extra dark-green overlay.
 */
function patchAndroidOverviewRouteVisible() {
  if (!fs.existsSync(androidKt)) return;
  let source = fs.readFileSync(androidKt, 'utf8');
  const marker = 'DRIVER_TRACKING_OVERVIEW_ROUTE_V5';
  if (source.includes(marker) && source.includes('hasAgencyOverview')) {
    console.log('[patch-mapbox-puck] Android overview route visibility V5 already applied');
    return;
  }

  if (!source.includes('import android.graphics.Color')) {
    source = source.replace(
      'import android.content.res.Resources\n',
      'import android.content.res.Resources\nimport android.graphics.Color\n',
    );
  }

  if (!source.includes('overviewRouteCoordinates')) {
    source = source.replace(
      /private var locale = Locale\.getDefault\(\)/,
      `private var locale = Locale.getDefault()
  // ${marker}: full agency / trip polyline (MapScreen path)
  private var overviewRouteCoordinates: List<Point> = listOf()
  private var routeCoordinates: List<Point> = listOf()
  private var overviewLayerReady = false
  private var overviewRouteColor: String = "#1C2023"`,
    );
  } else if (!source.includes('overviewRouteColor')) {
    source = source.replace(
      /private var overviewLayerReady = false/,
      `private var overviewLayerReady = false
  private var overviewRouteColor: String = "#1C2023"`,
    );
  }

  const hiddenColors = `.routeLineColorResources(
        RouteLineColorResources.Builder()
          .routeDefaultColor(Color.TRANSPARENT)
          .routeCasingColor(Color.TRANSPARENT)
          .routeLineTraveledColor(Color.TRANSPARENT)
          .routeLineTraveledCasingColor(Color.TRANSPARENT)
          .routeUnknownCongestionColor(Color.TRANSPARENT)
          .routeLowCongestionColor(Color.TRANSPARENT)
          .routeModerateCongestionColor(Color.TRANSPARENT)
          .routeHeavyCongestionColor(Color.TRANSPARENT)
          .routeSevereCongestionColor(Color.TRANSPARENT)
          .routeClosureColor(Color.TRANSPARENT)
          .restrictedRoadColor(Color.TRANSPARENT)
          .alternativeRouteDefaultColor(Color.TRANSPARENT)
          .alternativeRouteCasingColor(Color.TRANSPARENT)
          .alternativeRouteUnknownCongestionColor(Color.TRANSPARENT)
          .alternativeRouteLowCongestionColor(Color.TRANSPARENT)
          .alternativeRouteModerateCongestionColor(Color.TRANSPARENT)
          .alternativeRouteHeavyCongestionColor(Color.TRANSPARENT)
          .alternativeRouteSevereCongestionColor(Color.TRANSPARENT)
          .inActiveRouteLegsColor(Color.TRANSPARENT)
          .build()
      )`;

  if (source.includes('.routeLineColorResources(RouteLineColorResources.Builder().build())')) {
    source = source.replace(
      '.routeLineColorResources(RouteLineColorResources.Builder().build())',
      hiddenColors,
    );
  }

  const newObserver = `// ${marker}:
      // Agency polyline is the only visible path. Directions stays active for TBT
      // but the SDK route/congestion line is never painted (duplicate dark-green).
      val hasAgencyOverview = overviewRouteCoordinates.size >= 2
      if (hasAgencyOverview) {
        ensureAgencyOverviewRouteLine()
        routeLineApi.clearRouteLine { value ->
          binding.mapView.mapboxMap.style?.let { style ->
            routeLineView.renderClearRouteLineValue(style, value)
            ensureAgencyOverviewRouteLine(style)
          }
        }
      } else {
        val primaryOnly = listOf(routeUpdateResult.navigationRoutes.first())
        routeLineApi.setNavigationRoutes(primaryOnly) { value ->
          binding.mapView.mapboxMap.style?.apply {
            routeLineView.renderRouteDrawData(this, value)
          }
        }
      }`;

  const observerPatterns = [
    /\/\/ DRIVER_TRACKING_OVERVIEW_ROUTE_V4:[\s\S]*?routeLineView\.renderRouteDrawData\(this, value\)[\s\S]*?\n      \}\n\n      \/\/ update the camera/,
    /\/\/ DRIVER_TRACKING_OVERVIEW_ROUTE_V3:[\s\S]*?\n      \}\n\n      \/\/ update the camera/,
    /\/\/ DRIVER_TRACKING_OVERVIEW_ROUTE_V2:[\s\S]*?\n      \}\n\n      \/\/ update the camera/,
    /\/\/ DRIVER_TRACKING_OVERVIEW_ROUTE_V1:[\s\S]*?\n      \}\n\n      \/\/ update the camera/,
    /\/\/ generate route geometries asynchronously and render them\s*\n\s*routeLineApi\.setNavigationRoutes\([\s\S]*?routeLineView\.renderRouteDrawData\(this, value\)\s*\n\s*\}\s*\n\s*\}/,
  ];

  let replacedObserver = false;
  for (const pattern of observerPatterns) {
    if (pattern.test(source)) {
      source = source.replace(pattern, `${newObserver}\n\n      // update the camera`);
      // Vanilla block has no "// update the camera" prefix in the match — avoid duplicating it.
      source = source.replace(
        '// update the camera\n\n      // update the camera',
        '// update the camera',
      );
      replacedObserver = true;
      break;
    }
  }
  if (!replacedObserver && source.includes('// generate route geometries asynchronously and render them')) {
    source = source.replace(
      /\/\/ generate route geometries asynchronously and render them\s*\n\s*routeLineApi\.setNavigationRoutes\([\s\S]*?routeLineView\.renderRouteDrawData\(this, value\)\s*\n\s*\}\s*\n\s*\}/,
      newObserver,
    );
    replacedObserver = source.includes('hasAgencyOverview');
  }
  if (!replacedObserver && !source.includes('hasAgencyOverview')) {
    console.warn('[patch-mapbox-puck] overview routesObserver pattern not found');
  }

  if (!source.includes('fun setOverviewRouteColor')) {
    const colorSetter = `
  fun setOverviewRouteColor(color: String?) {
    val raw = color?.trim().orEmpty()
    if (raw.isEmpty()) return
    val next = if (raw.startsWith("#")) raw else "#$raw"
    if (next.equals(overviewRouteColor, ignoreCase = true)) return
    overviewRouteColor = next
    if (overviewRouteCoordinates.size >= 2) {
      ensureAgencyOverviewRouteLine()
    }
  }
`;
    if (source.includes('fun setOverviewRouteCoordinates')) {
      source = source.replace(
        /fun setOverviewRouteCoordinates\(points: List<Point>\) \{[\s\S]*?\n  \}/,
        (match) => `${match}\n${colorSetter}`,
      );
    }
  }

  if (!source.includes('ensureAgencyOverviewRouteLine')) {
    const lon = '${p.longitude()}';
    const lat = '${p.latitude()}';
    const err = '${e.message}';
    const helper = `
  fun setOverviewRouteCoordinates(points: List<Point>) {
    this.overviewRouteCoordinates = points
    overviewLayerReady = false
    if (points.size >= 2) {
      ensureAgencyOverviewRouteLine()
    }
  }

  fun setOverviewRouteColor(color: String?) {
    val raw = color?.trim().orEmpty()
    if (raw.isEmpty()) return
    val next = if (raw.startsWith("#")) raw else "#$raw"
    if (next.equals(overviewRouteColor, ignoreCase = true)) return
    overviewRouteColor = next
    if (overviewRouteCoordinates.size >= 2) {
      ensureAgencyOverviewRouteLine()
    }
  }

  fun setRouteCoordinates(points: List<Point>) {
    this.routeCoordinates = points
  }

  private fun ensureAgencyOverviewRouteLine(
    style: com.mapbox.maps.Style? = binding.mapView.mapboxMap.style,
  ) {
    // ${marker}
    val mapStyle = style ?: return
    if (overviewRouteCoordinates.size < 2) return
    try {
      val coordsJson = overviewRouteCoordinates.joinToString(",") { p ->
        "[${lon},${lat}]"
      }
      val geoJson =
        ${'"""'}{"type":"Feature","properties":{},"geometry":{"type":"LineString","coordinates":[$coordsJson]}}${'}'}${'"""'}
      val sourceId = "dt-agency-overview-src"
      val layerId = "dt-agency-overview-layer"
      val sourceProps = hashMapOf<String, com.mapbox.bindgen.Value>(
        "type" to com.mapbox.bindgen.Value.valueOf("geojson"),
        "data" to com.mapbox.bindgen.Value.valueOf(geoJson),
      )
      if (mapStyle.styleSourceExists(sourceId)) {
        mapStyle.setStyleSourceProperty(
          sourceId,
          "data",
          com.mapbox.bindgen.Value.valueOf(geoJson),
        )
      } else {
        mapStyle.addStyleSource(sourceId, com.mapbox.bindgen.Value.valueOf(sourceProps))
      }
      val colorValue = com.mapbox.bindgen.Value.valueOf(overviewRouteColor)
      val widthValue = com.mapbox.bindgen.Value.valueOf(4.0)
      val opacityValue = com.mapbox.bindgen.Value.valueOf(1.0)
      if (mapStyle.styleLayerExists(layerId)) {
        mapStyle.setStyleLayerProperty(layerId, "line-color", colorValue)
        mapStyle.setStyleLayerProperty(layerId, "line-width", widthValue)
        mapStyle.setStyleLayerProperty(layerId, "line-opacity", opacityValue)
      } else {
        val layerProps = hashMapOf<String, com.mapbox.bindgen.Value>(
          "id" to com.mapbox.bindgen.Value.valueOf(layerId),
          "type" to com.mapbox.bindgen.Value.valueOf("line"),
          "source" to com.mapbox.bindgen.Value.valueOf(sourceId),
          "paint" to com.mapbox.bindgen.Value.valueOf(
            hashMapOf(
              "line-color" to colorValue,
              "line-width" to widthValue,
              "line-opacity" to opacityValue,
            ),
          ),
          "layout" to com.mapbox.bindgen.Value.valueOf(
            hashMapOf(
              "line-cap" to com.mapbox.bindgen.Value.valueOf("round"),
              "line-join" to com.mapbox.bindgen.Value.valueOf("round"),
            ),
          ),
        )
        mapStyle.addStyleLayer(com.mapbox.bindgen.Value.valueOf(layerProps), null)
      }
      overviewLayerReady = true
    } catch (e: Throwable) {
      Log.w("MapboxNavigationView", "ensureAgencyOverviewRouteLine failed: ${err}")
    }
  }
`;
    source = source.replace(/\n  fun setLocal\(language: String\) \{/, `\n${helper}  fun setLocal(language: String) {`);
  }

  if (source.includes('#1B7F3A')) {
    source = source.replace(
      'com.mapbox.bindgen.Value.valueOf("#1B7F3A")',
      'com.mapbox.bindgen.Value.valueOf(overviewRouteColor)',
    );
    source = source.replace(
      'com.mapbox.bindgen.Value.valueOf(6.0)',
      'com.mapbox.bindgen.Value.valueOf(4.0)',
    );
    source = source.replace(
      'com.mapbox.bindgen.Value.valueOf(0.92)',
      'com.mapbox.bindgen.Value.valueOf(1.0)',
    );
  }

  fs.writeFileSync(androidKt, source, 'utf8');
  console.log('[patch-mapbox-puck] Android overview route visibility V5 patched');
}

/**
 * Completely disable Mapbox reroute + continuous alternatives when the trip
 * starts / routes are ready. Training must stay on the assigned agency path.
 */
function patchAndroidDisableRerouteCompletely() {
  if (!fs.existsSync(androidKt)) return;
  let source = fs.readFileSync(androidKt, 'utf8');
  const marker = 'DRIVER_TRACKING_DISABLE_REROUTE_V1';
  if (source.includes(marker) && source.includes('fun disableRerouteCompletely()')) {
    console.log('[patch-mapbox-puck] Android disable-reroute V1 already applied');
    return;
  }

  if (!source.includes('private fun disableRerouteCompletely()')) {
    const helper = `
  /** Training: stay on the assigned path — never recalculate a shortcut. */
  private fun disableRerouteCompletely() {
    // ${marker}
    try {
      mapboxNavigation?.setRerouteEnabled(false)
    } catch (_: Throwable) {
      // Older / alternate SDK builds
    }
    try {
      mapboxNavigation?.setContinuousAlternativesEnabled(false)
    } catch (_: Throwable) {
      // no-op
    }
  }

`;
    if (source.includes('  private fun startRoute() {')) {
      source = source.replace('  private fun startRoute() {', `${helper}  private fun startRoute() {`);
    } else {
      source = source.replace(
        '  private fun sendErrorToReact(error: String?) {',
        `${helper}  private fun sendErrorToReact(error: String?) {`,
      );
    }
  }

  if (
    source.includes('mapboxNavigation?.registerOffRouteObserver(offRouteObserver)') &&
    !source.includes('registerOffRouteObserver(offRouteObserver)\n    disableRerouteCompletely()')
  ) {
    source = source.replace(
      'mapboxNavigation?.registerOffRouteObserver(offRouteObserver)',
      `mapboxNavigation?.registerOffRouteObserver(offRouteObserver)
    disableRerouteCompletely()`,
    );
  } else if (
    source.includes('mapboxNavigation?.registerVoiceInstructionsObserver(voiceInstructionsObserver)') &&
    !source.includes('disableRerouteCompletely()')
  ) {
    source = source.replace(
      'mapboxNavigation?.registerVoiceInstructionsObserver(voiceInstructionsObserver)',
      `mapboxNavigation?.registerVoiceInstructionsObserver(voiceInstructionsObserver)
    disableRerouteCompletely()`,
    );
  }

  if (
    source.includes('mapboxNavigation?.setNavigationRoutes(routes)') &&
    !source.includes('val primary = if (routes.isNotEmpty()) listOf(routes.first()) else routes')
  ) {
    source = source.replace(
      'mapboxNavigation?.setNavigationRoutes(routes)',
      `disableRerouteCompletely()
    val primary = if (routes.isNotEmpty()) listOf(routes.first()) else routes
    mapboxNavigation?.setNavigationRoutes(primary)
    disableRerouteCompletely()`,
    );
  }

  if (
    source.includes('mapboxNavigation?.startTripSession(withForegroundService = true)') &&
    !/startTripSession\(withForegroundService = true\)\s*\n\s*disableRerouteCompletely\(\)/.test(source)
  ) {
    source = source.replace(
      'mapboxNavigation?.startTripSession(withForegroundService = true)',
      `mapboxNavigation?.startTripSession(withForegroundService = true)
    disableRerouteCompletely()`,
    );
  }

  if (source.includes('.steps(true)') && !source.includes('.alternatives(false)')) {
    source = source.replace('.steps(true)', '.steps(true)\n        .alternatives(false)');
  }

  fs.writeFileSync(androidKt, source, 'utf8');
  console.log('[patch-mapbox-puck] Android disable-reroute V1 patched');
}

/**
 * JS + ViewManager props for agency overview polyline and MapScreen route color.
 */
function patchNativeAgencyPathProps() {
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
  if (fs.existsSync(managerPath)) {
    let manager = fs.readFileSync(managerPath, 'utf8');
    const propsMarker = 'DRIVER_TRACKING_OVERVIEW_PROPS_V1';
    const colorMarker = 'DRIVER_TRACKING_ROUTE_COLOR_V1';
    if (!manager.includes('setOverviewRouteCoordinates')) {
      const block = `
  // ${propsMarker}
  @ReactProp(name = "overviewRouteCoordinates")
  override fun setOverviewRouteCoordinates(view: MapboxNavigationView?, value: ReadableArray?) {
    if (value == null) {
      view?.setOverviewRouteCoordinates(listOf())
      return
    }
    val points = value.toArrayList().mapNotNull { item ->
      val map = item as? Map<*, *>
      val latitude = map?.get("latitude") as? Double
      val longitude = map?.get("longitude") as? Double
      if (latitude != null && longitude != null) {
        Point.fromLngLat(longitude, latitude)
      } else {
        null
      }
    }
    view?.setOverviewRouteCoordinates(points)
  }

  // ${colorMarker}
  @ReactProp(name = "routeColor")
  override fun setRouteColor(view: MapboxNavigationView?, value: String?) {
    view?.setOverviewRouteColor(value)
  }

  @ReactProp(name = "routeCoordinates")
  override fun setRouteCoordinates(view: MapboxNavigationView?, value: ReadableArray?) {
    if (value == null) {
      view?.setRouteCoordinates(listOf())
      return
    }
    val points = value.toArrayList().mapNotNull { item ->
      val map = item as? Map<*, *>
      val latitude = map?.get("latitude") as? Double
      val longitude = map?.get("longitude") as? Double
      if (latitude != null && longitude != null) {
        Point.fromLngLat(longitude, latitude)
      } else {
        null
      }
    }
    view?.setRouteCoordinates(points)
  }

`;
      manager = manager.replace(
        /@ReactProp\(name = "language"\)/,
        `${block}  @ReactProp(name = "language")`,
      );
    } else if (!manager.includes('setRouteColor')) {
      manager = manager.replace(
        /view\?\.setOverviewRouteCoordinates\(points\)\n  \}/,
        `view?.setOverviewRouteCoordinates(points)
  }

  // ${colorMarker}
  @ReactProp(name = "routeColor")
  override fun setRouteColor(view: MapboxNavigationView?, value: String?) {
    view?.setOverviewRouteColor(value)
  }`,
      );
    }
    fs.writeFileSync(managerPath, manager, 'utf8');
  }

  const nativeComponentPath = path.join(
    __dirname,
    '..',
    'node_modules',
    '@pawan-pk',
    'react-native-mapbox-navigation',
    'src',
    'MapboxNavigationViewNativeComponent.ts',
  );
  if (fs.existsSync(nativeComponentPath)) {
    let source = fs.readFileSync(nativeComponentPath, 'utf8');
    if (!source.includes('overviewRouteCoordinates')) {
      source = source.replace(
        /waypoints\?: \{[\s\S]*?\}\[\];\n/,
        (match) => `${match}  overviewRouteCoordinates?: {\n    latitude: Double;\n    longitude: Double;\n  }[];\n  routeColor?: string;\n  routeCoordinates?: {\n    latitude: Double;\n    longitude: Double;\n    name?: string;\n    separatesLegs?: boolean;\n  }[];\n`,
      );
    } else if (!source.includes('routeColor?: string')) {
      source = source.replace(
        /overviewRouteCoordinates\?: \{[\s\S]*?\}\[\];\n/,
        (match) => `${match}  routeColor?: string;\n`,
      );
    }
    fs.writeFileSync(nativeComponentPath, source, 'utf8');
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
    if (!types.includes('overviewRouteCoordinates?:')) {
      types = types.replace(
        'destination: Coordinate & { title?: string };\n',
        `destination: Coordinate & { title?: string };\n  overviewRouteCoordinates?: Coordinate[];\n  routeColor?: string;\n`,
      );
    } else if (!types.includes('routeColor?: string')) {
      types = types.replace(
        'overviewRouteCoordinates?: Coordinate[];\n',
        'overviewRouteCoordinates?: Coordinate[];\n  routeColor?: string;\n',
      );
    }
    fs.writeFileSync(typesPath, types, 'utf8');
  }
  console.log('[patch-mapbox-puck] Native agency-path props patched');
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

/**
 * Light-blue Google-nav path (not agency purple) + Map Matching / Directions-along-shape
 * so TBT progresses on the fixed agency polyline with reroute disabled.
 */
function patchAndroidLightBlueAgencyNavV2() {
  if (!fs.existsSync(androidKt)) return;
  let source = fs.readFileSync(androidKt, 'utf8');
  const marker = 'DRIVER_TRACKING_MAP_MATCHING_AGENCY_V2';
  const colorMarker = 'DRIVER_TRACKING_ROUTE_COLOR_V2';

  if (source.includes('overviewRouteColor: String = "#1C2023"')) {
    source = source.replace(
      'overviewRouteColor: String = "#1C2023"',
      'overviewRouteColor: String = "#4285F4"',
    );
  }
  if (source.includes('overviewRouteColor: String = "#4285F4"') && !source.includes('overviewRouteCasingColor')) {
    source = source.replace(
      'private var overviewRouteColor: String = "#4285F4"',
      `private var overviewRouteColor: String = "#4285F4"
  private var overviewRouteCasingColor: String = "#1967D2"`,
    );
  }
  if (!source.includes('routeCoordinateWaypointIndices')) {
    source = source.replace(
      'private var routeCoordinates: List<Point> = listOf()',
      `private var routeCoordinates: List<Point> = listOf()
  /** Indices into routeCoordinates that are bus-stop waypoints (separatesLegs). */
  private var routeCoordinateWaypointIndices: List<Int> = listOf()`,
    );
  }

  if (!source.includes('requestAgencyMapMatching(matchPoints)')) {
    const startRouteMatch = source.match(
      /private fun startRoute\(\) \{[\s\S]*?\n    findRoute\(coordinatesList\)\n  \}/,
    );
    if (startRouteMatch) {
      source = source.replace(
        startRouteMatch[0],
        `private fun startRoute() {
    mapboxNavigation?.registerRoutesObserver(routesObserver)
    mapboxNavigation?.registerArrivalObserver(arrivalObserver)
    mapboxNavigation?.registerRouteProgressObserver(routeProgressObserver)
    mapboxNavigation?.registerLocationObserver(locationObserver)
    mapboxNavigation?.registerVoiceInstructionsObserver(voiceInstructionsObserver)
    mapboxNavigation?.registerOffRouteObserver(offRouteObserver)
    disableRerouteCompletely()

    val matchPoints = when {
      routeCoordinates.size >= 2 -> routeCoordinates
      overviewRouteCoordinates.size >= 2 -> overviewRouteCoordinates
      else -> emptyList()
    }
    if (matchPoints.size >= 2) {
      requestAgencyMapMatching(matchPoints)
      return
    }

    val coordinatesList = mutableListOf<Point>()
    this.origin?.let { coordinatesList.add(it) }
    this.waypoints.let { coordinatesList.addAll(waypoints) }
    this.destination?.let { coordinatesList.add(it) }
    findRoute(coordinatesList)
  }`,
      );
    }
  }

  if (source.includes('DRIVER_TRACKING_MAP_MATCHING_AGENCY_V1') && !source.includes(marker)) {
    source = source.replace('DRIVER_TRACKING_MAP_MATCHING_AGENCY_V1', marker);
  }

  if (!source.includes(colorMarker) && source.includes('fun setOverviewRouteColor')) {
    source = source.replace(
      /fun setOverviewRouteColor\(color: String\?\) \{[\s\S]*?\n  \}/,
      `fun setOverviewRouteColor(color: String?) {
    // ${colorMarker}: keep Google-nav light blue; ignore agency purple/etc.
    val raw = color?.trim().orEmpty()
    if (raw.isEmpty()) return
    val normalized = if (raw.startsWith("#")) raw else "#$raw"
    val isBlueFamily = normalized.matches(
      Regex("#(?i)(4285F4|1A73E8|1967D2|3B82F6|2196F3|4A90E2|5B9BD5)([0-9A-F]{0,2})?")
    )
    if (!isBlueFamily) {
      overviewRouteColor = "#4285F4"
      overviewRouteCasingColor = "#1967D2"
    } else {
      overviewRouteColor = normalized.take(7)
      overviewRouteCasingColor = "#1967D2"
    }
    if (overviewRouteCoordinates.size >= 2) {
      ensureAgencyOverviewRouteLine()
    }
  }`,
    );
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
  if (fs.existsSync(managerPath)) {
    let manager = fs.readFileSync(managerPath, 'utf8');
    if (
      manager.includes('@ReactProp(name = "routeCoordinates")') &&
      !manager.includes('waypointIndices')
    ) {
      manager = manager.replace(
        /@ReactProp\(name = "routeCoordinates"\)\s*\n\s*override fun setRouteCoordinates\(view: MapboxNavigationView\?, value: ReadableArray\?\) \{[\s\S]*?\n  \}/,
        `@ReactProp(name = "routeCoordinates")
  override fun setRouteCoordinates(view: MapboxNavigationView?, value: ReadableArray?) {
    if (value == null) {
      view?.setRouteCoordinates(listOf(), listOf())
      return
    }
    val waypointIndices = mutableListOf<Int>()
    val points = value.toArrayList().mapIndexedNotNull { index, item ->
      val map = item as? Map<*, *>
      val latitude = (map?.get("latitude") as? Number)?.toDouble()
      val longitude = (map?.get("longitude") as? Number)?.toDouble()
      val separatesRaw = map?.get("separatesLegs")
      val separatesLegs = when (separatesRaw) {
        is Boolean -> separatesRaw
        is Number -> separatesRaw.toInt() != 0
        else -> false
      }
      if (separatesLegs) {
        waypointIndices.add(index)
      }
      if (latitude != null && longitude != null) {
        Point.fromLngLat(longitude, latitude)
      } else {
        null
      }
    }
    view?.setRouteCoordinates(points, waypointIndices)
  }`,
      );
      fs.writeFileSync(managerPath, manager, 'utf8');
    }
  }

  fs.writeFileSync(androidKt, source, 'utf8');
  console.log('[patch-mapbox-puck] Android light-blue agency nav V2 patched');
}
