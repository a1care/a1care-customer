import React from 'react';
import {
    View, Text, TouchableOpacity, Share, StyleSheet,
    ActivityIndicator, ScrollView, Alert, Clipboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { referralService } from '@/services/referral.service';
import { Colors } from '@/constants/colors';

const HOW_STEPS = [
    { icon: 'share-social-outline' as const, color: '#2563EB', bg: '#EEF4FF', title: 'Share Your Code', desc: 'Send your unique code to friends & family' },
    { icon: 'person-add-outline' as const, color: '#7C3AED', bg: '#F3EEFF', title: 'Friend Signs Up', desc: 'They register and use your referral code' },
    { icon: 'wallet-outline' as const, color: '#16A34A', bg: '#ECFDF5', title: 'Both Earn Rewards', desc: 'You get ₹100 added to your A1Care wallet' },
];

export default function ReferralScreen() {
    const router = useRouter();

    const { data, isLoading, isError } = useQuery({
        queryKey: ['referral-code'],
        queryFn: referralService.getMyCode,
    });

    const { data: earningsData } = useQuery({
        queryKey: ['referral-earnings'],
        queryFn: referralService.getMyEarnings,
    });

    const handleShare = async () => {
        if (!data?.shareMessage) return;
        try { await Share.share({ message: data.shareMessage }); } catch (e) { }
    };

    const handleCopy = () => {
        if (!data?.referralCode) return;
        Clipboard.setString(data.referralCode);
        Alert.alert('Copied!', 'Referral code copied to clipboard.');
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={22} color="#0F172A" />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={styles.headerTitle}>Refer & Earn</Text>
                    <Text style={styles.headerSub}>Invite friends, grow together</Text>
                </View>
                <View style={{ width: 44 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

                {/* Hero Banner */}
                <LinearGradient
                    colors={['#0B3370', '#1A5FAD', '#2878D0']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={styles.hero}
                >
                    {/* Decorative blobs */}
                    <View style={styles.blob1} />
                    <View style={styles.blob2} />
                    <View style={styles.blob3} />

                    {/* Gift icon circle */}
                    <View style={styles.giftCircle}>
                        <Ionicons name="gift" size={38} color="#fff" />
                    </View>

                    <Text style={styles.heroTitle}>
                        Invite Friends,{'\n'}Earn {data?.rewardAmount ? `₹${data.rewardAmount}` : '₹100'}
                    </Text>
                    <Text style={styles.heroSub}>
                        For every friend who books their first service using your code, you get rewarded in your A1Care wallet.
                    </Text>

                    {/* Reward pill */}
                    <View style={styles.rewardPill}>
                        <Ionicons name="star" size={12} color="#FBBF24" />
                        <Text style={styles.rewardPillText}>₹{data?.rewardAmount ?? 100} per successful referral</Text>
                    </View>
                </LinearGradient>

                {/* Your Code Card */}
                <View style={styles.card}>
                    <View style={styles.cardHeaderRow}>
                        <View style={styles.cardLabelDot} />
                        <Text style={styles.cardLabel}>YOUR REFERRAL CODE</Text>
                    </View>

                    {isLoading ? (
                        <ActivityIndicator color={Colors.primary} style={{ marginVertical: 20 }} />
                    ) : isError ? (
                        <Text style={{ color: '#EF4444', fontSize: 13, fontWeight: '600' }}>Failed to load code</Text>
                    ) : (
                        <>
                            <TouchableOpacity style={styles.codeBox} onPress={handleCopy} activeOpacity={0.85}>
                                <Text style={styles.codeText}>{data?.referralCode ?? '———'}</Text>
                                <View style={styles.copyPill}>
                                    <Ionicons name="copy-outline" size={14} color="#2563EB" />
                                    <Text style={styles.copyPillText}>Copy</Text>
                                </View>
                            </TouchableOpacity>

                            <TouchableOpacity onPress={handleShare} style={styles.shareBtn} activeOpacity={0.88}>
                                <LinearGradient
                                    colors={['#0B3370', '#1A5FAD']}
                                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                                    style={styles.shareBtnInner}
                                >
                                    <Ionicons name="share-social" size={18} color="#FFF" />
                                    <Text style={styles.shareBtnText}>Share with Friends</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        </>
                    )}
                </View>

                {/* Referral History */}
                <View style={styles.card}>
                    <View style={styles.cardHeaderRow}>
                        <View style={[styles.cardLabelDot, { backgroundColor: '#16A34A' }]} />
                        <Text style={styles.cardLabel}>REFERRAL HISTORY</Text>
                        {(earningsData?.items?.length ?? 0) > 0 && (
                            <View style={styles.historyCountBadge}>
                                <Text style={styles.historyCountText}>{earningsData!.items.length}</Text>
                            </View>
                        )}
                    </View>

                    {(!earningsData?.items || earningsData.items.length === 0) ? (
                        <View style={styles.emptyHistory}>
                            <View style={styles.emptyIconBox}>
                                <Ionicons name="people-outline" size={34} color="#CBD5E1" />
                            </View>
                            <Text style={styles.emptyTitle}>No referrals yet</Text>
                            <Text style={styles.emptyDesc}>Share your code and start earning rewards!</Text>
                        </View>
                    ) : (
                        <View style={{ gap: 12 }}>
                            {earningsData.items.map((item: any, index: number) => {
                                const isRewarded = item.status === 'REWARDED';
                                return (
                                    <View key={index} style={styles.historyItem}>
                                        <View style={[styles.historyIconBox, { backgroundColor: isRewarded ? '#ECFDF5' : '#FFF7ED' }]}>
                                            <Ionicons
                                                name={isRewarded ? 'checkmark-circle' : 'time'}
                                                size={20}
                                                color={isRewarded ? '#16A34A' : '#EA580C'}
                                            />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.historyName}>{item.refereeId?.name || 'Pending User'}</Text>
                                            <Text style={[styles.historyStatus, { color: isRewarded ? '#16A34A' : '#EA580C' }]}>
                                                {isRewarded ? '✓ Reward Earned' : '⏳ Awaiting first booking'}
                                            </Text>
                                        </View>
                                        <Text style={[styles.historyAmount, { color: isRewarded ? '#16A34A' : '#EA580C' }]}>
                                            +₹{item.rewardAmount}
                                        </Text>
                                    </View>
                                );
                            })}
                        </View>
                    )}
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F4F7FC' },

    // Header
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 14,
        backgroundColor: '#FFFFFF',
        shadowColor: '#0A1A3A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 12,
        elevation: 4,
    },
    backBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#F1F5F9',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 14,
    },
    headerTitle: { fontSize: 20, fontWeight: '900', color: '#0F172A', letterSpacing: -0.3 },
    headerSub: { fontSize: 12, color: '#94A3B8', fontWeight: '600', marginTop: 2 },

    // Scroll
    scroll: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 20 },

    // Hero
    hero: {
        borderRadius: 32,
        padding: 32,
        marginBottom: 20,
        alignItems: 'center',
        overflow: 'hidden',
        position: 'relative',
        shadowColor: '#0B3370',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.25,
        shadowRadius: 24,
        elevation: 12,
    },
    blob1: { position: 'absolute', top: -50, right: -50, width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(255,255,255,0.06)' },
    blob2: { position: 'absolute', bottom: -30, left: -30, width: 110, height: 110, borderRadius: 55, backgroundColor: 'rgba(255,255,255,0.06)' },
    blob3: { position: 'absolute', top: 20, left: -40, width: 90, height: 90, borderRadius: 45, backgroundColor: 'rgba(255,255,255,0.04)' },
    giftCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(255,255,255,0.15)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 18,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.25)',
    },
    heroTitle: { fontSize: 28, fontWeight: '900', color: '#fff', textAlign: 'center', marginBottom: 12, letterSpacing: -0.5 },
    heroSub: { fontSize: 14, color: 'rgba(255,255,255,0.82)', textAlign: 'center', lineHeight: 22, fontWeight: '500', marginBottom: 20 },
    rewardPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(255,255,255,0.18)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
    },
    rewardPillText: { color: '#fff', fontSize: 13, fontWeight: '800', letterSpacing: 0.3 },

    // Card
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 28,
        padding: 22,
        marginBottom: 16,
        shadowColor: '#0A1A3A',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.05,
        shadowRadius: 20,
        elevation: 5,
    },
    cardHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 18 },
    cardLabelDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#2563EB' },
    cardLabel: { flex: 1, fontSize: 11, fontWeight: '900', color: '#94A3B8', letterSpacing: 1.4, textTransform: 'uppercase' },

    // Code box
    codeBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F0F5FF',
        borderRadius: 20,
        paddingHorizontal: 22,
        paddingVertical: 18,
        marginBottom: 16,
        borderWidth: 1.5,
        borderColor: '#DBEAFE',
    },
    codeText: { flex: 1, fontSize: 30, fontWeight: '900', color: '#0B3370', letterSpacing: 8 },
    copyPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#DBEAFE',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 12,
    },
    copyPillText: { fontSize: 12, fontWeight: '800', color: '#2563EB' },

    // Share button
    shareBtn: { borderRadius: 22, overflow: 'hidden' },
    shareBtnInner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        paddingVertical: 18,
    },
    shareBtnText: { fontSize: 16, fontWeight: '900', color: '#FFF', letterSpacing: 0.3 },

    // How it works steps
    stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 16, position: 'relative' },
    stepIconBox: {
        width: 46,
        height: 46,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    stepTitle: { fontSize: 15, fontWeight: '900', color: '#0F172A', marginBottom: 3 },
    stepDesc: { fontSize: 13, color: '#64748B', fontWeight: '500', lineHeight: 18 },
    stepConnector: {
        position: 'absolute',
        left: 22,
        top: 50,
        width: 2,
        height: 20,
        backgroundColor: '#E2E8F0',
    },

    // History
    historyCountBadge: {
        backgroundColor: '#ECFDF5',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10,
    },
    historyCountText: { fontSize: 11, fontWeight: '900', color: '#16A34A' },
    emptyHistory: { alignItems: 'center', paddingVertical: 24, gap: 10 },
    emptyIconBox: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: '#F8FAFC',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 4,
    },
    emptyTitle: { fontSize: 16, fontWeight: '900', color: '#334155' },
    emptyDesc: { fontSize: 13, color: '#94A3B8', fontWeight: '500', textAlign: 'center' },
    historyItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        backgroundColor: '#F8FAFC',
        borderRadius: 18,
        padding: 14,
    },
    historyIconBox: { width: 42, height: 42, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
    historyName: { fontSize: 14, fontWeight: '800', color: '#0F172A', marginBottom: 3 },
    historyStatus: { fontSize: 12, fontWeight: '700' },
    historyAmount: { fontSize: 16, fontWeight: '900' },
});
