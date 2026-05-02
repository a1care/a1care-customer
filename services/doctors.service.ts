import api from './api';
import { API_BASE_URL, Endpoints } from '@/constants/api';
import type { ApiResponse, Doctor, Role, TimeSlot } from '@/types';

const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, '');

const toAbsoluteImageUrl = (value?: string) => {
    if (!value || typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    if (/^(https?:|data:|file:)/i.test(trimmed)) return trimmed;
    const path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
    return `${API_ORIGIN}${path}`;
};

const getDoctorImage = (doctor: any) =>
    doctor?.profileImage ??
    doctor?.imageUrl ??
    doctor?.imageURL ??
    doctor?.image ??
    doctor?.photo ??
    doctor?.avatar ??
    doctor?.doctorImage;

const normalizeDoctor = <T extends Record<string, any>>(doctor: T): T => ({
    ...doctor,
    profileImage: toAbsoluteImageUrl(getDoctorImage(doctor)),
});

const normalizeSlots = (raw: any): TimeSlot[] => {
    const arr = Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.slots)
            ? raw.slots
            : Array.isArray(raw?.data)
                ? raw.data
                : [];

    return arr
        .map((s: any) => ({
            startingTime: s?.startingTime ?? s?.startTime ?? s?.start ?? '',
            endingTime: s?.endingTime ?? s?.endTime ?? s?.end ?? '',
        }))
        .filter((s: TimeSlot) => !!s.startingTime && !!s.endingTime);
};

export const doctorsService = {
    getById: async (doctorId: string) => {
        const res = await api.get<ApiResponse<Doctor>>(
            Endpoints.DOCTOR_BY_ID(doctorId)
        );
        return normalizeDoctor(res.data.data);
    },

    getByRole: async (roleId: string, specialization?: string) => {
        const res = await api.get<ApiResponse<Doctor[]>>(Endpoints.STAFF_BY_ROLE, {
            params: { roleId, specialization },
        });
        return res.data.data.map(normalizeDoctor);
    },

    getSlots: async (doctorId: string, date: string): Promise<TimeSlot[]> => {
        const res = await api.get<any>(Endpoints.DOCTOR_SLOTS(doctorId, date));
        return normalizeSlots(res?.data?.data);
    },

    getRoles: async () => {
        const res = await api.get<ApiResponse<Role[]>>(Endpoints.ROLES);
        return res.data.data;
    },
};
