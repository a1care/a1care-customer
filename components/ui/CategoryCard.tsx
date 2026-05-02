import React from 'react';
import { TouchableOpacity, Text, View, StyleSheet } from 'react-native';
import { Colors } from '@/constants/colors';
import { FontSize } from '@/constants/spacing';
import { Shadows } from '@/constants/colors';

interface CategoryCardProps {
    emoji: string;
    label: string;
    subtitle?: string;
    actionLabel?: string;
    onPress: () => void;
    variant?: 'blue' | 'green' | 'purple' | 'orange' | 'red';
}

const VARIANT_COLORS = {
    blue: { bg: '#EBF3FD', border: '#D1E5FC' },
    green: { bg: '#E9F7EF', border: '#D4EFE0' },
    purple: { bg: '#F3E8FF', border: '#E9D5FF' },
    orange: { bg: '#FEF9C3', border: '#FEF08A' },
    red: { bg: '#FEF2F2', border: '#FEE2E2' },
};

export function CategoryCard({
    emoji,
    label,
    subtitle,
    actionLabel = 'Book',
    onPress,
    variant = 'blue',
}: CategoryCardProps) {
    const colors = VARIANT_COLORS[variant];

    return (
        <TouchableOpacity
            style={[styles.card, { backgroundColor: colors.bg, borderColor: colors.border }]}
            onPress={onPress}
            activeOpacity={0.8}
        >
            <View style={styles.iconBg}>
                <Text style={styles.emoji}>{emoji}</Text>
            </View>
            <Text style={styles.label} numberOfLines={2}>{label}</Text>
            {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}

            <View style={[styles.btn, { backgroundColor: variant === 'blue' ? Colors.primary : Colors.health }]}>
                <Text style={styles.btnText}>{actionLabel} ›</Text>
            </View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    card: {
        width: 105,
        padding: 12,
        borderRadius: 20,
        alignItems: 'center',
        borderWidth: 1,
        marginRight: 10,
        ...Shadows.card,
    },
    iconBg: {
        width: 54,
        height: 54,
        borderRadius: 16,
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 10,
        ...Shadows.card,
    },
    emoji: { fontSize: 28 },
    label: {
        fontSize: 11,
        fontWeight: '700',
        color: Colors.textPrimary,
        textAlign: 'center',
        marginBottom: 4,
        height: 32,
    },
    subtitle: {
        fontSize: 9,
        color: Colors.textSecondary,
        marginBottom: 10,
    },
    btn: {
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 20,
        width: '100%',
        alignItems: 'center',
    },
    btnText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: '700',
    },
});
