import React, { useRef, useState } from 'react';
import {
    View,
    Text,
    ScrollView,
    Pressable,
    TouchableOpacity,
    TextInput,
    StyleSheet,
    ActivityIndicator,
    RefreshControl,
    Image,
    Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, useNavigation } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { servicesService } from '@/services/services.service';
import { Colors, Shadows } from '@/constants/colors';
import { FontSize } from '@/constants/spacing';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { SkeletonListItem, SkeletonSubCard, SkeletonChildCard } from '@/components/ui/Skeleton';
import type { Service, SubService, ChildService } from '@/types';

// ─── Level types ──────────────────────────────────────────────────────────────
type DrillLevel = 'services' | 'sub' | 'child';

// ─── Service icon emoji map ───────────────────────────────────────────────────
const SERVICE_ICONS: Record<number, string> = {
    0: '🏥', 1: '💉', 2: '🚑', 3: '🧪', 4: '💊', 5: '🩺',
    6: '🧬', 7: '🫀', 8: '🧪', 9: '👁️',
};

function serviceEmoji(name: string, idx: number) {
    const n = (name || '').toLowerCase();
    if (n.includes('ambulance') || n.includes('emergency')) return '🚑';
    if (n.includes('nurse') || n.includes('nursing')) return '🩺';
    if (n.includes('lab') || n.includes('test')) return '🧪';
    if (n.includes('doctor') || n.includes('consult')) return '👨‍⚕️';
    if (n.includes('diagnostic')) return '🏥';
    return SERVICE_ICONS[idx % 10] ?? '⚕️';
}

function ServiceRow({
    emoji,
    imageUrl,
    name,
    subtitle,
    price,
    onPress,
    showCOD = false,
    showArrow = true,
}: {
    emoji: string;
    imageUrl?: string;
    name: string;
    subtitle?: string;
    price?: number;
    onPress: () => void;
    showCOD?: boolean;
    showArrow?: boolean;
}) {
    return (
        <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.88}>
            {/* Image panel — flush left, full height, no inner padding */}
            <View style={styles.rowImagePanel}>
                {imageUrl && imageUrl.trim().length > 0 ? (
                    <Image source={{ uri: imageUrl }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
                ) : (
                    <Text style={{ fontSize: 28 }}>{emoji}</Text>
                )}
            </View>
            <View style={styles.rowContent}>
                <Text style={styles.rowName} numberOfLines={1}>{name}</Text>
                {subtitle ? (
                    <Text style={styles.rowSub} numberOfLines={1}>{subtitle}</Text>
                ) : null}
            </View>
            <View style={styles.rowRight}>
                {price !== undefined && (
                    <Text style={styles.rowPrice}>₹{price}</Text>
                )}
                <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
            </View>
        </TouchableOpacity>
    );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function ServicesScreen() {
    const router = useRouter();
    const navigation = useNavigation();
    const rawParams = useLocalSearchParams<{ category?: string | string[]; subCategory?: string | string[]; serviceId?: string | string[]; subServiceId?: string | string[]; from?: string | string[] }>();
    const category = Array.isArray(rawParams.category) ? rawParams.category[0] : rawParams.category;
    const subCategory = Array.isArray(rawParams.subCategory) ? rawParams.subCategory[0] : rawParams.subCategory;
    const serviceId = Array.isArray(rawParams.serviceId) ? rawParams.serviceId[0] : rawParams.serviceId;
    const subServiceId = Array.isArray(rawParams.subServiceId) ? rawParams.subServiceId[0] : rawParams.subServiceId;
    const from = Array.isArray(rawParams.from) ? rawParams.from[0] : rawParams.from;
    const isFromIndex = from === 'home' || from === 'index';
    const initialLevel: DrillLevel = subServiceId ? 'child' : ((serviceId || category) ? 'sub' : 'services');
    const [level, setLevel] = useState<DrillLevel>(initialLevel);
    const [selectedService, setSelectedService] = useState<Service | null>(null);
    const [selectedSub, setSelectedSub] = useState<SubService | null>(null);
    const [search, setSearch] = useState('');
    const hasRestoredDeepLinkRef = useRef(false);
    const navLockRef = useRef(false);
    const lastNavRef = useRef<{ key: string; ts: number } | null>(null);

    // ── Tab Bar Interaction ──
    // Reset to root services when the Services tab is pressed in the bottom bar
    useEffect(() => {
        const unsubscribe = navigation.addListener('tabPress', () => {
            // Reset state
            setLevel('services');
            setSelectedService(null);
            setSelectedSub(null);
            setSearch('');
            hasRestoredDeepLinkRef.current = false;
            // Clear params
            router.setParams({ category: '', serviceId: '', subServiceId: '', from: '' } as any);
        });
        return unsubscribe;
    }, [navigation, router]);

    // ── Back Handler (Android hardware back button) ──
    useEffect(() => {
        const onBackPress = () => {
            if (level === 'child' || level === 'sub') {
                goBack();
                return true;
            }
            if (level === 'services' && isFromIndex) {
                router.replace('/');
                return true;
            }
            return false; // let the OS handle (exit tab)
        };

        const subscription = require('react-native').BackHandler.addEventListener(
            'hardwareBackPress',
            onBackPress
        );
        return () => subscription.remove();
    }, [level, from, isFromIndex, router]);

    // ── Root services ──
    const {
        data: services,
        isLoading: servicesLoading,
        isError: servicesErr,
        refetch: refetchServices,
    } = useQuery({
        queryKey: ['services'],
        queryFn: servicesService.getAll,
        retry: 2,
        placeholderData: (prev) => prev,
    });

    // ── Sub-services ──
    const {
        data: subServices,
        isLoading: subLoading,
        isError: subErr,
        refetch: refetchSubs,
    } = useQuery({
        queryKey: ['sub-services', (selectedService?._id || (selectedService as any)?.id)],
        queryFn: () => servicesService.getSubServices(selectedService!._id),
        enabled: !!selectedService && level === 'sub',
        retry: 2,
        placeholderData: (prev) => prev,
    });

    // ── Child services ──
    const {
        data: childServices,
        isLoading: childLoading,
        isError: childErr,
        refetch: refetchChildren,
    } = useQuery({
        queryKey: ['child-services', (selectedSub?._id || (selectedSub as any)?.id)],
        queryFn: () => servicesService.getChildServices(selectedSub!._id),
        enabled: !!selectedSub && level === 'child',
        retry: 2,
        placeholderData: (prev) => prev,
    });

    // ── Handle Initial Deep Link ──
    useEffect(() => {
        // If we are currently clearing params (e.g. from tabPress), don't try to restore
        if (!category && !serviceId) {
            if (level !== 'services') {
                setLevel('services');
                setSelectedService(null);
            }
            return;
        }

        if (services && (category || serviceId)) {
            const target = services.find(s => {
                const sid = (s._id || (s as any).id); if (serviceId && String(sid) === String(serviceId)) return true;
                if (!category) return false;
                const sName = s.name.toLowerCase();
                const cName = category.toLowerCase();
                if (sName === cName) return true;
                if (sName.includes(cName) || cName.includes(sName)) return true;

                const sWords = sName.split(/\s+/).filter(w => w.length > 2);
                const cWords = cName.split(/\s+/).filter(w => w.length > 2);
                return sWords.some(sw => cWords.includes(sw)) || cWords.some(cw => sWords.includes(cw));
            });
            if (target) {
                if ((selectedService?._id || (selectedService as any)?.id) !== target._id) {
                    setSelectedService(target);
                }
                if (level === 'services') {
                    setLevel('sub');
                }
            } else {
                // Fallback: if target service not found, go back to all services
                setLevel('services');
                setSelectedService(null);
            }
        } else if (services && !category && !serviceId && level !== 'services') {
            // Explicit reset if navigating to services tab without specific target
            setLevel('services');
            setSelectedService(null);
            setSelectedSub(null);
            setSearch('');
        }
    }, [services, category, serviceId, subServiceId, level, (selectedService?._id || (selectedService as any)?.id)]);

    useEffect(() => {
        hasRestoredDeepLinkRef.current = false;
    }, [serviceId, subServiceId]);

    // Deep-link restore: when a sub-service context is provided, restore child procedure list.
    useEffect(() => {
        if (hasRestoredDeepLinkRef.current) return;
        if (!subServiceId || !subServices?.length) return;
        if ((selectedSub?._id || (selectedSub as any)?.id) === subServiceId) return;
        const targetSub = subServices.find((s) => String((s._id || (s as any).id)) === String(subServiceId));
        if (targetSub) {
            setSelectedSub(targetSub);
            setLevel('child');
            hasRestoredDeepLinkRef.current = true;
        }
    }, [level, subServiceId, subServices, (selectedSub?._id || (selectedSub as any)?.id)]);

    const handleServicePress = async (s: any) => {
        // Fast-track for Emergency / Ambulance (2-step booking)
        if (s.type === 'Emergency' || s.name.toLowerCase().includes('ambulance')) {
            try {
                const subs = await servicesService.getSubServices((s._id || (s as any).id) as string);
                if (subs && subs.length > 0) {
                    const children = await servicesService.getChildServices(subs[0]._id);
                    if (children && children.length > 0) {
                        const targetChild = children[0]; // Auto pick first (e.g., BLS)
                        setSelectedService(s);
                        setLevel('sub');
                        router.push({
                            pathname: '/service/[id]',
                            params: {
                                id: (targetChild._id || (targetChild as any).id) as string,
                                name: targetChild.name,
                                price: targetChild.price,
                                subName: subs[0].name,
                                from: isFromIndex ? from : 'services',
                                entryMode: 'direct',
                                originServiceId: '',
                                originSubServiceId: '',
                                originCategory: '',
                            }
                        });
                        return;
                    }
                }
            } catch (err) {
                console.error("Fast track failed", err);
            }
        }

        // Normal Flow
        setSelectedService(s);
        setLevel('sub');
        router.setParams({
            serviceId: (s._id || (s as any).id) as string,
            category: s.name,
            from: isFromIndex ? from : 'services',
        } as any);
    };

    // ── Breadcrumb back (header back button & Android hardware back) ──
    const goBack = () => {
        if (level === 'child') {
            setLevel('sub');
            setSelectedSub(null);
            setSearch('');
            // Clear subServiceId param so deep-link effect doesn't re-trigger
            router.setParams({ subServiceId: '' } as any);
        } else if (level === 'sub') {
            if (isFromIndex) {
                // Came from Home tab directly into a category — go back to Home
                router.replace('/');
            } else {
                setLevel('services');
                setSelectedService(null);
                setSearch('');
                // Clear all category params
                router.setParams({ serviceId: '', category: '', subServiceId: '', from: '' } as any);
            }
        } else if (level === 'services' && isFromIndex) {
            // At root services list but arrived from Home tab
            router.replace('/');
        } else {
            if (router.canGoBack()) {
                router.back();
            } else {
                router.replace('/');
            }
        }
    };

    const openChildServiceDetail = (c: ChildService) => {
        const navKey = `${(c._id || (c as any).id) ?? ""}:${(selectedSub?._id || (selectedSub as any)?.id) ?? ""}`;
        const now = Date.now();
        const prev = lastNavRef.current;
        if (prev && prev.key === navKey && now - prev.ts < 1200) return;
        if (navLockRef.current) return;
        navLockRef.current = true;
        lastNavRef.current = { key: navKey, ts: now };
        router.push({
            pathname: '/service/[id]',
            params: {
                id: (c._id || (c as any).id) as string,
                name: c.name,
                price: c.price,
                subName: selectedSub?.name,
                from: isFromIndex ? from : 'services',
                originServiceId: (selectedService?._id || (selectedService as any)?.id),
                originSubServiceId: (selectedSub?._id || (selectedSub as any)?.id),
                originCategory: selectedService?.name,
            }
        });
        setTimeout(() => { navLockRef.current = false; }, 700);
    };

    // ── Filtered root services ──
    const filteredServices = services
        ? search.trim()
            ? services.filter((s) =>
                s.name.toLowerCase().includes(search.toLowerCase())
            )
            : services
        : [];

    const isResolvingRouteContext =
        ((level === 'sub' || level === 'child') && !!(serviceId || category) && !selectedService) ||
        (level === 'child' && !!subServiceId && !selectedSub);

    const isLoading =
        isResolvingRouteContext ||
        (level === 'services' && (servicesLoading || !services)) ||
        (level === 'sub' && (subLoading || !subServices || !selectedService)) ||
        (level === 'child' && (childLoading || !childServices || !selectedSub));
    const isError = servicesErr || subErr || childErr;
    const onRetry = level === 'services' ? refetchServices : level === 'sub' ? refetchSubs : refetchChildren;

    return (
        <SafeAreaView style={styles.root} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={goBack} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={20} color={Colors.textPrimary} />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={styles.headerTitle}>
                        {level === 'services'
                            ? 'Browse Services'
                            : level === 'sub'
                                ? (selectedService?.name ?? 'Services')
                                : (selectedSub?.name ?? subCategory ?? 'Sub-services')}
                    </Text>
                    {/* Subtitle: parent name for context */}
                    {/* Subtitle: parent name for context */}
                    {level === 'sub' && (selectedService || category) && (
                        <Text style={styles.headerSub}>{selectedService?.name ?? category ?? ''}</Text>
                    )}
                    {level === 'child' && (selectedSub || subCategory) && (
                        <Text style={styles.headerSub}>{(selectedService?.name ?? category ?? '')} › {(selectedSub?.name ?? subCategory ?? '')}</Text>
                    )}
                </View>
            </View>

            {/* Universal Search Bar */}
            <View style={styles.searchWrap}>
                <TextInput
                    style={styles.searchInput}
                    placeholder={`Search in ${level === 'services' ? 'Services' : level === 'sub' ? 'Categories' : 'Procedures'}…`}
                    placeholderTextColor={Colors.muted}
                    value={search}
                    onChangeText={setSearch}
                    returnKeyType="search"
                    clearButtonMode="while-editing"
                />
                {search.length > 0 && (
                    <TouchableOpacity onPress={() => setSearch('')} style={styles.searchClear}>
                        <Text style={styles.searchClearText}>✕</Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* Content */}
            {isError ? (
                <ErrorState message="Failed to load services. Please try again." onRetry={onRetry} />
            ) : isLoading ? (
                <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
                    {[1, 2, 3, 4, 5].map((i) => <SkeletonListItem key={i} />)}
                </ScrollView>
            ) : (
                <ScrollView
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    refreshControl={
                        <RefreshControl
                            refreshing={servicesLoading || subLoading || childLoading}
                            onRefresh={onRetry}
                            colors={[Colors.primary]}
                            tintColor={Colors.primary}
                        />
                    }
                >
                    {/* Level: Root services */}
                    {level === 'services' &&
                        filteredServices.map((s, idx) => (
                            <View key={s._id || (s as any).id}>
                                <ServiceRow
                                    emoji={serviceEmoji(s.name, idx)}
                                    imageUrl={s.imageUrl}
                                    name={s.name}
                                    subtitle={s.title ?? s.type ?? undefined}
                                    onPress={() => {
                                        setSearch('');
                                        handleServicePress(s);
                                    }}
                                />
                            </View>
                        ))}

                    {level === 'services' && filteredServices.length === 0 && !servicesLoading && (
                        <EmptyState
                            icon="🔍"
                            title="No services found"
                            subtitle={search ? `Try searching for something else` : 'No services available yet'}
                            actionLabel={search ? 'Clear Search' : undefined}
                            onAction={search ? () => setSearch('') : undefined}
                        />
                    )}

                    {/* Level: Sub-services */}
                    {level === 'sub' &&
                        (subServices ?? [])
                            .filter(s => search.trim() ? s.name.toLowerCase().includes(search.toLowerCase()) : true)
                            .map((s, idx) => (
                                <TouchableOpacity
                                    key={s._id || (s as any).id}
                                    style={styles.subCard}
                                    onPress={() => {
                                        setSearch('');
                                        setSelectedSub(s);
                                        setLevel('child');
                                        router.setParams({
                                            serviceId: (selectedService?._id || (selectedService as any)?.id),
                                            subServiceId: (s._id || (s as any).id) as string,
                                            category: selectedService?.name,
                                            from: isFromIndex ? from : 'services',
                                        } as any);
                                    }}
                                    activeOpacity={0.85}
                                >
                                    {/* Image panel flush left, full height */}
                                    <View style={styles.subImagePanel}>
                                        {s.imageUrl && s.imageUrl.trim().length > 0 ? (
                                            <Image
                                                source={{ uri: s.imageUrl }}
                                                style={StyleSheet.absoluteFillObject}
                                                resizeMode="cover" />
                                        ) : (
                                            <Text style={{ fontSize: 32 }}>{serviceEmoji(s.name, idx)}</Text>
                                        )}
                                    </View>
                                    <View style={styles.subCardContent}>
                                        <Text style={styles.childName} numberOfLines={1}>{s.name}</Text>
                                        {s.description ? (
                                            <Text style={styles.childDesc} numberOfLines={2}>
                                                {s.description}
                                            </Text>
                                        ) : null}
                                    </View>
                                    <View style={[styles.rowRight, { paddingRight: 16 }]}>
                                        <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
                                    </View>
                                </TouchableOpacity>
                            ))}

                    {level === 'sub' && !subLoading && (subServices ?? []).length === 0 && (
                        <EmptyState
                            icon="📋"
                            title="No categories found"
                            subtitle="There are no sub-categories for this service yet."
                            actionLabel="Back to All Services"
                            onAction={goBack}
                        />
                    )}

                    {/* Level: Child services — bookable items */}
                    {level === 'child' &&
                        (childServices ?? [])
                            .filter(c => search.trim() ? c.name.toLowerCase().includes(search.toLowerCase()) : true)
                            .map((c) => (
                                <Pressable
                                    key={c._id || (c as any).id}
                                    style={[styles.childCard, { padding: 16 }]}
                                    onPress={() => openChildServiceDetail(c)}
                                >
                                    <View style={[styles.childTop, { marginBottom: 12 }]}>
                                        <View style={[styles.childIconBg, { width: 56, height: 56, borderRadius: 16, overflow: 'hidden' }]}>
                                            {c.imageUrl ? (
                                                <Image source={{ uri: c.imageUrl }} style={{ width: 56, height: 56 }} resizeMode="cover" />
                                            ) : (
                                                <Text style={{ fontSize: 24 }}>⚕️</Text>
                                            )}
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={[styles.childName, { fontSize: 18, marginBottom: 2 }]}>{c.name}</Text>
                                            <Text style={[styles.childDesc, { fontSize: 14 }]} numberOfLines={2}>
                                                {c.description || 'Professional healthcare service'}
                                            </Text>
                                        </View>
                                    </View>

                                    <View style={styles.childBottom}>
                                        {c.price !== undefined && c.price > 0 ? (
                                            <Text style={styles.childPrice}>₹{c.price}</Text>
                                        ) : (
                                            <Text style={styles.childPriceNA}>Price on request</Text>
                                        )}
                                        <TouchableOpacity
                                            style={styles.bookBtn}
                                            onPress={(e) => {
                                                (e as any)?.stopPropagation?.();
                                                openChildServiceDetail(c);
                                            }}
                                            disabled={navLockRef.current}
                                        >
                                            <Text style={styles.bookBtnText}>Book Now</Text>
                                        </TouchableOpacity>
                                    </View>
                                </Pressable>
                            ))}

                    {level === 'child' && !childLoading && (childServices?.length ?? 0) === 0 && (
                        <EmptyState
                            icon="📋"
                            title="No services available"
                            subtitle="Check back later or try another category"
                            actionLabel="Go Back"
                            onAction={goBack}
                        />
                    )}

                    <View style={{ height: 100 }} />
                </ScrollView>
            )}
        </SafeAreaView>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#F8FAFC' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        backgroundColor: Colors.card,
        gap: 16,
    },
    backBtn: {
        width: 42,
        height: 42,
        borderRadius: 14,
        backgroundColor: '#F1F5F9',
        justifyContent: 'center',
        alignItems: 'center',
    },
    backText: { fontSize: 22, color: Colors.textPrimary, fontWeight: '600' },
    headerTitle: { fontSize: 24, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.5 },
    headerSub: { fontSize: 12, color: Colors.textSecondary, marginTop: 2, fontWeight: '500' },

    // Search
    searchWrap: {
        paddingHorizontal: 20,
        marginVertical: 12,
    },
    searchInput: {
        backgroundColor: Colors.card,
        borderRadius: 20,
        paddingHorizontal: 20,
        paddingVertical: 14,
        fontSize: 16,
        color: Colors.textPrimary,
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
        paddingRight: 45,
        ...Shadows.card,
        shadowOpacity: 0.05,
    },
    searchClear: {
        position: 'absolute',
        right: 32,
        top: 0,
        bottom: 0,
        justifyContent: 'center',
    },
    searchClearText: { fontSize: 14, color: Colors.muted, fontWeight: '700' },

    // Video hero banner
    heroBanner: {
        marginHorizontal: 20,
        marginBottom: 20,
        borderRadius: 24,
        overflow: 'hidden',
        ...Shadows.float,
    },
    heroGradient: {
        padding: 20,
    },
    heroContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    heroLeft: {
        flex: 1,
    },
    heroBadge: {
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
        alignSelf: 'flex-start',
        marginBottom: 10,
    },
    heroBadgeText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 1,
    },
    heroTitleMain: {
        fontSize: 20,
        fontWeight: '900',
        color: '#fff',
        lineHeight: 26,
    },
    heroSubText: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.8)',
        marginTop: 6,
        lineHeight: 16,
    },
    heroRight: {
        marginLeft: 12,
    },
    videoIconBg: {
        width: 64,
        height: 64,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.15)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    },

    // List
    listContent: { paddingHorizontal: 20, paddingBottom: 100 },

    // Row Styles (for Main Categories)
    row: {
        flexDirection: 'row',
        alignItems: 'stretch',
        backgroundColor: Colors.card,
        borderRadius: 20,
        marginBottom: 12,
        overflow: 'hidden',
        ...Shadows.card,
        borderWidth: 1.5,
        borderColor: '#CBD5E1',
    },
    // Flush-left image panel — no padding, stretches full card height
    rowImagePanel: {
        width: 78,
        backgroundColor: '#EEF5FF',
        justifyContent: 'center',
        alignItems: 'center',
        borderTopRightRadius: 14,
        borderBottomRightRadius: 14,
    },
    rowContent: { flex: 1, paddingVertical: 16, paddingLeft: 14 },
    rowName: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
    rowSub: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },
    rowRight: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, paddingRight: 16 },
    rowPrice: { fontSize: 16, fontWeight: '800', color: Colors.primary },
    arrowIcon: { fontSize: 18, color: Colors.textSecondary, fontWeight: '600' },

    // Sub-service card (level=sub) — image flush left
    subCard: {
        flexDirection: 'row',
        alignItems: 'stretch',
        backgroundColor: Colors.card,
        borderRadius: 20,
        marginBottom: 12,
        overflow: 'hidden',
        ...Shadows.card,
        borderWidth: 1.5,
        borderColor: '#CBD5E1',
    },
    subImagePanel: {
        width: 84,
        backgroundColor: Colors.primaryLight,
        justifyContent: 'center',
        alignItems: 'center',
        borderTopRightRadius: 14,
        borderBottomRightRadius: 14,
    },
    subCardContent: { flex: 1, paddingVertical: 16, paddingLeft: 14 },

    // Child bookable service card
    childCard: {
        backgroundColor: Colors.card,
        borderRadius: 20,
        padding: 20,
        marginBottom: 16,
        overflow: 'hidden',
        ...Shadows.card,
        borderWidth: 1.5,
        borderColor: '#CBD5E1',
    },
    childTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, marginBottom: 16 },
    childIconBg: {
        width: 56,
        height: 56,
        borderRadius: 10,
        backgroundColor: Colors.primaryLight,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    childName: { fontSize: 19, fontWeight: '800', color: Colors.textPrimary, marginBottom: 6 },
    childDesc: { fontSize: 14, color: Colors.textSecondary, lineHeight: 22, fontWeight: '500' },
    childBottom: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
        paddingTop: 16,
    },
    childPrice: { fontSize: 22, fontWeight: '900', color: Colors.primary, flex: 1 },
    childPriceNA: { fontSize: 14, color: Colors.textSecondary, flex: 1 },
    codTag: {
        backgroundColor: '#ECFDF5',
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderWidth: 1,
        borderColor: '#A7F3D0',
    },
    codTagText: { fontSize: 10, fontWeight: '900', color: '#065F46' },
    bookBtn: {
        backgroundColor: Colors.primary,
        borderRadius: 14,
        paddingHorizontal: 18,
        paddingVertical: 12,
        ...Shadows.float,
    },
    bookBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
});



