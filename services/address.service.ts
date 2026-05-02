import api from './api';
import { Endpoints } from '@/constants/api';
import type { ApiResponse, Address } from '@/types';

export const addressService = {
    getAll: async () => {
        const res = await api.get<ApiResponse<Address[]>>(Endpoints.ADDRESS);
        return res.data.data;
    },

    add: async (data: Omit<Address, '_id' | 'userId' | 'isDeleted' | 'isPrimary'>) => {
        const res = await api.post<ApiResponse<Address>>(Endpoints.ADD_ADDRESS, data);
        return res.data.data;
    },

    update: async (addressId: string, data: Partial<Address>) => {
        const res = await api.put<ApiResponse<Address>>(
            Endpoints.UPDATE_ADDRESS(addressId),
            data
        );
        return res.data.data;
    },

    delete: async (addressId: string) => {
        const res = await api.patch<ApiResponse<Address>>(
            Endpoints.DELETE_ADDRESS(addressId)
        );
        return res.data.data;
    },

    makePrimary: async (addressId: string) => {
        const res = await api.put<ApiResponse<Address>>(
            Endpoints.MAKE_PRIMARY_ADDRESS(addressId)
        );
        return res.data.data;
    },

    /** Alias for makePrimary — used by Profile screen */
    setPrimary: async (addressId: string) => {
        const res = await api.patch<ApiResponse<Address>>(
            `${Endpoints.ADDRESS}/${addressId}/primary`
        );
        return res.data.data;
    },
};
