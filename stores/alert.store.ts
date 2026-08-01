import { create } from 'zustand';

export type AlertType = 'success' | 'error' | 'info' | 'warning';

export interface AlertAction {
    text: string;
    onPress?: () => void;
    style?: 'default' | 'cancel' | 'destructive';
}

interface AlertState {
    isOpen: boolean;
    title: string;
    message: string;
    type: AlertType;
    actions: AlertAction[];
    cancelable: boolean;
    show: (options: {
        title: string;
        message: string;
        type?: AlertType;
        actions?: AlertAction[];
        cancelable?: boolean;
    }) => void;
    hide: () => void;
}

export const useAlertStore = create<AlertState>((set) => ({
    isOpen: false,
    title: '',
    message: '',
    type: 'info',
    actions: [],
    cancelable: true,
    show: (options) => set({
        isOpen: true,
        title: options.title,
        message: options.message,
        type: options.type || 'info',
        actions: options.actions || [{ text: 'OK', style: 'default' }],
        cancelable: options.cancelable ?? true,
    }),
    hide: () => set({ isOpen: false }),
}));

// Helper object for easy usage outside React components
export const CustomAlert = {
    show: (title: string, message: string, actions?: AlertAction[], options?: { type?: AlertType; cancelable?: boolean }) => {
        useAlertStore.getState().show({
            title,
            message,
            actions,
            ...options
        });
    },
    hide: () => {
        useAlertStore.getState().hide();
    }
};
