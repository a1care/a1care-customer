import api from './api';
import { Endpoints } from '@/constants/api';
import type { ApiResponse } from '@/types';

export interface Review {
    _id: string;
    userId: {
        _id: string;
        name: string;
        profileImage?: string;
    };
    doctorId?: string;
    childServiceId?: string;
    bookingId: string;
    bookingType: 'Doctor' | 'Service';
    rating: number;
    comment: string;
    createdAt: string;
}

export const reviewsService = {
    addReview: async (data: {
        bookingId: string;
        bookingType: 'Doctor' | 'Service';
        rating: number;
        comment: string;
        doctorId?: string;
        childServiceId?: string;
    }) => {
        const res = await api.post<ApiResponse<Review>>(
            Endpoints.ADD_REVIEW,
            data
        );
        return res.data.data;
    },

    getDoctorReviews: async (doctorId: string) => {
        const res = await api.get<ApiResponse<Review[]>>(
            Endpoints.DOCTOR_REVIEWS(doctorId)
        );
        return res.data.data;
    },

    getServiceReviews: async (serviceId: string) => {
        const res = await api.get<ApiResponse<Review[]>>(
            Endpoints.SERVICE_REVIEWS(serviceId)
        );
        return res.data.data;
    },
};
