const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://api.a1carehospital.in/api';
console.log('DEBUG: BASE_URL in constants/api.ts is:', BASE_URL);

export const API_BASE_URL = BASE_URL;

export const Endpoints = {
    // Auth
    SEND_OTP: '/patient/auth/send-otp',
    VERIFY_OTP: '/patient/auth/verify-otp',
    PROFILE: '/patient/auth/profile',
    REQUEST_DELETION: '/patient/auth/request-deletion',

    // Address
    ADDRESS: '/patient/address',
    ADD_ADDRESS: '/patient/address/add',
    UPDATE_ADDRESS: (id: string) => `/patient/address/${id}`,
    MAKE_PRIMARY_ADDRESS: (id: string) => `/patient/address/primary/${id}`,
    DELETE_ADDRESS: (id: string) => `/patient/address/${id}`,

    // Services
    SERVICES: '/services',
    SUBSERVICES: (serviceId: string) => `/subservice/${serviceId}`,
    CHILD_SERVICES: (subServiceId: string) => `/childService/${subServiceId}`,
    CHILD_SERVICE_DETAIL: (id: string) => `/childService/detail/${id}`,
    CHILD_SERVICES_FEATURED: '/childService/featured',

    // Roles
    ROLES: '/role',

    // Doctors
    DOCTOR_BY_ID: (doctorId: string) => `/doctor/${doctorId}`,
    STAFF_BY_ROLE: '/doctor/staff/role/',
    DOCTOR_SLOTS: (doctorId: string, date: string) => `/doctor/slots/${doctorId}/${date}`,

    // Appointments
    BOOK_DOCTOR: (doctorId: string) => `/appointment/booking/${doctorId}`,
    UPDATE_APPOINTMENT_STATUS: (id: string) => `/appointment/status/${id}`,
    MY_APPOINTMENTS: '/appointment/patient/appointments',
    PENDING_APPOINTMENTS: '/appointment/patient/appointments/pending',

    // Service Bookings
    CREATE_SERVICE_BOOKING: '/service/booking/create',
    UPDATE_SERVICE_BOOKING_STATUS: (id: string) => `/service/booking/status/${id}`,
    MY_SERVICE_BOOKINGS: '/service/booking/user',
    PENDING_SERVICE_BOOKINGS: '/service/booking/get/pending',
    SERVICE_BOOKING_BY_ID: (id: string) => `/service/booking/request/${id}`,

    // Support Tickets
    CREATE_TICKET: '/tickets/patient/create',
    MY_TICKETS: '/tickets/patient/my',

    // Reviews
    ADD_REVIEW: '/reviews/add',
    DOCTOR_REVIEWS: (doctorId: string) => `/reviews/doctor/${doctorId}`,
    SERVICE_REVIEWS: (childServiceId: string) => `/reviews/service/${childServiceId}`,

    // Wallet
    WALLET: '/wallet',
    ADD_MONEY: '/wallet/add',
    HEALTH_PACKAGES: '/health-packages',
    HEALTH_PACKAGE_DETAIL: (id: string) => `/health-packages/detail/${id}`,
};
