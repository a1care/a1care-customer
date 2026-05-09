import { Tabs } from 'expo-router';
import { View, Text, StyleSheet, Platform } from 'react-native';
import React, { useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Shadows } from '@/constants/colors';
import { useNotificationStore } from '@/stores/notification.store';
import { QueryProvider } from '@/providers/QueryProvider';

interface TabIconProps {
    focused: boolean;
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    isCenter?: boolean;
}

function TabIcon({ focused, icon, label, isCenter }: TabIconProps) {
    if (isCenter) {
        return (
            <View style={styles.centerTabWrapper}>
                <View style={[styles.centerTab, Shadows.float]}>
                    <Ionicons name={focused ? icon : icon} size={28} color="#FFF" />
                </View>
            </View>
        );
    }

    return (
        <View style={styles.tabItem}>
            <Ionicons
                name={focused ? icon : (`${icon}-outline` as any)}
                size={23}
                color={focused ? Colors.primary : '#94A3B8'}
            />
            <Text style={[styles.tabLabel, focused && styles.tabLabelActive]} numberOfLines={1}>
                {label}
            </Text>
        </View>
    );
}


export default function TabsLayout() {
    const { unreadCount, fetchUnreadCount } = useNotificationStore();

    useEffect(() => {
        fetchUnreadCount();
        const interval = setInterval(fetchUnreadCount, 90000);
        return () => clearInterval(interval);
    }, []);

    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarStyle: styles.tabBar,
                tabBarShowLabel: false,
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
                        // Reset params when clicking the tab to show all services
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
                        <TabIcon focused={focused} icon="notifications" label="Alerts" />
                    ),
                    // Show red dot if unread
                    tabBarBadge: unreadCount > 0 ? '' : undefined,
                    tabBarBadgeStyle: {
                        backgroundColor: '#EF4444',
                        transform: [{ scale: 0.6 }],
                        marginTop: 2,
                    }
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
        bottom: 0,
        left: 12,
        right: 12,
        backgroundColor: '#FFFFFF',
        borderRadius: 32,
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
        height: 68,
        borderTopWidth: 0,
        ...Shadows.float,
        elevation: 12,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 10,
        paddingBottom: 0,
    },
    tabItem: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 10,
        minWidth: 60,
    },
    centerTabWrapper: {
        top: -15,
        justifyContent: 'center',
        alignItems: 'center',
    },
    centerTab: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: Colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 4,
        borderColor: '#FFF',
    },
    tabLabel: {
        fontSize: 10,
        color: '#94A3B8',
        fontWeight: '600',
        marginTop: 4,
    },
    tabLabelActive: {
        color: Colors.primary,
        fontWeight: '800',
    },
});
