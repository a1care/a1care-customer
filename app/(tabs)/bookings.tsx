import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    RefreshControl,
    StyleSheet,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useIsFocused } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import {
    CalendarDays,
    Stethoscope,
    ShieldCheck,
    CreditCard,
    Ambulance,
    FlaskConical,
    HeartPulse,
    Activity,
    Pill,
    LayoutGrid,
    Home,
    Bone,
    Thermometer,
    Wind,
    Brain,
    Syringe,
    Dumbbell,
    Bandage
} from 'lucide-react-native';

import { bookingsService } from '@/services/bookings.service';
import { useAuthStore } from '@/stores/auth.store';
import { socketService } from '@/services/socket.service';
import { Colors, Shadows } from '@/constants/colors';
import { FontSize } from '@/constants/spacing';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { SkeletonBookingCard } from '@/components/ui/Skeleton';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { formatDateTime } from '@/utils/formatters';
import type { ServiceRequest, DoctorAppointment } from '@/types';

type TabId = 'upcoming' | 'ongoing' | 'completed' | 'cancelled';

const TABS: { id: TabId; label: string }[] = [
    { id: 'upcoming', label: 'Upcoming' },
    { id: 'ongoing', label: 'Ongoing' },
    { id: 'completed', label: 'Completed' },
    { id: 'cancelled', label: 'Cancelled' },
];

const SERVICE_TAB: Record<string, TabId> = {
    PENDING: 'upcoming',
    BROADCASTED: 'upcoming',
    PARTNER_ASSIGNED: 'upcoming',
    RETURNED_TO_ADMIN: 'upcoming',
    ACCEPTED: 'ongoing',
    IN_PROGRESS: 'ongoing',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
};
const getServiceTab = (status: string): TabId => SERVICE_TAB[status] ?? 'upcoming';

const APPT_TAB: Record<string, TabId> = {
    Pending: 'upcoming',
    Confirmed: 'ongoing',
    Completed: 'completed',
    Cancelled: 'cancelled',
};

const getServiceIconTheme = (name: string) => {
    const low = String(name || '').toLowerCase();
    if (low.includes('ambulance')) return { icon: Ambulance, color: '#EB5757', bg: '#FEEFEF' };
    if (low.includes('diagnostic') || low.includes('lab')) return { icon: FlaskConical, color: '#27AE60', bg: '#E9F7EF' };
    if (low.includes('nurs') || low.includes('care') || low.includes('elder')) return { icon: HeartPulse, color: '#D63384', bg: '#FFF0F5' };
    if (low.includes('doctor') || low.includes('consult') || low.includes('physician') || low.includes('cardio') || low.includes('derma')) {
        return { icon: Stethoscope, color: '#2F80ED', bg: '#EBF3FD' };
    }
    if (low.includes('neuro') || low.includes('brain')) return { icon: Brain, color: '#8B5CF6', bg: '#F5F3FF' };
    if (low.includes('pulmo') || low.includes('resp') || low.includes('bipap') || low.includes('cpap') || low.includes('oxygen')) return { icon: Wind, color: '#0EA5E9', bg: '#E0F2FE' };
    if (low.includes('ortho') || low.includes('bone') || low.includes('joint') || low.includes('hip') || low.includes('knee')) return { icon: Bone, color: '#F97316', bg: '#FFEDD5' };
    if (low.includes('pharmacy') || low.includes('medicine')) return { icon: Pill, color: '#F2C94C', bg: '#FFF9E6' };
    if (low.includes('hospital') || low.includes('op') || low.includes('token') || low.includes('machine') || low.includes('equipment')) return { icon: Activity, color: '#2F80ED', bg: '#EBF3FD' };
    if (low.includes('home') || low.includes('visit')) return { icon: Home, color: '#8B5CF6', bg: '#F5F3FF' };
    if (low.includes('ache') || low.includes('fever') || low.includes('pain') || low.includes('cold')) return { icon: Thermometer, color: '#EF4444', bg: '#FEE2E2' };
    if (low.includes('session') || low.includes('therapy') || low.includes('physio')) return { icon: Dumbbell, color: '#10B981', bg: '#D1FAE5' };
    if (low.includes('vaccin') || low.includes('inject') || low.includes('drip')) return { icon: Syringe, color: '#D946EF', bg: '#FAE8FF' };
    if (low.includes('wound') || low.includes('dress') || low.includes('suture')) return { icon: Bandage, color: '#F43F5E', bg: '#FFE4E6' };
    
    return { icon: LayoutGrid, color: '#64748B', bg: '#F1F5F9' };
};

function BookingMetaRow({ dateText, paymentText }: { dateText: string; paymentText: string }) {
    return (
        <View style={styles.cardBottom}>
            <View style={styles.metaItem}>
                <CalendarDays size={13} color={Colors.textSecondary} />
                <Text style={styles.cardMeta}>{dateText}</Text>
            </View>
            <View style={styles.metaItem}>
                <CreditCard size={13} color={Colors.textSecondary} />
                <Text style={styles.cardMeta} numberOfLines={1}>{paymentText}</Text>
            </View>
        </View>
    );
}

function ServiceCard({ booking, onPress, onDelete }: { booking: ServiceRequest; onPress: () => void; onDelete?: () => void }) {
    const router = useRouter();
    const rawNotes = (booking as any)?.notes as string | undefined;
    const selectedReason =
        rawNotes?.startsWith('Dept:') ? rawNotes.replace('Dept:', '').trim() :
            rawNotes?.startsWith('Symptom:') ? rawNotes.replace('Symptom:', '').trim() :
                '';

    const baseName =
        typeof booking.childServiceId === 'object' && booking.childServiceId
            ? (booking.childServiceId as any).name ?? 'Home Service'
            : 'Home Service';

    const packageName =
        typeof (booking as any).healthPackageId === 'object' && (booking as any).healthPackageId
            ? ((booking as any).healthPackageId as any).name ?? ''
            : '';

    const name = selectedReason || packageName || baseName;
    const iconTheme = getServiceIconTheme(name);
    const ServiceIcon = iconTheme.icon;

    const modeLabel =
        booking.fulfillmentMode === 'HOSPITAL_VISIT'
            ? 'Hospital Visit'
            : booking.fulfillmentMode === 'VIRTUAL'
                ? 'Virtual Consultation'
                : 'Home Healthcare Service';

    const mode = (booking.paymentMode || 'OFFLINE').toUpperCase();
    const isPaid = booking.paymentStatus === 'COMPLETED';
    const paymentLabel =
        mode === 'WALLET' ? (isPaid ? 'Paid via wallet' : 'Wallet pending') :
            mode === 'ONLINE' ? (isPaid ? 'Paid online' : 'Online pending') :
                'Cash on service';

    const isCancelled = booking.status === 'CANCELLED';
    const showBookAgain = booking.status === 'COMPLETED' || isCancelled;

    return (
        <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.9}>
            <View style={styles.cardTop}>
                <View style={[styles.cardIconBg, { backgroundColor: iconTheme.bg }]}>
                    <ServiceIcon size={22} color={iconTheme.color} />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={styles.cardName} numberOfLines={1}>{name}</Text>
                    <Text style={styles.cardType}>{modeLabel}</Text>
                </View>
                <StatusBadge status={booking.status} />
            </View>
            <View style={styles.cardDivider} />
            <BookingMetaRow
                dateText={formatDateTime((booking as any).scheduledTime || (booking as any).scheduledSlot?.startTime || booking.createdAt)}
                paymentText={paymentLabel}
            />
            <View style={{ flexDirection: 'row', paddingHorizontal: 14, paddingBottom: 14, gap: 8 }}>
                {showBookAgain && (
                    <TouchableOpacity
                        style={[styles.cardActionBtn, { flex: 1 }]}
                        onPress={(e) => {
                            e.stopPropagation();
                            const svc = booking.childServiceId;
                            const pkg = (booking as any).healthPackageId;
                            
                            if (svc) {
                                const svcId = typeof svc === 'object' ? svc?._id : svc;
                                router.push({
                                    pathname: `/service/[id]` as any,
                                    params: { 
                                        id: svcId || '',
                                        price: String(booking.price ?? ''),
                                        name: typeof svc === 'object' ? (svc as any)?.name : ''
                                    }
                                });
                            } else if (pkg) {
                                const pkgId = typeof pkg === 'object' ? pkg?._id : pkg;
                                router.push({
                                    pathname: `/package/[id]` as any,
                                    params: { id: pkgId || '' }
                                });
                            } else {
                                router.push('/services');
                            }
                        }}
                    >
                        <Text style={styles.cardActionText}>Book Again</Text>
                    </TouchableOpacity>
                )}
                {isCancelled && onDelete && (
                    <TouchableOpacity
                        style={styles.cardDeleteBtn}
                        onPress={(e) => { e.stopPropagation(); onDelete(); }}
                    >
                        <Ionicons name="trash-outline" size={16} color="#DC2626" />
                    </TouchableOpacity>
                )}
            </View>
        </TouchableOpacity>
    );
}

function AppointmentCard({ appt, onPress, onDelete }: { appt: DoctorAppointment; onPress?: () => void; onDelete?: () => void }) {
    const router = useRouter();
    const formatApptDate = (value?: string) => {
        if (!value) return '';
        const raw = value.trim();
        const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (m) {
            return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
                .toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
        }
        const parsed = new Date(raw);
        if (Number.isNaN(parsed.getTime())) return raw;
        return parsed.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
    };

    const mode = (appt.paymentMode || 'OFFLINE').toUpperCase();
    const isPaid = appt.paymentStatus === 'COMPLETED';
    const paymentLabel =
        mode === 'WALLET' ? (isPaid ? 'Paid via wallet' : 'Wallet pending') :
            mode === 'ONLINE' ? (isPaid ? 'Paid online' : 'Online pending') :
                'Cash on consultation';

    const isCancelled = appt.status === 'Cancelled';
    const showBookAgain = appt.status === 'Completed' || isCancelled;

    return (
        <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.9}>
            <View style={styles.cardTop}>
                <View style={[styles.cardIconBg, { backgroundColor: '#E9F7EF' }]}>
                    <Stethoscope size={22} color={Colors.health} />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={styles.cardName} numberOfLines={1}>
                        {appt.serviceName || (typeof appt.doctorId === 'object' ? `Dr. ${appt.doctorId.name}` : "General Consultation")}
                    </Text>
                    <Text style={styles.cardType}>Specialist Consultation</Text>
                </View>
                <StatusBadge status={appt.status ?? 'Pending'} />
            </View>
            <View style={styles.cardDivider} />
            <BookingMetaRow
                dateText={`${formatApptDate(appt.date)} · ${appt.startingTime && appt.endingTime ? `${appt.startingTime}-${appt.endingTime}` : (appt.timeSlot ?? 'ASAP')}`}
                paymentText={paymentLabel}
            />
            <View style={{ flexDirection: 'row', paddingHorizontal: 14, paddingBottom: 14, gap: 8 }}>
                {showBookAgain && (
                    <TouchableOpacity
                        style={[styles.cardActionBtn, { flex: 1 }]}
                        onPress={(e) => {
                            e.stopPropagation();
                            const dr = appt.doctorId;
                            const drId = typeof dr === 'object' ? dr?._id : dr;
                            router.push({ pathname: `/doctor/book`, params: { id: drId || '', serviceName: appt.serviceName || 'Doctor Consultation' } } as any);
                        }}
                    >
                        <Text style={styles.cardActionText}>Book Again</Text>
                    </TouchableOpacity>
                )}
                {isCancelled && onDelete && (
                    <TouchableOpacity
                        style={styles.cardDeleteBtn}
                        onPress={(e) => { e.stopPropagation(); onDelete(); }}
                    >
                        <Ionicons name="trash-outline" size={16} color="#DC2626" />
                    </TouchableOpacity>
                )}
            </View>
        </TouchableOpacity>
    );
}

const HIDDEN_IDS_KEY = 'cancelled_booking_hidden_ids';

export default function BookingsScreen() {
    const router = useRouter();
    const isFocused = useIsFocused();
    const { user, isAuthenticated } = useAuthStore();
    const myId = user?._id ? String(user._id) : '';
    const queryClient = useQueryClient();
    const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        AsyncStorage.getItem(HIDDEN_IDS_KEY).then((raw) => {
            if (raw) setHiddenIds(new Set(JSON.parse(raw)));
        });
    }, []);

    const hideId = async (id: string) => {
        setHiddenIds((prev) => {
            const next = new Set(prev);
            next.add(id);
            AsyncStorage.setItem(HIDDEN_IDS_KEY, JSON.stringify([...next]));
            return next;
        });
    };

    const deleteServiceMutation = useMutation({
        mutationFn: bookingsService.deleteCancelledServiceBooking,
        onSuccess: (_data, id) => {
            hideId(id);
            queryClient.setQueryData(['service-bookings-all', myId], (prev: any) =>
                Array.isArray(prev) ? prev.filter((b: any) => b._id !== id) : prev
            );
        },
    });

    const deleteApptMutation = useMutation({
        mutationFn: bookingsService.deleteCancelledAppointment,
        onSuccess: (_data, id) => {
            hideId(id);
            queryClient.setQueryData(['appointments', myId], (prev: any) =>
                Array.isArray(prev) ? prev.filter((a: any) => a._id !== id) : prev
            );
        },
    });

    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<{ id: string, kind: 'service' | 'appt' } | null>(null);

    const confirmDelete = (id: string, kind: 'service' | 'appt') => {
        setDeleteTarget({ id, kind });
        setShowDeleteModal(true);
    };

    const [activeTab, setActiveTab] = useState<TabId>('upcoming');
    const [refreshing, setRefreshing] = useState(false);
    const [allowCardPress, setAllowCardPress] = useState(false);

    const {
        data: serviceBookings,
        isLoading: sbLoading,
        isError: sbErr,
        refetch: refetchSB,
    } = useQuery({
        queryKey: ['service-bookings-all', myId],
        queryFn: bookingsService.getMyServiceBookings,
        enabled: !!myId,
        retry: 2,
        refetchInterval: 30000, // auto-refresh every 30 seconds
    });

    const {
        data: appointments,
        isLoading: apptLoading,
        isError: apptErr,
        refetch: refetchAppt,
    } = useQuery({
        queryKey: ['appointments', myId],
        queryFn: bookingsService.getMyAppointments,
        enabled: !!myId,
        retry: 1,
        refetchInterval: 30000, // auto-refresh every 30 seconds
    });

    const myServiceBookings = useMemo(() => {
        return (serviceBookings ?? [])
            .filter((b) => {
                if (!myId) return false;
                const userId =
                    typeof b.userId === 'object' && b.userId
                        ? String((b.userId as any)._id ?? '')
                        : String((b as any).userId ?? '');
                const patientId =
                    typeof (b as any).patientId === 'object' && (b as any).patientId
                        ? String((b as any).patientId?._id ?? '')
                        : String((b as any).patientId ?? '');
                return userId === myId || patientId === myId;
            })
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }, [serviceBookings, myId]);

    const myAppointments = useMemo(() => {
        return (appointments ?? [])
            .filter((a) => {
                if (!myId) return false;
                const pid =
                    typeof a.patientId === 'object' && a.patientId
                        ? String((a.patientId as any)._id ?? '')
                        : String(a.patientId ?? '');
                return pid === myId;
            })
            .sort((a, b) => {
                const aTs = new Date(`${a.date || ''} ${a.startingTime || ''}`).getTime();
                const bTs = new Date(`${b.date || ''} ${b.startingTime || ''}`).getTime();
                return bTs - aTs;
            });
    }, [appointments, myId]);

    const onRefresh = async () => {
        setRefreshing(true);
        await Promise.all([refetchSB(), refetchAppt()]);
        setRefreshing(false);
    };

    React.useEffect(() => {
        if (!isFocused) return;
        refetchSB();
        refetchAppt();
    }, [isFocused, refetchSB, refetchAppt]);

    // Socket: refetch bookings on any status update so customer sees live changes
    useEffect(() => {
        const socket = socketService.getSocket();
        if (!socket) return;
        
        const handleUpdate = () => {
            refetchSB();
            refetchAppt();
        };
        
        socket.on('booking_status_updated', handleUpdate);
        return () => { socket.off('booking_status_updated', handleUpdate); };
    }, []);

    React.useEffect(() => {
        if (!isFocused) return;
        setAllowCardPress(false);
        const timer = setTimeout(() => setAllowCardPress(true), 350);
        return () => clearTimeout(timer);
    }, [isFocused]);

    const isLoading = sbLoading || apptLoading;
    const isError = sbErr || apptErr;

    const filteredServiceBookings = myServiceBookings.filter(
        (b) => getServiceTab(b.status) === activeTab && !hiddenIds.has(b._id)
    );
    const filteredAppts = myAppointments.filter(
        (a) => APPT_TAB[a.status ?? 'Pending'] === activeTab && !hiddenIds.has(a._id)
    );
    const visibleCount = filteredServiceBookings.length + filteredAppts.length;
    const filteredItems = [
        ...filteredAppts.map((appt) => ({
            kind: 'appt' as const,
            id: appt._id,
            ts: new Date(appt.createdAt || appt.date || 0).getTime(),
            appt,
        })),
        ...filteredServiceBookings.map((booking) => ({
            kind: 'service' as const,
            id: booking._id,
            ts: new Date(booking.createdAt || 0).getTime(),
            booking,
        })),
    ].sort((a, b) => b.ts - a.ts);

    const tabCount = (tab: TabId) => {
        const sbCount = myServiceBookings.filter((b) => getServiceTab(b.status) === tab).length;
        const apptCount = myAppointments.filter((a) => APPT_TAB[a.status ?? 'Pending'] === tab).length;
        return sbCount + apptCount;
    };

    const isEmpty = visibleCount === 0 && !isLoading;

    if (!isAuthenticated) {
        return (
            <SafeAreaView style={styles.root} edges={['top']}>
                <ScrollView
                    contentContainerStyle={{ flexGrow: 1 }}
                    showsVerticalScrollIndicator={false}
                    bounces={false}
                >
                    {/* Hero gradient top */}
                    <LinearGradient
                        colors={['#0B3370', '#1A5FAD', '#2878D0']}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                        style={styles.guestHero}
                    >
                        <View style={styles.guestBlob1} />
                        <View style={styles.guestBlob2} />

                        <View style={styles.guestIconRing}>
                            <LinearGradient
                                colors={['rgba(255,255,255,0.25)', 'rgba(255,255,255,0.1)']}
                                style={styles.guestIconGrad}
                            >
                                <Ionicons name="calendar" size={38} color="#fff" />
                            </LinearGradient>
                        </View>
                        <Text style={styles.guestHeroTitle}>My Bookings</Text>
                        <Text style={styles.guestHeroSub}>Track all your healthcare appointments and service requests in one place.</Text>

                        {/* Stats row */}
                        <View style={styles.guestStatsRow}>
                            {[
                                { label: 'Home Services', icon: 'home-outline' as const },
                                { label: 'Doctor Visits', icon: 'medkit-outline' as const },
                                { label: 'Diagnostics', icon: 'flask-outline' as const },
                            ].map((s, i) => (
                                <View key={i} style={styles.guestStatPill}>
                                    <Ionicons name={s.icon} size={14} color="rgba(255,255,255,0.9)" />
                                    <Text style={styles.guestStatText}>{s.label}</Text>
                                </View>
                            ))}
                        </View>
                    </LinearGradient>

                    {/* Feature list */}
                    <View style={styles.guestBody}>
                        <Text style={styles.guestSectionLabel}>SIGN IN TO ACCESS</Text>

                        {[
                            { icon: 'time-outline' as const, color: '#7C3AED', bg: '#F3EEFF', title: 'Real-time Tracking', desc: 'Follow your booking status live — from request to completion' },
                            { icon: 'refresh-circle-outline' as const, color: '#0284C7', bg: '#E0F2FE', title: 'Book Again', desc: 'Quickly rebook your favorite services with one tap' },
                            { icon: 'document-text-outline' as const, color: '#16A34A', bg: '#ECFDF5', title: 'Digital Records', desc: 'All your booking history stored safely in one place' },
                            { icon: 'notifications-outline' as const, color: '#D97706', bg: '#FEF3C7', title: 'Smart Alerts', desc: 'Get notified on status changes, reminders & partner arrival' },
                        ].map((f, i) => (
                            <View key={i} style={styles.guestFeatureRow}>
                                <View style={[styles.guestFeatureIcon, { backgroundColor: f.bg }]}>
                                    <Ionicons name={f.icon} size={22} color={f.color} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.guestFeatureTitle}>{f.title}</Text>
                                    <Text style={styles.guestFeatureDesc}>{f.desc}</Text>
                                </View>
                                <View style={styles.guestFeatureLock}>
                                    <Ionicons name="lock-closed" size={13} color="#CBD5E1" />
                                </View>
                            </View>
                        ))}

                        {/* CTA */}
                        <TouchableOpacity
                            onPress={() => router.push('/(auth)/login')}
                            activeOpacity={0.88}
                            style={styles.guestCTA}
                        >
                            <LinearGradient
                                colors={['#0B3370', '#2563EB']}
                                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                                style={styles.guestCTAGrad}
                            >
                                <Ionicons name="log-in-outline" size={20} color="#fff" />
                                <Text style={styles.guestCTAText}>Sign In / Register</Text>
                            </LinearGradient>
                        </TouchableOpacity>

                        <Text style={styles.guestDisclaimer}>
                            By continuing, you agree to our{' '}
                            <Text style={styles.guestDisclaimerLink} onPress={() => router.push('/terms' as any)}>Terms</Text>
                            {' & '}
                            <Text style={styles.guestDisclaimerLink} onPress={() => router.push('/privacy' as any)}>Privacy Policy</Text>
                        </Text>
                    </View>
                </ScrollView>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.root} edges={['top']}>
            {/* Premium Header */}
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => router.back()}
                    style={styles.headerBackBtn}
                    activeOpacity={0.85}
                >
                    <Ionicons name="arrow-back" size={20} color="#0F172A" />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={styles.headerTitle}>My Bookings</Text>
                    <Text style={styles.headerSub}>Track all your appointments & requests</Text>
                </View>
                <View style={styles.headerCountPill}>
                    <Text style={styles.headerCountText}>{visibleCount} shown</Text>
                </View>
            </View>

            {/* Tab Bar */}
            <View style={styles.tabsContainer}>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.tabsRow}
                >
                    {TABS.map((t) => {
                        const count = tabCount(t.id);
                        const isActive = activeTab === t.id;
                        return (
                            <TouchableOpacity
                                key={t.id}
                                style={[styles.tab, isActive && styles.tabActive]}
                                onPress={() => setActiveTab(t.id)}
                                activeOpacity={0.85}
                            >
                                <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                                    {t.label}
                                </Text>
                                {count > 0 && (
                                    <View style={[styles.tabBadge, isActive && styles.tabBadgeActive]}>
                                        <Text style={[styles.tabBadgeText, isActive && styles.tabBadgeTextActive]}>
                                            {count}
                                        </Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            </View>

            {isError ? (
                <ErrorState message="We could not load your bookings right now." onRetry={onRefresh} />
            ) : (
                <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.list}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            colors={[Colors.primary]}
                        />
                    }
                >
                    {isLoading ? (
                        <>
                            <SkeletonBookingCard />
                            <SkeletonBookingCard />
                            <SkeletonBookingCard />
                        </>
                    ) : isEmpty ? (
                        <EmptyState
                            icon={activeTab === 'cancelled' ? '🚫' : activeTab === 'ongoing' ? '⏳' : activeTab === 'completed' ? '✅' : '📋'}
                            title={`No ${activeTab} bookings`}
                            subtitle={
                                activeTab === 'upcoming'
                                    ? 'You have no upcoming bookings. Start by booking a service or doctor.'
                                    : activeTab === 'ongoing'
                                        ? 'You currently have no active bookings in progress.'
                                        : activeTab === 'completed'
                                            ? 'Completed bookings will appear here once services are finished.'
                                            : 'Cancelled bookings will appear here when any booking is cancelled.'
                            }
                            actionLabel={activeTab === 'upcoming' ? 'Browse Services' : undefined}
                            onAction={activeTab === 'upcoming' ? () => router.push('/services') : undefined}
                        />
                    ) : (
                        <>
                            {filteredItems.map((item) =>
                                item.kind === 'appt' ? (
                                    <AppointmentCard
                                        key={`appt-${item.id}`}
                                        appt={item.appt}
                                        onPress={() => {
                                            if (!allowCardPress) return;
                                            router.push({ pathname: '/doctor/appointment/[id]', params: { id: item.appt._id } });
                                        }}
                                        onDelete={() => confirmDelete(item.appt._id, 'appt')}
                                    />
                                ) : (
                                    <ServiceCard
                                        key={`service-${item.id}`}
                                        booking={item.booking}
                                        onPress={() => {
                                            if (!allowCardPress) return;
                                            router.push({ pathname: '/booking/[id]', params: { id: item.booking._id } });
                                        }}
                                        onDelete={() => confirmDelete(item.booking._id, 'service')}
                                    />
                                )
                            )}
                        </>
                    )}
                    <View style={{ height: 24 }} />
                </ScrollView>
            )}

            <ConfirmModal
                visible={showDeleteModal}
                title="Remove Booking?"
                body="Remove this cancelled booking from your list? This action cannot be undone."
                confirmLabel="Yes, Remove"
                icon="trash-outline"
                confirmColor="#E11D48"
                loading={deleteServiceMutation.isPending || deleteApptMutation.isPending}
                onConfirm={() => {
                    if (deleteTarget) {
                        deleteTarget.kind === 'service'
                            ? deleteServiceMutation.mutate(deleteTarget.id)
                            : deleteApptMutation.mutate(deleteTarget.id);
                    }
                    setShowDeleteModal(false);
                }}
                onCancel={() => setShowDeleteModal(false)}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#F4F7FC' },

    // Header
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 18,
        paddingVertical: 14,
        backgroundColor: '#FFFFFF',
        shadowColor: '#0A1A3A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
        elevation: 5,
    },
    headerBackBtn: {
        width: 44, height: 44, borderRadius: 22,
        backgroundColor: '#F1F5F9',
        justifyContent: 'center', alignItems: 'center',
        marginRight: 12,
    },
    headerTitle: { fontSize: 20, fontWeight: '900', color: '#0F172A', letterSpacing: -0.3 },
    headerSub: { fontSize: 12, color: '#94A3B8', fontWeight: '500', marginTop: 2 },
    headerCountPill: {
        paddingHorizontal: 12, height: 30, borderRadius: 20,
        backgroundColor: '#EEF4FF',
        justifyContent: 'center', alignItems: 'center',
        borderWidth: 1, borderColor: '#BFDBFE',
    },
    headerCountText: { fontSize: 11, fontWeight: '800', color: '#2563EB' },

    // Tabs
    tabsContainer: {
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    tabsScroll: { backgroundColor: Colors.card },
    tabsRow: {
        paddingHorizontal: 16, paddingVertical: 10,
        gap: 8, alignItems: 'center',
    },
    tab: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 6, paddingHorizontal: 18, height: 38, borderRadius: 19,
        backgroundColor: '#F8FAFC',
        borderWidth: 1, borderColor: '#E2E8F0',
    },
    tabActive: { backgroundColor: '#0B3370', borderColor: '#0B3370' },
    tabText: { fontSize: 13, fontWeight: '700', color: '#64748B', includeFontPadding: false },
    tabTextActive: { color: '#fff' },
    tabBadge: {
        backgroundColor: '#E2E8F0', borderRadius: 9,
        minWidth: 18, height: 18,
        justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4,
    },
    tabBadgeActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
    tabBadgeText: { fontSize: 9, fontWeight: '800', color: '#64748B', includeFontPadding: false, textAlignVertical: 'center' },
    tabBadgeTextActive: { color: '#fff' },

    list: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 110 },

    // Cards
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        marginBottom: 16,
        paddingBottom: 4,
        borderWidth: 1,
        borderColor: '#F1F5F9',
        shadowColor: '#0A1A3A',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.06,
        shadowRadius: 24,
        elevation: 8,
    },
    cardTop: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 16, paddingTop: 18, paddingBottom: 14, gap: 14,
    },
    cardIconBg: {
        width: 56, height: 56, borderRadius: 20,
        backgroundColor: Colors.primaryLight,
        justifyContent: 'center', alignItems: 'center',
        borderWidth: 1, borderColor: 'rgba(0,0,0,0.03)',
    },
    cardName: { fontSize: 16, fontWeight: '900', color: '#0F172A', marginBottom: 4, letterSpacing: -0.3 },
    cardType: { fontSize: 13, color: '#64748B', fontWeight: '600' },
    cardDivider: { height: 1, backgroundColor: '#F1F5F9', marginHorizontal: 16, marginVertical: 2 },
    cardBottom: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 16, paddingVertical: 14, gap: 8,
    },
    metaItem: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
    cardMeta: { fontSize: 13, color: '#475569', fontWeight: '700' },
    cardActionBtn: {
        backgroundColor: '#0B3370',
        borderRadius: 16, paddingVertical: 12,
        alignItems: 'center', justifyContent: 'center',
        marginTop: 4,
        shadowColor: '#0B3370', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4,
    },
    cardActionText: { fontSize: 14, fontWeight: '900', color: '#FFFFFF', letterSpacing: 0.3 },
    cardDeleteBtn: {
        width: 48, borderRadius: 16,
        alignItems: 'center', justifyContent: 'center',
        marginTop: 4,
        borderWidth: 1, borderColor: '#FECACA',
        backgroundColor: '#FEF2F2',
    },

    // Guest / Unauthenticated screen
    guestHero: {
        width: '100%', paddingTop: 60, paddingBottom: 44, paddingHorizontal: 28,
        alignItems: 'center', overflow: 'hidden', position: 'relative',
    },
    guestBlob1: { position: 'absolute', top: -60, right: -60, width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.06)' },
    guestBlob2: { position: 'absolute', bottom: -40, left: -40, width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(255,255,255,0.05)' },
    guestIconRing: {
        width: 92, height: 92, borderRadius: 46,
        borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)',
        justifyContent: 'center', alignItems: 'center', marginBottom: 18,
    },
    guestIconGrad: {
        width: 84, height: 84, borderRadius: 42,
        justifyContent: 'center', alignItems: 'center',
    },
    guestHeroTitle: { fontSize: 26, fontWeight: '900', color: '#fff', letterSpacing: -0.5, marginBottom: 10, textAlign: 'center' },
    guestHeroSub: { fontSize: 14, color: 'rgba(255,255,255,0.78)', textAlign: 'center', lineHeight: 21, fontWeight: '500', marginBottom: 22 },
    guestStatsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center' },
    guestStatPill: {
        flexDirection: 'row', alignItems: 'center', gap: 5,
        backgroundColor: 'rgba(255,255,255,0.14)',
        borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
    },
    guestStatText: { fontSize: 11, color: 'rgba(255,255,255,0.9)', fontWeight: '700' },

    guestBody: { flex: 1, backgroundColor: '#F4F7FC', paddingHorizontal: 20, paddingTop: 28, paddingBottom: 40 },
    guestSectionLabel: { fontSize: 11, fontWeight: '900', color: '#94A3B8', letterSpacing: 1.4, marginBottom: 16 },
    guestFeatureRow: {
        flexDirection: 'row', alignItems: 'center', gap: 14,
        backgroundColor: '#FFFFFF', borderRadius: 22, padding: 16, marginBottom: 12,
        shadowColor: '#0A1A3A', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.04, shadowRadius: 14, elevation: 3,
        borderWidth: 1, borderColor: '#E8EEF5',
    },
    guestFeatureIcon: { width: 50, height: 50, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },
    guestFeatureTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A', marginBottom: 3 },
    guestFeatureDesc: { fontSize: 12, color: '#64748B', fontWeight: '500', lineHeight: 17 },
    guestFeatureLock: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
    guestCTA: {
        marginTop: 28, borderRadius: 30, overflow: 'hidden',
        shadowColor: '#0B3370', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 8,
    },
    guestCTAGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 18 },
    guestCTAText: { color: '#fff', fontSize: 17, fontWeight: '900', letterSpacing: 0.3 },
    guestDisclaimer: { textAlign: 'center', fontSize: 12, color: '#94A3B8', marginTop: 20, lineHeight: 18, fontWeight: '500' },
    guestDisclaimerLink: { color: '#2563EB', fontWeight: '800' },
});
