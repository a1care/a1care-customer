import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { Star, ShieldCheck } from 'lucide-react-native';
import { Colors, Shadows } from '@/constants/colors';
import { FontSize } from '@/constants/spacing';

interface DoctorCardProps {
    name: string;
    specialization: string;
    rating: number;
    experience: string;
    price: number;
    workingHours?: string;
    onPress: () => void;
    fullWidth?: boolean;
}

export function DoctorCard({
    name,
    specialization,
    rating,
    experience,
    price,
    workingHours,
    onPress,
    fullWidth = false,
}: DoctorCardProps) {
    return (
        <TouchableOpacity
            style={[styles.card, fullWidth && { width: '100%', marginRight: 0 }]}
            onPress={onPress}
            activeOpacity={0.9}
        >
            <View style={styles.topRow}>
                <View style={styles.avatarContainer}>
                    <View style={styles.avatar}>
                        <Text style={styles.avatarText}>{name.charAt(0)}</Text>
                    </View>
                    <View style={styles.verifiedBadge}>
                        <ShieldCheck size={10} color="#fff" />
                    </View>
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={styles.name} numberOfLines={1}>{name}</Text>
                    <Text style={styles.spec} numberOfLines={1}>{specialization}</Text>
                    <View style={styles.metaRow}>
                        <View style={styles.ratingBox}>
                            <Star size={10} color="#F2C94C" fill="#F2C94C" />
                            <Text style={styles.ratingText}>{Number(rating).toFixed(1)}</Text>
                        </View>
                        <Text style={styles.dot}> • </Text>
                        <Text style={styles.exp}>{experience}</Text>
                    </View>
                    {workingHours && (
                        <View style={styles.workingRow}>
                            <Text style={styles.workingIcon}>🕒</Text>
                            <Text style={styles.workingText} numberOfLines={1}>{workingHours}</Text>
                        </View>
                    )}
                </View>
            </View>

            <View style={styles.footer}>
                <View>
                    <Text style={styles.priceLabel}>Consultation Fee</Text>
                    <Text style={styles.price}>₹{price}</Text>
                </View>
                <View style={styles.bookBtn}>
                    <Text style={styles.bookText}>Book</Text>
                </View>
            </View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: Colors.white,
        borderRadius: 24,
        padding: 20,
        marginRight: 12,
        width: 280,
        borderWidth: 1.5,
        borderColor: '#CBD5E1',
        ...Shadows.card,
    },
    topRow: { flexDirection: 'row', gap: 14, alignItems: 'center' },
    avatarContainer: { position: 'relative' },
    avatar: {
        width: 52,
        height: 52,
        borderRadius: 16,
        backgroundColor: Colors.primaryLight,
        justifyContent: 'center',
        alignItems: 'center',
    },
    verifiedBadge: {
        position: 'absolute',
        bottom: -2,
        right: -2,
        backgroundColor: Colors.health,
        width: 18,
        height: 18,
        borderRadius: 9,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: Colors.white,
    },
    avatarText: { fontSize: 20, fontWeight: '800', color: Colors.primary },
    name: { fontSize: 16, fontWeight: '800', color: Colors.textPrimary },
    spec: { fontSize: 13, color: Colors.textSecondary, marginTop: 1 },
    metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
    ratingBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#FFF9E5',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
    },
    ratingText: { fontSize: 11, fontWeight: '800', color: '#B08800' },
    dot: { color: Colors.muted, fontSize: 12 },
    exp: { fontSize: 11, fontWeight: '600', color: Colors.textSecondary },

    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 16,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#E2E8F0',
    },
    priceLabel: { fontSize: 10, color: Colors.muted, marginBottom: 2 },
    price: { fontSize: 16, fontWeight: '800', color: Colors.textPrimary },
    bookBtn: {
        backgroundColor: Colors.primary,
        paddingHorizontal: 20,
        paddingVertical: 8,
        borderRadius: 10,
    },
    bookText: { color: Colors.white, fontSize: 13, fontWeight: '800' },

    workingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
        backgroundColor: '#F8FAFC',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        alignSelf: 'flex-start',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    workingIcon: { fontSize: 10, marginRight: 4 },
    workingText: { fontSize: 10, fontWeight: '600', color: Colors.health, letterSpacing: 0.3 },
});
