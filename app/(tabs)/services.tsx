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
    Dimensions,
    FlatList,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
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
    const rawParams = useLocalSearchParams<{ category?: string | string[]; subCategory?: string | string[]; serviceId?: string | string[]; subServiceId?: string | string[]; from?: string | string[]; isEmergencyFastTrack?: string | string[] }>();
    const category = Array.isArray(rawParams.category) ? rawParams.category[0] : rawParams.category;
    const subCategory = Array.isArray(rawParams.subCategory) ? rawParams.subCategory[0] : rawParams.subCategory;
    const serviceId = Array.isArray(rawParams.serviceId) ? rawParams.serviceId[0] : rawParams.serviceId;
    const subServiceId = Array.isArray(rawParams.subServiceId) ? rawParams.subServiceId[0] : rawParams.subServiceId;
    const from = Array.isArray(rawParams.from) ? rawParams.from[0] : rawParams.from;
    const isFromIndex = from === 'home' || from === 'index';
    const isEmergencyFastTrack = Array.isArray(rawParams.isEmergencyFastTrack) ? rawParams.isEmergencyFastTrack[0] === 'true' : rawParams.isEmergencyFastTrack === 'true';
    
    const initialLevel: DrillLevel = subServiceId ? 'child' : ((serviceId || category) ? 'sub' : 'services');
    const [level, setLevel] = useState<DrillLevel>(initialLevel);
    const [selectedService, setSelectedService] = useState<Service | null>(null);
    const [selectedSub, setSelectedSub] = useState<SubService | null>(null);
    const [search, setSearch] = useState('');
    const [animPlaceholder, setAnimPlaceholder] = useState('');
    const [fastTrackStatus, setFastTrackStatus] = useState<'idle' | 'loading' | 'error'>('idle');
    const [fastTrackError, setFastTrackError] = useState('');
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

    // ── Handle Fast Track Resolution ──
    useEffect(() => {
        if (!isEmergencyFastTrack || fastTrackStatus !== 'idle') return;
        if (!serviceId) return;

        let active = true;
        const resolveFastTrack = async () => {
            setFastTrackStatus('loading');
            try {
                const subs = await servicesService.getSubServices(serviceId);
                if (!active) return;
                if (subs && subs.length > 0) {
                    const children = await servicesService.getChildServices(subs[0]._id);
                    if (!active) return;
                    if (children && children.length > 0) {
                        const targetChild = children[0];
                        setFastTrackStatus('idle'); // clear state
                        router.replace({
                            pathname: '/service/[id]',
                            params: {
                                id: targetChild._id || (targetChild as any).id,
                                name: targetChild.name,
                                price: targetChild.price,
                                subName: subs[0].name,
                                from: isFromIndex ? from : 'services',
                                entryMode: 'direct',
                                originServiceId: serviceId,
                                originSubServiceId: subs[0]._id,
                                originCategory: category || '',
                            }
                        });
                        return;
                    }
                }
                if (active) {
                    setFastTrackStatus('error');
                    setFastTrackError('Could not auto-resolve services in this region.');
                }
            } catch (err: any) {
                if (active) {
                    setFastTrackStatus('error');
                    setFastTrackError(err.message || 'Failed to auto-resolve emergency service.');
                }
            }
        };

        resolveFastTrack();

        return () => { active = false; };
    }, [isEmergencyFastTrack, serviceId, fastTrackStatus, category, from, isFromIndex, router]);

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
        // P0.1 / P0.2: Fast-track for Emergency / Ambulance (2-step booking).
        // Navigate immediately with fast-track param instead of waiting for API here.
        if (s.type === 'Emergency' || s.name.toLowerCase().includes('ambulance')) {
            router.push({
                pathname: '/services',
                params: {
                    category: s.name,
                    serviceId: (s._id || (s as any).id) as string,
                    subServiceId: '',
                    from: isFromIndex ? from : 'services',
                    isEmergencyFastTrack: 'true'
                }
            });
            return;
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
        fastTrackStatus === 'loading' ||
        isResolvingRouteContext ||
        (level === 'services' && (servicesLoading || !services)) ||
        (level === 'sub' && (subLoading || !subServices || !selectedService)) ||
        (level === 'child' && (childLoading || !childServices || !selectedSub));
    const isError = servicesErr || subErr || childErr || fastTrackStatus === 'error';
    const onRetry = () => {
        if (fastTrackStatus === 'error') {
            setFastTrackStatus('idle');
            return;
        }
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
                        <Ionicons name="arrow-back" size={22} color="#0F172A" />
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
                        <Ionicons name="notifications-outline" size={22} color="#0F172A" />
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
                <>
                    {level === 'services' && (
                        <FlatList
                            contentContainerStyle={styles.listContent}
                            showsVerticalScrollIndicator={false}
                            keyboardShouldPersistTaps="handled"
                            data={filteredServices}
                            keyExtractor={s => s._id || (s as any).id}
                            numColumns={2}
                            columnWrapperStyle={{ justifyContent: 'space-between' }}
                            initialNumToRender={8}
                            maxToRenderPerBatch={6}
                            windowSize={5}
                            refreshControl={<RefreshControl refreshing={servicesLoading} onRefresh={onRetry} colors={[Colors.primary]} tintColor={Colors.primary} />}
                            ListEmptyComponent={() => !servicesLoading ? (
                                <EmptyState
                                    icon="🔍"
                                    title="No services found"
                                    subtitle={search ? `Try searching for something else` : 'No services available yet'}
                                    actionLabel={search ? 'Clear Search' : undefined}
                                    onAction={search ? () => setSearch('') : undefined}
                                />
                            ) : null}
                            renderItem={({ item: s, index: idx }) => (
                                <ServiceGridCard
                                    service={s}
                                    idx={idx}
                                    onPress={() => {
                                        setSearch('');
                                        handleServicePress(s);
                                    }}
                                />
                            )}
                        />
                    )}

                    {level === 'sub' && (
                        <FlatList
                            contentContainerStyle={styles.listContent}
                            showsVerticalScrollIndicator={false}
                            keyboardShouldPersistTaps="handled"
                            data={(subServices ?? []).filter(s => search.trim() ? s.name.toLowerCase().includes(search.toLowerCase()) : true)}
                            keyExtractor={s => s._id || (s as any).id}
                            initialNumToRender={8}
                            maxToRenderPerBatch={6}
                            windowSize={5}
                            refreshControl={<RefreshControl refreshing={subLoading} onRefresh={onRetry} colors={[Colors.primary]} tintColor={Colors.primary} />}
                            ListHeaderComponent={() => !!toImageUrl(selectedService?.bannerUrl) ? (
                                <View style={styles.categoryBanner}>
                                    <Image source={{ uri: toImageUrl(selectedService?.bannerUrl) }} style={styles.categoryBannerImage} resizeMode="cover" />
                                    <LinearGradient colors={['transparent', 'rgba(10,20,50,0.55)']} style={StyleSheet.absoluteFillObject} start={{ x: 0, y: 0.4 }} end={{ x: 0, y: 1 }} />
                                    <View style={styles.bannerPill}>
                                        <Ionicons name="grid-outline" size={12} color="#fff" />
                                        <Text style={styles.bannerPillText}>{(subServices ?? []).length} Specialties</Text>
                                    </View>
                                </View>
                            ) : null}
                            ListEmptyComponent={() => !subLoading ? (
                                <EmptyState icon="📋" title="No categories found" subtitle="There are no sub-categories for this service yet." actionLabel="Back to All Services" onAction={goBack} />
                            ) : null}
                            renderItem={({ item: s, index: idx }) => (
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
                                            {s.description ? <Text style={styles.subCardDesc} numberOfLines={2}>{s.description}</Text> : null}
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
                            )}
                        />
                    )}

                    {level === 'child' && (
                        <FlatList
                            contentContainerStyle={styles.listContent}
                            showsVerticalScrollIndicator={false}
                            keyboardShouldPersistTaps="handled"
                            data={(childServices ?? []).filter(c => search.trim() ? c.name.toLowerCase().includes(search.toLowerCase()) : true)}
                            keyExtractor={c => c._id || (c as any).id}
                            initialNumToRender={8}
                            maxToRenderPerBatch={6}
                            windowSize={5}
                            refreshControl={<RefreshControl refreshing={childLoading} onRefresh={onRetry} colors={[Colors.primary]} tintColor={Colors.primary} />}
                            ListHeaderComponent={() => {
                                const count = (childServices ?? []).filter(c => search.trim() ? c.name.toLowerCase().includes(search.toLowerCase()) : true).length;
                                if (count > 0) {
                                    return (
                                        <View style={styles.childSectionHeader}>
                                            <Text style={styles.childSectionTitle}>Available Services</Text>
                                            <Text style={styles.childSectionSub}>Choose the service that suits your needs</Text>
                                        </View>
                                    );
                                }
                                return null;
                            }}
                            ListEmptyComponent={() => !childLoading ? (
                                <EmptyState icon="📋" title="No services available" subtitle="Check back later or try another category" actionLabel="Go Back" onAction={goBack} />
                            ) : null}
                            renderItem={({ item: c, index: idx }) => {
                                const fulfillment = c.fulfillmentMode === 'HOSPITAL_VISIT' ? 'At Hospital' : c.fulfillmentMode === 'VIRTUAL' ? 'Virtual' : 'At Your Home';
                                return (
                                <Pressable
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
                            )}}
                        />
                    )}
                </>
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
        backgroundColor: '#FFFFFF',
        gap: 16,
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
    },
    headerTitle: { fontSize: 28, fontWeight: '900', color: '#0F172A', letterSpacing: -0.5 },
    headerSub: { fontSize: 13, color: '#64748B', marginTop: 4, fontWeight: '600' },

    // Search
    searchWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginVertical: 16,
        backgroundColor: '#FFFFFF',
        marginHorizontal: 16,
        borderRadius: 28,
        borderWidth: 1,
        borderColor: '#E8EEF5',
        shadowColor: '#0A1A3A',
        shadowOpacity: 0.04,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 6 },
        elevation: 4,
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
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        overflow: 'hidden',
        marginBottom: 4,
        borderWidth: 1,
        borderColor: '#E8EEF5',
        shadowColor: '#00266B',
        shadowOpacity: 0.03,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 8 },
        elevation: 4,
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
        fontSize: 15,
        fontWeight: '900',
        color: '#0F172A',
        lineHeight: 20,
        marginBottom: 4,
        letterSpacing: 0.2,
    },
    gridCardSub: {
        fontSize: 12,
        color: '#64748B',
        fontWeight: '500',
        lineHeight: 16,
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
        marginBottom: 20,
        marginHorizontal: -16,
        height: 210,
        position: 'relative',
    },
    categoryBannerImage: {
        width: '100%',
        height: '100%',
    },
    bannerPill: {
        position: 'absolute',
        bottom: 14,
        left: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.35)',
    },
    bannerPillText: { color: '#fff', fontWeight: '800', fontSize: 12, letterSpacing: 0.3 },

    // Sub-service card (level=sub) — image flush left
    subCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        marginBottom: 14,
        overflow: 'hidden',
        shadowColor: '#00266B',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.04,
        shadowRadius: 18,
        elevation: 5,
        borderWidth: 1,
        borderColor: '#E8EEF5',
    },
    subCardTop: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        padding: 18,
        gap: 16,
    },
    subIconBox: {
        width: 80,
        height: 80,
        borderRadius: 20,
        backgroundColor: '#EEF4FF',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    subCardContent: { flex: 1 },
    subCardName: { fontSize: 17, fontWeight: '900', color: '#0F172A', marginBottom: 5, letterSpacing: 0.1 },
    subCardDesc: { fontSize: 13, color: '#64748B', lineHeight: 19, marginBottom: 8, fontWeight: '500' },
    subPriceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
    subStartingPrice: { fontSize: 13, fontWeight: '700', color: '#059669' },
    subStartingPriceAmount: { fontSize: 16, fontWeight: '900', color: '#059669' },
    subChevronBtn: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: '#0B3370',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#0B3370',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 4,
    },

    // Child bookable service card
    // Child section header
    childSectionHeader: { marginBottom: 16 },
    childSectionTitle: { fontSize: 22, fontWeight: '900', color: '#0F172A', letterSpacing: -0.3 },
    childSectionSub: { fontSize: 14, color: '#64748B', marginTop: 4, fontWeight: '500' },

    // Child card
    childCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        marginBottom: 18,
        overflow: 'hidden',
        shadowColor: '#00266B',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.05,
        shadowRadius: 20,
        elevation: 6,
        borderWidth: 1,
        borderColor: '#E8EEF5',
    },
    childCardTop: {
        flexDirection: 'row',
        gap: 14,
        padding: 16,
        paddingBottom: 12,
    },
    childCardImage: {
        width: 90,
        height: 90,
        borderRadius: 18,
        backgroundColor: '#EEF4FF',
        overflow: 'hidden',
        justifyContent: 'center',
        alignItems: 'center',
    },
    childBadgeRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginBottom: 7,
    },
    childBadgeMostBooked: {
        backgroundColor: '#FFF0E6',
        borderRadius: 20,
        paddingHorizontal: 9,
        paddingVertical: 3,
    },
    childBadgeMostBookedText: { fontSize: 10, fontWeight: '800', color: '#E8610A' },
    childBadgeAvailable: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ECFDF5',
        borderRadius: 20,
        paddingHorizontal: 9,
        paddingVertical: 3,
        gap: 4,
    },
    childAvailableDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#22C55E' },
    childBadgeAvailableText: { fontSize: 10, fontWeight: '800', color: '#16A34A' },
    childCardName: { fontSize: 18, fontWeight: '900', color: '#0F172A', marginBottom: 4, letterSpacing: 0.1 },
    childCardDesc: { fontSize: 13, color: '#64748B', lineHeight: 19, fontWeight: '500' },

    // Bottom strip
    childCardBottom: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
        gap: 4,
    },
    childPriceCol: { marginRight: 6 },
    childCardPrice: { fontSize: 18, fontWeight: '900', color: '#0F172A' },
    childPriceLabel: { fontSize: 9, color: '#94A3B8', fontWeight: '600', marginTop: 1 },
    childFeatureCol: { flex: 1, alignItems: 'center', gap: 2 },
    childFeatureVal: { fontSize: 10, fontWeight: '800', color: '#334155', textAlign: 'center' },
    childFeatureLabel: { fontSize: 9, color: '#94A3B8', textAlign: 'center', fontWeight: '500' },

    bookBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#0B3370',
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 11,
        shadowColor: '#0B3370',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
        elevation: 6,
    },
    bookBtnText: { color: '#fff', fontWeight: '900', fontSize: 13, letterSpacing: 0.3 },

});



