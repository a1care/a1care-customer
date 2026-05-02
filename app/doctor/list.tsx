import React, { useState, useMemo } from 'react';
import {
    View,
    Text,
    FlatList,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    RefreshControl,
    Platform,
    TextInput,
} from 'react-native';
import { Search, X } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { doctorsService } from '@/services/doctors.service';
import { Colors, Shadows } from '@/constants/colors';
import { FontSize } from '@/constants/spacing';
import { ErrorState } from '@/components/ui/EmptyState';
import type { Doctor, Role } from '@/types';

export default function DoctorListScreen() {
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState('');

    // 1. Fetch available roles
    const { data: roles, isLoading: rolesLoading, isError: rolesError, refetch: refetchRoles } = useQuery({
        queryKey: ['roles'],
        queryFn: doctorsService.getRoles,
    });

    // 2. Identify 'Doctor' role ID
    const doctorRoleId = useMemo(() => {
        if (!roles) return null;
        return roles.find(r => r.name.toLowerCase().includes('doctor'))?._id;
    }, [roles]);

    // 3. Fetch doctors by role
    const {
        data: allDoctors,
        isLoading: doctorsLoading,
        isError: doctorsError,
        refetch: refetchDoctors,
        isRefetching
    } = useQuery({
        queryKey: ['doctors', doctorRoleId],
        queryFn: () => doctorsService.getByRole(doctorRoleId!),
        enabled: !!doctorRoleId,
    });

    const doctors = useMemo(() => {
        if (!allDoctors) return [];
        if (!searchQuery.trim()) return allDoctors;
        return allDoctors.filter(d =>
            d.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            d.specialization?.some(s => s.toLowerCase().includes(searchQuery.toLowerCase()))
        );
    }, [allDoctors, searchQuery]);

    const onRefresh = () => {
        refetchRoles();
        if (doctorRoleId) refetchDoctors();
    };

    const renderDoctor = ({ item }: { item: Doctor }) => (
        <TouchableOpacity
            style={styles.card}
            onPress={() => router.push({ pathname: '/doctor/[id]', params: { id: item._id } })}
            activeOpacity={0.8}
        >
            <View style={styles.avatar}>
                <Text style={styles.avatarText}>{item.name?.charAt(0).toUpperCase() ?? 'Dr'}</Text>
            </View>
            <View style={styles.info}>
                <Text style={styles.name}>Dr. {item.name}</Text>
                <Text style={styles.spec}>{item.specialization?.join(', ') || 'N/A'}</Text>
                <View style={styles.meta}>
                    <Text style={styles.stat}>⭐ {item.rating ? item.rating.toFixed(1) : 'N/A'}</Text>
                    <Text style={styles.dot}>•</Text>
                    <Text style={styles.stat}>{item.startExperience || '0'}+ Yrs Exp.</Text>
                </View>
            </View>
            <View style={styles.feesCol}>
                <Text style={styles.feeLabel}>Fees</Text>
                <Text style={styles.feeVal}>{item.consultationFee ? `₹${item.consultationFee}` : 'N/A'}</Text>
            </View>
        </TouchableOpacity>
    );

    const isLoading = rolesLoading || (!!doctorRoleId && doctorsLoading);
    const isError = rolesError || doctorsError;

    return (
        <SafeAreaView style={styles.root} edges={['top']}>
            {/* Header Area with Search */}
            <View style={styles.headerArea}>
                <View style={styles.headerTop}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                        <Text style={styles.backText}>←</Text>
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Available Doctors</Text>
                    <View style={{ width: 44 }} />
                </View>

                <View style={styles.searchWrapper}>
                    <View style={styles.searchBar}>
                        <Search size={18} color={Colors.muted} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search by name or specialty..."
                            placeholderTextColor={Colors.muted}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                        {searchQuery.length > 0 && (
                            <TouchableOpacity onPress={() => setSearchQuery('')}>
                                <X size={18} color={Colors.muted} />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </View>

            {isLoading && !isRefetching ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                    <Text style={styles.loadingText}>Fetching Professionals...</Text>
                </View>
            ) : isError ? (
                <ErrorState message="Could not load doctors" onRetry={onRefresh} />
            ) : (doctors ?? []).length === 0 ? (
                <View style={styles.center}>
                    <Text style={{ fontSize: 40 }}>🩺</Text>
                    <Text style={styles.emptyTitle}>No doctors found</Text>
                    <Text style={styles.emptySub}>We'll have expert doctors available soon.</Text>
                    <TouchableOpacity onPress={onRefresh} style={styles.retryBtn}>
                        <Text style={styles.retryText}>Check Again</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <FlatList
                    data={doctors}
                    keyExtractor={(item) => item._id}
                    renderItem={renderDoctor}
                    contentContainerStyle={styles.list}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={!!isRefetching}
                            onRefresh={onRefresh}
                            colors={[Colors.primary]}
                        />
                    }
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: Colors.background },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText: { marginTop: 12, fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: '500' },
    headerArea: {
        backgroundColor: Colors.card,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
        ...Shadows.card,
    },
    headerTop: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 14,
    },
    searchWrapper: {
        paddingHorizontal: 16,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.background,
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 44,
        gap: 10,
    },
    searchInput: {
        flex: 1,
        fontSize: 14,
        color: Colors.textPrimary,
        height: '100%',
    },
    backBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: Colors.background,
        justifyContent: 'center',
        alignItems: 'center',
    },
    backText: { fontSize: 24, color: Colors.textPrimary },
    headerTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary },

    list: { padding: 16 },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.card,
        padding: 14,
        borderRadius: 16,
        marginBottom: 12,
        ...Shadows.card,
    },
    avatar: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: Colors.primaryLight,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 14,
    },
    avatarText: { fontSize: 22, fontWeight: '700', color: Colors.primary },
    info: { flex: 1 },
    name: { fontSize: FontSize.base, fontWeight: '700', color: Colors.textPrimary, marginBottom: 2 },
    spec: { fontSize: 13, color: Colors.textSecondary, marginBottom: 6 },
    meta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    stat: { fontSize: 11, fontWeight: '600', color: Colors.textSecondary },
    dot: { color: Colors.muted, fontSize: 10 },
    feesCol: { alignItems: 'flex-end', paddingLeft: 10 },
    feeLabel: { fontSize: 10, color: Colors.muted, textTransform: 'uppercase' },
    feeVal: { fontSize: FontSize.base, fontWeight: '700', color: Colors.primary },

    emptyTitle: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.textPrimary, marginTop: 16, marginBottom: 8 },
    emptySub: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', paddingHorizontal: 40 },
    retryBtn: { marginTop: 20, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, backgroundColor: Colors.primaryLight },
    retryText: { color: Colors.primary, fontWeight: '700', fontSize: FontSize.sm },
});
