import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '@/constants/colors';
import { FontSize } from '@/constants/spacing';

type StatusType =
    // Service request statuses
    | 'PENDING'
    | 'BROADCASTED'
    | 'ACCEPTED'
    | 'IN_PROGRESS'
    | 'COMPLETED'
    | 'CANCELLED'
    // Doctor appointment statuses
    | 'Pending'
    | 'Confirmed'
    | 'Completed'
    | 'Cancelled';

const STATUS_CONFIG: Record<
    StatusType,
    { bg: string; text: string; label: string; dot: string }
> = {
    PENDING: { bg: '#FEF9C3', text: '#854D0E', label: 'Pending', dot: '#EAB308' },
    BROADCASTED: { bg: '#F3E8FF', text: '#6B21A8', label: 'Searching Provider', dot: '#A855F7' },
    ACCEPTED: { bg: '#D1EFE0', text: '#166534', label: 'Accepted', dot: '#22C55E' },
    IN_PROGRESS: { bg: '#DBEAFE', text: '#1E40AF', label: 'In Progress', dot: '#3B82F6' },
    COMPLETED: { bg: '#D1FAE5', text: '#065F46', label: 'Completed', dot: '#10B981' },
    CANCELLED: { bg: '#FEE2E2', text: '#991B1B', label: 'Cancelled', dot: '#EF4444' },
    // Doctor appt aliases
    Pending: { bg: '#FEF9C3', text: '#854D0E', label: 'Pending', dot: '#EAB308' },
    Confirmed: { bg: '#D1EFE0', text: '#166534', label: 'Confirmed', dot: '#22C55E' },
    Completed: { bg: '#D1FAE5', text: '#065F46', label: 'Completed', dot: '#10B981' },
    Cancelled: { bg: '#FEE2E2', text: '#991B1B', label: 'Cancelled', dot: '#EF4444' },
};

interface StatusBadgeProps {
    status: string;
    size?: 'sm' | 'md';
}

export function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
    const config = STATUS_CONFIG[status as StatusType] ?? {
        bg: '#F3F4F6',
        text: Colors.textSecondary,
        label: status,
        dot: Colors.muted,
    };

    return (
        <View style={[styles.badge, { backgroundColor: config.bg }, size === 'md' ? styles.badgeMd : {}]}>
            <View style={[styles.dot, { backgroundColor: config.dot }]} />
            <Text style={[styles.label, { color: config.text }, size === 'md' ? styles.labelMd : {}]}>
                {config.label}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 9,
        paddingVertical: 4,
        borderRadius: 20,
        alignSelf: 'flex-start',
    },
    badgeMd: { paddingHorizontal: 12, paddingVertical: 6 },
    dot: { width: 6, height: 6, borderRadius: 3 },
    label: { fontSize: FontSize.xs, fontWeight: '700' },
    labelMd: { fontSize: FontSize.sm },
});
