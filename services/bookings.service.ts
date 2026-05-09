import api from './api';
import { Endpoints } from '@/constants/api';
import type { ApiResponse, DoctorAppointment, ServiceRequest } from '@/types';

const getArrayFromPayload = (payload: any): any[] => {
    if (Array.isArray(payload)) return payload;
    if (!payload || typeof payload !== 'object') return [];
    if (Array.isArray(payload.data)) return payload.data;
    if (Array.isArray(payload.items)) return payload.items;
    if (Array.isArray(payload.bookings)) return payload.bookings;
    if (Array.isArray(payload.appointments)) return payload.appointments;
    if (Array.isArray(payload.results)) return payload.results;
    return [];
};

const getTotalPagesFromPayload = (payload: any): number => {
    if (!payload || typeof payload !== 'object') return 1;
    const candidates = [
        payload.pages,
        payload.totalPages,
        payload.pageCount,
        payload.pagination?.pages,
        payload.meta?.pages,
        payload.meta?.totalPages,
    ];
    for (const n of candidates) {
        const parsed = Number(n);
        if (Number.isFinite(parsed) && parsed > 1) return parsed;
    }
    return 1;
};

const fetchAllPages = async <T>(endpoint: string): Promise<T[]> => {
    const pageSize = 100;
    const join = endpoint.includes('?') ? '&' : '?';
    const firstUrl = `${endpoint}${join}page=1&limit=${pageSize}`;
    const firstRes = await api.get<ApiResponse<any>>(firstUrl);
    const firstPayload = firstRes.data.data;

    const firstItems = getArrayFromPayload(firstPayload) as T[];
    const totalPages = getTotalPagesFromPayload(firstPayload);

    if (totalPages <= 1) return firstItems;

    const all = [...firstItems];
    for (let page = 2; page <= totalPages; page += 1) {
        const pageUrl = `${endpoint}${join}page=${page}&limit=${pageSize}`;
        const res = await api.get<ApiResponse<any>>(pageUrl);
        const items = getArrayFromPayload(res.data.data) as T[];
        all.push(...items);
    }

    // Keep newest-first order if backend already sorted; just remove accidental duplicates by _id.
    const seen = new Set<string>();
    return all.filter((item: any) => {
        const id = String(item?._id ?? '');
        if (!id) return true;
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
    });
};

export const bookingsService = {
    // Doctor appointments
    bookDoctor: async (
        doctorId: string,
        data: { date: string; startingTime: string; endingTime: string; totalAmount?: number; paymentMode?: 'ONLINE' | 'OFFLINE' | 'WALLET'; isGatewayPayment?: boolean; serviceName?: string }
    ) => {
        const payload = { 
            ...data, 
            paymentMode: data.paymentMode === 'WALLET' ? 'ONLINE' : data.paymentMode, 
            isGatewayPayment: data.isGatewayPayment || data.paymentMode === 'ONLINE',
            paymentStatus: (data.paymentMode === 'ONLINE' || data.paymentMode === 'WALLET') ? 'COMPLETED' : 'PENDING' 
        };
        const res = await api.post<ApiResponse<DoctorAppointment>>(
            Endpoints.BOOK_DOCTOR(doctorId),
            payload
        );
        return res.data.data;
    },

    getMyAppointments: async () => {
        return fetchAllPages<DoctorAppointment>(Endpoints.MY_APPOINTMENTS);
    },

    getAppointmentById: async (id: string) => {
        const res = await api.get<ApiResponse<DoctorAppointment>>(
            `/appointment/${id}`
        );
        return res.data.data;
    },

    updateAppointmentStatus: async (id: string, status: string) => {
        const res = await api.patch<ApiResponse<DoctorAppointment>>(
            Endpoints.UPDATE_APPOINTMENT_STATUS(id),
            { status }
        );
        return res.data.data;
    },

    // Service bookings
    createServiceBooking: async (data: {
        childServiceId?: string;
        healthPackageId?: string;
        addressId?: string;
        location?: { lat: number; lng: number };
        assignedProviderId?: string;
        scheduledTime?: string;
        bookingType: string;
        fulfillmentMode: string;
        price: number;
        paymentMode?: 'ONLINE' | 'OFFLINE' | 'WALLET';
        isGatewayPayment?: boolean;
        notes?: string;
    }) => {
        const payload = {
            childServiceId: data.childServiceId,
            healthPackageId: data.healthPackageId,
            addressId: data.addressId,
            location: data.location,
            assignedProviderId: data.assignedProviderId,
            scheduledSlot: data.scheduledTime ? { startTime: data.scheduledTime, endTime: data.scheduledTime } : undefined,
            bookingType: data.bookingType,
            fulfillmentMode: data.fulfillmentMode,
            price: data.price,
            paymentMode: data.paymentMode === 'WALLET' ? 'ONLINE' : (data.paymentMode || 'OFFLINE'),
            isGatewayPayment: data.isGatewayPayment || data.paymentMode === 'ONLINE',
            notes: data.notes
        };
        const res = await api.post<ApiResponse<ServiceRequest>>(
            Endpoints.CREATE_SERVICE_BOOKING,
            payload
        );
        return res.data.data;
    },

    updateServiceBookingStatus: async (id: string, status: string) => {
        const res = await api.patch<ApiResponse<ServiceRequest>>(
            Endpoints.UPDATE_SERVICE_BOOKING_STATUS(id),
            { status }
        );
        return res.data.data;
    },

    getMyServiceBookings: async () => {
        return fetchAllPages<ServiceRequest>(Endpoints.MY_SERVICE_BOOKINGS);
    },

    getPendingServiceBookings: async () => {
        const res = await api.get<ApiResponse<ServiceRequest[]>>(
            Endpoints.PENDING_SERVICE_BOOKINGS
        );
        return res.data.data;
    },

    getServiceBookingById: async (id: string) => {
        const res = await api.get<ApiResponse<ServiceRequest>>(
            Endpoints.SERVICE_BOOKING_BY_ID(id)
        );
        return res.data.data;
    },

    // Live Tracking & Chat
    getProviderLocation: async (providerId: string) => {
        const res = await api.get<ApiResponse<{ latitude: number, longitude: number, heading: number }>>(
            `/appointment/location/${providerId}`
        );
        return res.data.data;
    },

    getBookingMessages: async (bookingId: string) => {
        const res = await api.get<ApiResponse<any[]>>(
            `/chat/${bookingId}`
        );
        return res.data.data;
    },

    sendBookingMessage: async (bookingId: string, message: string) => {
        // Logic similar to partner app: actual persistence in socket
        return {
            _id: Math.random().toString(),
            bookingId,
            message,
            senderType: 'User',
            createdAt: new Date().toISOString()
        };
    },
};
