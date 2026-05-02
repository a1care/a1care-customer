import { create } from 'zustand';
import { notificationsService } from '@/services/notifications.service';

interface NotificationState {
    unreadCount: number;
    isLoading: boolean;
    fetchUnreadCount: () => Promise<void>;
    setUnreadCount: (count: number) => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
    unreadCount: 0,
    isLoading: false,
    fetchUnreadCount: async () => {
        try {
            const data = await notificationsService.getAll(1);
            set({ unreadCount: data.unreadCount ?? 0 });
        } catch (error) {
            console.error('[NotificationStore] Fetch Error:', error);
        }
    },
    setUnreadCount: (count: number) => set({ unreadCount: count }),
}));
