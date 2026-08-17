import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Patient } from '@/types';
import { authService } from '@/services/auth.service';

interface AuthState {
    token: string | null;
    user: Patient | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    isInitialized: boolean;
    hasSeenOnboarding: boolean;
    postLoginReturn: { pathname: string; params?: Record<string, string> } | null;

    setToken: (token: string) => void;
    setUser: (user: Patient) => void;
    setPostLoginReturn: (destination: { pathname: string; params?: Record<string, string> } | null) => void;
    setHasSeenOnboarding: (val: boolean) => Promise<void>;
    initialize: () => Promise<void>;
    logout: () => Promise<void>;
}

let _isInitializing = false;

export const useAuthStore = create<AuthState>((set, get) => ({
    token: null,
    user: null,
    isAuthenticated: false,
    isLoading: false,
    isInitialized: false,
    hasSeenOnboarding: false,
    postLoginReturn: null,

    setToken: (token) => set({ token, isAuthenticated: true }),
    setUser: (user) => set({ user }),
    setPostLoginReturn: (destination) => set({ postLoginReturn: destination }),

    initialize: async () => {
        if (get().isInitialized || _isInitializing) return;
        _isInitializing = true;
        
        try {
            // Safely read from AsyncStorage without throwing
            const onboardingDone = await AsyncStorage.getItem('onboarding_done').catch(() => null);
            set({ hasSeenOnboarding: onboardingDone === 'true' });

            const token = await authService.getToken();
            if (token) {
                if (__DEV__) console.log('[AuthStore] Pre-existing token found, verifying...');
                const user = await authService.getProfile();
                set({ token, user, isAuthenticated: true });
                if (__DEV__) console.log('[AuthStore] Verification Success');
            } else {
                set({ isAuthenticated: false });
                if (__DEV__) console.log('[AuthStore] No token found');
            }
        } catch (error: any) {
            if (__DEV__) console.log('[AuthStore] Verification Failed — clearing session', error.message);
            // Safely establish fallback defaults
            await authService.logout().catch(() => {});
            set({ token: null, user: null, isAuthenticated: false });
        } finally {
            _isInitializing = false;
            set({ isInitialized: true, isLoading: false });
        }
    },

    logout: async () => {
        await authService.logout();
        set({ token: null, user: null, isAuthenticated: false, postLoginReturn: null });
        // Clear React Query cache so next user doesn't see stale data
        // We can't access the QueryClient instance here, but components handle this via useFocusEffect refetch
    },

    setHasSeenOnboarding: async (val: boolean) => {
        await AsyncStorage.setItem('onboarding_done', val ? 'true' : 'false');
        set({ hasSeenOnboarding: val });
    },
}));
