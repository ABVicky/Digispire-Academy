import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { requestNotificationPermission } from '../utils/notificationEngine';

export default function NativeAppInitializer() {
  const location = useLocation();
  const navigate = useNavigate();
  const lastBackPressRef = useRef(0);

  // 1. Automatically scroll to top on every route change
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [location.pathname]);

  // 2. Initialize native features and Android hardware back button
  useEffect(() => {
    let backListener = null;

    const initNativeFeatures = async () => {
      // Configure Native Status Bar (prevent camera notch / cutout overlap)
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

      // Request System Notification Permission
      try {
        setTimeout(async () => {
          await requestNotificationPermission();
        }, 1500);
      } catch (err) {
        console.warn('Initial notification request warning:', err);
      }

      // Android Hardware Back Button Listener
      try {
        const appPlugin = (typeof window !== 'undefined' && window.Capacitor?.Plugins?.App);
        const handleBack = () => {
          const currentPath = window.location.pathname;
          const isRootPage = currentPath === '/student/dashboard' || 
                             currentPath === '/admin/dashboard' || 
                             currentPath === '/login' || 
                             currentPath === '/';

          if (isRootPage) {
            const now = Date.now();
            if (now - lastBackPressRef.current < 2000) {
              if (appPlugin) appPlugin.exitApp();
            } else {
              lastBackPressRef.current = now;
            }
          } else {
            navigate(-1);
          }
        };

        if (appPlugin) {
          backListener = await appPlugin.addListener('backButton', handleBack);
        } else {
          const { App: CapApp } = await import('@capacitor/app');
          if (CapApp) {
            backListener = await CapApp.addListener('backButton', handleBack);
          }
        }
      } catch (err) {
        console.warn('Hardware back button init warning:', err);
      }
    };

    initNativeFeatures();

    return () => {
      if (backListener && typeof backListener.remove === 'function') {
        backListener.remove();
      }
    };
  }, [navigate]);

  return null;
}
