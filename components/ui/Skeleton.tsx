import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, ViewStyle } from 'react-native';
import { Colors } from '@/constants/colors';

interface SkeletonBoxProps {
    width?: number | string;
    height?: number;
    borderRadius?: number;
    style?: ViewStyle;
}

export function SkeletonBox({ width = '100%', height = 16, borderRadius = 8, style }: SkeletonBoxProps) {
    const opacity = useRef(new Animated.Value(0.3)).current;

    useEffect(() => {
        const anim = Animated.loop(
            Animated.sequence([
                Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
                Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
            ])
        );
        anim.start();
        return () => anim.stop();
    }, []);

    return (
        <View
            style={[
                styles.box,
                { width: width as any, height, borderRadius },
                style,
            ]}
        />
    );
}

// Pre-built cards
export function SkeletonServiceCard() {
    return (
        <View style={styles.card}>
            <SkeletonBox width={52} height={52} borderRadius={14} style={{ marginBottom: 12 }} />
            <SkeletonBox height={14} borderRadius={6} style={{ marginBottom: 8 }} />
            <SkeletonBox width="60%" height={11} borderRadius={6} style={{ marginBottom: 12 }} />
            <SkeletonBox height={28} borderRadius={8} />
        </View>
    );
}

export function SkeletonBookingCard() {
    return (
        <View style={styles.bookingCard}>
            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
                <SkeletonBox width={48} height={48} borderRadius={14} />
                <View style={{ flex: 1 }}>
                    <SkeletonBox height={14} borderRadius={6} style={{ marginBottom: 8 }} />
                    <SkeletonBox width="50%" height={11} borderRadius={6} />
                </View>
                <SkeletonBox width={70} height={26} borderRadius={20} />
            </View>
            <SkeletonBox height={1} borderRadius={1} style={{ marginBottom: 10 }} />
            <SkeletonBox width="40%" height={11} borderRadius={6} />
        </View>
    );
}

export function SkeletonListItem() {
    return (
        <View style={styles.listItem}>
            <SkeletonBox width={44} height={44} borderRadius={13} />
            <View style={{ flex: 1 }}>
                <SkeletonBox height={14} borderRadius={6} style={{ marginBottom: 8 }} />
                <SkeletonBox width="65%" height={11} borderRadius={6} />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    box: { backgroundColor: Colors.border },
    card: {
        width: 150,
        backgroundColor: Colors.card,
        borderRadius: 16,
        padding: 14,
        marginRight: 12,
    },
    bookingCard: {
        backgroundColor: Colors.card,
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
    },
    listItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: Colors.card,
        borderRadius: 16,
        padding: 14,
        marginBottom: 10,
    },
});
