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
    imageUrl?: string;
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
    imageUrl,
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
                        {imageUrl
                            ? <Image source={{ uri: imageUrl }} style={{ width: '100%', height: '100%', borderRadius: 999 }} />
                            : <Text style={styles.avatarText}>{name.charAt(0)}</Text>
                        }
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
        backgroundColor: '#FFFFFF',
        borderRadius: 28,
        padding: 24,
        marginRight: 16,
        width: 300,
        borderWidth: 1,
        borderColor: '#E8EEF5',
        shadowColor: '#0A1A3A',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.04,
        shadowRadius: 24,
        elevation: 8,
    },
    topRow: { flexDirection: 'row', gap: 14, alignItems: 'center' },
    avatarContainer: { position: 'relative' },
    avatar: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#E0EAFF',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#FFFFFF',
        shadowColor: '#3B82F6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
        elevation: 3,
    },
    verifiedBadge: {
        position: 'absolute',
        bottom: -2,
        right: -2,
        backgroundColor: '#10B981',
        width: 22,
        height: 22,
        borderRadius: 11,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: Colors.white,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    avatarText: { fontSize: 22, fontWeight: '900', color: '#0B3370' },
    name: { fontSize: 17, fontWeight: '900', color: '#0F172A', letterSpacing: 0.2 },
    spec: { fontSize: 13, color: '#64748B', marginTop: 2, fontWeight: '500' },
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
        marginTop: 18,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
    },
    priceLabel: { fontSize: 11, color: '#94A3B8', marginBottom: 4, fontWeight: '600' },
    price: { fontSize: 18, fontWeight: '900', color: '#0F172A' },
    bookBtn: {
        backgroundColor: '#0B3370',
        paddingHorizontal: 24,
        paddingVertical: 10,
        borderRadius: 24,
        shadowColor: '#0B3370',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
        elevation: 6,
    },
    bookText: { color: Colors.white, fontSize: 14, fontWeight: '900', letterSpacing: 0.3 },

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
