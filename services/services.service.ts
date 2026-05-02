import api from './api';
import { API_BASE_URL, Endpoints } from '@/constants/api';
import type { ApiResponse, Service, SubService, ChildService } from '@/types';

const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, '');

const getImageValue = (item: any) =>
    item?.imageUrl ??
    item?.imageURL ??
    item?.image ??
    item?.serviceImage ??
    item?.subServiceImage ??
    item?.childServiceImage ??
    item?.icon ??
    item?.thumbnail;

const toAbsoluteImageUrl = (value?: string) => {
    if (!value || typeof value !== 'string') return undefined;

    const trimmed = value.trim();
    if (!trimmed) return undefined;
    if (/^(https?:|data:|file:)/i.test(trimmed)) return trimmed;

    const path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
    return `${API_ORIGIN}${path}`;
};

const normalizeImageUrl = <T extends Record<string, any>>(item: T): T => ({
    ...item,
    imageUrl: toAbsoluteImageUrl(getImageValue(item)),
});

const normalizeImageList = <T extends Record<string, any>>(items: T[] = []) =>
    items.map(normalizeImageUrl);

export const servicesService = {
    getAll: async () => {
        const res = await api.get<ApiResponse<Service[]>>(Endpoints.SERVICES);
        return normalizeImageList(res.data.data);
    },

    getSubServices: async (serviceId: string) => {
        const res = await api.get<ApiResponse<SubService[]>>(
            Endpoints.SUBSERVICES(serviceId)
        );
        return normalizeImageList(res.data.data);
    },

    getChildServices: async (subServiceId: string) => {
        const res = await api.get<ApiResponse<ChildService[]>>(
            Endpoints.CHILD_SERVICES(subServiceId)
        );
        return normalizeImageList(res.data.data);
    },

    getChildServiceById: async (id: string) => {
        const res = await api.get<ApiResponse<ChildService>>(
            Endpoints.CHILD_SERVICE_DETAIL(id)
        );
        return normalizeImageUrl(res.data.data);
    },

    getFeatured: async () => {
        const res = await api.get<ApiResponse<ChildService[]>>(
            Endpoints.CHILD_SERVICES_FEATURED
        );
        return normalizeImageList(res.data.data);
    },
};
