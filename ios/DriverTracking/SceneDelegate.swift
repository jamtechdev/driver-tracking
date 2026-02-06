import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider

/// Scene delegate so we can set full-screen size restrictions on the window scene *before*
/// creating the window. This makes the app open in full screen on iPad (including Stage Manager).
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = scene as? UIWindowScene else { return }

    // Force this scene to full-screen size before any window is created (critical for iPad Stage Manager).
    let fullSize = UIScreen.main.bounds.size
    if #available(iOS 16.0, *) {
      windowScene.sizeRestrictions?.minimumSize = fullSize
      windowScene.sizeRestrictions?.maximumSize = fullSize
    }

    guard let appDelegate = UIApplication.shared.delegate as? AppDelegate,
          let factory = appDelegate.reactNativeFactory else { return }

    let bounds = UIScreen.main.bounds
    let win = UIWindow(windowScene: windowScene)
    win.frame = bounds
    win.bounds = bounds
    appDelegate.window = win

    factory.startReactNative(
      withModuleName: "DriverTracking",
      in: win,
      launchOptions: appDelegate.launchOptions
    )

    win.makeKeyAndVisible()
    window = win

    // Force root content to fill the window edge-to-edge (phones and tablets).
    let b = win.bounds
    win.rootViewController?.view.frame = b
    win.rootViewController?.view.bounds = b
    win.subviews.forEach { $0.frame = b; $0.bounds = b }
  }
}
