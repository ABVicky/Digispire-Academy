import { useEffect } from 'react';
import { requestNotificationPermission } from '../utils/notificationEngine';

export default function NativeAppInitializer() {
  useEffect(() => {
    const initNativeFeatures = async () => {
      // 1. Configure Native Status Bar (prevent top camera notch overlap)
      try {
        const statusBar = (typeof window !== 'undefined' && window.Capacitor?.Plugins?.StatusBar);
        if (statusBar) {
          await statusBar.setOverlaysWebView({ overlay: false });
          await statusBar.setBackgroundColor({ color: '#1E3A5F' });
        } else {
          const { StatusBar, Style } = await import('@capacitor/status-bar');
          if (StatusBar) {
            await StatusBar.setOverlaysWebView({ overlay: false });
            await StatusBar.setBackgroundColor({ color: '#1E3A5F' });
            await StatusBar.setStyle({ style: Style.Dark });
          }
        }
      } catch (err) {
        console.warn('Native status bar init warning:', err);
      }

      // 2. Request System Notification Permission
      try {
        setTimeout(async () => {
          await requestNotificationPermission();
        }, 1200);
      } catch (err) {
        console.warn('Initial notification request warning:', err);
      }

      // 3. Hardware Back Button handler on Android
      try {
        const appPlugin = (typeof window !== 'undefined' && window.Capacitor?.Plugins?.App);
        if (appPlugin) {
          appPlugin.addListener('backButton', ({ canGoBack }) => {
            if (canGoBack) {
              window.history.back();
            }
          });
        } else {
          const { App: CapApp } = await import('@capacitor/app');
          if (CapApp) {
            CapApp.addListener('backButton', ({ canGoBack }) => {
              if (canGoBack) {
                window.history.back();
              }
            });
          }
        }
      } catch (err) {
        console.warn('Hardware back button init warning:', err);
      }
    };

    initNativeFeatures();
  }, []);

  return null;
}
