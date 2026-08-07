import api from './api';

export const packagesService = {
    getActivePackages: async (serviceType?: string) => {
        const query = serviceType ? `?serviceType=${serviceType}` : '';
        const response = await api.get(`/health-packages/my-active${query}`);
        return response.data;
    },
    getPublicPackages: async () => {
        const response = await api.get(`/health-packages`);
        return response.data;
    },
    getPackageById: async (id: string) => {
        const response = await api.get(`/health-packages/detail/${id}`);
        return response.data;
    },
    purchasePackage: async (payload: { healthPackageId: string, paymentMode: 'ONLINE' | 'OFFLINE' | 'WALLET' }) => {
        const response = await api.post('/health-packages/purchase', payload);
        return response.data.data;
    }
};
