import axios from 'axios';
import { tokenStorage } from '@/utils/storage';
import { API_BASE_URL } from '@/constants/api';

const DEBUG_API = __DEV__;

const api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 15000,
    headers: {
        'Content-Type': 'application/json',
    },
});

let isRefreshing = false;
let failedQueue: Array<{
    resolve: (token: string) => void;
    reject: (error: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
    failedQueue.forEach(prom => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve(token as string);
        }
    });
    failedQueue = [];
};

// ── Request interceptor — Auth & Logging ──
api.interceptors.request.use(
    async (config) => {
        const token = await tokenStorage.getItem('auth_token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        // Idempotency-Key header removed — backend does not enforce it, so the
        // header created a false sense of safety without any actual protection.
        // Real idempotency is handled atomically in the DB (findOneAndUpdate guards).
        if (DEBUG_API) {
            const fullUrl = `${config.baseURL || ''}${config.url || ''}`;
            console.log(`\n🚀 [API Request] ${config.method?.toUpperCase()} ${config.url}`);
            console.log(`🌐 [API BaseURL] ${config.baseURL}`);
            console.log(`🔗 [API Full URL] ${fullUrl}`);
            if (config.data) console.log(`📦 Body:`, JSON.stringify(config.data, null, 2));
        }
        return config;
    },
    (error) => {
        if (DEBUG_API) console.error(`❌ [API Request Error]`, error);
        return Promise.reject(error);
    }
);

// ── Response interceptor — Logging & 401 Handle ──
api.interceptors.response.use(
    (response) => {
        if (DEBUG_API) console.log(`✅ [API Success] ${response.config.url}`);
        return response;
    },
    async (error) => {
        if (DEBUG_API) {
            console.error(`\n🔴 [API Error] ${error.config?.url || 'Unknown URL'}`);
            console.error(`   Status: ${error.response?.status || 'No Status Code'}`);
            console.error(`   Message:`, error.response?.data?.message || error.message);
            if (error.response?.data) {
                console.error(`   Full Response:`, JSON.stringify(error.response.data, null, 2));
            }
        }

        if (error.response?.status === 401) {
            const originalRequest = error.config;
            const errMsg: string = error.response?.data?.message || '';
            const isTokenMissing = errMsg.toLowerCase().includes('token missing');

            if (isTokenMissing || originalRequest._retry) {
                return Promise.reject(error);
            }

            if (isRefreshing) {
                return new Promise(function(resolve, reject) {
                    failedQueue.push({ resolve, reject });
                }).then(token => {
                    originalRequest.headers.Authorization = 'Bearer ' + token;
                    return api(originalRequest);
                }).catch(err => {
                    return Promise.reject(err);
                });
            }

            originalRequest._retry = true;
            isRefreshing = true;

            try {
                const refreshToken = await tokenStorage.getItem('refresh_token');
                if (!refreshToken) throw new Error("No refresh token");

                const res = await axios.post(`${API_BASE_URL}/patient/auth/refresh`, { refreshToken });
                const { token: newToken, refreshToken: newRefreshToken } = res.data.data;

                await tokenStorage.setItem('auth_token', newToken);
                await tokenStorage.setItem('refresh_token', newRefreshToken);

                api.defaults.headers.common['Authorization'] = 'Bearer ' + newToken;
                originalRequest.headers.Authorization = 'Bearer ' + newToken;

                // Keep auth store and socket in sync with the refreshed token
                try {
                    const { useAuthStore } = require('@/stores/auth.store');
                    useAuthStore.getState().setToken(newToken);
                    const { socketService } = require('@/services/socket.service');
                    socketService.updateAuth(newToken);
                } catch (e) { /* non-fatal */ }

                processQueue(null, newToken);
                return api(originalRequest);
            } catch (refreshError) {
                processQueue(refreshError, null);
                await tokenStorage.removeItem('auth_token');
                await tokenStorage.removeItem('refresh_token');
                try {
                    const authStore = require('@/stores/auth.store');
                    if (authStore && authStore.useAuthStore) {
                        authStore.useAuthStore.getState().logout();
                    }
                } catch (e) {
                    console.error("Failed to trigger auth store logout from api interceptor", e);
                }
                return Promise.reject(refreshError);
            } finally {
                isRefreshing = false;
            }
        }
        return Promise.reject(error);
    }
);

export default api;
