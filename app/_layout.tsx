import React from 'react'; 
import { Stack } from 'expo-router';
import { QueryProvider } from '@/providers/QueryProvider';
import {
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    useFonts,
} from '@expo-google-fonts/inter';
import { StatusBar } from 'expo-status-bar';
import { authService } from '@/services/auth.service';
import { useEffect } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { useConfigStore } from '@/stores/config.store';
import { useRouter, useSegments } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { Colors } from '@/constants/colors';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Alert, PermissionsAndroid, Platform } from 'react-native'; 
import Toast from 'react-native-toast-message';
import messaging from '@react-native-firebase/messaging';
import api from '@/services/api';
import { notificationsService } from '@/services/notifications.service';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LAST_CITY_KEY = 'last_city';
const LAST_AREA_KEY = 'last_area';
const LAST_LOCATION_SYNC_TS_KEY = 'last_location_sync_ts';
const LOCATION_SYNC_INTERVAL_MS = 5 * 60 * 1000;


function AuthGuard({ children }: { children: React.ReactNode }) {
    const { isAuthenticated, isLoading, user, initialize } = useAuthStore();
    const { fetchConfig, config } = useConfigStore();
    const router = useRouter();
    const segments = useSegments();

    useEffect(() => {
        console.log('[AuthGuard] Initializing...');
        initialize();
        fetchConfig();
    }, []);


    // OS-level permission dialog only — safe to call before login (no API calls).
    const requestNotificationPermissionOnly = async () => {
        try {
            if (Platform.OS === 'android' && Platform.Version >= 33) {
                await PermissionsAndroid.request(
                    PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
                );
            }
            await messaging().requestPermission();
        } catch (e) {
            console.log('[Permissions] Notification permission request failed:', e);
        }
    };

    const requestNotificationPermission = async () => {
        try {
            if (Platform.OS === 'android' && Platform.Version >= 33) {
                const granted = await PermissionsAndroid.request(
                    PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
                );
                if (granted !== PermissionsAndroid.RESULTS.GRANTED) return;
            }

            const authStatus = await messaging().requestPermission();
            const enabled =
                authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
                authStatus === messaging.AuthorizationStatus.PROVISIONAL;

            if (enabled) {
                const fcmToken = await messaging().getToken();
                if (fcmToken) {
                    await api.put('/notifications/fcm-token/patient', { fcmToken });
                    console.log('[FCM] Token registered:', fcmToken);
                }
            }
        } catch (e) {
            console.log("[FCM] Registry Error:", e);
        }
    };

    const requestLocationPermission = async () => {
        try {
            const current = await Location.getForegroundPermissionsAsync();
            if (current.granted) return;
            if (!current.canAskAgain && current.status === 'denied') {
                Alert.alert(
                    'Location Permission Needed',
                    'Please enable location permission from app settings to continue.',
                    [{ text: 'OK' }]
                );
                return;
            }

            const requested = await Location.requestForegroundPermissionsAsync();
            if (!requested.granted && !requested.canAskAgain) {
                Alert.alert(
                    'Location Permission Needed',
                    'Location access is blocked. Please enable it from app settings.',
                    [{ text: 'OK' }]
                );
            }
        } catch (e) {
            console.log('[Location] permission request failed:', e);
        }
    };

    const syncLocationCache = async (requestIfNeeded: boolean) => {
        try {
            const permission = requestIfNeeded
                ? await Location.requestForegroundPermissionsAsync()
                : await Location.getForegroundPermissionsAsync();

            if (permission.status !== 'granted') return;

            let pos = await Location.getLastKnownPositionAsync({
                maxAge: LOCATION_SYNC_INTERVAL_MS,
                requiredAccuracy: 500,
            });

            if (!pos) {
                pos = await Location.getCurrentPositionAsync({
                    accuracy: Location.Accuracy.Balanced,
                    mayShowUserSettingsDialog: true,
                });
            }

            const geocoded = await Location.reverseGeocodeAsync({
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
            });
            const geo = geocoded?.[0];

            const city = geo?.city || geo?.region || 'Your City';
            const area = geo?.district || geo?.subregion || geo?.street || '';

            await AsyncStorage.multiSet([
                [LAST_CITY_KEY, city],
                [LAST_AREA_KEY, area],
                [LAST_LOCATION_SYNC_TS_KEY, String(Date.now())],
            ]);
        } catch (e) {
            console.log('[Location] sync failed:', e);
        }
    };

    useEffect(() => {
        if (isAuthenticated) {
            // Ask location + notification permissions after login.
            requestNotificationPermissionOnly();
            requestLocationPermission();
            // Register FCM token for authenticated users.
            requestNotificationPermission();

            const unsubscribe = messaging().onMessage(async remoteMessage => {
                console.log('[FCM] Foreground message received:', remoteMessage);
                const title = remoteMessage.notification?.title || "A1Care";
                const body = remoteMessage.notification?.body || "You have a new notification";
                await notificationsService.addLocalNotification({
                    title,
                    body,
                    refType: (remoteMessage.data?.refType as string) || 'Broadcast',
                    data: remoteMessage.data as Record<string, string> | undefined,
                });
                Alert.alert(
                    title,
                    body,
                    [
                        {
                            text: "View",
                            onPress: () => {
                                if (remoteMessage.data?.screen) {
                                    router.push(remoteMessage.data.screen as any);
                                }
                            }
                        },
                        { text: "Dismiss", style: "cancel" }
                    ]
                );
            });

            messaging().onNotificationOpenedApp(remoteMessage => {
                console.log('[FCM] Notification opened app:', remoteMessage.notification);
                if (remoteMessage.data?.screen) {
                    router.push(remoteMessage.data.screen as any);
                }
            });

            messaging()
                .getInitialNotification()
                .then(remoteMessage => {
                    if (remoteMessage) {
                        console.log('[FCM] App opened from quit state:', remoteMessage.notification);
                        if (remoteMessage.data?.screen) {
                            setTimeout(() => {
                                router.push(remoteMessage.data?.screen as any);
                            }, 500);
                        }
                    }
                });

            return unsubscribe;
        }
    }, [isAuthenticated]);

    useEffect(() => {
        // Fresh users: ask again when registration is completed and they enter app screens.
        const currentSegment = (segments as string[])[0];
        const inTabs = currentSegment === '(tabs)';
        if (!isAuthenticated || !user?.isRegistered || !inTabs) return;

        // Small delay to let the screen transition finish
        const timer = setTimeout(() => {
            requestNotificationPermissionOnly();
            requestLocationPermission();
            requestNotificationPermission();
        }, 1000);

        return () => clearTimeout(timer);
    }, [isAuthenticated, user?.isRegistered, segments]);

    useEffect(() => {
        if (!isAuthenticated) return;

        let timer: ReturnType<typeof setInterval> | undefined;
        let active = true;

        const bootstrapLocationSync = async () => {
            const raw = await AsyncStorage.getItem(LAST_LOCATION_SYNC_TS_KEY);
            const lastTs = raw ? Number(raw) : 0;
            const shouldRefresh = !lastTs || Number.isNaN(lastTs) || (Date.now() - lastTs >= LOCATION_SYNC_INTERVAL_MS);

            // Ask on app entry once (if not granted yet), else sync silently.
            await syncLocationCache(shouldRefresh);

            if (!active) return;
            timer = setInterval(() => {
                syncLocationCache(false);
            }, LOCATION_SYNC_INTERVAL_MS);
        };

        bootstrapLocationSync();

        return () => {
            active = false;
            if (timer) clearInterval(timer);
        };
    }, [isAuthenticated]);

    useEffect(() => {
        if (!isAuthenticated) return;
        return messaging().onTokenRefresh(fcmToken => {
            if (fcmToken) {
                api.put('/notifications/fcm-token/patient', { fcmToken });
                console.log('[FCM] Token refreshed:', fcmToken);
            }
        });
    }, [isAuthenticated]);

    useEffect(() => {
        console.log('[AuthGuard] State Changed:', { isAuthenticated, isLoading, segments, maintenance: config?.maintenanceMode });
        if (isLoading) return;

        const isMaintenancePage = (segments as string[])[0] === 'maintenance';
        if (config?.maintenanceMode) {
            if (!isMaintenancePage) {
                console.log('[AuthGuard] Redirecting to maintenance');
                router.replace('/maintenance' as any);
            }
            return;
        } else if (isMaintenancePage) {
            router.replace('/' as any);
            return;
        }

        const currentSegment = (segments as string[])[0];
        const isAtRoot = !segments.length || currentSegment === 'index';
        const inAuthGroup = currentSegment === '(auth)';
        const excludedSegments = ['(auth)', 'privacy', 'terms', 'faq'];
        const isExcluded = excludedSegments.includes(currentSegment);

        if (!isAuthenticated && !isExcluded) {
            router.replace('/(auth)/login');
        } else if (isAuthenticated && user && (inAuthGroup || isAtRoot)) {
            // If registered go to tabs; else go to profile setup
            if (user.isRegistered) {
                console.log('[AuthGuard] Redirecting to tabs');
                router.replace('/(tabs)');
            } else {
                console.log('[AuthGuard] Redirecting to profile-setup');
                router.replace('/(auth)/profile-setup');
            }
        }
    }, [isAuthenticated, isLoading, user, segments, config?.maintenanceMode]);

    if (isLoading) {
        console.log('[AuthGuard] Rendering Loading State');
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.primary || '#2F80ED' }}>
                <ActivityIndicator size="large" color="#fff" />
            </View>
        );
    }

    console.log('[AuthGuard] Rendering Children');
    return <>{children}</>;
}

export default function RootLayout() {
    console.log('[RootLayout] Starting...');
    const [fontsLoaded] = useFonts({
        Inter_400Regular,
        Inter_500Medium,
        Inter_600SemiBold,
        Inter_700Bold,
    });

    if (!fontsLoaded) {
        console.log('[RootLayout] Fonts NOT Loaded');
        return (
            <View style={{ flex: 1, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#fff" />
            </View>
        );
    }

    console.log('[RootLayout] Fonts Loaded, Rendering Providers');
    return (
        <>
            <GestureHandlerRootView style={{ flex: 1 }}>
                <AuthGuard>
                    <Stack
                        screenOptions={{
                            headerShown: false,
                            animation: 'slide_from_right',
                            contentStyle: { backgroundColor: Colors.background },
                        }}
                    >
                        <Stack.Screen name="(auth)" />
                        <Stack.Screen name="(tabs)" />
                        <Stack.Screen
                            name="service/[id]"
                            options={{
                                animation: 'slide_from_right',
                                animationDuration: 220,
                                contentStyle: { backgroundColor: Colors.background },
                            }}
                        />
                        <Stack.Screen name="doctor/[id]" />
                        <Stack.Screen name="booking/[id]" />
                        <Stack.Screen name="booking/chat" />
                        <Stack.Screen name="booking/track" />
                        <Stack.Screen name="doctor/appointment/[id]" />
                        <Stack.Screen name="wallet/index" />
                        <Stack.Screen name="checkout/easebuzz" />
                        <Stack.Screen name="support/chat" />
                        <Stack.Screen name="profile/health-vault" />
                        <Stack.Screen name="faq" />
                        <Stack.Screen name="privacy" />
                        <Stack.Screen name="terms" />
                        <Stack.Screen name="maintenance" />
                    </Stack>
                </AuthGuard>
            </GestureHandlerRootView>
            <Toast />
        </>
    );
}
