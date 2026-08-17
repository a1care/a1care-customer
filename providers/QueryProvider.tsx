import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            // Category B: Semi-Dynamic default (5 minutes)
            staleTime: 1000 * 60 * 5,
            retry: 1,
            refetchOnWindowFocus: false,
        },
    },
});

// Category A: Static / Configuration (24 hours)
queryClient.setQueryDefaults(['services'], { staleTime: 1000 * 60 * 60 * 24 });
queryClient.setQueryDefaults(['sub-services'], { staleTime: 1000 * 60 * 60 * 24 });
queryClient.setQueryDefaults(['child-services'], { staleTime: 1000 * 60 * 60 * 24 });
queryClient.setQueryDefaults(['service-areas'], { staleTime: 1000 * 60 * 60 * 24 });
queryClient.setQueryDefaults(['config'], { staleTime: 1000 * 60 * 60 * 24 });

// Category C: Highly Dynamic (15 seconds + targeted invalidation relies on mutations)
queryClient.setQueryDefaults(['appointments'], { staleTime: 1000 * 15 });
queryClient.setQueryDefaults(['service-bookings'], { staleTime: 1000 * 15 });
queryClient.setQueryDefaults(['wallet'], { staleTime: 1000 * 15 });
queryClient.setQueryDefaults(['notifications-unread'], { staleTime: 1000 * 30 });

export function QueryProvider({ children }: { children: React.ReactNode }) {
    return (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    );
}
