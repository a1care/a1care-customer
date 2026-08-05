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
import { Image } from 'expo-image';

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

    const getImageUrl = (url?: string) => {
        if (!url) return null;
        return url.replace(/localhost|127\.0\.0\.1/g, '10.120.29.202');
    };

    const { data: doctor, isLoading, isError, refetch } = useQuery({
        queryKey: ['doctor', id],
        queryFn: () => doctorsService.getById(id!),
        enabled: !!id && id !== '[id]',
    });

    const { data: reviews = [] } = useQuery({
        queryKey: ['reviews', id],
        queryFn: () => reviewsService.getDoctorReviews(id!),
        enabled: !!id && id !== '[id]',
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
            {/* Soft background header */}
            <View style={styles.headerBackground} />
            <View style={styles.header}>
                <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#0F172A" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Doctor Profile</Text>
                <View style={{ width: 44 }} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
                <View style={styles.premiumProfileCard}>
                    <View style={styles.premiumAvatarContainer}>
                        <View style={styles.premiumAvatar}>
                            {(doctor.profileImage || doctor.imageUrl) ? (
                                <Image
                                    source={{ uri: getImageUrl(doctor.profileImage || doctor.imageUrl) }}
                                    style={{ width: '100%', height: '100%', borderRadius: 55 }}
                                    contentFit="cover"
                                />
                            ) : (
                                <Text style={styles.premiumAvatarText}>{doctor.name?.charAt(0).toUpperCase() ?? 'D'}</Text>
                            )}
                        </View>
                        <View style={styles.verifiedBadge}>
                            <Ionicons name="checkmark-circle" size={20} color="#16A34A" />
                        </View>
                    </View>
                    
                    <Text style={styles.premiumDoctorName}>
                        {doctor.name?.toLowerCase().startsWith('dr') ? doctor.name : `Dr. ${doctor.name}`}
                    </Text>

                    <View style={styles.premiumSpecRow}>
                        {(doctor.specialization ?? []).map((s) => (
                            <View key={s} style={styles.premiumSpecBadge}>
                                <Text style={styles.premiumSpecText}>{s}</Text>
                            </View>
                        ))}
                    </View>

                    <View style={styles.premiumStatsContainer}>
                        <View style={styles.premiumStatItem}>
                            <View style={styles.premiumStatIconBg}>
                                <Ionicons name="briefcase" size={18} color="#2563EB" />
                            </View>
                            <Text style={styles.premiumStatNum}>{formatExperience(doctor.startExperience)}+ Yrs</Text>
                            <Text style={styles.premiumStatLabel}>Experience</Text>
                        </View>
                        <View style={styles.premiumStatItem}>
                            <View style={[styles.premiumStatIconBg, { backgroundColor: '#FEF9C3' }]}>
                                <Star size={18} color="#CA8A04" fill="#CA8A04" />
                            </View>
                            <Text style={styles.premiumStatNum}>{doctor.rating ? Number(doctor.rating).toFixed(1) : 'New'}</Text>
                            <Text style={styles.premiumStatLabel}>Rating</Text>
                        </View>
                        <View style={styles.premiumStatItem}>
                            <View style={[styles.premiumStatIconBg, { backgroundColor: '#DCFCE7' }]}>
                                <Ionicons name="wallet" size={18} color="#16A34A" />
                            </View>
                            <Text style={styles.premiumStatNum}>₹{doctor.consultationFee ?? '500'}</Text>
                            <Text style={styles.premiumStatLabel}>Fees</Text>
                        </View>
                    </View>
                </View>

                {/* About Section */}
                <View style={styles.premiumSection}>
                    <Text style={styles.premiumSectionTitle}>About Doctor</Text>
                    <Text style={styles.premiumAboutText}>
                        {doctor.about || `${doctor.name} is an experienced specialist. Dedicated to providing excellent patient care with comprehensive treatment plans.`}
                    </Text>
                </View>

                {/* Working Hours */}
                <View style={styles.premiumSection}>
                    <Text style={styles.premiumSectionTitle}>Working Hours</Text>
                    <View style={styles.premiumWorkingCard}>
                        <View style={styles.premiumWorkingIcon}>
                            <Clock3 size={20} color="#2563EB" />
                        </View>
                        <View>
                            <Text style={styles.premiumWorkingTitle}>Available Today</Text>
                            <Text style={styles.premiumWorkingTime}>{doctor.workingHours || '09:00 AM - 05:00 PM'}</Text>
                        </View>
                    </View>
                </View>

                {/* Video Consultation Banner */}
                <View style={styles.premiumVideoBanner}>
                    <View style={styles.premiumVideoIcon}>
                        <Ionicons name="videocam" size={24} color="#0284C7" />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.premiumVideoTitle}>Video Consultation</Text>
                        <Text style={styles.premiumVideoSub}>Connect from anywhere.</Text>
                    </View>
                    <View style={styles.premiumSoonBadge}>
                        <Text style={styles.premiumSoonText}>Coming Soon</Text>
                    </View>
                </View>

                {/* Reviews */}
                <View style={[styles.premiumSection, { marginTop: 24 }]}>
                    <View style={styles.premiumRowBetween}>
                        <Text style={styles.premiumSectionTitle}>Patient Reviews</Text>
                        <Text style={styles.premiumReviewCount}>{reviews.length} total</Text>
                    </View>

                    {reviews.length === 0 ? (
                        <View style={styles.premiumEmptyReviews}>
                            <Ionicons name="chatbubble-ellipses-outline" size={28} color="#94A3B8" />
                            <Text style={styles.emptyText}>
                                No reviews yet. Reviews will appear here after completed appointments.
                            </Text>
                        </View>
                    ) : (
                        reviews.map((rev) => (
                            <View key={rev._id} style={styles.premiumReviewCard}>
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
                    onPress={() => router.push({ pathname: '/doctor/book', params: { id: doctor._id, serviceName: doctor.name } })}
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
        backgroundColor: 'transparent',
    },
    backBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    headerTitle: { fontSize: FontSize.lg, fontWeight: '800', color: '#0F172A' },
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
    reviewComment: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },

    // PREMIUM STYLES
    headerBackground: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 300,
        backgroundColor: '#EFF6FF',
    },
    premiumProfileCard: {
        backgroundColor: '#fff',
        borderRadius: 32,
        padding: 24,
        alignItems: 'center',
        marginTop: 10,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        shadowColor: '#2563EB',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.05,
        shadowRadius: 20,
        elevation: 4,
    },
    premiumAvatarContainer: {
        position: 'relative',
        marginBottom: 16,
    },
    premiumAvatar: {
        width: 110,
        height: 110,
        borderRadius: 55,
        backgroundColor: '#2563EB',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 6,
        borderColor: '#fff',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
    },
    premiumAvatarText: { fontSize: 44, fontWeight: '800', color: '#fff' },
    verifiedBadge: {
        position: 'absolute',
        bottom: 6,
        right: 6,
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 2,
    },
    premiumDoctorName: { fontSize: 24, fontWeight: '800', color: '#0F172A', marginBottom: 12 },
    premiumSpecRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24, justifyContent: 'center' },
    premiumSpecBadge: { backgroundColor: '#F1F5F9', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 100, borderWidth: 1, borderColor: '#E2E8F0' },
    premiumSpecText: { color: '#475569', fontSize: 13, fontWeight: '700' },

    premiumStatsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
        backgroundColor: '#F8FAFC',
        borderRadius: 24,
        padding: 20,
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    premiumStatItem: { alignItems: 'center', flex: 1 },
    premiumStatIconBg: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#DBEAFE',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    premiumStatNum: { fontSize: 16, fontWeight: '800', color: '#0F172A', marginBottom: 2 },
    premiumStatLabel: { fontSize: 12, fontWeight: '600', color: '#64748B' },

    premiumSection: { marginBottom: 28 },
    premiumSectionTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A', marginBottom: 16 },
    premiumAboutText: { fontSize: 14, color: '#475569', lineHeight: 24, fontWeight: '500' },

    premiumWorkingCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 20,
        gap: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.03,
        shadowRadius: 10,
        elevation: 2,
    },
    premiumWorkingIcon: {
        width: 48,
        height: 48,
        borderRadius: 16,
        backgroundColor: '#EFF6FF',
        justifyContent: 'center',
        alignItems: 'center',
    },
    premiumWorkingTitle: { fontSize: 13, color: '#64748B', fontWeight: '600', marginBottom: 2 },
    premiumWorkingTime: { fontSize: 16, color: '#0F172A', fontWeight: '800' },

    premiumVideoBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F0F9FF',
        padding: 20,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#BAE6FD',
        gap: 16,
    },
    premiumVideoIcon: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: '#E0F2FE',
        justifyContent: 'center',
        alignItems: 'center',
    },
    premiumVideoTitle: { fontSize: 16, fontWeight: '800', color: '#0369A1', marginBottom: 4 },
    premiumVideoSub: { fontSize: 13, color: '#0284C7', fontWeight: '500' },
    premiumSoonBadge: { backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100 },
    premiumSoonText: { fontSize: 11, fontWeight: '800', color: '#0369A1' },

    premiumRowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    premiumReviewCount: { fontSize: 14, fontWeight: '700', color: '#64748B' },
    premiumEmptyReviews: {
        paddingVertical: 32,
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderStyle: 'dashed',
    },
    premiumReviewCard: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 20,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 8,
        elevation: 1,
    },
});

