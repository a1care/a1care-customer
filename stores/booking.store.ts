import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface AbandonedBooking {
    serviceId: string;
    name: string;
    price?: string;
    subName?: string;
    originCategory?: string;
    lastStep: string;
    timestamp: number;
}

interface BookingState {
    abandonedBooking: AbandonedBooking | null;
    saveAbandonedBooking: (booking: Omit<AbandonedBooking, 'timestamp'>) => void;
    clearAbandonedBooking: () => void;
}

export const useBookingStore = create<BookingState>()(
    persist(
        (set) => ({
            abandonedBooking: null,
            saveAbandonedBooking: (booking) => set({ 
                abandonedBooking: { 
                    ...booking, 
                    timestamp: Date.now() 
                } 
            }),
            clearAbandonedBooking: () => set({ abandonedBooking: null }),
        }),
        {
            name: 'booking-storage',
            storage: createJSONStorage(() => AsyncStorage),
        }
    )
);
