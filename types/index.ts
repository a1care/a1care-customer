// ──────────────────────────────────────────
// Patient / User Types
// ──────────────────────────────────────────
export interface Patient {
    _id: string;
    mobileNumber: number;
    name?: string;
    email?: string;
    profileImage?: string;
    gender?: 'Male' | 'Female' | 'Other';
    dateOfBirth?: string;
    fcmToken?: string;
    isRegistered: boolean;
    primaryAddressId?: Address | string;
    createdAt: string;
    updatedAt: string;
}

// ──────────────────────────────────────────
// Address Types
// ──────────────────────────────────────────
export interface Address {
    _id: string;
    userId: string;
    label?: string;
    street?: string; // Keep for legacy
    moreInfo?: string;
    city?: string;
    state?: string;
    pincode?: string;
    landmark?: string;
    location?: {
        lat: number;
        lng: number;
    };
    latitude?: number;
    longitude?: number;
    isDeleted: boolean;
    isPrimary?: boolean;
}

// ──────────────────────────────────────────
// Service Types
// ──────────────────────────────────────────
export interface Service {
    _id: string;
    name: string;
    title?: string;
    type?: string;
    imageUrl?: string;
    createdAt: string;
}

export interface SubService {
    _id: string;
    name: string;
    description?: string;
    serviceId: string;
    imageUrl?: string;
}

export interface ChildService {
    _id: string;
    name: string;
    description?: string;
    price: number;
    imageUrl?: string;
    serviceId: string;
    subServiceId: string;
    allowedRoleIds: string[];
    selectionType: 'SELECT' | 'ASSIGN';
    bookingType: 'SCHEDULED' | 'ON_DEMAND';
    fulfillmentMode: 'HOME_VISIT' | 'HOSPITAL_VISIT' | 'VIRTUAL';
}

// ──────────────────────────────────────────
// Doctor / Staff Types
// ──────────────────────────────────────────
export interface Doctor {
    _id: string;
    mobileNumber?: string;
    name?: string;
    gender?: 'Male' | 'Female' | 'Other';
    startExperience?: string;
    specialization?: string[];
    about?: string;
    workingHours?: string;
    consultationFee?: number;
    profileImage?: string;
    imageUrl?: string;
    status?: 'Pending' | 'Active' | 'Inactive';
    rating?: number;
    roleId?: Role | string;
    isRegistered: boolean;
}

export interface Role {
    _id: string;
    name: string;
    description?: string;
}

// ──────────────────────────────────────────
// Slot Types
// ──────────────────────────────────────────
export interface TimeSlot {
    startingTime: string;
    endingTime: string;
}

// ──────────────────────────────────────────
// Appointment Types
// ──────────────────────────────────────────
export type AppointmentStatus = 'Pending' | 'Confirmed' | 'Completed' | 'Cancelled';
export type PaymentMode = 'ONLINE' | 'OFFLINE' | 'WALLET';
export type PaymentStatus = 'PENDING' | 'COMPLETED' | 'FAILED';

export interface DoctorAppointment {
    _id: string;
    patientId: Patient | string;
    doctorId: Doctor | string;
    date: string;
    startingTime: string;
    endingTime: string;
    timeSlot?: string;
    status: AppointmentStatus;
    paymentMode?: PaymentMode;
    paymentStatus?: PaymentStatus;
    totalAmount?: number;
    serviceName?: string;
    createdAt: string;
}

// ──────────────────────────────────────────
// Service Booking Types
// ──────────────────────────────────────────
export type ServiceRequestStatus =
    | 'PENDING'
    | 'BROADCASTED'
    | 'ACCEPTED'
    | 'RETURNED_TO_ADMIN'
    | 'IN_PROGRESS'
    | 'COMPLETED'
    | 'CANCELLED';

export interface ServiceRequest {
    _id: string;
    userId: Patient | string;
    childServiceId: ChildService | string;
    address?: string;
    scheduledTime?: string;
    status: ServiceRequestStatus;
    bookingType: 'SCHEDULED' | 'ON_DEMAND';
    fulfillmentMode: 'HOME_VISIT' | 'HOSPITAL_VISIT' | 'VIRTUAL';
    paymentMode?: PaymentMode;
    paymentStatus?: PaymentStatus;
    price?: number;
    createdAt: string;
    updatedAt: string;
}

// ──────────────────────────────────────────
// API Response Wrapper
// ──────────────────────────────────────────
export interface ApiResponse<T> {
    statusCode: number;
    message: string;
    data: T;
    success: boolean;
}
