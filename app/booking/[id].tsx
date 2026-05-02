import React from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { bookingsService } from '@/services/bookings.service';
import { addressService } from '@/services/address.service';
import { Colors, Shadows } from '@/constants/colors';
import { Ionicons } from '@expo/vector-icons';
import { FontSize } from '@/constants/spacing';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/EmptyState';
import { formatDateTime } from '@/utils/formatters';
import { MapPin, MessageSquare, XCircle, Clock3, Radio, ShieldCheck, Truck, CheckCircle2, Search } from 'lucide-react-native';
import { triggerLocalNotification } from '@/utils/notifications';

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_STEPS: Array<{ status: string; label: string; key: 'pending' | 'broadcasted' | 'accepted' | 'in_progress' | 'completed'; desc: string }> = [
    { status: 'PENDING', key: 'pending', label: 'Pending', desc: 'Waiting to be sent to nearby providers' },
    { status: 'BROADCASTED', key: 'broadcasted', label: 'Searching Provider', desc: 'We are matching you with the nearest available provider' },
    { status: 'ACCEPTED', key: 'accepted', label: 'Accepted', desc: 'A provider has accepted your request' },
    { status: 'IN_PROGRESS', key: 'in_progress', label: 'In Progress', desc: 'Provider is on the way' },
    { status: 'COMPLETED', key: 'completed', label: 'Completed', desc: 'Service has been completed successfully' },
];

const STATUS_ORDER = STATUS_STEPS.map((s) => s.status);

// ─── Status progression banner ────────────────────────────────────────────────
const STATUS_BG: Record<string, string> = {
    PENDING: '#FEF9C3',
    BROADCASTED: '#F3E8FF',
    ACCEPTED: '#D1EFE0',
    IN_PROGRESS: '#DBEAFE',
    COMPLETED: '#D1FAE5',
    CANCELLED: '#FEE2E2',
};

function StatusHero({ status }: { status: string }) {
    const step = STATUS_STEPS.find((s) => s.status === status);
    const bg = STATUS_BG[status] ?? '#F3F4F6';
    const HeroIcon =
        step?.key === 'pending' ? Clock3 :
        step?.key === 'broadcasted' ? Radio :
        step?.key === 'accepted' ? ShieldCheck :
        step?.key === 'in_progress' ? Truck :
        step?.key === 'completed' ? CheckCircle2 :
        Search;
    return (
        <View style={[styles.statusHero, { backgroundColor: bg }]}>
            <View style={styles.statusHeroIconWrap}>
                <HeroIcon size={34} color="#4B5563" />
            </View>
            <Text style={styles.statusHeroLabel}>{step?.label ?? status.replace('_', ' ')}</Text>
            <Text style={styles.statusHeroDesc}>{step?.desc ?? ''}</Text>
        </View>
    );
}

// ─── Timeline ─────────────────────────────────────────────────────────────────
function Timeline({ status }: { status: string }) {
    const currentIdx = STATUS_ORDER.indexOf(status);
    const isCancelled = status === 'CANCELLED';

    if (isCancelled) {
        return (
            <View style={[styles.card, styles.cancelledBox]}>
                <Text style={styles.cancelledText}>This booking has been cancelled.</Text>
            </View>
        );
    }

    return (
        <View style={styles.card}>
            <Text style={styles.cardTitle}>Booking Progress</Text>
            {STATUS_STEPS.map((s, idx) => {
                const done = currentIdx > idx;
                const active = currentIdx === idx;
                return (
                    <View key={s.status} style={styles.timelineRow}>
                        <View style={styles.timelineLeft}>
                            <View
                                style={[
                                    styles.timelineDot,
                                    done ? styles.timelineDotDone : {},
                                    active ? styles.timelineDotActive : {},
                                ]}
                            >
                                {done ? (
                                    <Text style={styles.timelineCheck}>✓</Text>
                                ) : active ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : null}
                            </View>
                            {idx < STATUS_STEPS.length - 1 && (
                                <View style={[styles.timelineLine, done ? styles.timelineLineDone : {}]} />
                            )}
                        </View>
                        <View style={styles.timelineContent}>
                            <Text
                                style={[
                                    styles.timelineLabel,
                                    active ? styles.timelineLabelActive : {},
                                    done ? styles.timelineLabelDone : {},
                                ]}
                            >
                                {s.label}
                            </Text>
                            {active && (
                                <Text style={styles.timelineDesc}>{s.desc}</Text>
                            )}
                        </View>
                    </View>
                );
            })}
        </View>
    );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function BookingDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const [isManualRefreshing, setIsManualRefreshing] = React.useState(false);
    const [isCancelling, setIsCancelling] = React.useState(false);

    const { data: booking, isLoading, isError, refetch, isRefetching } = useQuery({
        queryKey: ['service-booking', id],
        queryFn: () => bookingsService.getServiceBookingById(id!),
        refetchInterval: 12000, // Poll every 12 seconds for status updates
        retry: 2,
    });

    const { data: myAddresses } = useQuery({
        queryKey: ['addresses-for-booking-detail'],
        queryFn: addressService.getAll,
        retry: 1,
    });

    const getAddressText = (b: any) => {
        const addr = b?.addressId;

        // 1) Populated address object
        if (addr && typeof addr === 'object') {
            const parts = [
                addr?.street,
                addr?.landmark,
                addr?.city,
                addr?.state,
                addr?.pincode,
                addr?.moreInfo,
            ].filter(Boolean);
            if (parts.length) return parts.join(', ');
        }

        // 2) If only addressId string returned, resolve from patient's addresses list
        if (typeof addr === 'string' && Array.isArray(myAddresses)) {
            const matched = myAddresses.find((a: any) => String(a?._id) === String(addr));
            if (matched) {
                const parts = [
                    matched?.street,
                    matched?.landmark,
                    matched?.city,
                    matched?.state,
                    matched?.pincode,
                    matched?.moreInfo,
                ].filter(Boolean);
                if (parts.length) return parts.join(', ');
            }
        }

        // 3) Geo fallback when booking stored only raw location
        if (b?.location?.lat && b?.location?.lng) {
            return `Lat ${Number(b.location.lat).toFixed(5)}, Lng ${Number(b.location.lng).toFixed(5)}`;
        }

        return 'Not specified';
    };

    const getScheduleText = (b: any) => {
        if (b?.bookingType === 'ON_DEMAND') return 'ASAP';
        const start = b?.scheduledSlot?.startTime;
        if (start) return formatDateTime(start);
        if (b?.scheduledTime) return formatDateTime(b.scheduledTime);
        return 'ASAP';
    };

    const handleManualRefresh = async () => {
        if (isManualRefreshing || isRefetching) return;
        try {
            setIsManualRefreshing(true);
            await refetch();
        } finally {
            setIsManualRefreshing(false);
        }
    };

    const shouldShowPollingNote = booking
        ? !['COMPLETED', 'CANCELLED'].includes(String(booking.status))
        : false;

    return (
        <SafeAreaView style={styles.root} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.replace('/bookings')} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={20} color={Colors.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Booking Details</Text>
                <TouchableOpacity
                    onPress={handleManualRefresh}
                    style={[styles.refreshBtn, (isRefetching || isManualRefreshing) && styles.refreshBtnDisabled]}
                    disabled={isRefetching || isManualRefreshing}
                >
                    {isRefetching || isManualRefreshing ? (
                        <ActivityIndicator size="small" color={Colors.primary} />
                    ) : (
                        <Ionicons name="refresh" size={18} color={Colors.primary} />
                    )}
                </TouchableOpacity>
            </View>

            {isLoading ? (
                <View style={styles.centerLoader}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                    <Text style={styles.loaderText}>Loading booking…</Text>
                </View>
            ) : isError || !booking ? (
                <ErrorState
                    message="Could not load booking details"
                    onRetry={() => refetch()}
                />
            ) : (
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
                    {/* Status Hero */}
                    <StatusHero status={booking.status} />

                    {/* Info Card */}
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Booking Information</Text>
                        {(() => {
                            const isOnline = booking.paymentMode === 'ONLINE';
                            const isPaid = booking.paymentStatus === 'COMPLETED';
                            const paymentLabel = isOnline ? (isPaid ? 'Paid online' : 'Online (pending)') : 'Cash on pay';

                            return [
                                { label: 'Booking ID', value: `#${booking._id.slice(-10).toUpperCase()}` },
                                { label: 'Status', value: <StatusBadge status={booking.status} size="md" /> },
                                { label: 'Booked On', value: formatDateTime(booking.createdAt) },
                                { label: 'Address', value: getAddressText(booking) },
                                { label: 'Schedule', value: getScheduleText(booking) },
                                { label: 'Payment', value: paymentLabel },
                            ];
                        })().map((r) => (
                            <View key={r.label} style={styles.infoRow}>
                                <Text style={styles.infoLabel}>{r.label}</Text>
                                {typeof r.value === 'string' ? (
                                    <Text style={styles.infoValue} numberOfLines={3}>{r.value}</Text>
                                ) : (
                                    r.value
                                )}
                            </View>
                        ))}
                    </View>

                    {/* Timeline */}
                    <Timeline status={booking.status} />

                    {/* Polling indicator */}
                    {shouldShowPollingNote ? (
                        <View style={styles.pollingNote}>
                            <Text style={styles.pollingText}>Status auto-updates every 12 seconds</Text>
                        </View>
                    ) : null}

                    {/* Live Support / Tracking */}
                    {booking.status === 'ACCEPTED' || booking.status === 'IN_PROGRESS' ? (
                        <View style={styles.card}>
                            <Text style={styles.cardTitle}>Live Support</Text>
                            <View style={styles.actionGrid}>
                                <TouchableOpacity 
                                    style={styles.actionBtn}
                                    onPress={() => router.push({
                                        pathname: '/booking/track' as any,
                                        params: { id: booking._id, providerId: (booking as any).assignedProviderId?._id || (booking as any).assignedProviderId }
                                    })}
                                >
                                    <View style={[styles.actionIcon, { backgroundColor: '#E0F2FE' }]}>
                                        <MapPin size={22} color="#0369A1" />
                                    </View>
                                    <Text style={styles.actionLabel}>Track Live</Text>
                                </TouchableOpacity>

                                <TouchableOpacity 
                                    style={styles.actionBtn}
                                    onPress={() => router.push({
                                        pathname: '/booking/chat' as any,
                                        params: { id: booking._id, name: (booking as any).assignedProviderId?.name || 'Provider' }
                                    })}
                                >
                                    <View style={[styles.actionIcon, { backgroundColor: '#F0FDF4' }]}>
                                        <MessageSquare size={22} color="#15803D" />
                                    </View>
                                    <Text style={styles.actionLabel}>Chat</Text>
                                </TouchableOpacity>

                            </View>
                        </View>
                    ) : null}

                    {/* Actions */}
                    {booking.status === 'PENDING' || booking.status === 'BROADCASTED' || booking.status === 'ACCEPTED' ? (
                        <View style={styles.card}>
                            <Text style={styles.cardTitle}>Actions</Text>
                            <Button
                                label={isCancelling ? 'Cancelling...' : 'Cancel Booking'}
                                icon={<XCircle size={18} color="#fff" />}
                                onPress={() => {
                                    import('react-native').then(({ Alert }) => {
                                        Alert.alert(
                                            'Cancel Booking',
                                            'Are you sure you want to cancel this booking?',
                                            [
                                                { text: 'No', style: 'cancel' },
                                                {
                                                    text: 'Yes, Cancel',
                                                    style: 'destructive',
                                                    onPress: async () => {
                                                        if (isCancelling) return;
                                                        try {
                                                            setIsCancelling(true);
                                                            await bookingsService.updateServiceBookingStatus(booking._id, 'CANCELLED');
                                                            await refetch();
                                                            triggerLocalNotification('Booking Cancelled', 'Your service booking has been cancelled.');
                                                        } catch (error: any) {
                                                            Alert.alert('Error', error?.response?.data?.message || 'Failed to cancel booking');
                                                        } finally {
                                                            setIsCancelling(false);
                                                        }
                                                    }
                                                }
                                            ]
                                        );
                                    });
                                }}
                                variant="danger"
                                size="md"
                                fullWidth
                                disabled={isCancelling}
                            />
                        </View>
                    ) : null}

                    {booking.status === 'COMPLETED' && (
                        <View style={styles.card}>
                            <Text style={styles.cardTitle}>Rate Your Experience</Text>
                            <Text style={styles.codReminderText}>
                                Your feedback helps us improve. Please share your experience!
                            </Text>
                            <Button
                                label="Write a Review"
                                onPress={() => router.push({
                                    pathname: '/booking/feedback',
                                    params: {
                                        bookingId: booking._id,
                                        bookingType: 'Service',
                                        childServiceId: (booking as any).childServiceId?._id || (booking as any).childServiceId,
                                        name: (booking as any).childServiceId?.name || 'Service'
                                    }
                                })}
                                variant="outline"
                                size="sm"
                                style={{ marginTop: 12 }}
                            />
                        </View>
                    )}

                    <View style={{ height: 40 }} />
                </ScrollView>
            )}
        </SafeAreaView>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#F4F7FB' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 14,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E6EDF5',
    },
    backBtn: {
        width: 36,
        height: 36,
        borderRadius: 12,
        backgroundColor: '#F4F7FB',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: { fontSize: FontSize.lg, fontWeight: '800', color: '#1F2A37', flex: 1, textAlign: 'center' },
    refreshBtn: {
        width: 36,
        height: 36,
        borderRadius: 12,
        backgroundColor: '#EAF2FB',
        justifyContent: 'center',
        alignItems: 'center',
    },
    refreshBtnDisabled: { opacity: 0.65 },

    centerLoader: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
    loaderText: { color: Colors.textSecondary, fontSize: FontSize.base },

    scroll: { padding: 14, gap: 12, paddingBottom: 40 },

    // Status hero
    statusHero: {
        borderRadius: 20,
        paddingVertical: 24,
        paddingHorizontal: 16,
        alignItems: 'center',
    },
    statusHeroIconWrap: { marginBottom: 10, width: 54, height: 54, borderRadius: 27, backgroundColor: '#FFFFFF55', alignItems: 'center', justifyContent: 'center' },
    statusHeroLabel: { fontSize: FontSize['2xl'], fontWeight: '800', color: '#1F2A37', marginBottom: 4 },
    statusHeroDesc: { fontSize: FontSize.sm, color: Colors.textSecondary },

    // Cards
    card: {
        backgroundColor: Colors.card,
        borderRadius: 18,
        padding: 16,
        borderWidth: 1,
        borderColor: '#E6EDF5',
        ...Shadows.card,
    },
    cardTitle: { fontSize: FontSize.base, fontWeight: '800', color: '#1F2A37', marginBottom: 12 },

    // Info rows
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#EDF2F7',
        gap: 10,
    },
    infoLabel: { fontSize: FontSize.sm, color: '#6B7280', flexShrink: 0, width: 92, fontWeight: '600' },
    infoValue: { fontSize: FontSize.sm, fontWeight: '700', color: '#1F2A37', flex: 1, textAlign: 'right' },

    // Timeline
    timelineRow: { flexDirection: 'row', marginBottom: 4, minHeight: 40 },
    timelineLeft: { alignItems: 'center', width: 32 },
    timelineDot: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: Colors.border,
        justifyContent: 'center',
        alignItems: 'center',
    },
    timelineDotActive: { backgroundColor: Colors.primary },
    timelineDotDone: { backgroundColor: Colors.health },
    timelineCheck: { fontSize: 12, fontWeight: '700', color: '#fff' },
    timelineLine: { width: 2, flex: 1, backgroundColor: Colors.border, marginVertical: 2 },
    timelineLineDone: { backgroundColor: Colors.health },
    timelineContent: { flex: 1, paddingLeft: 12, paddingBottom: 8 },
    timelineLabel: { fontSize: FontSize.base, color: Colors.textSecondary, fontWeight: '500' },
    timelineLabelActive: { color: Colors.primary, fontWeight: '700' },
    timelineLabelDone: { color: Colors.health, fontWeight: '600' },
    timelineDesc: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },

    cancelledBox: { borderWidth: 1.5, borderColor: '#FDD8D8' },
    cancelledText: { fontSize: FontSize.base, color: Colors.emergency, fontWeight: '500', textAlign: 'center' },

    pollingNote: {
        backgroundColor: '#EEF4FB',
        borderRadius: 10,
        padding: 10,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#DBE7F5',
    },
    pollingText: { fontSize: FontSize.xs, color: '#4B5563', fontWeight: '600' },

    codReminderText: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
    actionGrid: { flexDirection: 'row', gap: 12 },
    actionBtn: { flex: 1, alignItems: 'center', gap: 8 },
    actionIcon: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center' },
    actionLabel: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.textPrimary },
});
