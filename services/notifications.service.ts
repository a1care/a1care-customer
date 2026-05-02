import api from './api';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Notification {
    _id: string;
    title: string;
    body: string;
    refType?: string;
    isRead: boolean;
    createdAt: string;
    data?: Record<string, string>;
}

export interface NotificationsResponse {
    notifications: Notification[];
    unreadCount: number;
    total: number;
    page: number;
    pages: number;
}

const LOCAL_NOTIFICATIONS_KEY = 'local_notifications_v1';
const LOCAL_NOTIFICATION_LIMIT = 50;
const LOCAL_DUPLICATE_WINDOW_MS = 2 * 60 * 1000;

const isRealId = (id?: string) => !!id && !String(id).startsWith('local-');

export const notificationsService = {
    /**
     * GET /notifications
     * Returns paginated notifications for the logged-in patient.
     * Backend: GET /api/notifications
     */
    getAll: async (page = 1): Promise<NotificationsResponse> => {
        const res = await api.get(`/notifications?page=${page}&limit=30`);
        return res.data.data;
    },

    /**
     * PUT /notifications/:id/read
     * Marks a single notification as read.
     * Backend: PUT /api/notifications/:id/read
     */
    markRead: async (id: string): Promise<void> => {
        await api.put(`/notifications/${id}/read`);
    },

    /**
     * PUT /notifications/read-all
     * Marks ALL unread notifications as read.
     * Backend: PUT /api/notifications/read-all
     */
    markAllRead: async (): Promise<void> => {
        await api.put('/notifications/read-all');
    },

    /**
     * DELETE /notifications/clear-all
     * Deletes all notifications for the user.
     */
    clearAll: async (): Promise<void> => {
        await api.delete('/notifications/clear-all');
    },

    getLocalNotifications: async (): Promise<Notification[]> => {
        try {
            const raw = await AsyncStorage.getItem(LOCAL_NOTIFICATIONS_KEY);
            const parsed = raw ? JSON.parse(raw) : [];
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    },

    addLocalNotification: async (payload: Partial<Notification> & { title: string; body: string }): Promise<void> => {
        const current = await notificationsService.getLocalNotifications();
        const now = new Date().toISOString();
        const normalizedTitle = String(payload.title || '').trim().toLowerCase();
        const normalizedBody = String(payload.body || '').trim().toLowerCase();
        const normalizedRefType = String(payload.refType || 'Broadcast').trim().toLowerCase();
        const incomingTs = payload.createdAt ? new Date(payload.createdAt).getTime() : Date.now();

        // Prevent duplicate local inserts for the same event in a short time window.
        const hasRecentDuplicate = current.some((n) => {
            const sameTitle = String(n.title || '').trim().toLowerCase() === normalizedTitle;
            const sameBody = String(n.body || '').trim().toLowerCase() === normalizedBody;
            const sameRefType = String(n.refType || '').trim().toLowerCase() === normalizedRefType;
            const nTs = new Date(n.createdAt).getTime();
            const closeInTime = Number.isFinite(nTs) && Math.abs(incomingTs - nTs) <= LOCAL_DUPLICATE_WINDOW_MS;
            return sameTitle && sameBody && sameRefType && closeInTime;
        });
        if (hasRecentDuplicate) return;

        const localItem: Notification = {
            _id: `local-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
            title: payload.title,
            body: payload.body,
            refType: payload.refType ?? 'Broadcast',
            isRead: false,
            createdAt: payload.createdAt ?? now,
            data: payload.data ?? {},
        };
        const merged = [localItem, ...current].slice(0, LOCAL_NOTIFICATION_LIMIT);
        await AsyncStorage.setItem(LOCAL_NOTIFICATIONS_KEY, JSON.stringify(merged));
    },

    markLocalRead: async (id: string): Promise<void> => {
        if (isRealId(id)) return;
        const current = await notificationsService.getLocalNotifications();
        const updated = current.map((n) => (n._id === id ? { ...n, isRead: true } : n));
        await AsyncStorage.setItem(LOCAL_NOTIFICATIONS_KEY, JSON.stringify(updated));
    },

    markAllLocalRead: async (): Promise<void> => {
        const current = await notificationsService.getLocalNotifications();
        if (!current.length) return;
        const updated = current.map((n) => ({ ...n, isRead: true }));
        await AsyncStorage.setItem(LOCAL_NOTIFICATIONS_KEY, JSON.stringify(updated));
    },

    clearLocalNotifications: async (): Promise<void> => {
        await AsyncStorage.removeItem(LOCAL_NOTIFICATIONS_KEY);
    },
};
