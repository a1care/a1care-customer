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

// ── Request interceptor — Auth & Logging ──
api.interceptors.request.use(
    async (config) => {
        const token = await tokenStorage.getItem('auth_token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
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
            await tokenStorage.removeItem('auth_token');
        }
        return Promise.reject(error);
    }
);

export default api;
