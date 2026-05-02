import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors, Shadows } from '@/constants/colors';
import { FontSize } from '@/constants/spacing';

interface PromoBannerProps {
    title: string;
    subtitle: string;
    price?: string;
    originalPrice?: string;
    tag?: string;
    onPress: () => void;
    backgroundColor?: string;
    illustration?: string;
}

export function PromoBanner({
    title,
    subtitle,
    price,
    originalPrice,
    tag,
    onPress,
    backgroundColor = '#EBF3FD',
    illustration = '🧪',
}: PromoBannerProps) {
    return (
        <TouchableOpacity
            style={[styles.banner, { backgroundColor }]}
            onPress={onPress}
            activeOpacity={0.9}
        >
            <View style={styles.content}>
                {tag && (
                    <View style={styles.tag}>
                        <Text style={styles.tagText}>{tag}</Text>
                    </View>
                )}
                <Text style={styles.title}>{title}</Text>
                <Text style={styles.subtitle} numberOfLines={2}>{subtitle}</Text>

                <View style={styles.bottom}>
                    {price && (
                        <Text style={styles.price}>
                            From <Text style={styles.amount}>₹{price}</Text>
                            {originalPrice && <Text style={styles.original}> ₹{originalPrice}</Text>}
                        </Text>
                    )}
                    <TouchableOpacity style={styles.btn} onPress={onPress}>
                        <Text style={styles.btnText}>Book Now ›</Text>
                    </TouchableOpacity>
                </View>
            </View>
            <View style={styles.illustrationWrap}>
                <Text style={styles.illustration}>{illustration}</Text>
            </View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    banner: {
        borderRadius: 20,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        overflow: 'hidden',
        minHeight: 140,
    },
    content: { flex: 1, zIndex: 1 },
    tag: {
        backgroundColor: Colors.health,
        alignSelf: 'flex-start',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
        marginBottom: 8,
    },
    tagText: { color: '#fff', fontSize: 9, fontWeight: '800' },
    title: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
    subtitle: { fontSize: 11, color: Colors.textSecondary, lineHeight: 16, marginBottom: 12 },
    bottom: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    price: { fontSize: 11, color: Colors.textSecondary },
    amount: { color: Colors.textPrimary, fontWeight: '800', fontSize: 14 },
    original: { textDecorationLine: 'line-through', fontSize: 10 },
    btn: {
        backgroundColor: Colors.primary,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
    },
    btnText: { color: '#fff', fontSize: 10, fontWeight: '700' },
    illustrationWrap: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(255,255,255,0.4)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    illustration: { fontSize: 50 },
});
