import { create } from 'zustand';
import type { Patient } from '@/types';
import { authService } from '@/services/auth.service';

interface AuthState {
    token: string | null;
    user: Patient | null;
    isAuthenticated: boolean;
    isLoading: boolean;

    setToken: (token: string) => void;
    setUser: (user: Patient) => void;
    initialize: () => Promise<void>;
    logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
    token: null,
    user: null,
    isAuthenticated: false,
    isLoading: true,

    setToken: (token) => set({ token, isAuthenticated: true }),
    setUser: (user) => set({ user }),

    initialize: async () => {
        set({ isLoading: true });
        try {
            const token = await authService.getToken();
            if (token) {
                console.log('[AuthStore] Pre-existing token found, verifying...');
                const user = await authService.getProfile();
                set({ token, user, isAuthenticated: true });
                console.log('[AuthStore] Verification Success');
            } else {
                set({ isAuthenticated: false });
                console.log('[AuthStore] No token found');
            }
        } catch (error: any) {
            console.log('[AuthStore] Verification Failed — clearing session', error.message);
            await authService.logout();
            set({ token: null, user: null, isAuthenticated: false });
        } finally {
            set({ isLoading: false });
        }
    },

    logout: async () => {
        await authService.logout();
        set({ token: null, user: null, isAuthenticated: false });
    },
}));
