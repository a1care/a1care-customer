import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { packagesService } from '@/services/packages.service';

export default function MyPackagesScreen() {
    const router = useRouter();

    const { data: packagesData, isLoading } = useQuery({
        queryKey: ['active-packages'],
        queryFn: () => packagesService.getActivePackages(), // fetch all without filter
    });

    const activePackages = packagesData?.data || [];

    return (
        <SafeAreaView style={styles.root} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#1E293B" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>My Packages</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
                <Text style={styles.title}>Active Packages</Text>
                <Text style={styles.subtitle}>View and track your health package credits</Text>

                {isLoading ? (
                    <ActivityIndicator size="large" color="#2563EB" style={{ marginTop: 40 }} />
                ) : activePackages.length === 0 ? (
                    <View style={styles.emptyBox}>
                        <MaterialCommunityIcons name="star-circle-outline" size={48} color="#94A3B8" />
                        <Text style={styles.emptyTitle}>No Active Packages</Text>
                        <Text style={styles.emptyDesc}>You haven't purchased any health packages yet, or your previous packages have expired.</Text>
                        <TouchableOpacity style={styles.buyBtn} onPress={() => router.push('/package')}>
                            <Text style={styles.buyBtnText}>Browse Packages</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    activePackages.map((upkg: any) => {
                        const isExhausted = upkg.remainingUses <= 0;
                        const isExpired = new Date(upkg.validityEndDate) < new Date();
                        
                        return (
                            <View key={upkg._id} style={[styles.card, (isExhausted || isExpired) && { opacity: 0.6 }]}>
                                <View style={[styles.cardHeader, { backgroundColor: upkg.packageId?.color || '#2563EB' }]}>
                                    <View style={styles.headerRow}>
                                        <Text style={styles.cardTitle}>{upkg.packageId?.name || 'Health Package'}</Text>
                                        <MaterialCommunityIcons name="star-circle" size={24} color="#FFF" />
                                    </View>
                                    <Text style={styles.cardDesc} numberOfLines={1}>{upkg.packageId?.description}</Text>
                                </View>
                                
                                <View style={styles.cardBody}>
                                    <View style={styles.statRow}>
                                        <View style={styles.statBox}>
                                            <Text style={styles.statLabel}>Remaining Uses</Text>
                                            <Text style={[styles.statValue, { color: isExhausted ? '#DC2626' : '#16A34A' }]}>
                                                {upkg.remainingUses} / {upkg.totalUses}
                                            </Text>
                                        </View>
                                        <View style={styles.statDivider} />
                                        <View style={styles.statBox}>
                                            <Text style={styles.statLabel}>Valid Until</Text>
                                            <Text style={[styles.statValue, { color: isExpired ? '#DC2626' : '#0F172A' }]}>
                                                {new Date(upkg.validityEndDate).toLocaleDateString()}
                                            </Text>
                                        </View>
                                    </View>

                                    {upkg.packageId?.coveredServices?.length > 0 && (
                                        <View style={styles.coveredServices}>
                                            <Text style={styles.coveredLabel}>Covers:</Text>
                                            <View style={styles.badges}>
                                                {upkg.packageId.coveredServices.map((svc: string) => (
                                                    <View key={svc} style={styles.badge}>
                                                        <Text style={styles.badgeText}>{svc.replace('_', ' ')}</Text>
                                                    </View>
                                                ))}
                                            </View>
                                        </View>
                                    )}
                                </View>
                            </View>
                        );
                    })
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#F8FAFC' },
    header: { 
        flexDirection: 'row', 
        justifyContent: 'space-between',
        alignItems: 'center', 
        padding: 16, 
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9'
    },
    backBtn: { padding: 4 },
    headerTitle: { fontSize: 16, fontWeight: '700', color: '#1E293B' },
    
    scroll: { flex: 1 },
    scrollContent: { padding: 20, paddingBottom: 40 },
    
    title: { fontSize: 22, fontWeight: '800', color: '#0F172A', marginBottom: 6 },
    subtitle: { fontSize: 14, color: '#64748B', marginBottom: 24 },

    emptyBox: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
        backgroundColor: '#FFF',
        borderRadius: 20,
        marginTop: 20
    },
    emptyTitle: { fontSize: 18, fontWeight: '700', color: '#1E293B', marginTop: 16, marginBottom: 8 },
    emptyDesc: { fontSize: 14, color: '#64748B', textAlign: 'center', marginBottom: 24, lineHeight: 20 },
    buyBtn: { backgroundColor: '#1E3A8A', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
    buyBtnText: { color: '#FFF', fontWeight: '700', fontSize: 14 },

    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        overflow: 'hidden',
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
    },
    cardHeader: { padding: 20 },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    cardTitle: { fontSize: 18, fontWeight: '800', color: '#FFF' },
    cardDesc: { fontSize: 13, color: 'rgba(255,255,255,0.8)' },
    
    cardBody: { padding: 20 },
    statRow: { flexDirection: 'row', justifyContent: 'space-between' },
    statBox: { flex: 1, alignItems: 'center' },
    statDivider: { width: 1, backgroundColor: '#E2E8F0', marginHorizontal: 16 },
    statLabel: { fontSize: 12, color: '#64748B', fontWeight: '600', textTransform: 'uppercase', marginBottom: 4 },
    statValue: { fontSize: 16, fontWeight: '800' },

    coveredServices: { marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
    coveredLabel: { fontSize: 13, color: '#64748B', fontWeight: '600', marginBottom: 8 },
    badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    badge: { backgroundColor: '#F1F5F9', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100 },
    badgeText: { fontSize: 12, color: '#334155', fontWeight: '700' }
});
