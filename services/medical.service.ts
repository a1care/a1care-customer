import api from './api';

export interface MedicalRecord {
    _id: string;
    patientId: string;
    doctorId?: any;
    appointmentId?: any;
    clinicalNotes?: string;
    diagnosis?: string;
    prescriptions: string[];
    labReports: string[];
    createdAt: string;
}

export const medicalService = {
    getMyRecords: async (): Promise<MedicalRecord[]> => {
        const res = await api.get('/medical-records/my');
        return res.data.data;
    },

    getById: async (id: string): Promise<MedicalRecord> => {
        const res = await api.get(`/medical-records/${id}`);
        return res.data.data;
    },

    uploadRecord: async (formData: FormData): Promise<MedicalRecord> => {
        const res = await api.post('/medical-records', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        return res.data.data;
    },

    deleteRecord: async (id: string): Promise<void> => {
        await api.delete(`/medical-records/${id}`);
    }
};
