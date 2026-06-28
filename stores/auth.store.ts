import { create } from 'zustand';
import type { Patient } from '@/types';
import { authService } from '@/services/auth.service';

interface AuthState {
    token: string | null;
    user: Patient | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    postLoginReturn: { pathname: string; params?: Record<string, string> } | null;

    setToken: (token: string) => void;
    setUser: (user: Patient) => void;
    setPostLoginReturn: (destination: { pathname: string; params?: Record<string, string> } | null) => void;
    initialize: () => Promise<void>;
    logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
    token: null,
    user: null,
    isAuthenticated: false,
    isLoading: true,
    postLoginReturn: null,

    setToken: (token) => set({ token, isAuthenticated: true }),
    setUser: (user) => set({ user }),
    setPostLoginReturn: (destination) => set({ postLoginReturn: destination }),

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
        set({ token: null, user: null, isAuthenticated: false, postLoginReturn: null });
        // Clear React Query cache so next user doesn't see stale data
        const { QueryClient } = await import('@tanstack/react-query');
        // We can't access the QueryClient instance here, but components handle this via useFocusEffect refetch
    },
}));
