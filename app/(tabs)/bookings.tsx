import React, { useMemo, useState } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    RefreshControl,
    StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useIsFocused } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
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
    LayoutGrid
} from 'lucide-react-native';

import { bookingsService } from '@/services/bookings.service';
import { useAuthStore } from '@/stores/auth.store';
import { Colors, Shadows } from '@/constants/colors';
import { FontSize } from '@/constants/spacing';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { SkeletonBookingCard } from '@/components/ui/Skeleton';
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
    ACCEPTED: 'ongoing',
    IN_PROGRESS: 'ongoing',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
};

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
    if (low.includes('doctor') || low.includes('consult') || low.includes('physician') || low.includes('cardio') || low.includes('neuro') || low.includes('derma')) {
        return { icon: Stethoscope, color: '#2F80ED', bg: '#EBF3FD' };
    }
    if (low.includes('pharmacy') || low.includes('medicine')) return { icon: Pill, color: '#F2C94C', bg: '#FFF9E6' };
    if (low.includes('hospital') || low.includes('op') || low.includes('token')) return { icon: Activity, color: '#2F80ED', bg: '#EBF3FD' };
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

function ServiceCard({ booking, onPress }: { booking: ServiceRequest; onPress: () => void }) {
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
                dateText={formatDateTime(booking.createdAt)}
                paymentText={paymentLabel}
            />
        </TouchableOpacity>
    );
}

function AppointmentCard({ appt, onPress }: { appt: DoctorAppointment; onPress?: () => void }) {
    const mode = (appt.paymentMode || 'OFFLINE').toUpperCase();
    const isPaid = appt.paymentStatus === 'COMPLETED';
    const paymentLabel =
        mode === 'WALLET' ? (isPaid ? 'Paid via wallet' : 'Wallet pending') :
            mode === 'ONLINE' ? (isPaid ? 'Paid online' : 'Online pending') :
                'Cash on consultation';

    return (
        <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.9}>
            <View style={styles.cardTop}>
                <View style={[styles.cardIconBg, { backgroundColor: '#E9F7EF' }]}>
                    <Stethoscope size={22} color={Colors.health} />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={styles.cardName} numberOfLines={1}>Doctor Appointment</Text>
                    <Text style={styles.cardType}>Specialist Consultation</Text>
                </View>
                <StatusBadge status={appt.status ?? 'Pending'} />
            </View>
            <View style={styles.cardDivider} />
            <BookingMetaRow
                dateText={`${appt.date ? new Date(appt.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : ''} · ${appt.startingTime && appt.endingTime ? `${appt.startingTime}-${appt.endingTime}` : (appt.timeSlot ?? 'ASAP')}`}
                paymentText={paymentLabel}
            />
        </TouchableOpacity>
    );
}

export default function BookingsScreen() {
    const router = useRouter();
    const isFocused = useIsFocused();
    const { user } = useAuthStore();
    const myId = user?._id ? String(user._id) : '';

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

    React.useEffect(() => {
        if (!isFocused) return;
        setAllowCardPress(false);
        const timer = setTimeout(() => setAllowCardPress(true), 350);
        return () => clearTimeout(timer);
    }, [isFocused]);

    const isLoading = sbLoading || apptLoading;
    const isError = sbErr || apptErr;

    const filteredServiceBookings = myServiceBookings.filter(
        (b) => SERVICE_TAB[b.status] === activeTab
    );
    const filteredAppts = myAppointments.filter(
        (a) => APPT_TAB[a.status ?? 'Pending'] === activeTab
    );
    const visibleCount = filteredServiceBookings.length + filteredAppts.length;

    const tabCount = (tab: TabId) => {
        const sbCount = myServiceBookings.filter((b) => SERVICE_TAB[b.status] === tab).length;
        const apptCount = myAppointments.filter((a) => APPT_TAB[a.status ?? 'Pending'] === tab).length;
        return sbCount + apptCount;
    };

    const isEmpty = visibleCount === 0 && !isLoading;

    return (
        <SafeAreaView style={styles.root} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => router.back()}
                    style={styles.headerBackBtn}
                    activeOpacity={0.85}
                >
                    <Ionicons name="arrow-back" size={20} color={Colors.textPrimary} />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={styles.headerTitle}>My Bookings</Text>
                    <Text style={styles.headerSub}>Track all your requests and appointments in one place</Text>
                </View>
                <View style={styles.headerCountPill}>
                    <Text style={styles.headerCountText}>{visibleCount} shown</Text>
                </View>
            </View>

            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.tabsRow}
                style={styles.tabsScroll}
            >
                {TABS.map((t) => {
                    const count = tabCount(t.id);
                    return (
                        <TouchableOpacity
                            key={t.id}
                            style={[styles.tab, activeTab === t.id && styles.tabActive]}
                            onPress={() => setActiveTab(t.id)}
                            activeOpacity={0.9}
                        >
                            <Text style={[styles.tabText, activeTab === t.id && styles.tabTextActive]}>
                                {t.label}
                            </Text>
                            {count > 0 && (
                                <View style={[styles.tabBadge, activeTab === t.id && styles.tabBadgeActive]}>
                                    <Text style={[styles.tabBadgeText, activeTab === t.id && styles.tabBadgeTextActive]}>
                                        {count}
                                    </Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>

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
                            icon={activeTab === 'cancelled' ? 'No updates' : 'No bookings yet'}
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
                            {filteredAppts.map((a) => (
                                <AppointmentCard
                                    key={a._id}
                                    appt={a}
                                    onPress={() => {
                                        if (!allowCardPress) return;
                                        router.push({ pathname: '/doctor/appointment/[id]', params: { id: a._id } });
                                    }}
                                />
                            ))}
                            {filteredServiceBookings.map((b) => (
                                <ServiceCard
                                    key={b._id}
                                    booking={b}
                                    onPress={() => {
                                        if (!allowCardPress) return;
                                        router.push({ pathname: '/booking/[id]', params: { id: b._id } });
                                    }}
                                />
                            ))}
                        </>
                    )}
                    <View style={{ height: 24 }} />
                </ScrollView>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: Colors.background },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 14,
        paddingBottom: 14,
        backgroundColor: Colors.card,
        ...Shadows.card,
    },
    headerBackBtn: {
        width: 38,
        height: 38,
        borderRadius: 12,
        backgroundColor: '#F4F7FB',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
    },
    headerTitle: { fontSize: FontSize['2xl'], fontWeight: '800', color: Colors.textPrimary },
    headerSub: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
    headerCountPill: {
        paddingHorizontal: 10,
        height: 30,
        borderRadius: 999,
        backgroundColor: Colors.primaryLight,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 10,
    },
    headerCountText: { fontSize: 11, fontWeight: '700', color: Colors.primary },

    tabsScroll: {
        backgroundColor: Colors.card,
        flexGrow: 0,
        maxHeight: 56,
    },
    tabsRow: {
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 10,
        gap: 10,
        alignItems: 'center',
        paddingRight: 20,
    },
    tab: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 16,
        height: 38,
        borderRadius: 19,
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    tabActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
    tabText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary },
    tabTextActive: { color: '#fff' },
    tabBadge: {
        backgroundColor: Colors.border,
        borderRadius: 10,
        minWidth: 18,
        height: 18,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 5,
    },
    tabBadgeActive: { backgroundColor: 'rgba(255,255,255,0.3)' },
    tabBadgeText: { fontSize: 10, fontWeight: '700', color: Colors.textSecondary },
    tabBadgeTextActive: { color: '#fff' },

    list: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 110 },

    card: {
        backgroundColor: Colors.card,
        borderRadius: 16,
        marginBottom: 12,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#E6EDF5',
        ...Shadows.card,
    },
    cardTop: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        gap: 12,
    },
    cardIconBg: {
        width: 48,
        height: 48,
        borderRadius: 14,
        backgroundColor: Colors.primaryLight,
        justifyContent: 'center',
        alignItems: 'center',
    },
    cardName: {
        fontSize: FontSize.base,
        fontWeight: '800',
        color: Colors.textPrimary,
        marginBottom: 2,
    },
    cardType: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: '500' },
    cardDivider: { height: 1, backgroundColor: Colors.border, marginHorizontal: 14 },
    cardBottom: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 11,
        gap: 8,
    },
    metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1 },
    cardMeta: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: '500' },
});
