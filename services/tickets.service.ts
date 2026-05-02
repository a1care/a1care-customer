import api from './api';
import { Endpoints } from '@/constants/api';
import type { ApiResponse } from '@/types';

export interface Ticket {
    _id: string;
    subject: string;
    description: string;
    status: 'Pending' | 'In Progress' | 'Resolved' | 'Closed';
    priority: 'Low' | 'Medium' | 'High' | 'Critical';
    createdAt: string;
    userId?: string;
    staffId?: string;
}

export const ticketsService = {
    createTicket: async (data: { subject: string; description: string; priority: string }) => {
        const res = await api.post<ApiResponse<Ticket>>(
            Endpoints.CREATE_TICKET,
            data
        );
        return res.data.data;
    },

    getMyTickets: async () => {
        const res = await api.get<ApiResponse<Ticket[]>>(
            Endpoints.MY_TICKETS
        );
        return res.data.data;
    },

    getMessages: async (ticketId: string) => {
        const res = await api.get<ApiResponse<any[]>>(
            `/tickets/messages/${ticketId}`
        );
        return res.data.data;
    },

    sendChatMessage: async (ticketId: string, message: string) => {
        const res = await api.post<ApiResponse<any>>(
            `/tickets/messages/send`,
            { ticketId, message }
        );
        return res.data.data;
    },
};
