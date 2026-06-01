import notifee, { AndroidImportance, AndroidStyle, AndroidForegroundServiceType, AuthorizationStatus } from '@notifee/react-native';
import { PermissionsAndroid, Platform } from 'react-native';

/**
 * Notification Service
 * Manages background tracking indicators and notifications.
 */
export const notificationService = {
    /**
     * Initialize notification channels (Android only)
     */
    async initialize() {
        await this.requestPermission();
        if (Platform.OS === 'android') {
            await notifee.createChannel({
                id: 'tracking',
                name: 'Background Tracking Status',
                importance: AndroidImportance.LOW, // Use LOW to avoid intrusive sound/popup, just persistent indicator
                description: 'Shows that the app is currently tracking location in the background.',
            });
        }
    },

    /**
     * Request notification permissions (Android 13+ and iOS)
     */
    async requestPermission() {
        try {
            // For Android 13+ (API level 33+), we must explicitly request the POST_NOTIFICATIONS permission
            if (Platform.OS === 'android' && Platform.Version >= 33) {
                const granted = await PermissionsAndroid.request(
                    PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
                    {
                        title: 'Notification Permission',
                        message: 'This app needs notification access to show your tracking status in the background.',
                        buttonNeutral: 'Ask Me Later',
                        buttonNegative: 'Cancel',
                        buttonPositive: 'OK',
                    }
                );
                if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
                    console.warn('[NotificationService] Notification permission denied');
                    return false;
                }
            }

            // Default Notifee request for iOS and fallback for older Android
            const settings = await notifee.requestPermission();
            return settings.authorizationStatus >= AuthorizationStatus.AUTHORIZED;
        } catch (error) {
            console.warn('[NotificationService] Permission request failed:', error);
            return false;
        }
    },

    /**
     * Optional Notifee foreground notification (Android).
     * Background GPS uses react-native-background-actions' built-in notification instead —
     * call this only if you are not using BackgroundService.start().
     */
    async startTrackingIndicator(title: string, description: string) {
        try {
            if (Platform.OS === 'android') {
                // Create the foreground service notification
                await notifee.displayNotification({
                    id: 'bg-tracking-indicator',
                    title: title,
                    body: description,
                    android: {
                        channelId: 'tracking',
                        asForegroundService: true,
                        foregroundServiceTypes: [AndroidForegroundServiceType.FOREGROUND_SERVICE_TYPE_LOCATION],
                        ongoing: true,
                        smallIcon: 'ic_launcher', // Use app icon as the indicator
                        pressAction: {
                            id: 'default',
                        },
                    },
                });
            }
            // On iOS, the tracking indicator is handled by the blue bar/dot if UIBackgroundModes includes 'location'
        } catch (error) {
            console.warn('[NotificationService] Failed to start tracking indicator:', error);
        }
    },

    /**
     * Stop the background tracking indicator
     */
    async stopTrackingIndicator() {
        try {
            await notifee.stopForegroundService();
            await notifee.cancelNotification('bg-tracking-indicator');
        } catch (error) {
            console.warn('[NotificationService] Failed to stop tracking indicator:', error);
        }
    },
};
