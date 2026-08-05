import { Tabs } from 'expo-router';
import { View, Text, StyleSheet, Platform } from 'react-native';
import React, { useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Shadows } from '@/constants/colors';
import { useNotificationStore } from '@/stores/notification.store';
import { QueryProvider } from '@/providers/QueryProvider';
import { LinearGradient } from 'expo-linear-gradient';
import { InteractionManager } from 'react-native';

interface TabIconProps {
    focused: boolean;
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    isCenter?: boolean;
    badge?: number;
}

function TabIcon({ focused, icon, label, isCenter, badge }: TabIconProps) {
    if (isCenter) {
        return (
            <View style={styles.centerTabWrapper}>
                <LinearGradient
                    colors={focused ? ['#0B3370', '#2563EB'] : ['#1A5FAD', '#0B3370']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.centerTab}
                >
                    <Ionicons name={icon} size={26} color="#FFF" />
                </LinearGradient>
                {/* outer glow ring when focused */}
                {focused && <View style={styles.centerTabGlow} />}
            </View>
        );
    }

    return (
        <View style={styles.tabItem}>
            {/* Active indicator pill */}
            {focused && <View style={styles.activePill} />}

            <View style={styles.tabIconWrap}>
                <Ionicons
                    name={focused ? icon : (`${icon}-outline` as any)}
                    size={22}
                    color={focused ? '#0B3370' : '#94A3B8'}
                />
                {/* Notification badge */}
                {!!badge && badge > 0 && (
                    <View style={styles.badge}>
                        <Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
                    </View>
                )}
            </View>

            <Text style={[styles.tabLabel, focused && styles.tabLabelActive]} numberOfLines={1}>
                {label}
            </Text>
        </View>
    );
}

export default function TabsLayout() {
    const { unreadCount, fetchUnreadCount } = useNotificationStore();

    useEffect(() => {
        const task = InteractionManager.runAfterInteractions(() => {
            fetchUnreadCount();
        });
        const interval = setInterval(fetchUnreadCount, 90000);
        return () => {
            task.cancel();
            clearInterval(interval);
        };
    }, []);

    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarStyle: styles.tabBar,
                tabBarShowLabel: false,
                freezeOnBlur: true,
            }}
        >
            <Tabs.Screen
                name="index"
                options={{
                    tabBarIcon: ({ focused }) => (
                        <TabIcon focused={focused} icon="home" label="Home" />
                    ),
                }}
            />
            <Tabs.Screen
                name="services"
                options={{
                    tabBarIcon: ({ focused }) => (
                        <TabIcon focused={focused} icon="medical" label="Services" />
                    ),
                }}
                listeners={({ navigation }) => ({
                    tabPress: (e) => {
                        if (!navigation.isFocused()) return;
                        e.preventDefault();
                        navigation.navigate('services', {
                            category: '',
                            serviceId: '',
                            subServiceId: '',
                            from: ''
                        });
                    },
                })}
            />
            <Tabs.Screen
                name="bookings"
                options={{
                    tabBarIcon: ({ focused }) => (
                        <TabIcon focused={focused} icon="calendar" label="Bookings" isCenter />
                    ),
                }}
            />
            <Tabs.Screen
                name="notifications"
                options={{
                    tabBarIcon: ({ focused }) => (
                        <TabIcon
                            focused={focused}
                            icon="notifications"
                            label="Alerts"
                            badge={unreadCount}
                        />
                    ),
                    // Keep the native badge hidden — we render our own
                    tabBarBadge: undefined,
                }}
            />
            <Tabs.Screen
                name="profile"
                options={{
                    tabBarIcon: ({ focused }) => (
                        <TabIcon focused={focused} icon="person" label="Profile" />
                    ),
                }}
            />
        </Tabs>
    );
}

const styles = StyleSheet.create({
    tabBar: {
        position: 'absolute',
        bottom: Platform.OS === 'ios' ? 24 : 12,
        left: 16,
        right: 16,
        backgroundColor: '#FFFFFF',
        borderRadius: 32,
        height: 72,
        borderTopWidth: 0,
        shadowColor: '#0A1A3A',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.10,
        shadowRadius: 24,
        elevation: 18,
        paddingBottom: 0,
    },

    tabItem: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 8,
        minWidth: 56,
        position: 'relative',
    },

    activePill: {
        position: 'absolute',
        top: 0,
        width: 28,
        height: 3,
        borderRadius: 2,
        backgroundColor: '#0B3370',
    },

    tabIconWrap: {
        position: 'relative',
        alignItems: 'center',
        justifyContent: 'center',
        width: 32,
        height: 32,
    },

    badge: {
        position: 'absolute',
        top: -4,
        right: -8,
        backgroundColor: '#EF4444',
        borderRadius: 9,
        minWidth: 17,
        height: 17,
        paddingHorizontal: 3,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: '#FFFFFF',
    },
    badgeText: {
        color: '#fff',
        fontSize: 9,
        fontWeight: '900',
        includeFontPadding: false,
    },

    tabLabel: {
        fontSize: 10,
        color: '#94A3B8',
        fontWeight: '600',
        marginTop: 3,
        letterSpacing: 0.2,
    },
    tabLabelActive: {
        color: '#0B3370',
        fontWeight: '900',
    },

    // Center booking FAB
    centerTabWrapper: {
        top: -22,
        alignItems: 'center',
        justifyContent: 'center',
    },
    centerTab: {
        width: 64,
        height: 64,
        borderRadius: 32,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 4,
        borderColor: '#FFFFFF',
        shadowColor: '#0B3370',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.35,
        shadowRadius: 16,
        elevation: 12,
    },
    centerTabGlow: {
        position: 'absolute',
        width: 76,
        height: 76,
        borderRadius: 38,
        borderWidth: 2,
        borderColor: 'rgba(37, 99, 235, 0.2)',
    },
});
