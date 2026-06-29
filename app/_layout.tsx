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
import { ActivityIndicator, View, Image, Text, Animated } from 'react-native';
import { Colors } from '@/constants/colors';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Alert, Platform } from 'react-native';
import Toast from 'react-native-toast-message';
import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});
import api from '@/services/api';
import { notificationsService } from '@/services/notifications.service';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LAST_CITY_KEY = 'last_city';
const LAST_AREA_KEY = 'last_area';
const LAST_LOCATION_SYNC_TS_KEY = 'last_location_sync_ts';
const LOCATION_SYNC_INTERVAL_MS = 5 * 60 * 1000;


function AuthGuard({ children }: { children: React.ReactNode }) {
    const { isAuthenticated, isLoading, user, initialize, postLoginReturn, setPostLoginReturn } = useAuthStore();
    const { fetchConfig, config } = useConfigStore();
    const router = useRouter();
    const segments = useSegments();
    const [hasRequestedPostLoginPermissions, setHasRequestedPostLoginPermissions] = React.useState(false);
    const [onboardingChecked, setOnboardingChecked] = React.useState(false);
    const [onboardingDone, setOnboardingDone] = React.useState(false);
    const [routerReady, setRouterReady] = React.useState(false);

    useEffect(() => {
        initialize();
        fetchConfig();
        AsyncStorage.getItem('onboarding_done').then(done => {
            setOnboardingDone(!!done);
            setOnboardingChecked(true);
        });
    }, []);


    // OS-level permission dialog only — safe to call before login (no API calls).
    const requestNotificationPermissionOnly = async () => {
        try {
            await Notifications.requestPermissionsAsync();
        } catch (e) {
            if (__DEV__) console.log('[Permissions] Notification permission request failed:', e);
        }
    };

    const requestNotificationPermission = async () => {
        try {
            const { status } = await Notifications.requestPermissionsAsync();
            if (status !== 'granted') return;

            const tokenData = await Notifications.getDevicePushTokenAsync();
            const fcmToken = tokenData.data;
            if (fcmToken) {
                await api.put('/notifications/fcm-token/patient', { fcmToken });
            }
        } catch (e) {
            if (__DEV__) console.log("[FCM] Registry Error:", e);
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
            if (__DEV__) console.log('[Location] permission request failed:', e);
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
            if (__DEV__) console.log('[Location] sync failed:', e);
        }
    };

    useEffect(() => {
        if (!isAuthenticated) return;

        // Foreground notification handler
        const foregroundSub = Notifications.addNotificationReceivedListener(async notification => {
            const title = notification.request.content.title || "A1Care";
            const body = notification.request.content.body || "You have a new notification";
            const data = notification.request.content.data as Record<string, string> | undefined;
            await notificationsService.addLocalNotification({
                title,
                body,
                refType: (data?.refType as string) || 'Broadcast',
                data,
            });
        });

        // Notification tap handler (app in background/foreground)
        const ALLOWED_SCREENS = [
            '/(tabs)/bookings', '/(tabs)/notifications', '/(tabs)/profile',
            '/wallet/index', '/wallet_history', '/booking/', '/doctor/appointment/',
        ];
        const responseSub = Notifications.addNotificationResponseReceivedListener(response => {
            const data = response.notification.request.content.data as Record<string, string> | undefined;
            if (data?.screen && ALLOWED_SCREENS.some(s => (data.screen as string).startsWith(s))) {
                router.push(data.screen as any);
            }
        });

        return () => {
            foregroundSub.remove();
            responseSub.remove();
        };
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
        if (!isAuthenticated || !user?.isRegistered) {
            setHasRequestedPostLoginPermissions(false);
        }
    }, [isAuthenticated, user?.isRegistered]);

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
        // Re-register push token on refresh (e.g. after app reinstall)
        const tokenSub = Notifications.addPushTokenListener(({ data: fcmToken }) => {
            if (fcmToken) api.put('/notifications/fcm-token/patient', { fcmToken });
        });
        return () => tokenSub.remove();
    }, [isAuthenticated]);

    useEffect(() => {
        if (isLoading || !onboardingChecked) return;

        const isMaintenancePage = (segments as string[])[0] === 'maintenance';
        if (config?.maintenanceMode) {
            if (!isMaintenancePage) {
                router.replace('/maintenance' as any);
            }
            setRouterReady(true); // don't leave splash stuck
            return;
        } else if (isMaintenancePage) {
            router.replace('/' as any);
            setRouterReady(true);
            return;
        }

        const currentSegment = (segments as string[])[0];
        const isAtRoot = !segments.length || currentSegment === 'index';
        const inAuthGroup = currentSegment === '(auth)';
        const excludedSegments = ['(auth)', 'privacy', 'terms', 'faq', 'index', '(tabs)', 'service'];
        // Treat unresolved route (empty segments) as excluded to avoid premature redirect
        const isExcluded = !segments.length || excludedSegments.includes(currentSegment);

        if (!isAuthenticated && !isExcluded) {
            // Unauthenticated users always land on tabs to browse freely (Apple 5.1.1)
            router.replace('/(tabs)');
            setRouterReady(true); // don't leave splash stuck
            return;
        }

        if (!isAuthenticated && isAtRoot) {
            // If onboarding already seen, skip to tabs. Otherwise show onboarding.
            if (onboardingDone) {
                router.replace('/(tabs)');
            } else {
                setRouterReady(true);
            }
            return;
        } else if (isAuthenticated && user && (inAuthGroup || isAtRoot)) {
            // If registered go to tabs (or back to service if returning from guest checkout); else profile setup
            if (user.isRegistered) {
                const run = async () => {
                    if (!hasRequestedPostLoginPermissions) {
                        await requestNotificationPermissionOnly();
                        await requestLocationPermission();
                        await requestNotificationPermission();
                        setHasRequestedPostLoginPermissions(true);
                    }
                    const dest = useAuthStore.getState().postLoginReturn;
                    if (dest) {
                        useAuthStore.getState().setPostLoginReturn(null);
                        router.replace(dest as any);
                    } else {
                        router.replace('/(tabs)');
                    }
                };
                run();
            } else {
                router.replace('/(auth)/profile-setup');
            }
        }

        setRouterReady(true);
    }, [isAuthenticated, isLoading, user, segments, config?.maintenanceMode, hasRequestedPostLoginPermissions, onboardingDone, onboardingChecked]);

    const showSplash = isLoading || !onboardingChecked || !routerReady;

    const scaleAnim = React.useRef(new Animated.Value(0.75)).current;
    const opacityAnim = React.useRef(new Animated.Value(0)).current;

    React.useEffect(() => {
        if (showSplash) {
            scaleAnim.setValue(0.75);
            opacityAnim.setValue(0);
            Animated.parallel([
                Animated.spring(scaleAnim, {
                    toValue: 1,
                    friction: 5,
                    tension: 60,
                    useNativeDriver: true,
                }),
                Animated.timing(opacityAnim, {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: true,
                }),
            ]).start();
        }
    }, [showSplash]);

    return (
        <>
            {children}
            {showSplash && (
                <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#FFFFFF', zIndex: 9999, justifyContent: 'center', alignItems: 'center' }}>
                    <Animated.View style={{ alignItems: 'center', transform: [{ scale: scaleAnim }], opacity: opacityAnim }}>
                        <Image
                            source={require('../assets/splash-icon.png')}
                            style={{ width: 220, height: 220, resizeMode: 'contain', marginBottom: 24 }}
                        />
                        <Text style={{ fontSize: 36, fontWeight: '900' }}>
                            <Text style={{ color: '#1A7FD4' }}>A1</Text>
                            <Text style={{ color: '#27AE60' }}>Care</Text>
                            <Text style={{ color: '#1A7FD4' }}> 24/7</Text>
                        </Text>
                        <Text style={{ fontSize: 14, color: '#888', marginTop: 8, letterSpacing: 1 }}>Healthcare at Your Doorstep</Text>
                    </Animated.View>
                    <ActivityIndicator size="large" color="#1A7FD4" style={{ position: 'absolute', bottom: 80 }} />
                </View>
            )}
        </>
    );
}

export default function RootLayout() {
    useFonts({
        Inter_400Regular,
        Inter_500Medium,
        Inter_600SemiBold,
        Inter_700Bold,
    });

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
