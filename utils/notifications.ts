import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { notificationsService } from '@/services/notifications.service';

// Configure how notifications are handled when the app is in the foreground
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

export const triggerLocalNotification = async (title: string, body: string) => {
    try {
        await notificationsService.addLocalNotification({
            title,
            body,
            refType: 'Broadcast',
        });

        const { status } = await Notifications.getPermissionsAsync();
        if (status !== 'granted') {
            const { status: newStatus } = await Notifications.requestPermissionsAsync();
            if (newStatus !== 'granted') return;
        }

        await Notifications.scheduleNotificationAsync({
            content: {
                title,
                body,
                data: { data: 'goes here' },
                sound: true,
            },
            trigger: null, // show immediately
        });
    } catch (error) {
        console.error('Error triggering local notification:', error);
    }
};
