import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    RefreshControl,
    ActivityIndicator,
    TouchableOpacity,
    TextInput,
    Linking,
    Dimensions,
    Modal,
    Platform,
    Animated,
    Easing,
} from 'react-native';
import { Image } from 'expo-image';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { useQuery } from '@tanstack/react-query';
import {
    Stethoscope,
    FlaskConical,
    Ambulance,
    Pill,
    LayoutGrid,
    Search,
    Bell,
    User as UserIcon,
    MapPin,
    ChevronDown,
    Star,
    ArrowRight,
    Crosshair,
    HeartPulse,
    Activity,
    ShieldCheck,
    X,
    BookOpen,
    Hospital,
    Clock,
    CalendarCheck,
    CheckCircle2,
    ChevronRight,
    Lock,
    BadgeCheck,
    Tag,
} from 'lucide-react-native';

import { servicesService } from '@/services/services.service';
import { bookingsService } from '@/services/bookings.service';
import { doctorsService } from '@/services/doctors.service';
import api from '@/services/api';
import { notificationsService } from '@/services/notifications.service';
import { useAuthStore } from '@/stores/auth.store';
import { useNotificationStore } from '@/stores/notification.store';
import { Colors, Shadows } from '@/constants/colors';
import { API_BASE_URL, Endpoints } from '@/constants/api';
import { FontSize } from '@/constants/spacing';
import { DoctorCard } from '@/components/ui/DoctorCard';

import { useConfigStore } from '@/stores/config.store';
import { useCallback } from 'react';

const { width } = Dimensions.get('window');
const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, '');

const toBannerImageUrl = (value?: string) => {
    if (!value || typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    if (/^(https?:|data:|file:)/i.test(trimmed)) {
        // Rewrite localhost/127.0.0.1 URLs to the real API origin so physical devices can load images
        return trimmed.replace(/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/, API_ORIGIN);
    }
    const path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
    return `${API_ORIGIN}${path}`;
};

const getBannerImage = (banner: any) =>
    toBannerImageUrl(
        banner?.imageUrl ??
        banner?.imageURL ??
        banner?.image ??
        banner?.bannerImage ??
        banner?.mobileImageUrl ??
        banner?.thumbnail
    );

const getKnowledgeImage = (item: any) =>
    toBannerImageUrl(
        item?.imageUrl ??
        item?.imageURL ??
        item?.image ??
        item?.coverImage ??
        item?.thumbnail ??
        item?.bannerImage
    );

// ── Service Icon Mapping (Maps DB names to Lucide icons & colors) ──
const SERVICE_THEMES: Record<string, { icon: any; color: string; bgColor: string }> = {
    'doctor': { icon: Stethoscope, color: '#2F80ED', bgColor: '#EBF3FD' },
    'nurse': { icon: Pill, color: '#9B51E0', bgColor: '#F5EBFF' },
    'lab': { icon: FlaskConical, color: '#27AE60', bgColor: '#E9F7EF' },
    'diagnostics': { icon: FlaskConical, color: '#27AE60', bgColor: '#E9F7EF' },
    'ambulance': { icon: Ambulance, color: '#EB5757', bgColor: '#FEEFEF' },
    'emergency': { icon: ShieldCheck, color: '#EB5757', bgColor: '#FEEFEF' },
    'home': { icon: HeartPulse, color: '#D63384', bgColor: '#FFF0F5' },
    'care': { icon: HeartPulse, color: '#D63384', bgColor: '#FFF0F5' },
    'equipment': { icon: ShieldCheck, color: '#F2994A', bgColor: '#FFF7ED' },
    'pharmacy': { icon: Pill, color: '#FFC107', bgColor: '#FFF9E6' },
    'physio': { icon: Star, color: '#607D8B', bgColor: '#ECEFF1' },
    'default': { icon: LayoutGrid, color: '#64748B', bgColor: '#F1F5F9' },
};

const KNOWLEDGE_THEMES: Record<string, { icon: any; color: string; bgColor: string }> = {
    'Activity': { icon: Activity, color: '#FF6B6B', bgColor: '#FFF5F5' },
    'Flask': { icon: FlaskConical, color: '#4DABF7', bgColor: '#E7F5FF' },
    'Heart': { icon: HeartPulse, color: '#51CF66', bgColor: '#EBFBEE' },
    'Mental': { icon: ShieldCheck, color: '#FCC419', bgColor: '#FFF9DB' },
    'default': { icon: BookOpen, color: '#64748B', bgColor: '#F1F5F9' },
};

function getServiceTheme(name: string) {
    const low = name.toLowerCase();
    const key = Object.keys(SERVICE_THEMES).find(k => low.includes(k)) || 'default';
    return SERVICE_THEMES[key];
}

function getServiceSubtitle(name: string) {
    const n = (name || '').toLowerCase();
    if (n.includes('doctor') || n.includes('consult')) return 'Book doctors at home';
    if (n.includes('diagnostic') || n.includes('lab') || n.includes('test')) return 'Lab tests at home';
    if (n.includes('ambulance') || n.includes('emergency')) return '24/7 emergency services';
    if (n.includes('nurs')) return 'Nursing care at home';
    if (n.includes('equipment') || n.includes('rental')) return 'Rent / Buy equipment';
    if (n.includes('pharmacy') || n.includes('medicine')) return 'Medicines at your door';
    if (n.includes('physio') || n.includes('therapy')) return 'Therapy at home';
    return 'Available near you';
}

function getQuickServiceLabel(name: string) {
    const trimmed = (name || '').trim();
    if (!trimmed) return 'Service';

    if (trimmed.toLowerCase() === 'diagnostics') return 'Diagnostics';
    if (trimmed.toLowerCase().includes('doctor')) return 'Doctor Consult';
    if (trimmed.toLowerCase().includes('home nursing')) return 'Home Nursing';

    return trimmed
        .split(/\s+/)
        .slice(0, 2)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
}





const formatExperience = (exp: string | number) => {
    if (!exp) return "0 yrs";
    if (typeof exp === 'string' && (exp.includes('-') || exp.includes('/'))) {
        const start = new Date(exp);
        const now = new Date();
        const diff = now.getFullYear() - start.getFullYear();
        return `${diff > 0 ? diff : 0} yrs`;
    }
    return `${exp} yrs`;
};

// Global persistence to prevent flickering during tab switches
let cachedCity = "";

export default function HomeScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { user } = useAuthStore();
    const [refreshing, setRefreshing] = useState(false);
    const [activeHero, setActiveHero] = useState(0);
    const [activePopular, setActivePopular] = useState(0);
    const [activeBooking, setActiveBooking] = useState(0);
    const [fastTrackLoading, setFastTrackLoading] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [homeAnimPlaceholder, setHomeAnimPlaceholder] = useState('');
    const [activeKB, setActiveKB] = useState(0);
    const [selectedKB, setSelectedKB] = useState<any>(null);
    const [isKBModalOpen, setIsKBModalOpen] = useState(false);
    const { config, fetchConfig } = useConfigStore();
    const { unreadCount: globalUnreadCount } = useNotificationStore();
    const [locCity, setLocCity] = useState(cachedCity || 'Current Location');
    const [locArea, setLocArea] = useState('');
    const [locLoading, setLocLoading] = useState(false);
    const [showAreaPicker, setShowAreaPicker] = useState(false);

    const heroScrollRef = useRef<ScrollView>(null);
    const popularScrollRef = useRef<ScrollView>(null);
    const kbScrollRef = useRef<ScrollView>(null);
    const serviceImageScale = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        const pulse = Animated.loop(
            Animated.sequence([
                Animated.timing(serviceImageScale, {
                    toValue: 1.06,
                    duration: 2400,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                }),
                Animated.timing(serviceImageScale, {
                    toValue: 1,
                    duration: 2400,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                }),
            ])
        );

        pulse.start();
        return () => pulse.stop();
    }, [serviceImageScale]);

    // Computed dynamic components
    const dynamicBanners = useMemo(() => {
        const main = config?.landing.mainBanners || [];
        const festival = config?.landing.festivalBanners || [];

        // Prefer mainBanners, fallback to festivalBanners
        const pool = main.length > 0 ? main : festival;
        const activeBanners = pool.filter(b => b.active !== false);

        if (activeBanners.length > 0) {
            return activeBanners.map((b: any, index: number) => {
                const imageUrl = getBannerImage(b);
                return {
                    id: b.id || b._id || `admin-banner-${index}`,
                    tag: b.tag || b.badge || b.label || 'A1CARE OFFER',
                    title: b.title || b.name || 'Healthcare services made easier',
                    subtitle: b.subtitle || b.description || 'Book trusted care from A1Care.',
                    cta: b.cta || b.buttonText || 'Explore Now',
                    colors: b.colors || [config?.branding?.primaryColor || '#2F80ED', config?.branding?.secondaryColor || '#21BB7E'],
                    path: b.redirectUrl || b.link || '/services',
                    params: b.params || {},
                    secondaryIcon: HeartPulse,
                    isDynamic: true,
                    imageUrl,
                };
            });
        }

        return [];
    }, [config?.branding?.primaryColor, config?.branding?.secondaryColor, config?.landing.mainBanners, config?.landing.festivalBanners]);

    const dynamicPromotionalBanners = useMemo(() => {
        const promo = config?.landing.promotionalBanners || [];
        return promo.filter(b => b.active !== false).map((b: any, index: number) => ({
            id: b.id || b._id || `promo-banner-${index}`,
            title: b.title || 'Special Offer',
            imageUrl: getBannerImage(b),
            path: b.redirectUrl || b.link || '/services',
            params: b.params || {},
        }));
    }, [config?.landing.promotionalBanners]);

    const dynamicKnowledgeBanners = useMemo(() => {
        const knowledge = (config?.landing as any)?.knowledgeBanners || [];
        return knowledge.filter((b: any) => b.active !== false).map((b: any, index: number) => ({
            id: b.id || b._id || `knowledge-banner-${index}`,
            title: b.title || 'Health Insight',
            imageUrl: getBannerImage(b),
            path: b.redirectUrl || b.link || '/services',
            params: b.params || {},
        }));
    }, [config?.landing]);

    const dynamicKB = useMemo(() => {
        const cloudKB = config?.knowledgeBase || [];
        if (cloudKB.length === 0) return [];

        return cloudKB.map((item: any) => ({
            ...item,
            id: item.id || Math.random().toString(),
            icon: KNOWLEDGE_THEMES[item.refType]?.icon || Activity,
            color: KNOWLEDGE_THEMES[item.refType]?.color || '#FF6B6B',
            bgColor: KNOWLEDGE_THEMES[item.refType]?.bgColor || '#FFF5F5',
            imageUrl: getKnowledgeImage(item),
            fallbackImage:
                item.refType === 'Flask'
                    ? require('@/assets/images/doctor_fallback_ai_2.png')
                    : item.refType === 'Heart'
                        ? require('@/assets/images/doctor_fallback_ai_3.png')
                        : require('@/assets/images/doctor_fallback_ai.png'),
        }));
    }, [config?.knowledgeBase]);

    useEffect(() => {
        fetchConfig();
    }, [fetchConfig]);

    // Location fetcher
    const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> => {
        return await Promise.race([
            promise,
            new Promise<T>((_, reject) => setTimeout(() => reject(new Error(message)), timeoutMs)),
        ]);
    };

    const handleGetLocation = async (isBackground = false) => {
        if (!isBackground) setLocLoading(true);
        try {
            const permission = isBackground
                ? await Location.getForegroundPermissionsAsync()
                : await Location.requestForegroundPermissionsAsync();
            const { status } = permission;
            if (status !== 'granted') {
                if (!isBackground) {
                    setLocCity('Permission Denied');
                    setLocArea('Enable location in settings');
                }
                return;
            }
            let pos = await Location.getLastKnownPositionAsync({
                maxAge: 5 * 60 * 1000,
                requiredAccuracy: 500,
            });

            if (!pos) {
                pos = await withTimeout(
                    Location.getCurrentPositionAsync({
                        accuracy: Location.Accuracy.Balanced,
                        mayShowUserSettingsDialog: true,
                    }),
                    12000,
                    'Location detection timed out'
                );
            }

            const geocoded = await withTimeout(
                Location.reverseGeocodeAsync({
                    latitude: pos.coords.latitude,
                    longitude: pos.coords.longitude,
                }),
                10000,
                'Address lookup timed out'
            );
            const [geo] = geocoded;

            const city = geo.city || geo.region || 'Your City';
            const area = geo.district || geo.subregion || geo.street || '';

            setLocCity(city);
            setLocArea(area);
            cachedCity = city; // Store in memory

            // Persistent storage
            await AsyncStorage.setItem("last_city", city);
            await AsyncStorage.setItem("last_area", area);
        } catch (e) {
            if (!isBackground) {
                setLocCity('Location Error');
                setLocArea('Tap to retry');
            }
        } finally {
            if (!isBackground) setLocLoading(false);
        }
    };

    useEffect(() => {
        const loadCachedLocation = async () => {
            try {
                const cachedCity = await AsyncStorage.getItem("last_city");
                const cachedArea = await AsyncStorage.getItem("last_area");
                if (cachedCity) setLocCity(cachedCity);
                if (cachedArea) setLocArea(cachedArea);
            } catch (e) { }
        };

        loadCachedLocation();
        // Request location permission when user lands on Home after login/app entry.
        handleGetLocation();
    }, []);

    useFocusEffect(
        useCallback(() => {
            let active = true;
            const refreshFromCache = async () => {
                try {
                    const cachedCity = await AsyncStorage.getItem("last_city");
                    const cachedArea = await AsyncStorage.getItem("last_area");
                    if (!active) return;
                    if (cachedCity) setLocCity(cachedCity);
                    if (cachedArea !== null) setLocArea(cachedArea);
                } catch (e) { }
            };
            refreshFromCache();
            return () => {
                active = false;
            };
        }, [])
    );

    // Auto-slide logic for Hero section
    useEffect(() => {
        const slideCount = dynamicBanners.length;
        if (slideCount <= 1) return;

        const timer = setInterval(() => {
            setActiveHero((prev) => {
                const nextIndex = (prev + 1) % slideCount;
                heroScrollRef.current?.scrollTo({ x: nextIndex * width, animated: true });
                return nextIndex;
            });
        }, 5000); // 5 second rotation

        return () => clearInterval(timer);
    }, [dynamicBanners.length]);

    // Auto-slide for Knowledge Base
    useEffect(() => {
        const slideCount = dynamicKB.length;
        if (slideCount <= 1) return;

        const timer = setInterval(() => {
            setActiveKB((prev) => {
                const nextIndex = (prev + 1) % slideCount;
                kbScrollRef.current?.scrollTo({ x: nextIndex * (width - 40), animated: true });
                return nextIndex;
            });
        }, 7000); // 7 second rotation

        return () => clearInterval(timer);
    }, [dynamicKB.length]);

    const { data: services, refetch: refetchServices } = useQuery({
        queryKey: ['services'],
        queryFn: servicesService.getAll,
    });

    const { data: featured, refetch: refetchFeatured } = useQuery({
        queryKey: ['services-featured'],
        queryFn: servicesService.getFeatured,
    });

    const { data: ongoingBookings, refetch: refetchBookings } = useQuery({
        queryKey: ['pending-bookings'],
        queryFn: bookingsService.getPendingServiceBookings,
    });

    const { data: roles } = useQuery({
        queryKey: ['roles'],
        queryFn: doctorsService.getRoles,
    });

    const doctorRoleId = roles?.find(r => r.name.toLowerCase().includes('doctor'))?._id;

    const { data: allDoctors, refetch: refetchDoctors } = useQuery({
        queryKey: ['doctors', doctorRoleId],
        queryFn: () => doctorsService.getByRole(doctorRoleId!),
        enabled: !!doctorRoleId,
    });

    const { data: notifications, refetch: refetchNotifications } = useQuery({
        queryKey: ['notifications'],
        queryFn: () => notificationsService.getAll(1),
    });

    const unreadCount = notifications?.unreadCount ?? 0;

    const { data: healthPackages, refetch: refetchPackages } = useQuery({
        queryKey: ['health-packages'],
        queryFn: async () => {
            const res = await api.get(Endpoints.HEALTH_PACKAGES);
            return res.data.data as any[];
        },
    });

    const topDoctors = useMemo(() => {
        if (!allDoctors) return [];
        if (!searchQuery.trim()) return allDoctors.slice(0, 6);
        return allDoctors.filter(d =>
            d.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            d.specialization?.some(s => s.toLowerCase().includes(searchQuery.toLowerCase()))
        );
    }, [allDoctors, searchQuery]);

    const matchedServices = useMemo(() => {
        if (!services || !searchQuery.trim()) return [];
        return services.filter(s =>
            s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.title?.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [services, searchQuery]);

    const isSearching = searchQuery.trim().length > 0;

    // ── Typewriter placeholder for home search bar ──
    useEffect(() => {
        // Only the service name animates — "Search for" stays static
        const phrases = services?.length
            ? services.map(s => s.name)
            : ['Doctor at Home', 'Home Nursing', 'Diagnostics', 'Pharmacy', 'Ambulance'];
        let phraseIdx = 0;
        let charIdx = 0;
        let deleting = false;
        let timeoutId: ReturnType<typeof setTimeout>;
        const tick = () => {
            const phrase = phrases[phraseIdx % phrases.length];
            let delay = 80;
            if (!deleting) {
                charIdx++;
                setHomeAnimPlaceholder(`Search for ${phrase.slice(0, charIdx)}`);
                if (charIdx === phrase.length) { deleting = true; delay = 1400; }
            } else {
                charIdx--;
                setHomeAnimPlaceholder(`Search for ${phrase.slice(0, charIdx)}`);
                if (charIdx === 0) { deleting = false; phraseIdx++; delay = 300; }
                else { delay = 38; }
            }
            timeoutId = setTimeout(tick, delay);
        };
        timeoutId = setTimeout(tick, 600);
        return () => clearTimeout(timeoutId);
    }, [services]);

    const dynamicQuickServices = useMemo(() => {
        if (!services) return [];
        // Use API order (already sorted by admin-set priority)
        return services.slice(0, 6).map(s => ({
            id: s._id,
            label: getQuickServiceLabel(s.name),
            subtitle: getServiceSubtitle(s.name),
            icon: getServiceTheme(s.name).icon,
            color: getServiceTheme(s.name).color,
            bgColor: getServiceTheme(s.name).bgColor,
            imageUrl: s.imageUrl,
            isMore: false,
            path: '/services',
            params: { category: s.name, serviceId: s._id }
        }));
    }, [services]);

    const onRefresh = async () => {
        setRefreshing(true);
        await Promise.all([
            refetchServices(),
            refetchFeatured(),
            refetchBookings(),
            refetchDoctors(),
            refetchPackages(),
            refetchNotifications(),
            fetchConfig()
        ]);
        setRefreshing(false);
    };

    const handleEmergency = () => Linking.openURL('tel:112');

    const handleOpenKnowledgeSpace = () => {
        router.push({ pathname: '/knowledge-base' as any });
    };

    const handleBannerPress = (slide: any) => {
        // Knowledge base banners open the detail modal
        if (slide.isKB || slide.description) {
            setSelectedKB(slide);
            setIsKBModalOpen(true);
            return;
        }
        const target = slide.path || '/services';

        // Handle web links
        if (typeof target === 'string' && /^https?:\/\//i.test(target)) {
            Linking.openURL(target);
            return;
        }

        // Handle a1care deep links (e.g. a1care://services?category=...&serviceId=...)
        if (typeof target === 'string' && target.startsWith('a1care://')) {
            try {
                const url = new URL(target.replace('a1care://', 'https://a1care.app/'));
                const path = url.pathname === '/' ? '/services' : url.pathname;
                const params: any = {};
                url.searchParams.forEach((val, key) => {
                    params[key] = val;
                });

                router.push({
                    pathname: path as any,
                    params: { ...params, from: 'banner' }
                });
                return;
            } catch (err) {
                console.error('[BannerPress] Deep link parse failed:', err);
            }
        }

        router.push({
            pathname: target as any,
            params: { ...slide.params, from: 'home' },
        });
    };

    const handleQuickServiceOpen = async (item: any) => {
        setFastTrackLoading(item.id);
        const label = String(item?.label || '').toLowerCase();
        const isAmbulance = label.includes('ambulance') || label.includes('emergency');
        try {
        const withTimeout = async <T,>(promise: Promise<T>, ms = 7000) => {
            let timer: ReturnType<typeof setTimeout> | null = null;
            const timeoutPromise = new Promise<T>((_, reject) => {
                timer = setTimeout(() => reject(new Error('Request timed out')), ms);
            });
            try {
                return await Promise.race([promise, timeoutPromise]);
            } finally {
                if (timer) clearTimeout(timer);
            }
        };

        if (isAmbulance && item?.id) {
            try {
                const subs = await withTimeout(servicesService.getSubServices(item.id));
                if (subs?.length) {
                    const children = await withTimeout(servicesService.getChildServices(subs[0]._id));
                    if (children?.length) {
                        const targetChild = children[0];
                        router.push({
                            pathname: '/service/[id]',
                            params: {
                                id: targetChild._id,
                                name: targetChild.name,
                                price: targetChild.price,
                                subName: subs[0].name,
                                from: 'index',
                                entryMode: 'direct',
                                originServiceId: '',
                                originSubServiceId: '',
                                originCategory: '',
                            },
                        });
                        return;
                    }
                }
            } catch (err) {
                console.log('[QuickService] Ambulance fast-track failed:', err);
            }

            // Always fallback if fast-track cannot resolve a child service.
            router.push({
                pathname: '/services',
                params: { category: item.label, serviceId: item.id, subServiceId: '', from: 'home' }
            });
            return;
        }

        router.push({
            pathname: '/services',
            params: { category: item.label, serviceId: item.id, subServiceId: '', from: 'home' }
        });
        } catch (err) {
            console.log('[QuickService] Error:', err);
            router.push({ pathname: '/services', params: { category: item.label, serviceId: item.id, subServiceId: '', from: 'home' } });
        } finally {
            setFastTrackLoading(null);
        }
    };

    // Dynamic Hospital OP Link - Ultra-fast separate booking flow
    const handleHospitalBooking = async () => {
        // 1. Try to find the specific Hospital service
        let hSrv = services?.find(s =>
            s.name.toLowerCase().includes('hospital') ||
            s.title?.toLowerCase().includes('op booking')
        );

        // 2. Fallback: Try to find 'Doctor Consult' if Hospital isn't in DB yet
        if (!hSrv) {
            hSrv = services?.find(s => s.name.toLowerCase().includes('doctor'));
        }

        if (hSrv) {
            try {
                const subs = await servicesService.getSubServices(hSrv._id);
                if (subs && subs.length > 0) {
                    // Look for an OP-related sub-service or just pick the first one
                    const opSub = subs.find(sub =>
                        sub.name.toLowerCase().includes('op') ||
                        sub.name.toLowerCase().includes('general')
                    ) || subs[0];

                    const children = await servicesService.getChildServices(opSub._id);
                    if (children && children.length > 0) {
                        const target = children[0];
                        router.push({
                            pathname: '/hospital/book',
                            params: { id: target._id, from: 'index' }
                        });
                        return;
                    }
                }
            } catch (err) {
                console.error("Hospital fast-track failed", err);
            }

            // Fallback to services list with category filter if quick-book fails
            router.push({
                pathname: '/services',
                params: { category: hSrv.name, from: 'index' }
            });
        } else {
            // Last resort: basic services list
            router.push('/services');
        }
    };

    return (
        <View style={styles.root}>
            <ScrollView
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />
                }
                contentContainerStyle={{ paddingTop: 0 }}
            >
                {/* ── 1. Top Bar (Now part of scroll) ── */}
                <View style={[styles.stickyHeader, { paddingTop: insets.top + 12 }]}>
                    <View style={styles.headerTop}>
                        <TouchableOpacity style={styles.locationSelector} onPress={() => setShowAreaPicker(true)}>
                            <View style={styles.locIconContainer}>
                                {locLoading
                                    ? <ActivityIndicator size="small" color={Colors.primary} />
                                    : <MapPin size={16} color={Colors.primary} />
                                }
                            </View>
                            <View>
                                <Text style={styles.locCity} numberOfLines={1}>{locArea || 'Select Area'}</Text>
                                <Text style={styles.locSub} numberOfLines={1}>{locCity !== 'Current Location' ? locCity : 'Tap to choose'}</Text>
                            </View>
                        </TouchableOpacity>

                        {/* Area Picker Modal */}
                        <Modal visible={showAreaPicker} transparent animationType="slide" onRequestClose={() => setShowAreaPicker(false)}>
                            <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }} activeOpacity={1} onPress={() => setShowAreaPicker(false)} />
                            <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 32, position: 'absolute', bottom: 0, left: 0, right: 0 }}>
                                <View style={{ alignItems: 'center', paddingVertical: 12 }}>
                                    <View style={{ width: 40, height: 4, backgroundColor: '#e0e0e0', borderRadius: 2 }} />
                                    <Text style={{ fontSize: 16, fontWeight: '700', marginTop: 10, color: '#1a1a1a' }}>Select Your Area</Text>
                                </View>
                                {[
                                    'Safilguda',
                                    'Neredmet',
                                    'Malkajgiri',
                                    'Anand Bagh',
                                    'Dayanand Nagar',
                                    'Moula Ali',
                                    'A.S. Rao Nagar',
                                    'Sainikpuri',
                                ].map((area) => (
                                    <TouchableOpacity
                                        key={area}
                                        onPress={async () => {
                                            setLocArea(area);
                                            setLocCity('Hyderabad');
                                            await AsyncStorage.setItem('last_city', 'Hyderabad');
                                            await AsyncStorage.setItem('last_area', area);
                                            setShowAreaPicker(false);
                                        }}
                                        style={{
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            paddingHorizontal: 24,
                                            paddingVertical: 14,
                                            borderBottomWidth: 1,
                                            borderBottomColor: '#f0f0f0',
                                            backgroundColor: locArea === area ? '#EBF5FB' : '#fff',
                                        }}
                                    >
                                        <MapPin size={16} color={Colors.primary} style={{ marginRight: 12 }} />
                                        <Text style={{ fontSize: 15, color: '#1a1a1a', fontWeight: locArea === area ? '700' : '400' }}>{area}</Text>
                                        {locArea === area && <Text style={{ marginLeft: 'auto', color: Colors.primary, fontSize: 18 }}>✓</Text>}
                                    </TouchableOpacity>
                                ))}
                                <TouchableOpacity
                                    onPress={() => { setShowAreaPicker(false); handleGetLocation(); }}
                                    style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 14, borderTopWidth: 1, borderTopColor: '#f0f0f0' }}
                                >
                                    <MapPin size={16} color={Colors.primary} style={{ marginRight: 12 }} />
                                    <Text style={{ fontSize: 15, color: Colors.primary, fontWeight: '600' }}>Use my current location</Text>
                                </TouchableOpacity>
                            </View>
                        </Modal>

                        <View style={styles.headerActions}>
                            <TouchableOpacity style={styles.iconCircle} onPress={() => router.push('/(tabs)/notifications')}>
                                <Bell size={20} color={Colors.textPrimary} />
                                {globalUnreadCount > 0 && <View style={styles.notifDot} />}
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => router.push('/(tabs)/profile')}>
                                <View style={styles.avatarCircle}>
                                    {user?.profileImage ? (
                                        <Image
                                            source={{ uri: user.profileImage }}
                                            style={{ width: '100%', height: '100%', borderRadius: 100 }}
                                        />
                                    ) : (
                                        <Text style={styles.avatarInitial}>{user?.name?.charAt(0) ?? 'U'}</Text>
                                    )}
                                </View>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Search integrated into header area */}
                    <View style={styles.searchWrapper}>
                        <View style={styles.searchBar}>
                            <Search size={18} color={Colors.muted} style={{ marginRight: 10 }} />
                            <TextInput
                                style={styles.searchInput}
                                placeholder={homeAnimPlaceholder || 'Search symptoms, doctors...'}
                                placeholderTextColor={Colors.muted}
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                            />
                            {searchQuery.length > 0 && (
                                <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearIcon}>
                                    <X size={18} color={Colors.muted} />
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                    <View style={styles.headerDivider} />
                </View>
                {isSearching ? (
                    <View style={styles.searchResultsContainer}>
                        <View style={styles.searchHeader}>
                            <Text style={styles.searchTitle}>Search Results</Text>
                            <Text style={styles.searchCount}>{topDoctors.length + matchedServices.length} matches found</Text>
                        </View>

                        {/* Matched Services */}
                        {matchedServices.length > 0 && (
                            <View style={styles.searchSection}>
                                <Text style={styles.searchSectionTitle}>Services & Categories</Text>
                                {matchedServices.map(s => (
                                    <TouchableOpacity
                                        key={s._id}
                                        style={styles.searchResultRow}
                                        onPress={() => router.push({ pathname: '/services', params: { category: s.name, serviceId: s._id, subServiceId: '', from: 'home' } })}
                                    >
                                        <View style={styles.searchResultIcon}>
                                            <LayoutGrid size={18} color={Colors.primary} />
                                        </View>
                                        <Text style={styles.searchResultText}>{s.name}</Text>
                                        <ArrowRight size={14} color={Colors.muted} />
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}

                        {/* Matched Doctors */}
                        {topDoctors.length > 0 ? (
                            <View style={styles.searchSection}>
                                <Text style={styles.searchSectionTitle}>Doctors & Specialists</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 10 }}>
                                    {topDoctors.map(d => (
                                        <DoctorCard
                                            id={d._id}
                                            key={d._id}
                                            name={d.name || "Doctor"}
                                            specialization={d.specialization?.join(", ") || "Specialist"}
                                            rating={d.rating || 4.8}
                                            experience={formatExperience(d.startExperience ?? 0)}
                                            price={d.consultationFee || 650}
                                            imageUrl={d.profileImage || d.imageUrl}
                                            onPress={() => router.push({ pathname: '/doctor/[id]', params: { id: d._id, from: 'top_doctors' } })}
                                        />
                                    ))}
                                </ScrollView>
                            </View>
                        ) : !matchedServices.length && (
                            <View style={styles.noResults}>
                                <Search size={48} color={Colors.muted} style={{ marginBottom: 16, opacity: 0.5 }} />
                                <Text style={styles.noResultsText}>No matches found for "{searchQuery}"</Text>
                                <TouchableOpacity style={styles.resetBtn} onPress={() => setSearchQuery('')}>
                                    <Text style={styles.resetBtnText}>Clear Search</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                        <View style={{ height: 200 }} />
                    </View>
                ) : (
                    <>
                        {/* ── 2. Strong Hero Section ── */}
                        <View style={styles.heroContainer}>
                            <ScrollView
                                ref={heroScrollRef}
                                horizontal
                                pagingEnabled
                                showsHorizontalScrollIndicator={false}
                                onScroll={(e) => {
                                    const slide = Math.round(e.nativeEvent.contentOffset.x / width);
                                    if (slide !== activeHero) setActiveHero(slide);
                                }}
                                scrollEventThrottle={16}
                            >
                                {dynamicBanners.map((slide) => (
                                    <View key={slide.id} style={styles.heroCard}>
                                        <TouchableOpacity
                                            activeOpacity={0.9}
                                            onPress={() => handleBannerPress(slide)}
                                            style={{ flex: 1 }}
                                        >
                                            <LinearGradient
                                                colors={slide.colors as any}
                                                start={{ x: 0, y: 0 }}
                                                end={{ x: 1, y: 1 }}
                                                style={styles.heroGradient}
                                            >
                                                {(slide as any).imageUrl ? (
                                                    <Image
                                                        source={{ uri: (slide as any).imageUrl }}
                                                        style={[styles.adminBannerImage, { zIndex: 1 }]}
                                                        contentFit="cover"
                                                        contentPosition="center"
                                                        transition={220}
                                                    />
                                                ) : (
                                                    <>
                                                        <View style={styles.heroTextContent}>
                                                            <Text style={styles.heroTag}>{slide.tag}</Text>
                                                            <Text style={styles.heroTitle}>{slide.title}</Text>
                                                            <Text style={styles.heroSubtitle}>{slide.subtitle}</Text>

                                                            <View style={styles.heroCta}>
                                                                <Text style={styles.heroCtaText}>{slide.cta}</Text>
                                                                <ArrowRight size={16} color={Colors.primary} />
                                                            </View>

                                                            <View style={styles.heroLink}>
                                                                <Text style={styles.heroLinkText}>Explore Services</Text>
                                                            </View>
                                                        </View>
                                                        <View style={styles.heroDecorationContainer}>
                                                            <slide.secondaryIcon size={140} color="rgba(255,255,255,0.15)" strokeWidth={1.5} />
                                                        </View>
                                                    </>
                                                )}
                                            </LinearGradient>
                                        </TouchableOpacity>
                                    </View>
                                ))}
                            </ScrollView>
                            <View style={styles.paginationDots}>
                                {dynamicBanners.map((_, i) => (
                                    <View key={i} style={[styles.dot, activeHero === i && styles.dotActive]} />
                                ))}
                            </View>
                        </View>

                        {/* ── Our Services Grid ── */}
                        <View style={styles.servicesGridContainer}>
                            <View style={styles.servicesHeader}>
                                <Text style={[styles.sectionTitle, { fontSize: 18 }]}>Our Services</Text>
                                <TouchableOpacity onPress={() => router.push('/services' as any)} style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                                    <Text style={styles.seeAll}>View All</Text>
                                    <ChevronRight size={14} color={Colors.primary} />
                                </TouchableOpacity>
                            </View>

                            <View style={styles.servicesGridWrap}>
                                {(dynamicQuickServices.length > 0
                                    ? dynamicQuickServices
                                    : Array(6).fill(null).map((_, i) => ({ id: String(i), label: '', subtitle: '', icon: LayoutGrid, color: Colors.muted, bgColor: '#F1F5F9', imageUrl: undefined, isMore: false, path: '/services', params: {} }))
                                ).map((item) => (
                                    <TouchableOpacity
                                        key={item.id}
                                        style={styles.serviceBigCard}
                                        activeOpacity={0.86}
                                        onPress={() => handleQuickServiceOpen(item)}
                                    >
                                        {/* Service image area */}
                                        <View style={styles.serviceCircleWrap}>
                                            <View style={styles.serviceCircle}>
                                                {fastTrackLoading === item.id ? (
                                                    <ActivityIndicator color={item.color} size="small" />
                                                                                ) : item.isMore ? (
                                                    <View style={[styles.serviceCircleInner, { backgroundColor: Colors.primaryLight }]}>
                                                        <LayoutGrid size={30} color={Colors.primary} />
                                                    </View>
                                                ) : item.imageUrl ? (
                                                    <Animated.View style={[styles.serviceCircleImage, { transform: [{ scale: serviceImageScale }] }]}>
                                                        <Image
                                                            source={{ uri: item.imageUrl }}
                                                            style={styles.serviceCircleImage}
                                                            contentFit="cover"
                                                            transition={180}
                                                        />
                                                    </Animated.View>
                                                ) : (
                                                    <View style={[styles.serviceCircleInner, { backgroundColor: item.bgColor }]}>
                                                        <item.icon size={30} color={item.color} />
                                                    </View>
                                                )}
                                            </View>
                                        </View>

                                        <Text style={styles.serviceBigName} numberOfLines={2}>{item.label}</Text>
                                        <Text style={styles.serviceBigSub} numberOfLines={1}>{item.subtitle}</Text>

                                    </TouchableOpacity>
                                ))}
                                {/* Invisible fillers to keep last row left-aligned */}
                                {Array(
                                    dynamicQuickServices.length % 3 === 0 ? 0 : 3 - (dynamicQuickServices.length % 3)
                                ).fill(null).map((_, i) => (
                                    <View key={`filler-${i}`} style={{ width: Math.floor((width - 32 - 32 - 12) / 3) }} />
                                ))}
                            </View>

                        </View>

                        {/* ── OP Booking Card ── */}
                        <View style={styles.opCard}>
                            {/* Top row: icon+title | divider | button */}
                            <View style={styles.opTopRow}>
                                <View style={styles.opLeft}>
                                    <View style={styles.opIconWrap}>
                                        <View style={styles.opIconCircle}>
                                            <Hospital size={26} color={Colors.primary} />
                                        </View>
                                        <View style={styles.opCheckBadge}>
                                            <CheckCircle2 size={18} color="#fff" fill={Colors.accent} />
                                        </View>
                                    </View>
                                    <Text style={styles.opTitle}>
                                        Book <Text style={styles.opTitleAccent}>OP</Text>{'\n'}Consultation
                                    </Text>
                                </View>

                                <View style={styles.opDivider} />

                                <View style={styles.opRight}>
                                    <TouchableOpacity style={styles.opBtn} onPress={handleHospitalBooking} activeOpacity={0.88}>
                                        <Text style={styles.opBtnText}>Book Now</Text>
                                        <ArrowRight size={18} color="#fff" />
                                    </TouchableOpacity>
                                    <View style={styles.opTrustRow}>
                                        <ShieldCheck size={13} color={Colors.accent} />
                                        <Text style={styles.opTrustText}>Quick • Easy • Trusted</Text>
                                    </View>
                                </View>
                            </View>

                            {/* Description spans full card width */}
                            <Text style={styles.opSub}>
                                Walk-in or schedule your appointment at A1Care Hospital
                            </Text>

                            {/* Bottom features row */}
                            <View style={styles.opFeatureRow}>
                                {[
                                    { icon: Stethoscope, label: 'Expert\nDoctors' },
                                    { icon: CalendarCheck, label: 'Quick\nAppointments' },
                                    { icon: Clock, label: 'Shorter\nWaiting Time' },
                                    { icon: ShieldCheck, label: 'Trusted\nCare' },
                                ].map((f, i, arr) => (
                                    <React.Fragment key={i}>
                                        <View style={styles.opFeatureItem}>
                                            <View style={styles.opFeatureIconBox}>
                                                <f.icon size={18} color={Colors.accent} />
                                            </View>
                                            <Text style={styles.opFeatureLabel}>{f.label}</Text>
                                        </View>
                                        {i < arr.length - 1 && <View style={styles.opFeatureSep} />}
                                    </React.Fragment>
                                ))}
                            </View>
                        </View>



                        {/* ── 5. Smart Recommendations (Horizontal) ── */}
                        {featured && featured.length > 0 && (
                            <View style={styles.section}>
                                <View style={styles.sectionHeader}>
                                    <Text style={styles.sectionTitle}>Popular Near You</Text>
                                </View>
                                <ScrollView
                                    ref={popularScrollRef}
                                    horizontal
                                    pagingEnabled
                                    showsHorizontalScrollIndicator={false}
                                    onScroll={(e) => {
                                        const slide = Math.round(e.nativeEvent.contentOffset.x / width);
                                        if (slide !== activePopular) setActivePopular(slide);
                                    }}
                                    scrollEventThrottle={16}
                                >
                                    {featured.slice(0, 10).map((item) => {
                                        const theme = getServiceTheme(item.name);
                                        const IconComp = theme.icon;
                                        return (
                                            <TouchableOpacity
                                                key={item._id}
                                                style={styles.recommendCard}
                                                activeOpacity={0.9}
                                                onPress={() => router.push({
                                                    pathname: '/service/[id]',
                                                    params: {
                                                        id: item._id,
                                                        from: 'home',
                                                        entryMode: 'direct',
                                                        originServiceId: '',
                                                        originSubServiceId: '',
                                                        originCategory: '',
                                                    }
                                                })}
                                            >
                                                <View style={styles.recommendLeft}>
                                                    <View style={[styles.badge, { backgroundColor: theme.bgColor }]}>
                                                        <Text style={[styles.badgeText, { color: theme.color }]}>RECOMMENDED</Text>
                                                    </View>
                                                    <Text style={styles.recommendTitle}>{item.name}</Text>
                                                    <Text style={styles.recommendDesc} numberOfLines={2}>{item.description}</Text>
                                                    <View style={styles.recommendFooter}>
                                                        <Text style={styles.recommendPrice}>₹{item.price}</Text>
                                                        <View style={styles.bookBadge}>
                                                            <Text style={styles.bookBadgeText}>Book</Text>
                                                        </View>
                                                    </View>
                                                </View>
                                                <View style={styles.recommendRight}>
                                                    <IconComp size={40} color={theme.color} opacity={0.6} />
                                                </View>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </ScrollView>

                                <View style={styles.miniPagination}>
                                    {(featured?.slice(0, 10) ?? [1, 2]).map((_, i) => (
                                        <View key={i} style={[styles.miniDot, activePopular === i && styles.miniDotActive]} />
                                    ))}
                                </View>
                            </View>
                        )}

                        {/* ── 6. Top Doctors Section ── */}
                        <View style={styles.section}>
                            <View style={styles.sectionHeader}>
                                <View>
                                    <Text style={styles.sectionTitle}>
                                        {searchQuery ? 'Search Results' : 'Top Doctors'}
                                    </Text>
                                    <Text style={styles.sectionSub}>
                                        {searchQuery ? `${topDoctors.length} matched professionals` : 'Available experts near you'}
                                    </Text>
                                </View>
                                <TouchableOpacity onPress={() => router.push('/doctor/list')}>
                                    <Text style={styles.seeAll}>See All</Text>
                                </TouchableOpacity>
                            </View>
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                style={styles.doctorScroll}
                                contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 10 }}
                            >
                                {topDoctors.length > 0 ? topDoctors.map(d => (
                                    <DoctorCard
                                        id={d._id}
                                        key={d._id}
                                        name={d.name || "Doctor"}
                                        specialization={d.specialization?.join(", ") || "Specialist"}
                                        rating={d.rating || 4.8}
                                        experience={formatExperience(d.startExperience ?? 0)}
                                        price={d.consultationFee || 650}
                                        imageUrl={d.profileImage || d.imageUrl}
                                        workingHours={d.workingHours}
                                        onPress={() => router.push({ pathname: '/doctor/[id]', params: { id: d._id, from: 'top_doctors' } })}
                                    />
                                )) : (
                                    <View style={styles.emptyCard}>
                                        <Text style={styles.emptyText}>Loading experts...</Text>
                                    </View>
                                )}
                            </ScrollView>
                        </View>

                        {/* ── 7. Health Packages (Dynamic) ── */}
                        <View style={styles.section}>
                            <View style={styles.sectionHeader}>
                                <View>
                                    <Text style={styles.sectionTitle}>Health Packages</Text>
                                    <Text style={styles.sectionSub}>Bundled checkups at best prices</Text>
                                </View>
                            </View>
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={{ paddingHorizontal: 20, gap: 14 }}
                            >
                                {healthPackages && healthPackages.length > 0 ? (
                                    healthPackages.map((pkg: any) => {
                                        const discountPct = pkg.originalPrice > pkg.price
                                            ? Math.round(((pkg.originalPrice - pkg.price) / pkg.originalPrice) * 100)
                                            : 0;
                                        return (
                                            <TouchableOpacity
                                                key={pkg._id}
                                                activeOpacity={0.88}
                                                style={styles.pkgCard}
                                                onPress={() => router.push({
                                                    pathname: '/package/[id]',
                                                    params: { id: pkg._id, from: 'home' }
                                                })}
                                            >
                                                {/* Color top bar */}
                                                <LinearGradient
                                                    colors={[pkg.color || '#2F80ED', (pkg.color || '#2F80ED') + 'AA']}
                                                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                                                    style={styles.pkgHeader}
                                                >
                                                    {pkg.badge && (
                                                        <View style={styles.pkgBadge}>
                                                            <Text style={styles.pkgBadgeText}>{pkg.badge}</Text>
                                                        </View>
                                                    )}
                                                    <Text style={styles.pkgName} numberOfLines={2}>{pkg.name}</Text>
                                                    <View style={styles.pkgPriceRow}>
                                                        <Text style={styles.pkgPrice}>₹{pkg.price}</Text>
                                                        {discountPct > 0 && (
                                                            <View style={styles.pkgDiscountBadge}>
                                                                <Text style={styles.pkgDiscountText}>{discountPct}% OFF</Text>
                                                            </View>
                                                        )}
                                                    </View>
                                                    {pkg.originalPrice > pkg.price && (
                                                        <Text style={styles.pkgOriginalPrice}>₹{pkg.originalPrice}</Text>
                                                    )}
                                                </LinearGradient>

                                                {/* Tests */}
                                                <View style={styles.pkgBody}>
                                                    <Text style={styles.pkgTestsLabel}>{(pkg.testsIncluded || []).length} Tests Included</Text>
                                                    <View style={styles.pkgTestsTags}>
                                                        {(pkg.testsIncluded || []).slice(0, 3).map((t: string) => (
                                                            <View key={t} style={styles.pkgTag}>
                                                                <Text style={styles.pkgTagText} numberOfLines={1}>{t}</Text>
                                                            </View>
                                                        ))}
                                                        {(pkg.testsIncluded || []).length > 3 && (
                                                            <View style={styles.pkgTag}>
                                                                <Text style={styles.pkgTagText}>+{(pkg.testsIncluded || []).length - 3} more</Text>
                                                            </View>
                                                        )}
                                                    </View>
                                                    <TouchableOpacity
                                                        style={[styles.pkgBtn, { backgroundColor: pkg.color || '#2F80ED' }]}
                                                        onPress={() => router.push({
                                                            pathname: '/package/[id]',
                                                            params: { id: pkg._id, from: 'home' }
                                                        })}
                                                    >
                                                        <Text style={styles.pkgBtnText}>Book Package</Text>
                                                    </TouchableOpacity>
                                                </View>
                                            </TouchableOpacity>
                                        );
                                    })
                                ) : (
                                    // Static fallback while loading or if no packages
                                    [{ name: 'Basic Health Checkup', price: 999, color: '#2F80ED', badge: 'BEST VALUE' },
                                    { name: 'Diabetes Care Pack', price: 1499, color: '#9B51E0', badge: 'POPULAR' },
                                    { name: 'Full Body Checkup', price: 2999, color: '#F2994A', badge: 'COMPREHENSIVE' }].map((p, i) => (
                                        <TouchableOpacity key={i} activeOpacity={0.88} style={styles.pkgCard}>
                                            <LinearGradient colors={[p.color, p.color + 'AA']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.pkgHeader}>
                                                <View style={styles.pkgBadge}><Text style={styles.pkgBadgeText}>{p.badge}</Text></View>
                                                <Text style={styles.pkgName} numberOfLines={2}>{p.name}</Text>
                                                <Text style={styles.pkgPrice}>₹{p.price}</Text>
                                            </LinearGradient>
                                            <View style={styles.pkgBody}>
                                                <Text style={styles.pkgTestsLabel}>Loading tests...</Text>
                                                <TouchableOpacity style={[styles.pkgBtn, { backgroundColor: p.color }]}>
                                                    <Text style={styles.pkgBtnText}>Book Package</Text>
                                                </TouchableOpacity>
                                            </View>
                                        </TouchableOpacity>
                                    ))
                                )}
                            </ScrollView>
                        </View>


                        {/* ── 9. Ongoing / Upcoming Bookings (Horizontal) ── */}
                        {ongoingBookings && ongoingBookings.length > 0 && (
                            <View style={styles.section}>
                                <View style={styles.sectionHeader}>
                                    <Text style={styles.sectionTitle}>Ongoing Bookings</Text>
                                </View>
                                <ScrollView
                                    horizontal
                                    pagingEnabled
                                    showsHorizontalScrollIndicator={false}
                                    onScroll={(e) => {
                                        const slide = Math.round(e.nativeEvent.contentOffset.x / width);
                                        if (slide !== activeBooking) setActiveBooking(slide);
                                    }}
                                    scrollEventThrottle={16}
                                >
                                    {ongoingBookings.map((b: any) => (
                                        <View key={b._id} style={{ width: width }}>
                                            <TouchableOpacity
                                                style={styles.bookingCard}
                                                onPress={() => router.push({ pathname: '/booking/[id]', params: { id: b._id } })}
                                                activeOpacity={0.9}
                                            >
                                                <View style={styles.bookingLeft}>
                                                    <View style={styles.bookingTag}>
                                                        <Text style={styles.bookingTagText}>Active</Text>
                                                    </View>
                                                    <Text style={styles.bookingTitle}>{b.childServiceId?.name ?? 'Service'}</Text>
                                                    <View style={styles.bookingInfoRow}>
                                                        <ShieldCheck size={14} color={Colors.health} />
                                                        <Text style={styles.bookingSub}>
                                                            {b.scheduledTime
                                                                ? `For ${new Date(b.scheduledTime).toLocaleDateString()} at ${new Date(b.scheduledTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                                                                : `Booked on ${new Date(b.createdAt).toLocaleDateString()}`
                                                            }
                                                        </Text>
                                                    </View>
                                                    <TouchableOpacity style={styles.trackBtn} onPress={() => router.push('/bookings')}>
                                                        <Text style={styles.trackText}>Track Status</Text>
                                                        <ArrowRight size={14} color="#fff" />
                                                    </TouchableOpacity>
                                                </View>
                                                <View style={styles.bookingRight}>
                                                    <View style={styles.bookingPulseBg}>
                                                        <Activity size={34} color={Colors.primary} opacity={0.3} />
                                                    </View>
                                                </View>
                                            </TouchableOpacity>
                                        </View>
                                    ))}
                                </ScrollView>

                                {ongoingBookings.length > 1 && (
                                    <View style={styles.miniPagination}>
                                        {ongoingBookings.map((_: any, i: number) => (
                                            <View key={i} style={[styles.miniDot, activeBooking === i && styles.miniDotActive]} />
                                        ))}
                                    </View>
                                )}
                            </View>
                        )}



                        {/* ── Knowledge Base Section (from knowledgeBanners) ── */}
                        {dynamicKnowledgeBanners.length > 0 && (
                            <View style={[styles.section, { marginBottom: 20 }]}>
                                <View style={styles.sectionHeader}>
                                    <View>
                                        <Text style={styles.sectionTitle}>Knowledge Base</Text>
                                        <Text style={styles.sectionSub}>Expert health tips and articles</Text>
                                    </View>
                                </View>
                                <ScrollView
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    contentContainerStyle={{ paddingHorizontal: 20, gap: 14 }}
                                >
                                    {dynamicKnowledgeBanners.map((banner) => (
                                        <TouchableOpacity
                                            key={banner.id}
                                            activeOpacity={0.9}
                                            style={styles.knowledgePromoCard}
                                            onPress={() => handleBannerPress(banner)}
                                        >
                                            <Image
                                                source={{ uri: banner.imageUrl }}
                                                style={styles.knowledgePromoImage}
                                                contentFit="cover"
                                                transition={200}
                                            />
                                            <View style={styles.knowledgePromoOverlay}>
                                                <View style={styles.knowledgePromoBadge}>
                                                    <Text style={styles.knowledgePromoBadgeText}>LATEST</Text>
                                                </View>
                                                <Text style={styles.knowledgePromoTitle} numberOfLines={2}>
                                                    {banner.title || 'Health Insights'}
                                                </Text>
                                            </View>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </View>
                        )}

                        {/* ── Promotional Banners Section (from promotionalBanners) ── */}
                        {dynamicPromotionalBanners.length > 0 && (
                            <View style={[styles.section, { marginBottom: 32 }]}>
                                <View style={styles.sectionHeader}>
                                    <View>
                                        <Text style={styles.sectionTitle}>Promotional Banners</Text>
                                        <Text style={styles.sectionSub}>Latest offers & featured services</Text>
                                    </View>
                                </View>
                                <ScrollView
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    contentContainerStyle={{ paddingHorizontal: 20, gap: 14 }}
                                >
                                    {dynamicPromotionalBanners.map((banner) => (
                                        <TouchableOpacity
                                            key={banner.id}
                                            activeOpacity={0.9}
                                            style={styles.knowledgePromoCard}
                                            onPress={() => handleBannerPress(banner)}
                                        >
                                            <Image
                                                source={{ uri: banner.imageUrl }}
                                                style={styles.knowledgePromoImage}
                                                contentFit="cover"
                                                transition={200}
                                            />
                                            <View style={styles.knowledgePromoOverlay}>
                                                <View style={styles.knowledgePromoBadge}>
                                                    <Text style={styles.knowledgePromoBadgeText}>LATEST</Text>
                                                </View>
                                                <Text style={styles.knowledgePromoTitle} numberOfLines={2}>
                                                    {banner.title || 'Health Insights'}
                                                </Text>
                                            </View>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </View>
                        )}

                        {/* ── 11. Knowledge Base Detail Modal ── */}
                        <Modal
                            visible={isKBModalOpen}
                            transparent
                            animationType="slide"
                            onRequestClose={() => setIsKBModalOpen(false)}
                        >
                            <View style={styles.modalOverlay}>
                                <View style={styles.modalContent}>
                                    {selectedKB && (
                                        <>
                                            <View style={styles.modalHeader}>
                                                <View style={styles.kbImageFrame}>
                                                    <Image
                                                        source={selectedKB.imageUrl ? { uri: selectedKB.imageUrl } : selectedKB.fallbackImage}
                                                        style={styles.kbCoverImage}
                                                        contentFit="cover"
                                                    />
                                                    <View style={styles.kbImageTint} />
                                                </View>
                                                <TouchableOpacity
                                                    onPress={() => setIsKBModalOpen(false)}
                                                    style={styles.modalCloseBtn}
                                                >
                                                    <X size={24} color={Colors.textPrimary} />
                                                </TouchableOpacity>
                                            </View>

                                            <Text style={styles.modalTitle}>{selectedKB.title}</Text>

                                            <View style={styles.modalMeta}>
                                                <UserIcon size={14} color={Colors.primary} />
                                                <Text style={styles.modalAuthor}>{selectedKB.author}</Text>
                                                <View style={styles.kbDividerDot} />
                                                <BookOpen size={14} color={Colors.muted} />
                                                <Text style={styles.modalReadTime}>{selectedKB.readTime} read</Text>
                                            </View>

                                            <ScrollView style={styles.modalScroll}>
                                                <Text style={styles.modalDesc}>{selectedKB.description}</Text>
                                                <Text style={styles.modalNote}>
                                                    Disclaimer: This information is for educational purposes only. Always consult a qualified medical professional for personal health advice.
                                                </Text>
                                            </ScrollView>

                                            <TouchableOpacity
                                                style={styles.modalCta}
                                                onPress={() => setIsKBModalOpen(false)}
                                            >
                                                <Text style={styles.modalCtaText}>Got it, thanks!</Text>
                                            </TouchableOpacity>
                                        </>
                                    )}
                                </View>
                            </View>
                        </Modal>

                        <View style={{ height: 120 }} />
                    </>
                )}
            </ScrollView>

        </View>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: Colors.background },
    // scrollContent paddingTop is now set inline via insets.top + 148

    // 1. Sticky Top Bar
    stickyHeader: {
        backgroundColor: Colors.white,
        paddingHorizontal: 20,
        paddingBottom: 16,
    },
    headerTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    locationSelector: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginRight: 'auto',
    },
    locIconContainer: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: Colors.primaryLight,
        justifyContent: 'center',
        alignItems: 'center',
    },
    locCity: {
        fontSize: 16,
        fontWeight: '700',
        color: Colors.textPrimary,
    },
    locRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    locSub: {
        fontSize: 12,
        color: Colors.textSecondary,
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    iconCircle: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#F8FAFC',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#EDF2F7',
        position: 'relative',
    },
    notifDot: {
        position: 'absolute',
        top: 12,
        right: 13,
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: Colors.emergency,
        borderWidth: 2,
        borderColor: Colors.white,
    },
    avatarCircle: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: Colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 6,
        elevation: 4,
    },
    avatarInitial: {
        color: Colors.white,
        fontWeight: '800',
        fontSize: 16,
    },
    searchWrapper: {
        marginTop: 4,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F1F5F9',
        borderRadius: 16,
        paddingHorizontal: 16,
        height: 52,
    },
    searchPlaceholder: {
        fontSize: 15,
        color: Colors.muted,
        fontWeight: '500',
    },
    searchInput: {
        flex: 1,
        fontSize: 15,
        color: Colors.textPrimary,
        fontWeight: '500',
        paddingVertical: 8,
    },
    clearIcon: {
        padding: 4,
    },
    clearText: {
        fontSize: 16,
        color: Colors.muted,
        fontWeight: '700',
    },
    headerDivider: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 1,
        backgroundColor: '#F1F5F9',
    },

    // 2. Strong Hero Section
    heroContainer: {
        marginBottom: 0,
    },
    heroCard: {
        width: width,
        paddingHorizontal: 20,
    },
    heroGradient: {
        borderRadius: 24,
        flexDirection: 'row',
        minHeight: 180,
        overflow: 'hidden',
    },
    adminBannerImage: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100%',
        height: '100%',
    },
    adminBannerOverlay: {
        ...StyleSheet.absoluteFillObject,
    },
    heroTextContent: {
        flex: 1,
        padding: 24,
        zIndex: 2,
    },
    heroDecorationContainer: {
        position: 'absolute',
        right: -20,
        bottom: -30,
        zIndex: 1,
        transform: [{ rotate: '-15deg' }]
    },
    heroTag: {
        fontSize: 10,
        fontWeight: '900',
        color: 'rgba(255,255,255,0.7)',
        marginBottom: 8,
        letterSpacing: 1,
    },
    heroTitle: {
        fontSize: 22,
        fontWeight: '900',
        color: Colors.white,
        lineHeight: 28,
        marginBottom: 8,
    },
    heroSubtitle: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.85)',
        marginBottom: 20,
        fontWeight: '500',
    },
    heroCta: {
        backgroundColor: Colors.white,
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        alignSelf: 'flex-start',
        marginBottom: 12,
        ...Shadows.float,
    },
    heroCtaText: {
        color: Colors.primary,
        fontWeight: '800',
        fontSize: 14,
    },
    heroLink: {
        paddingVertical: 4,
    },
    heroLinkText: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 12,
        fontWeight: '700',
        textDecorationLine: 'underline',
    },
    heroImage: {
        position: 'absolute',
        right: -30,
        bottom: -20,
        width: 180,
        height: 220,
        opacity: 0.9,
    },
    paginationDots: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 6,
        marginTop: 4,
    },
    dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#E2E8F0' },
    dotActive: { width: 18, backgroundColor: Colors.primary },

    // Services Grid
    servicesGridContainer: {
        marginTop: 0,
        marginBottom: 8,
        backgroundColor: Colors.white,
        marginHorizontal: 16,
        borderRadius: 24,
        padding: 16,
        paddingBottom: 12,
        ...Shadows.card,
        shadowOpacity: 0.07,
        borderWidth: 1,
        borderColor: '#EEF2F8',
    },
    servicesHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    servicesGridWrap: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        rowGap: 10,
    },
    serviceBigCard: {
        width: Math.floor((width - 32 - 32 - 12) / 3),
        alignItems: 'center',
        backgroundColor: Colors.white,
        borderRadius: 18,
        paddingTop: 0,
        paddingBottom: 10,
        paddingHorizontal: 0,
        borderWidth: 1,
        borderColor: '#EEF2F8',
        overflow: 'hidden',
    },
    serviceCircleWrap: {
        position: 'relative',
        width: '100%',
        marginBottom: 8,
    },
    serviceCircle: {
        width: '100%',
        height: 76,
        borderRadius: 0,
        overflow: 'hidden',
        backgroundColor: '#EEF4FF',
    },
    serviceCircleInner: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    serviceCircleImage: {
        width: '100%',
        height: '100%',
    },
    serviceBadge: {
        position: 'absolute',
        top: -2,
        right: -2,
        width: 22,
        height: 22,
        borderRadius: 11,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: Colors.white,
    },
    serviceBigName: {
        fontSize: 12,
        fontWeight: '800',
        color: Colors.primary,
        textAlign: 'center',
        lineHeight: 15,
        marginBottom: 2,
        paddingHorizontal: 4,
    },
    serviceBigSub: {
        fontSize: 10,
        color: Colors.textSecondary,
        textAlign: 'center',
        fontWeight: '500',
        lineHeight: 12,
        marginBottom: 4,
        paddingHorizontal: 4,
    },
    serviceArrowBtn: {
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: Colors.primaryLight,
        justifyContent: 'center',
        alignItems: 'center',
    },

    // Trust bar
    trustBar: {
        marginTop: 14,
        backgroundColor: '#EEF4FF',
        borderRadius: 14,
        paddingVertical: 10,
        paddingHorizontal: 12,
        gap: 6,
    },
    trustBarLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    trustBarMain: {
        fontSize: 12,
        fontWeight: '800',
        color: Colors.primary,
    },
    trustBarRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        flexWrap: 'wrap',
    },
    trustBarItem: {
        fontSize: 10,
        color: Colors.textSecondary,
        fontWeight: '600',
    },
    trustDot: {
        width: 3,
        height: 3,
        borderRadius: 1.5,
        backgroundColor: Colors.muted,
    },

    // 4. Sections & Top Doctors
    section: {
        marginBottom: 32,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginBottom: 8,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: Colors.textPrimary,
    },
    sectionSub: {
        fontSize: 12,
        color: Colors.textSecondary,
        marginTop: 2,
    },
    seeAll: {
        fontSize: 14,
        fontWeight: '700',
        color: Colors.primary,
    },
    doctorScroll: {
        marginTop: 4,
    },
    emptyCard: {
        width: 200,
        height: 120,
        borderRadius: 20,
        backgroundColor: '#F1F5F9',
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyText: {
        color: Colors.muted,
        fontSize: 13,
    },

    // 5. Recommendations
    recommendationContainer: {
        paddingHorizontal: 0,
    },
    recommendCard: {
        width: width - 40,
        marginHorizontal: 20,
        flexDirection: 'row',
        backgroundColor: Colors.white,
        borderRadius: 24,
        padding: 20,
        borderWidth: 1,
        borderColor: '#F1F5F9',
        ...Shadows.card,
    },
    recommendLeft: { flex: 1 },
    badge: {
        alignSelf: 'flex-start',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        marginBottom: 10,
    },
    badgeText: {
        fontSize: 9,
        fontWeight: '900',
    },
    recommendTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: Colors.textPrimary,
        marginBottom: 4,
    },
    recommendDesc: {
        fontSize: 12,
        color: Colors.textSecondary,
        marginBottom: 14,
        lineHeight: 16,
    },
    recommendFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    recommendPrice: {
        fontSize: 14,
        fontWeight: '700',
        color: Colors.textPrimary,
    },
    bookBadge: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        backgroundColor: Colors.primary,
        borderRadius: 8,
    },
    bookBadgeText: {
        color: Colors.white,
        fontSize: 12,
        fontWeight: '700',
    },
    recommendRight: {
        width: 60,
        alignItems: 'flex-end',
        justifyContent: 'center',
    },

    // 6. Featured Offers
    offerCard: {
        width: 240,
        marginRight: 16,
        backgroundColor: '#EBF3FD',
        borderRadius: 20,
        padding: 20,
        position: 'relative',
        overflow: 'hidden',
    },
    offerBadge: {
        position: 'absolute',
        top: 0,
        right: 0,
        backgroundColor: '#3B82F6',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderBottomLeftRadius: 12,
    },
    offerBadgeText: {
        color: Colors.white,
        fontSize: 10,
        fontWeight: '900',
    },
    offerTitle: {
        fontSize: 18,
        fontWeight: '900',
        color: Colors.textPrimary,
        marginBottom: 4,
    },
    offerSubtitle: {
        fontSize: 12,
        color: Colors.textSecondary,
        marginBottom: 16,
        lineHeight: 16,
    },
    offerPriceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    offerPrice: {
        fontSize: 16,
        fontWeight: '800',
        color: Colors.textPrimary,
    },
    offerOldPrice: {
        fontSize: 13,
        color: Colors.muted,
        textDecorationLine: 'line-through',
    },

    // OP Booking Card
    opCard: {
        marginHorizontal: 20,
        marginTop: 4,
        marginBottom: 8,
        backgroundColor: Colors.white,
        borderRadius: 24,
        padding: 18,
        borderWidth: 1,
        borderColor: '#E8EDF5',
        ...Shadows.medium,
        shadowOpacity: 0.07,
    },
    opTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    opLeft: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingRight: 10,
    },
    opIconWrap: {
        position: 'relative',
        flexShrink: 0,
    },
    opIconCircle: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: '#D6E4FF',
        borderWidth: 1.5,
        borderColor: '#B3CAFF',
        justifyContent: 'center',
        alignItems: 'center',
    },
    opCheckBadge: {
        position: 'absolute',
        bottom: -2,
        right: -4,
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: Colors.white,
        justifyContent: 'center',
        alignItems: 'center',
    },
    opTitle: {
        fontSize: 15,
        fontWeight: '900',
        color: Colors.textPrimary,
        lineHeight: 20,
        marginBottom: 5,
    },
    opTitleAccent: {
        color: Colors.accent,
    },
    opSub: {
        fontSize: 12,
        color: Colors.textSecondary,
        fontWeight: '500',
        lineHeight: 17,
        marginBottom: 14,
    },
    opDivider: {
        width: 1,
        height: 72,
        backgroundColor: '#E8EDF5',
        marginHorizontal: 2,
        flexShrink: 0,
    },
    opRight: {
        alignItems: 'center',
        gap: 8,
        paddingLeft: 10,
        flexShrink: 0,
    },
    opBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: Colors.primary,
        paddingHorizontal: 14,
        paddingVertical: 11,
        borderRadius: 13,
        ...Shadows.float,
    },
    opBtnText: {
        color: Colors.white,
        fontWeight: '800',
        fontSize: 13,
    },
    opTrustRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    opTrustText: {
        fontSize: 10,
        color: Colors.textSecondary,
        fontWeight: '600',
    },
    opFeatureRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F4F7FC',
        borderRadius: 16,
        paddingVertical: 12,
        paddingHorizontal: 8,
    },
    opFeatureItem: {
        flex: 1,
        alignItems: 'center',
        gap: 6,
    },
    opFeatureIconBox: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: '#E6F7F7',
        justifyContent: 'center',
        alignItems: 'center',
    },
    opFeatureLabel: {
        fontSize: 10,
        fontWeight: '700',
        color: Colors.textSecondary,
        textAlign: 'center',
        lineHeight: 13,
    },
    opFeatureSep: {
        width: 1,
        height: 36,
        backgroundColor: '#DDE4EF',
    },

    emergencyPulse: {
        opacity: 0.8,
    },

    // Ongoing booking refined
    bookingCard: {
        marginHorizontal: 20,
        backgroundColor: Colors.white,
        borderRadius: 24,
        padding: 22,
        flexDirection: 'row',
        alignItems: 'stretch',
        borderWidth: 1,
        borderColor: '#E9EEF5',
        ...Shadows.card,
        shadowOpacity: 0.08,
    },
    bookingLeft: { flex: 1 },
    bookingTag: { backgroundColor: '#E9F7EF', alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, marginBottom: 14 },
    bookingTagText: { color: Colors.health, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
    bookingTitle: { fontSize: 24, fontWeight: '900', color: Colors.textPrimary, marginBottom: 8, letterSpacing: 0 },
    bookingInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 18 },
    bookingSub: { fontSize: 15, color: Colors.textSecondary, fontWeight: '500' },
    trackBtn: { backgroundColor: Colors.primary, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 14, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8 },
    trackText: { color: '#fff', fontWeight: '800', fontSize: 12 },
    bookingRight: { width: 88, alignItems: 'center', justifyContent: 'center' },
    bookingPulseBg: {
        width: 72,
        height: 72,
        borderRadius: 22,
        backgroundColor: '#F3F8FF',
        justifyContent: 'center',
        alignItems: 'center',
    },
    miniPagination: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 6,
        marginTop: 16,
    },
    miniDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#E2E8F0',
    },
    miniDotActive: {
        width: 16,
        backgroundColor: Colors.primary,
        borderRadius: 3,
    },

    // 10. Knowledge Base Horizontal List
    kbHorizontalWrapper: {
        marginHorizontal: 0,
        position: 'relative'
    },
    kbItem: {
        height: 164,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginHorizontal: 20,
        gap: 16,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.03)',
        ...Shadows.card,
    },
    kbImageFrame: {
        width: 92,
        height: 116,
        borderRadius: 22,
        overflow: 'hidden',
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.55)',
    },
    kbCoverImage: {
        width: '100%',
        height: '100%',
    },
    kbImageTint: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(255,255,255,0.08)',
    },
    kbContent: {
        flex: 1,
    },
    kbTitle: {
        fontSize: 18,
        fontWeight: '900',
        color: Colors.textPrimary,
        marginBottom: 8,
    },
    kbMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    kbAuthor: {
        fontSize: 13,
        fontWeight: '700',
        color: Colors.textSecondary,
    },
    kbDividerDot: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: Colors.muted,
        opacity: 0.5
    },
    kbReadTime: {
        fontSize: 12,
        color: Colors.muted,
        fontWeight: '500',
    },
    kbIndicatorLine: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 6,
        marginTop: 12
    },
    kbMiniDot: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#E2E8F0'
    },
    kbMiniDotActive: {
        width: 12,
        backgroundColor: Colors.primary,
        borderRadius: 2
    },

    // 11. Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: Colors.white,
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        padding: 24,
        maxHeight: '80%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 20,
    },
    modalCloseBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#F8FAFC',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalTitle: {
        fontSize: 24,
        fontWeight: '900',
        color: Colors.textPrimary,
        marginBottom: 12,
        lineHeight: 32,
    },
    modalMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 24,
        paddingBottom: 24,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    modalAuthor: {
        fontSize: 14,
        fontWeight: '700',
        color: Colors.textSecondary,
    },
    modalReadTime: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.muted,
    },
    modalScroll: {
        marginBottom: 24,
    },
    modalDesc: {
        fontSize: 16,
        color: Colors.textPrimary,
        lineHeight: 26,
        fontWeight: '500',
    },
    modalNote: {
        marginTop: 24,
        fontSize: 12,
        color: Colors.muted,
        fontStyle: 'italic',
        lineHeight: 18,
    },
    modalCta: {
        backgroundColor: Colors.primary,
        paddingVertical: 16,
        borderRadius: 16,
        alignItems: 'center',
        ...Shadows.float,
    },
    modalCtaText: {
        color: Colors.white,
        fontSize: 16,
        fontWeight: '800',
    },

    // Search Results Styles
    searchResultsContainer: {
        paddingHorizontal: 20,
        paddingTop: 10,
    },
    searchHeader: {
        marginBottom: 24,
    },
    searchTitle: {
        fontSize: 24,
        fontWeight: '900',
        color: Colors.textPrimary,
        letterSpacing: -0.5,
    },
    searchCount: {
        fontSize: 14,
        color: Colors.textSecondary,
        marginTop: 4,
        fontWeight: '600',
    },
    searchSection: {
        marginBottom: 32,
    },
    searchSectionTitle: {
        fontSize: 13,
        fontWeight: '900',
        color: Colors.muted,
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 16,
        paddingLeft: 4,
    },
    searchResultRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: Colors.white,
        borderRadius: 16,
        marginBottom: 10,
        borderWidth: 1.5,
        borderColor: '#CBD5E1',
        ...Shadows.card,
    },
    searchResultIcon: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: Colors.primaryLight,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    searchResultText: {
        flex: 1,
        fontSize: 16,
        fontWeight: '700',
        color: Colors.textPrimary,
    },
    noResults: {
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 60,
        paddingHorizontal: 40,
    },
    noResultsText: {
        fontSize: 16,
        color: Colors.textSecondary,
        textAlign: 'center',
        lineHeight: 24,
        fontWeight: '600',
        marginBottom: 24,
    },
    resetBtn: {
        paddingHorizontal: 24,
        paddingVertical: 12,
        backgroundColor: Colors.primary,
        borderRadius: 100,
        ...Shadows.float,
    },
    resetBtnText: {
        color: Colors.white,
        fontWeight: '800',
        fontSize: 14,
    },

    // ── Health Package Card Styles ──
    pkgCard: {
        width: 240,
        minHeight: 380,
        borderRadius: 24,
        overflow: 'hidden',
        backgroundColor: Colors.white,
        ...Shadows.card,
    },
    pkgHeader: {
        padding: 16,
        paddingBottom: 14,
        minHeight: 140,
    },
    pkgBadge: {
        alignSelf: 'flex-start',
        backgroundColor: 'rgba(255,255,255,0.25)',
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 3,
        marginBottom: 8,
    },
    pkgBadgeText: {
        color: '#fff',
        fontSize: 9,
        fontWeight: '900',
        letterSpacing: 1,
    },
    pkgName: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '900',
        lineHeight: 22,
        minHeight: 44, // reserve space for 2 lines without clipping
    },
    pkgPriceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 8,
    },
    pkgPrice: {
        color: '#fff',
        fontSize: 20,
        fontWeight: '900',
    },
    pkgDiscountBadge: {
        backgroundColor: '#22c55e',
        borderRadius: 999,
        paddingHorizontal: 8,
        paddingVertical: 2,
    },
    pkgDiscountText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: '800',
    },
    pkgOriginalPrice: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 12,
        textDecorationLine: 'line-through',
        marginTop: 2,
    },
    pkgBody: {
        padding: 16,
        flex: 1,
        justifyContent: 'space-between',
    },
    pkgTestsLabel: {
        fontSize: 11,
        fontWeight: '800',
        color: Colors.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    pkgTestsTags: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        minHeight: 60,
    },
    pkgTag: {
        backgroundColor: '#f1f5f9',
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 4,
        maxWidth: '100%',
    },
    pkgTagText: {
        fontSize: 10,
        color: '#475569',
        fontWeight: '600',
    },
    pkgBtn: {
        borderRadius: 12,
        paddingVertical: 10,
        alignItems: 'center',
        marginTop: 4,
    },
    pkgBtnText: {
        color: '#fff',
        fontWeight: '800',
        fontSize: 13,
    },

    // ── Promotional Banner Styles ──
    promoSection: {
        marginTop: 12,
        marginBottom: 24,
    },
    promoScroll: {
        paddingHorizontal: 20,
        gap: 12,
    },
    promoCard: {
        width: width - 40,
        height: 160,
        borderRadius: 24,
        overflow: 'hidden',
        backgroundColor: '#F1F5F9',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        ...Shadows.card,
    },
    promoImage: {
        width: '100%',
        height: '100%',
    },
    promoPlaceholder: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },
    promoPlaceholderText: {
        fontSize: 18,
        fontWeight: '900',
        color: Colors.primary,
        textAlign: 'center',
    },

    // ── Knowledge Section (from Promo Banners) ──
    knowledgePromoCard: {
        width: width * 0.7,
        height: 180,
        borderRadius: 24,
        overflow: 'hidden',
        backgroundColor: '#fff',
        ...Shadows.card,
    },
    knowledgePromoImage: {
        width: '100%',
        height: '100%',
    },
    knowledgePromoOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: 16,
        backgroundColor: 'rgba(0,0,0,0.4)',
    },
    knowledgePromoBadge: {
        alignSelf: 'flex-start',
        backgroundColor: Colors.emergency,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
        marginBottom: 6,
    },
    knowledgePromoBadgeText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: '900',
    },
    knowledgePromoTitle: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '800',
    },
});




