import api from './api';
import { Endpoints } from '@/constants/api';
import type { ApiResponse, Patient } from '@/types';
import { tokenStorage } from '@/utils/storage';

export const authService = {
    sendOtp: async (mobileNumber: string) => {
        const res = await api.post<ApiResponse<{ mobileNumber: string }>>(
            Endpoints.SEND_OTP,
            { mobileNumber }
        );
        return res.data;
    },

    verifyOtp: async (mobileNumber: string, otp: string) => {
        const res = await api.post<ApiResponse<{ token: string }>>(
            Endpoints.VERIFY_OTP,
            { mobileNumber, otp }
        );
        const { token } = res.data.data;
        await tokenStorage.setItem('auth_token', token);
        return res.data;
    },

    getProfile: async () => {
        const res = await api.get<ApiResponse<Patient>>(Endpoints.PROFILE);
        return res.data.data;
    },

    updateProfile: async (data: any) => {
        const config = data instanceof FormData ? {
            headers: { 'Content-Type': 'multipart/form-data' }
        } : {};
        const res = await api.put<ApiResponse<Patient>>(Endpoints.PROFILE, data, config);
        return res.data.data;
    },

    logout: async () => {
        await tokenStorage.removeItem('auth_token');
    },

    getToken: async () => {
        return tokenStorage.getItem('auth_token');
    },

    requestDeletion: async () => {
        const res = await api.post<ApiResponse<any>>(Endpoints.REQUEST_DELETION);
        return res.data;
    },
};
