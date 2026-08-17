import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { packagesService } from '@/services/packages.service';
import { showToast } from '@/utils/toast';
import { Skeleton } from '@/components/Skeleton';

export default function PackageStorefrontScreen() {
    const router = useRouter();

    const { data: packagesData, isLoading } = useQuery({
        queryKey: ['public-packages'],
        queryFn: packagesService.getPublicPackages,
    });

    const { data: activePackagesData } = useQuery({
        queryKey: ['active-packages'],
        queryFn: () => packagesService.getActivePackages(),
    });

    const packages = packagesData?.data || [];
    
    // Create a Set of active package IDs
    const activePackages = activePackagesData?.data || [];
    const activePackageIds = new Set(
        activePackages
            .filter((up: any) => up.status === 'ACTIVE')
            .map((up: any) => up.packageId?._id?.toString() || up.packageId?.toString())
    );

    const handleBuy = (pkg: any) => {
        router.push({
            pathname: '/package/[id]',
            params: { id: pkg._id }
        });
    };

    return (
        <SafeAreaView style={styles.root} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#1E293B" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Health Packages</Text>
                <View style={{ width: 24 }} />
            </View>

            <FlatList
                data={isLoading ? [1, 2, 3] : (packages.length === 0 ? [] : packages)}
                keyExtractor={(item, index) => isLoading ? `skeleton-${item}` : item._id.toString()}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                initialNumToRender={5}
                maxToRenderPerBatch={5}
                windowSize={5}
                ListHeaderComponent={
                    <View style={styles.heroSection}>
                        <MaterialCommunityIcons name="shield-star" size={48} color="#2563EB" />
                        <Text style={styles.title}>Protect Your Health</Text>
                        <Text style={styles.subtitle}>Save up to 40% on consultations and treatments with our exclusive prepaid packages.</Text>
                    </View>
                }
                ListEmptyComponent={
                    !isLoading ? (
                        <View style={styles.emptyBox}>
                            <Text style={styles.emptyTitle}>No Packages Available</Text>
                            <Text style={styles.emptyDesc}>Check back later for exciting health offers!</Text>
                        </View>
                    ) : null
                }
                renderItem={({ item, index }) => {
                    if (isLoading) {
                        return (
                            <View style={styles.card}>
                                <View style={[styles.cardHeader, { backgroundColor: '#F1F5F9' }]}>
                                    <View style={styles.headerRow}>
                                        <Skeleton style={{ height: 24, width: '60%', borderRadius: 4 }} />
                                        <Skeleton style={{ height: 32, width: 60, borderRadius: 16 }} />
                                    </View>
                                    <Skeleton style={{ height: 16, width: '90%', borderRadius: 4, marginTop: 8 }} />
                                    <Skeleton style={{ height: 16, width: '70%', borderRadius: 4, marginTop: 4 }} />
                                </View>
                                <View style={styles.cardBody}>
                                    <View style={styles.features}>
                                        <View style={styles.featureRow}>
                                            <Skeleton style={{ height: 20, width: 20, borderRadius: 10 }} />
                                            <Skeleton style={{ height: 16, width: 100, borderRadius: 4, marginLeft: 8 }} />
                                        </View>
                                        <View style={styles.featureRow}>
                                            <Skeleton style={{ height: 20, width: 20, borderRadius: 10 }} />
                                            <Skeleton style={{ height: 16, width: 120, borderRadius: 4, marginLeft: 8 }} />
                                        </View>
                                    </View>
                                    <Skeleton style={{ height: 50, width: '100%', borderRadius: 12, marginTop: 12 }} />
                                </View>
                            </View>
                        );
                    }

                    const pkg = item;
                    const isActive = activePackageIds.has(pkg._id?.toString());
                    
                    return (
                        <TouchableOpacity 
                            style={[styles.card, isActive && { borderColor: '#10B981', borderWidth: 2 }]}
                            activeOpacity={isActive ? 1 : 0.9}
                            onPress={() => !isActive && handleBuy(pkg)}
                        >
                            <View style={[styles.cardHeader, { backgroundColor: pkg.color || '#2563EB' }]}>
                                <View style={styles.headerRow}>
                                    <Text style={styles.cardTitle}>{pkg.name}</Text>
                                    <View style={styles.priceTag}>
                                        <Text style={styles.priceText}>₹{pkg.price}</Text>
                                    </View>
                                </View>
                                <Text style={styles.cardDesc}>{pkg.description}</Text>
                                {isActive && (
                                    <View style={{ backgroundColor: '#10B981', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, alignSelf: 'flex-start', marginTop: 12, flexDirection: 'row', alignItems: 'center' }}>
                                        <Ionicons name="checkmark-circle" size={16} color="#FFF" style={{ marginRight: 6 }} />
                                        <Text style={{ color: '#FFF', fontWeight: 'bold', fontSize: 13 }}>Current Plan</Text>
                                    </View>
                                )}
                            </View>
                            
                            <View style={styles.cardBody}>
                                <View style={styles.features}>
                                    <View style={styles.featureRow}>
                                        <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                                        <Text style={styles.featureText}>{pkg.usageLimit} Total Uses</Text>
                                    </View>
                                    <View style={styles.featureRow}>
                                        <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                                        <Text style={styles.featureText}>Valid for {pkg.validityDays} Days</Text>
                                    </View>
                                </View>

                                {pkg.coveredServices?.length > 0 && (
                                    <View style={styles.coveredServices}>
                                        <Text style={styles.coveredLabel}>Covers:</Text>
                                        <View style={styles.badges}>
                                            {pkg.coveredServices.map((svc: string) => (
                                                <View key={svc} style={styles.badge}>
                                                    <Text style={styles.badgeText}>{svc.replace('_', ' ')}</Text>
                                                </View>
                                            ))}
                                        </View>
                                    </View>
                                )}

                                <TouchableOpacity 
                                    style={[styles.buyBtn, isActive && { backgroundColor: '#E2E8F0' }]} 
                                    onPress={() => !isActive && handleBuy(pkg)}
                                    activeOpacity={0.8}
                                    disabled={isActive}
                                >
                                    <Text style={[styles.buyBtnText, isActive && { color: '#64748B' }]}>{isActive ? 'Purchased' : 'Buy Now'}</Text>
                                    {!isActive && <Ionicons name="arrow-forward" size={18} color="#FFF" />}
                                </TouchableOpacity>
                            </View>
                        </TouchableOpacity>
                    );
                }}
            />
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
    
    heroSection: { alignItems: 'center', marginBottom: 24, paddingHorizontal: 10 },
    title: { fontSize: 24, fontWeight: '800', color: '#0F172A', marginTop: 12, marginBottom: 8, textAlign: 'center' },
    subtitle: { fontSize: 15, color: '#64748B', textAlign: 'center', lineHeight: 22 },

    emptyBox: { alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: '#FFF', borderRadius: 20 },
    emptyTitle: { fontSize: 16, fontWeight: '700', color: '#1E293B', marginBottom: 8 },
    emptyDesc: { fontSize: 14, color: '#64748B', textAlign: 'center' },

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
    cardHeader: { padding: 20, paddingBottom: 24 },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
    cardTitle: { fontSize: 20, fontWeight: '800', color: '#FFF', flex: 1, marginRight: 12 },
    priceTag: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100 },
    priceText: { fontSize: 16, fontWeight: '800', color: '#FFF' },
    cardDesc: { fontSize: 14, color: 'rgba(255,255,255,0.9)', lineHeight: 20 },
    
    cardBody: { padding: 20, backgroundColor: '#FFF', marginTop: -10, borderTopLeftRadius: 12, borderTopRightRadius: 12 },
    
    features: { marginBottom: 16 },
    featureRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    featureText: { fontSize: 14, color: '#334155', marginLeft: 8, fontWeight: '500' },

    coveredServices: { marginTop: 4, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#F1F5F9', marginBottom: 20 },
    coveredLabel: { fontSize: 13, color: '#64748B', fontWeight: '600', marginBottom: 8 },
    badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    badge: { backgroundColor: '#F1F5F9', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100 },
    badgeText: { fontSize: 12, color: '#334155', fontWeight: '700' },

    buyBtn: { 
        backgroundColor: '#0F172A', 
        flexDirection: 'row', 
        alignItems: 'center', 
        justifyContent: 'center', 
        paddingVertical: 14, 
        borderRadius: 12,
        gap: 8
    },
    buyBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' }
});
