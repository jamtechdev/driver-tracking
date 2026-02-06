import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?
  /// Stored so SceneDelegate can pass them to startReactNative (scene connects after didFinishLaunching).
  var launchOptions: [UIApplication.LaunchOptionsKey: Any]?

  /// Always use main screen bounds so the app opens full screen on iPad (not in a Stage Manager half-window).
  private func fullScreenBounds() -> CGRect {
    return UIScreen.main.bounds
  }

  /// Apply full-screen frame and size restrictions. Call at launch, on become active, and repeatedly after launch.
  private func applyFullScreen(application: UIApplication) {
    let bounds = fullScreenBounds()
    window?.frame = bounds
    window?.bounds = bounds
    // Force root content view (e.g. RCTRootView) to fill the window edge-to-edge on all devices.
    window?.rootViewController?.view.frame = bounds
    window?.rootViewController?.view.bounds = bounds
    window?.subviews.forEach { sub in
      sub.frame = bounds
      sub.bounds = bounds
    }
    if #available(iOS 16.0, *) {
      let screenSize = bounds.size
      for scene in application.connectedScenes {
        guard let ws = scene as? UIWindowScene else { continue }
        ws.sizeRestrictions?.minimumSize = screenSize
        ws.sizeRestrictions?.maximumSize = screenSize
      }
    }
  }

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let delegate = ReactNativeDelegate()
    let factory = RCTReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory
    self.launchOptions = launchOptions

    // Window is created in SceneDelegate (when scene connects) so we can set full-screen
    // size restrictions on the scene before the window exists. That makes the app open
    // in full screen on iPad instead of a Stage Manager half-window.

    // Re-apply full-screen after scene has created the window (no rotation logic).
    DispatchQueue.main.async { self.applyFullScreen(application: application) }
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) { self.applyFullScreen(application: application) }
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { self.applyFullScreen(application: application) }
    DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) { self.applyFullScreen(application: application) }
    for delay in [1.5, 2.0, 2.5] {
      DispatchQueue.main.asyncAfter(deadline: .now() + delay) {
        self.applyFullScreen(application: application)
      }
    }

    return true
  }

  // Support portrait and landscape so app fills screen in both orientations.
  func application(_ application: UIApplication, supportedInterfaceOrientationsFor window: UIWindow?) -> UIInterfaceOrientationMask {
    return .all
  }

  // Keep window full screen when app becomes active (e.g. after Stage Manager resize).
  func applicationDidBecomeActive(_ application: UIApplication) {
    applyFullScreen(application: application)
  }
}

class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
  override func sourceURL(for bridge: RCTBridge) -> URL? {
    self.bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
#else
    Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
