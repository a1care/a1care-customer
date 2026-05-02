import React from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { Clock3, Star } from 'lucide-react-native';

import { doctorsService } from '@/services/doctors.service';
import { reviewsService } from '@/services/reviews.service';
import { Colors, Shadows } from '@/constants/colors';
import { FontSize } from '@/constants/spacing';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/EmptyState';

export default function DoctorDetailScreen() {
    const { id, from } = useLocalSearchParams<{ id: string; from?: string }>();
    const router = useRouter();
    const source = Array.isArray(from) ? from[0] : from;

    const handleBack = () => {
        if (source === 'top_doctors') {
            router.replace('/(tabs)');
            return;
        }
        if (router.canGoBack()) {
            router.back();
            return;
        }
        router.replace('/(tabs)');
    };

    const formatExperience = (exp: any) => {
        if (!exp) return '0';
        const start = new Date(exp);
        if (isNaN(start.getTime())) return String(exp);
        const now = new Date();
        const diff = now.getFullYear() - start.getFullYear();
        return `${diff > 0 ? diff : 0}`;
    };

    const { data: doctor, isLoading, isError, refetch } = useQuery({
        queryKey: ['doctor', id],
        queryFn: () => doctorsService.getById(id!),
        enabled: !!id,
    });

    const { data: reviews = [] } = useQuery({
        queryKey: ['reviews', id],
        queryFn: () => reviewsService.getDoctorReviews(id!),
        enabled: !!id,
    });

    if (isLoading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color={Colors.primary} />
            </View>
        );
    }

    if (isError || !doctor) {
        return (
            <ErrorState message="Could not find doctor details" onRetry={refetch} />
        );
    }

    return (
        <SafeAreaView style={styles.root} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={20} color={Colors.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Doctor Profile</Text>
                <View style={{ width: 44 }} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
                <View style={styles.profileCard}>
                    <View style={styles.avatarLarge}>
                        <Text style={styles.avatarText}>{doctor.name?.charAt(0).toUpperCase() ?? 'D'}</Text>
                    </View>
                    <Text style={styles.doctorName}>
                        {doctor.name?.toLowerCase().startsWith('dr') ? doctor.name : `Dr. ${doctor.name}`}
                    </Text>

                    <View style={styles.specializationRow}>
                        {(doctor.specialization ?? []).map((s) => (
                            <View key={s} style={styles.specBadge}>
                                <Text style={styles.specText}>{s}</Text>
                            </View>
                        ))}
                    </View>

                    <View style={styles.statsRow}>
                        <View style={styles.statItem}>
                            <Text style={styles.statNum}>{formatExperience(doctor.startExperience)}+</Text>
                            <Text style={styles.statLabel}>Exp. Years</Text>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={styles.statItem}>
                            <View style={styles.ratingRow}>
                                <Star size={18} color="#F2C94C" fill="#F2C94C" />
                                <Text style={styles.statNum}>{Number(doctor.rating || 5).toFixed(1)}</Text>
                            </View>
                            <Text style={styles.statLabel}>Rating</Text>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={styles.statItem}>
                            <Text style={styles.statNum}>₹{doctor.consultationFee ?? '500'}</Text>
                            <Text style={styles.statLabel}>Fees</Text>
                        </View>
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>About Doctor</Text>
                    <Text style={styles.aboutText}>
                        {doctor.about || `${doctor.name} is an experienced specialist. Detailed profile information will be updated soon.`}
                    </Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Working Hours</Text>
                    <View style={styles.workingCard}>
                        <Clock3 size={22} color={Colors.primary} />
                        <Text style={styles.workingText}>{doctor.workingHours || 'Working hours not available'}</Text>
                    </View>
                </View>

                <View style={styles.videoBanner}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.videoTitle}>Video Consultation</Text>
                        <Text style={styles.videoSub}>Video consultation will be available soon.</Text>
                    </View>
                    <View style={styles.soonBadge}>
                        <Text style={styles.soonText}>Coming Soon</Text>
                    </View>
                </View>

                <View style={[styles.section, { marginTop: 24 }]}>
                    <View style={styles.rowBetween}>
                        <Text style={styles.sectionTitle}>Patient Reviews</Text>
                        <Text style={styles.reviewCount}>{reviews.length} total</Text>
                    </View>

                    {reviews.length === 0 ? (
                        <View style={styles.emptyReviews}>
                            <Ionicons name="chatbubble-ellipses-outline" size={22} color={Colors.textSecondary} />
                            <Text style={styles.emptyText}>
                                No reviews yet. Reviews will appear here after completed appointments.
                            </Text>
                        </View>
                    ) : (
                        reviews.map((rev) => (
                            <View key={rev._id} style={styles.reviewCard}>
                                <View style={styles.reviewHeader}>
                                    <View style={styles.row}>
                                        <View style={styles.reviewAvatar}>
                                            <Text style={styles.avatarTextSmall}>{rev.userId?.name?.charAt(0) || 'U'}</Text>
                                        </View>
                                        <View>
                                            <Text style={styles.reviewUserName}>{rev.userId?.name || 'User'}</Text>
                                            <Text style={styles.reviewDate}>{new Date(rev.createdAt).toLocaleDateString()}</Text>
                                        </View>
                                    </View>
                                    <View style={styles.reviewRating}>
                                        <Text style={styles.starText}>★ {rev.rating}</Text>
                                    </View>
                                </View>
                                <Text style={styles.reviewComment}>{rev.comment}</Text>
                            </View>
                        ))
                    )}
                </View>

                <View style={{ height: 100 }} />
            </ScrollView>

            <View style={styles.footer}>
                <Button
                    label="Book Appointment"
                    onPress={() => router.push({ pathname: '/doctor/book', params: { id: doctor._id, name: doctor.name } })}
                    variant="primary"
                    size="lg"
                    fullWidth
                />
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: Colors.background },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 14,
        backgroundColor: Colors.card,
        ...Shadows.card,
    },
    backBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: Colors.background,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary },
    scroll: { padding: 16 },

    profileCard: {
        backgroundColor: Colors.card,
        borderRadius: 24,
        padding: 24,
        alignItems: 'center',
        marginBottom: 20,
        ...Shadows.card,
    },
    avatarLarge: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: Colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
        borderWidth: 4,
        borderColor: Colors.primaryLight,
    },
    avatarText: { fontSize: 40, fontWeight: '700', color: '#fff' },
    doctorName: { fontSize: FontSize['2xl'], fontWeight: '700', color: Colors.textPrimary, marginBottom: 8 },
    specializationRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20, justifyContent: 'center' },
    specBadge: { backgroundColor: Colors.primaryLight, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
    specText: { color: Colors.primary, fontSize: 12, fontWeight: '600' },

    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: Colors.border,
    },
    statItem: { alignItems: 'center', flex: 1 },
    ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    statNum: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
    statLabel: { fontSize: 11, color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
    statDivider: { width: 1, height: 30, backgroundColor: Colors.border },

    section: { marginBottom: 24 },
    sectionTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary, marginBottom: 12 },
    aboutText: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 22 },

    workingCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.card,
        borderRadius: 16,
        padding: 16,
        gap: 12,
        ...Shadows.card,
    },
    workingText: { fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: '600' },

    videoBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F0F9FF',
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#BAE6FD',
    },
    videoTitle: { fontSize: FontSize.base, fontWeight: '700', color: '#0369A1' },
    videoSub: { fontSize: FontSize.xs, color: '#0EA5E9', marginTop: 2 },
    soonBadge: { backgroundColor: '#E0F2FE', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
    soonText: { fontSize: 10, fontWeight: '700', color: '#0369A1' },

    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: 16,
        paddingBottom: 32,
        backgroundColor: Colors.card,
        ...Shadows.float,
    },
    rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    row: { flexDirection: 'row', alignItems: 'center' },
    reviewCount: { fontSize: 12, color: Colors.muted },
    emptyReviews: {
        paddingVertical: 24,
        alignItems: 'center',
        backgroundColor: Colors.card,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: Colors.border,
        borderStyle: 'dashed',
    },
    emptyText: { fontSize: 12, color: Colors.textSecondary, textAlign: 'center', paddingHorizontal: 40, marginTop: 8 },
    reviewCard: {
        backgroundColor: Colors.card,
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        ...Shadows.card,
    },
    reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    reviewAvatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: Colors.primaryLight,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
    },
    avatarTextSmall: { fontSize: 12, fontWeight: '700', color: Colors.primary },
    reviewUserName: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
    reviewDate: { fontSize: 11, color: Colors.muted },
    reviewRating: {
        backgroundColor: '#FCF3CF',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    starText: { fontSize: 12, fontWeight: '700', color: '#F39C12' },
    reviewComment: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },
});

