import React, { useRef, useState, useEffect } from 'react';
import { Animated } from 'react-native';
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
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, useNavigation } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { servicesService } from '@/services/services.service';
import { API_BASE_URL } from '@/constants/api';
import { Colors, Shadows } from '@/constants/colors';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { SkeletonListItem, SkeletonSubCard, SkeletonChildCard } from '@/components/ui/Skeleton';
import type { Service, SubService, ChildService } from '@/types';

const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, '');
const { width } = Dimensions.get('window');
const CARD_WIDTH = Math.floor((width - 32 - 12) / 2);

function toImageUrl(value?: string): string | undefined {
    if (!value || !value.trim()) return undefined;
    const trimmed = value.trim();
    if (/^(https?:|data:|file:)/i.test(trimmed)) {
        return trimmed.replace(/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/, API_ORIGIN);
    }
    return `${API_ORIGIN}${trimmed.startsWith('/') ? trimmed : `/${trimmed}`}`;
}

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

const SERVICE_BADGE_PALETTE = [
    { color: '#4F8EF7', bg: '#EEF4FF', icon: 'pulse-outline' },
    { color: '#22C55E', bg: '#DCFCE7', icon: 'flask-outline' },
    { color: '#EF4444', bg: '#FEE2E2', icon: 'car-outline' },
    { color: '#EC4899', bg: '#FCE7F3', icon: 'heart-outline' },
    { color: '#8B5CF6', bg: '#EDE9FE', icon: 'body-outline' },
    { color: '#14B8A6', bg: '#CCFBF1', icon: 'medical-outline' },
    { color: '#F59E0B', bg: '#FEF3C7', icon: 'bandage-outline' },
    { color: '#F97316', bg: '#FFEDD5', icon: 'fitness-outline' },
];

function getServiceTagline(name: string): string {
    const n = (name || '').toLowerCase();
    if (n.includes('doctor') || n.includes('physician') || n.includes('consult')) return 'Trusted doctors at your doorstep';
    if (n.includes('nurs')) return 'Professional nursing care at home';
    if (n.includes('physio') || n.includes('rehab')) return 'Expert therapy in the comfort of home';
    if (n.includes('diagnostic') || n.includes('lab') || n.includes('test')) return 'Accurate lab tests at your home';
    if (n.includes('pharma') || n.includes('medicine')) return 'Medicines delivered to your door';
    if (n.includes('ambulance') || n.includes('emergency')) return '24/7 emergency response near you';
    if (n.includes('rental') || n.includes('equipment')) return 'Quality equipment. Delivered home';
    if (n.includes('dental')) return 'Dental care without leaving home';
    if (n.includes('mental') || n.includes('psych')) return 'Mental wellness support at home';
    if (n.includes('elder') || n.includes('senior')) return 'Compassionate care for seniors';
    if (n.includes('paed') || n.includes('child') || n.includes('infant')) return 'Gentle care for your little ones';
    return 'Quality healthcare at your doorstep';
}

function getServiceBadge(name: string, idx: number) {
    const n = (name || '').toLowerCase();
    if (n.includes('doctor') || n.includes('consult')) return { color: '#4F8EF7', bg: '#EEF4FF', icon: 'pulse-outline' };
    if (n.includes('diagnostic') || n.includes('lab')) return { color: '#22C55E', bg: '#DCFCE7', icon: 'flask-outline' };
    if (n.includes('ambulance') || n.includes('emergency')) return { color: '#EF4444', bg: '#FEE2E2', icon: 'car-outline' };
    if (n.includes('nurs')) return { color: '#EC4899', bg: '#FCE7F3', icon: 'heart-outline' };
    if (n.includes('physio') || n.includes('rehab')) return { color: '#8B5CF6', bg: '#EDE9FE', icon: 'body-outline' };
    if (n.includes('pharma') || n.includes('medicine')) return { color: '#14B8A6', bg: '#CCFBF1', icon: 'medical-outline' };
    if (n.includes('rental') || n.includes('equipment')) return { color: '#F59E0B', bg: '#FEF3C7', icon: 'bandage-outline' };
    return SERVICE_BADGE_PALETTE[idx % SERVICE_BADGE_PALETTE.length];
}

function ServiceGridCard({ service, idx, onPress }: { service: Service; idx: number; onPress: () => void }) {
    const badge = getServiceBadge(service.name, idx);
    const imageUrl = toImageUrl(service.imageUrl);
    const scale = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        const anim = Animated.loop(
            Animated.sequence([
                Animated.timing(scale, { toValue: 1.07, duration: 3500, useNativeDriver: true }),
                Animated.timing(scale, { toValue: 1.0, duration: 3500, useNativeDriver: true }),
            ])
        );
        anim.start();
        return () => anim.stop();
    }, []);

    return (
        <TouchableOpacity style={styles.gridCard} onPress={onPress} activeOpacity={0.85}>
            <View style={styles.gridCardImage}>
                <Animated.View style={[StyleSheet.absoluteFillObject, { transform: [{ scale }] }]}>
                    {imageUrl ? (
                        <Image source={{ uri: imageUrl }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
                    ) : (
                        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: badge.bg, justifyContent: 'center', alignItems: 'center' }]}>
                            <Text style={{ fontSize: 36 }}>{serviceEmoji(service.name, idx)}</Text>
                        </View>
                    )}
                </Animated.View>
                <View style={[styles.gridCardBadge, { backgroundColor: badge.color }]}>
                    <Ionicons name={badge.icon as any} size={14} color="#fff" />
                </View>
            </View>
            <View style={styles.gridCardContent}>
                <Text style={styles.gridCardName} numberOfLines={2}>{service.name}</Text>
                {service.title ? (
                    <Text style={styles.gridCardSub} numberOfLines={2}>{service.title}</Text>
                ) : null}
            </View>
            <View style={styles.gridCardFooter}>
                <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
            </View>
        </TouchableOpacity>
    );
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
    const [animPlaceholder, setAnimPlaceholder] = useState('');
    const hasRestoredDeepLinkRef = useRef(false);
    const navLockRef = useRef(false);
    const lastNavRef = useRef<{ key: string; ts: number } | null>(null);

    // ── Tab Bar Interaction ──
    // Reset to root services when the Services tab is pressed in the bottom bar
    useEffect(() => {
        const unsubscribe = (navigation as any).addListener('tabPress', () => {
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
    const activeServiceId = selectedService?._id || (selectedService as any)?.id;
    const {
        data: subServices,
        isLoading: subLoading,
        isError: subErr,
        refetch: refetchSubs,
    } = useQuery({
        queryKey: ['sub-services', activeServiceId],
        queryFn: () => servicesService.getSubServices(selectedService!._id),
        enabled: !!selectedService && level === 'sub',
        retry: 2,
        staleTime: 30_000,
    });

    // ── Child services ──
    const activeSubId = selectedSub?._id || (selectedSub as any)?.id;
    const {
        data: childServices,
        isLoading: childLoading,
        isError: childErr,
        refetch: refetchChildren,
    } = useQuery({
        queryKey: ['child-services', activeSubId],
        queryFn: () => servicesService.getChildServices(selectedSub!._id),
        enabled: !!selectedSub && level === 'child',
        retry: 2,
        staleTime: 30_000,
    });

    // ── Typewriter placeholder animation ──
    useEffect(() => {
        if (level !== 'services') return;
        const baseNames = services?.map(s => `Search for ${s.name}...`) || [
            'Search for Doctor at Home...',
            'Search for Home Nursing...',
            'Search for Physiotherapy...',
            'Search for Diagnostics...',
            'Search for Pharmacy...',
            'Search for Ambulance...',
        ];
        let phraseIdx = 0;
        let charIdx = 0;
        let deleting = false;
        let timeoutId: ReturnType<typeof setTimeout>;

        const tick = () => {
            const phrase = baseNames[phraseIdx % baseNames.length];
            let delay = 80;
            if (!deleting) {
                charIdx++;
                setAnimPlaceholder(phrase.slice(0, charIdx));
                if (charIdx === phrase.length) { deleting = true; delay = 1400; }
            } else {
                charIdx--;
                setAnimPlaceholder(phrase.slice(0, charIdx));
                if (charIdx === 0) { deleting = false; phraseIdx++; delay = 300; }
                else { delay = 38; }
            }
            timeoutId = setTimeout(tick, delay);
        };
        timeoutId = setTimeout(tick, 600);
        return () => clearTimeout(timeoutId);
    }, [level, services]);

    // ── Handle Initial Deep Link ──
    useEffect(() => {
        if (!category && !serviceId) {
            if (level !== 'services') {
                setLevel('services');
                setSelectedService(null);
            }
            return;
        }

        if (services && (category || serviceId)) {
            const target = services.find(s => {
                const sid = (s._id || (s as any).id);
                if (serviceId && String(sid) === String(serviceId)) return true;
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
                const prevId = selectedService?._id || (selectedService as any)?.id;
                if (prevId !== target._id) {
                    console.log('[Services] Switching service:', target.name, '| prev level:', level);
                    setSelectedService(target);
                    setSelectedSub(null);
                    setLevel('sub');
                } else if (level === 'services') {
                    setLevel('sub');
                }
            } else {
                console.warn('[Services] Service not found for:', { serviceId, category });
                setLevel('services');
                setSelectedService(null);
            }
        } else if (services && !category && !serviceId && level !== 'services') {
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

        // Normal Flow — clear stale sub-selection before switching service
        console.log('[Services] handleServicePress:', s.name, s._id);
        setSelectedSub(null);
        setSelectedService(s);
        setLevel('sub');
        router.setParams({
            serviceId: (s._id || (s as any).id) as string,
            category: s.name,
            subServiceId: '',
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
    const onRetry = () => {
        if (servicesErr) refetchServices();
        if (subErr) refetchSubs();
        if (childErr) refetchChildren();
    };

    return (
        <SafeAreaView style={styles.root} edges={['top']}>
            {/* Header — root services: large title + bell; sub/child: back + title */}
            {level === 'services' ? (
                <View style={styles.headerRoot}>
                    <TouchableOpacity onPress={goBack} style={styles.backBtn}>
                        <Ionicons name="chevron-back" size={20} color={Colors.textPrimary} />
                    </TouchableOpacity>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={styles.headerTitle}>Browse Services</Text>
                        <Text style={styles.headerRootSub}>Quality care, right at your doorstep</Text>
                    </View>
                    <TouchableOpacity style={styles.bellBtn} activeOpacity={0.8} onPress={() => router.push('/(tabs)/notifications')}>
                        <Ionicons name="notifications-outline" size={22} color={Colors.textPrimary} />
                    </TouchableOpacity>
                </View>
            ) : (
                <View style={styles.header}>
                    <TouchableOpacity onPress={goBack} style={styles.backBtn}>
                        <Ionicons name="arrow-back" size={20} color={Colors.textPrimary} />
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.headerTitle}>
                            {level === 'sub'
                                ? (selectedService?.name ?? 'Services')
                                : (selectedSub?.name ?? subCategory ?? 'Sub-services')}
                        </Text>
                        {level === 'sub' && (selectedService || category) && (
                            <Text style={styles.headerSub}>{getServiceTagline(selectedService?.name ?? category ?? '')}</Text>
                        )}
                        {level === 'child' && (selectedSub || subCategory) && (
                            <Text style={styles.headerSub}>{(selectedService?.name ?? category ?? '')} › {(selectedSub?.name ?? subCategory ?? '')}</Text>
                        )}
                    </View>
                    <TouchableOpacity style={styles.bellBtn} activeOpacity={0.8} onPress={() => router.push('/(tabs)/notifications')}>
                        <Ionicons name="notifications-outline" size={22} color={Colors.textPrimary} />
                    </TouchableOpacity>
                </View>
            )}

            {/* Universal Search Bar */}
            <View style={styles.searchWrap}>
                <Ionicons name="search-outline" size={18} color={Colors.muted} style={styles.searchIcon} />
                <TextInput
                    style={styles.searchInput}
                    placeholder={level === 'services' ? animPlaceholder : `Search ${level === 'sub' ? 'categories' : 'procedures'}...`}
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
                    {level === 'child'
                        ? [1, 2, 3].map((i) => <SkeletonChildCard key={i} />)
                        : level === 'sub'
                            ? [1, 2, 3, 4].map((i) => <SkeletonSubCard key={i} />)
                            : [1, 2, 3, 4, 5].map((i) => <SkeletonListItem key={i} />)}
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
                    {/* Level: Root services — 2-column grid */}
                    {level === 'services' && filteredServices.length > 0 && (
                        <View style={styles.gridContainer}>
                            {filteredServices.map((s, idx) => (
                                <ServiceGridCard
                                    key={s._id || (s as any).id}
                                    service={s}
                                    idx={idx}
                                    onPress={() => {
                                        setSearch('');
                                        handleServicePress(s);
                                    }}
                                />
                            ))}
                            {filteredServices.length % 2 !== 0 && (
                                <View style={{ width: CARD_WIDTH }} />
                            )}
                        </View>
                    )}

                    {level === 'services' && filteredServices.length === 0 && !servicesLoading && (
                        <EmptyState
                            icon="🔍"
                            title="No services found"
                            subtitle={search ? `Try searching for something else` : 'No services available yet'}
                            actionLabel={search ? 'Clear Search' : undefined}
                            onAction={search ? () => setSearch('') : undefined}
                        />
                    )}

                    {/* Category hero banner (shown at top of sub-services level) */}
                    {level === 'sub' && !!toImageUrl(selectedService?.bannerUrl) && (
                        <View style={styles.categoryBanner}>
                            <Image
                                source={{ uri: toImageUrl(selectedService?.bannerUrl) }}
                                style={styles.categoryBannerImage}
                                resizeMode="cover"
                            />
                        </View>
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
                                    {/* Top row: icon + info + chevron */}
                                    <View style={styles.subCardTop}>
                                        <View style={styles.subIconBox}>
                                            {s.imageUrl && s.imageUrl.trim().length > 0 ? (
                                                <Image source={{ uri: s.imageUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                                            ) : (
                                                <Text style={{ fontSize: 30 }}>{serviceEmoji(s.name, idx)}</Text>
                                            )}
                                        </View>
                                        <View style={styles.subCardContent}>
                                            <Text style={styles.subCardName} numberOfLines={1}>{s.name}</Text>
                                            {s.description ? (
                                                <Text style={styles.subCardDesc} numberOfLines={2}>{s.description}</Text>
                                            ) : null}
                                            {s.startingPrice != null && s.startingPrice > 0 && (
                                                <View style={styles.subPriceRow}>
                                                    <Text style={styles.subStartingPrice}>
                                                        Starting at <Text style={styles.subStartingPriceAmount}>₹{s.startingPrice}</Text>
                                                    </Text>
                                                    <View style={styles.subChevronBtn}>
                                                        <Ionicons name="chevron-forward" size={14} color="#fff" />
                                                    </View>
                                                </View>
                                            )}
                                        </View>
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
                    {level === 'child' && (childServices ?? []).filter(c => search.trim() ? c.name.toLowerCase().includes(search.toLowerCase()) : true).length > 0 && (
                        <View style={styles.childSectionHeader}>
                            <Text style={styles.childSectionTitle}>Available Services</Text>
                            <Text style={styles.childSectionSub}>Choose the service that suits your needs</Text>
                        </View>
                    )}
                    {level === 'child' &&
                        (childServices ?? [])
                            .filter(c => search.trim() ? c.name.toLowerCase().includes(search.toLowerCase()) : true)
                            .map((c, idx) => {
                                const fulfillment = c.fulfillmentMode === 'HOSPITAL_VISIT' ? 'At Hospital' : c.fulfillmentMode === 'VIRTUAL' ? 'Virtual' : 'At Your Home';
                                return (
                                <Pressable
                                    key={c._id || (c as any).id}
                                    style={styles.childCard}
                                    onPress={() => openChildServiceDetail(c)}
                                >
                                    {/* Top section */}
                                    <View style={styles.childCardTop}>
                                        <View style={styles.childCardImage}>
                                            {c.imageUrl ? (
                                                <Image source={{ uri: c.imageUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                                            ) : (
                                                <Text style={{ fontSize: 36 }}>⚕️</Text>
                                            )}
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <View style={styles.childBadgeRow}>
                                                {idx === 0 && (
                                                    <View style={styles.childBadgeMostBooked}>
                                                        <Text style={styles.childBadgeMostBookedText}>🔥 Most Booked</Text>
                                                    </View>
                                                )}
                                                <View style={styles.childBadgeAvailable}>
                                                    <View style={styles.childAvailableDot} />
                                                    <Text style={styles.childBadgeAvailableText}>Available Today</Text>
                                                </View>
                                            </View>
                                            <Text style={styles.childCardName}>{c.name}</Text>
                                            <Text style={styles.childCardDesc} numberOfLines={3}>
                                                {c.description || 'Professional healthcare service'}
                                            </Text>
                                        </View>
                                    </View>

                                    {/* Bottom strip */}
                                    <View style={styles.childCardBottom}>
                                        <View style={styles.childPriceCol}>
                                            {c.price !== undefined && c.price > 0 ? (
                                                <Text style={styles.childCardPrice}>₹{c.price}</Text>
                                            ) : (
                                                <Text style={styles.childCardPrice}>—</Text>
                                            )}
                                            <Text style={styles.childPriceLabel}>
                                                {c.price > 0 ? 'Consultation Fee' : 'Price on request'}
                                            </Text>
                                        </View>
                                        <View style={styles.childFeatureCol}>
                                            <Ionicons name="time-outline" size={14} color={Colors.textSecondary} />
                                            <Text style={styles.childFeatureVal}>30-45 min</Text>
                                            <Text style={styles.childFeatureLabel}>Duration</Text>
                                        </View>
                                        <View style={styles.childFeatureCol}>
                                            <Ionicons name="home-outline" size={14} color={Colors.textSecondary} />
                                            <Text style={styles.childFeatureVal}>{fulfillment}</Text>
                                            <Text style={styles.childFeatureLabel}>Convenience</Text>
                                        </View>
                                        <View style={styles.childFeatureCol}>
                                            <Ionicons name="person-outline" size={14} color={Colors.textSecondary} />
                                            <Text style={styles.childFeatureVal}>Expert</Text>
                                            <Text style={styles.childFeatureLabel}>Verified</Text>
                                        </View>
                                        <TouchableOpacity
                                            style={styles.bookBtn}
                                            onPress={(e) => {
                                                (e as any)?.stopPropagation?.();
                                                openChildServiceDetail(c);
                                            }}
                                            disabled={navLockRef.current}
                                        >
                                            <Text style={styles.bookBtnText}>Book Now</Text>
                                            <Ionicons name="arrow-forward" size={14} color="#fff" />
                                        </TouchableOpacity>
                                    </View>
                                </Pressable>
                            )})}

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

    // Root services header (large title + bell)
    headerRoot: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 12,
        backgroundColor: Colors.card,
    },
    headerRootSub: { fontSize: 13, color: Colors.textSecondary, marginTop: 2, fontWeight: '500' },
    bellBtn: {
        width: 42,
        height: 42,
        borderRadius: 14,
        backgroundColor: '#F1F5F9',
        justifyContent: 'center',
        alignItems: 'center',
    },

    // Sub/child header (back + title)
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
    headerTitle: { fontSize: 24, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.5 },
    headerSub: { fontSize: 12, color: Colors.textSecondary, marginTop: 2, fontWeight: '500' },

    // Search
    searchWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        marginVertical: 12,
        backgroundColor: Colors.card,
        marginHorizontal: 16,
        borderRadius: 20,
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
        ...Shadows.card,
        shadowOpacity: 0.05,
    },
    searchIcon: { paddingLeft: 4, paddingRight: 4 },
    searchInput: {
        flex: 1,
        paddingHorizontal: 8,
        paddingVertical: 14,
        fontSize: 15,
        color: Colors.textPrimary,
    },
    searchClear: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        justifyContent: 'center',
    },
    searchClearText: { fontSize: 14, color: Colors.muted, fontWeight: '700' },

    // 2-column grid for root services
    gridContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        justifyContent: 'space-between',
    },
    gridCard: {
        width: CARD_WIDTH,
        backgroundColor: Colors.card,
        borderRadius: 20,
        overflow: 'hidden',
        marginBottom: 0,
        ...Shadows.card,
        borderWidth: 1,
        borderColor: '#E8EDF5',
    },
    gridCardImage: {
        width: '100%',
        height: 120,
        backgroundColor: '#EEF4FF',
        overflow: 'hidden',
    },
    gridCardBadge: {
        position: 'absolute',
        top: 10,
        right: 10,
        width: 30,
        height: 30,
        borderRadius: 15,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
        elevation: 3,
    },
    gridCardContent: {
        paddingHorizontal: 12,
        paddingTop: 10,
        paddingBottom: 4,
    },
    gridCardName: {
        fontSize: 14,
        fontWeight: '700',
        color: Colors.textPrimary,
        lineHeight: 20,
        marginBottom: 3,
    },
    gridCardSub: {
        fontSize: 11,
        color: Colors.textSecondary,
        lineHeight: 15,
    },
    gridCardFooter: {
        paddingHorizontal: 12,
        paddingBottom: 10,
        alignItems: 'flex-end',
    },


    // List
    listContent: { paddingHorizontal: 16, paddingBottom: 100, paddingTop: 4 },

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

    // Category hero banner
    categoryBanner: {
        overflow: 'hidden',
        marginBottom: 16,
        marginHorizontal: -16,
        height: 200,
    },
    categoryBannerImage: {
        width: '100%',
        height: '100%',
    },

    // Sub-service card (level=sub) — image flush left
    subCard: {
        backgroundColor: Colors.card,
        borderRadius: 20,
        marginBottom: 12,
        overflow: 'hidden',
        ...Shadows.card,
        borderWidth: 1,
        borderColor: '#E8EDF5',
    },
    subCardTop: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        padding: 16,
        gap: 14,
    },
    subIconBox: {
        width: 72,
        height: 72,
        borderRadius: 16,
        backgroundColor: Colors.primaryLight,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    subCardContent: { flex: 1 },
    subCardName: { fontSize: 16, fontWeight: '800', color: Colors.textPrimary, marginBottom: 4 },
    subCardDesc: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18, marginBottom: 5 },
    subPriceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
    subStartingPrice: { fontSize: 13, fontWeight: '600', color: '#10B981' },
    subStartingPriceAmount: { fontSize: 15, fontWeight: '800', color: '#10B981' },
    subChevronBtn: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: Colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },

    // Child bookable service card
    // Child section header
    childSectionHeader: { marginBottom: 14 },
    childSectionTitle: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary },
    childSectionSub: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },

    // Child card
    childCard: {
        backgroundColor: Colors.card,
        borderRadius: 20,
        marginBottom: 16,
        overflow: 'hidden',
        ...Shadows.card,
        borderWidth: 1,
        borderColor: '#E8EDF5',
    },
    childCardTop: {
        flexDirection: 'row',
        gap: 10,
        padding: 12,
        paddingBottom: 10,
    },
    childCardImage: {
        width: 80,
        height: 80,
        borderRadius: 12,
        backgroundColor: Colors.primaryLight,
        overflow: 'hidden',
        justifyContent: 'center',
        alignItems: 'center',
    },
    childBadgeRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 5,
        marginBottom: 5,
    },
    childBadgeMostBooked: {
        backgroundColor: '#FFF0E6',
        borderRadius: 20,
        paddingHorizontal: 7,
        paddingVertical: 2,
    },
    childBadgeMostBookedText: { fontSize: 10, fontWeight: '700', color: '#E8610A' },
    childBadgeAvailable: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ECFDF5',
        borderRadius: 20,
        paddingHorizontal: 7,
        paddingVertical: 2,
        gap: 4,
    },
    childAvailableDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#22C55E' },
    childBadgeAvailableText: { fontSize: 10, fontWeight: '700', color: '#16A34A' },
    childCardName: { fontSize: 17, fontWeight: '800', color: Colors.textPrimary, marginBottom: 3 },
    childCardDesc: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },

    // Bottom strip
    childCardBottom: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
        gap: 4,
    },
    childPriceCol: { marginRight: 4 },
    childCardPrice: { fontSize: 16, fontWeight: '900', color: Colors.textPrimary },
    childPriceLabel: { fontSize: 8, color: Colors.textSecondary, fontWeight: '500' },
    childFeatureCol: { flex: 1, alignItems: 'center', gap: 1 },
    childFeatureVal: { fontSize: 9, fontWeight: '700', color: Colors.textPrimary, textAlign: 'center' },
    childFeatureLabel: { fontSize: 8, color: Colors.textSecondary, textAlign: 'center' },

    bookBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        backgroundColor: Colors.primary,
        borderRadius: 12,
        paddingHorizontal: 10,
        paddingVertical: 9,
        ...Shadows.float,
    },
    bookBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },

});



