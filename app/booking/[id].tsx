import React from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    Modal,
    Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/stores/auth.store';
import { bookingsService } from '@/services/bookings.service';
import { addressService } from '@/services/address.service';
import { reviewsService } from '@/services/reviews.service';
import { Colors, Shadows } from '@/constants/colors';
import { Ionicons } from '@expo/vector-icons';
import { FontSize } from '@/constants/spacing';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/EmptyState';
import { formatDateTime } from '@/utils/formatters';
import { MapPin, MessageSquare, XCircle, Clock3, Radio, ShieldCheck, Truck, CheckCircle2, Search } from 'lucide-react-native';
import { triggerLocalNotification } from '@/utils/notifications';
import { showToast } from '@/utils/toast';

const SOCKET_URL = process.env.EXPO_PUBLIC_API_URL?.replace('/api', '') || 'http://10.0.2.2:3000';

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_STEPS: Array<{ status: string; label: string; key: string; desc: string }> = [
    { status: 'PENDING', key: 'pending', label: 'Pending', desc: 'Waiting for a provider to be assigned' },
    { status: 'PARTNER_ASSIGNED', key: 'partner_assigned', label: 'Provider Assigned', desc: 'A provider has been assigned and is confirming' },
    { status: 'BROADCASTED', key: 'broadcasted', label: 'Searching Provider', desc: 'Finding the nearest available provider' },
    { status: 'ACCEPTED', key: 'accepted', label: 'Accepted', desc: 'A provider has accepted your request' },
    { status: 'IN_PROGRESS', key: 'in_progress', label: 'In Progress', desc: 'Provider is on the way' },
    { status: 'COMPLETED', key: 'completed', label: 'Completed', desc: 'Service completed successfully' },
];

const STATUS_ORDER = STATUS_STEPS.map((s) => s.status);

// ─── Status progression banner ────────────────────────────────────────────────
const STATUS_BG: Record<string, string> = {
    PENDING: '#FEF9C3',
    PARTNER_ASSIGNED: '#E0F2FE',
    BROADCASTED: '#F3E8FF',
    ACCEPTED: '#D1EFE0',
    IN_PROGRESS: '#DBEAFE',
    COMPLETED: '#D1FAE5',
    CANCELLED: '#FEE2E2',
    RETURNED_TO_ADMIN: '#FEF3C7',
};

function StatusHero({ status }: { status: string }) {
    const step = STATUS_STEPS.find((s) => s.status === status);
    const bg = STATUS_BG[status] ?? '#F3F4F6';
    const HeroIcon =
        status === 'RETURNED_TO_ADMIN' ? Clock3 :
        status === 'CANCELLED' ? XCircle :
        step?.key === 'pending' ? Clock3 :
        step?.key === 'partner_assigned' ? ShieldCheck :
        step?.key === 'broadcasted' ? Radio :
        step?.key === 'accepted' ? ShieldCheck :
        step?.key === 'in_progress' ? Truck :
        step?.key === 'completed' ? CheckCircle2 :
        Search;
    const heroLabel = status === 'RETURNED_TO_ADMIN' ? 'Re-scheduling' : step?.label ?? status.replace(/_/g, ' ');
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
                                    <View style={styles.timelineDotInner} />
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
    const qc = useQueryClient();
    const { token } = useAuthStore();
    const [isManualRefreshing, setIsManualRefreshing] = React.useState(false);
    const [isCancelling, setIsCancelling] = React.useState(false);
    const [showCancelConfirmModal, setShowCancelConfirmModal] = React.useState(false);

    // Rating modal state
    const [showRatingModal, setShowRatingModal] = React.useState(false);
    const [ratingStars, setRatingStars] = React.useState(0);
    const prevStatusRef = React.useRef<string | null>(null);
    const socketRef = React.useRef<Socket | null>(null);

    const { data: booking, isLoading, isError, refetch, isRefetching } = useQuery({
        queryKey: ['service-booking', id],
        queryFn: () => bookingsService.getServiceBookingById(id!),
        refetchInterval: 12000,
        retry: 2,
    });

    const { data: myAddresses } = useQuery({
        queryKey: ['addresses-for-booking-detail'],
        queryFn: addressService.getAll,
        retry: 1,
    });

    // Socket — join booking room for real-time status updates
    React.useEffect(() => {
        if (!id) return;
        const socket = io(SOCKET_URL, { auth: { token }, transports: ['polling', 'websocket'] });
        socketRef.current = socket;
        socket.on('connect', () => socket.emit('join_room', id));
        socket.on('booking_status_updated', (data: { bookingId: string; status: string }) => {
            if (data.bookingId === id) refetch();
        });
        return () => { socket.disconnect(); socketRef.current = null; };
    }, [id]);

    // Auto-prompt rating when status first transitions to COMPLETED
    React.useEffect(() => {
        if (!booking) return;
        const prev = prevStatusRef.current;
        const curr = booking.status;
        if (prev !== null && prev !== 'COMPLETED' && curr === 'COMPLETED') {
            setTimeout(() => setShowRatingModal(true), 800);
        }
        prevStatusRef.current = curr;
    }, [booking?.status]);

    const ratingMutation = useMutation({
        mutationFn: () => reviewsService.addReview({
            bookingId: id!,
            bookingType: 'Service',
            rating: ratingStars,
            comment: '',
            childServiceId: (booking as any)?.childServiceId?._id || (booking as any)?.childServiceId,
        }),
        onSuccess: () => {
            setShowRatingModal(false);
            qc.invalidateQueries({ queryKey: ['service-booking', id] });
            showToast.success('Thank You!', 'Your rating helps us improve.');
        },
        onError: () => { showToast.error('Rating Failed', 'Unable to submit your rating. Please try again.'); },
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

                    {/* Chat with Provider — available for every booking status */}
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Contact Provider</Text>
                        <View style={styles.actionGrid}>
                            {(booking.status === 'ACCEPTED' || booking.status === 'IN_PROGRESS') && (
                                <TouchableOpacity
                                    style={styles.actionBtn}
                                    onPress={() => {
                                        const addr = booking.addressId;
                                        const lat = (addr && typeof addr === 'object') ? addr.latitude : booking.location?.lat;
                                        const lng = (addr && typeof addr === 'object') ? addr.longitude : booking.location?.lng;
                                        router.push({
                                            pathname: '/booking/track' as any,
                                            params: {
                                                id: booking._id,
                                                providerId: (booking as any).assignedProviderId?._id || (booking as any).assignedProviderId,
                                                destLat: lat ? String(lat) : '',
                                                destLng: lng ? String(lng) : ''
                                            }
                                        });
                                    }}
                                >
                                    <View style={[styles.actionIcon, { backgroundColor: '#E0F2FE' }]}>
                                        <MapPin size={22} color="#0369A1" />
                                    </View>
                                    <Text style={styles.actionLabel}>Track Live</Text>
                                </TouchableOpacity>
                            )}

                            <TouchableOpacity
                                style={styles.actionBtn}
                                onPress={() => router.push({
                                    pathname: '/booking/chat' as any,
                                    params: {
                                        id: booking._id,
                                        name: (booking as any).assignedProviderId?.name || (booking as any).partnerId?.name || 'Service Provider'
                                    }
                                })}
                            >
                                <View style={[styles.actionIcon, { backgroundColor: '#F0FDF4' }]}>
                                    <MessageSquare size={22} color="#15803D" />
                                </View>
                                <Text style={styles.actionLabel}>Chat</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Actions */}
                    {booking.status === 'PENDING' || booking.status === 'BROADCASTED' || booking.status === 'ACCEPTED' ? (
                        <View style={styles.card}>
                            <Text style={styles.cardTitle}>Actions</Text>
                            <Button
                                label={isCancelling ? 'Cancelling...' : 'Cancel Booking'}
                                icon={<XCircle size={18} color="#fff" />}
                                onPress={() => {
                                    setShowCancelConfirmModal(true);
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

                    {(booking.status === 'COMPLETED' || booking.status === 'CANCELLED') && (
                        <View style={styles.card}>
                            <Text style={styles.cardTitle}>Book Service Again</Text>
                            <Text style={styles.codReminderText}>
                                Need this service again? Re-book with a single click.
                            </Text>
                            <Button
                                label="Book Again"
                                onPress={() => {
                                    const svc = (booking as any).childServiceId;
                                    const pkg = (booking as any).healthPackageId;

                                    if (svc) {
                                        // Child service booking → go to service detail
                                        const svcId = typeof svc === 'object' ? svc?._id : svc;
                                        if (!svcId) {
                                            showToast.error('Error', 'Service details are no longer available.');
                                            return;
                                        }
                                        router.push({
                                            pathname: '/service/[id]' as any,
                                            params: { id: svcId }
                                        });
                                    } else if (pkg) {
                                        // Health package booking → go to package detail
                                        const pkgId = typeof pkg === 'object' ? pkg?._id : pkg;
                                        if (!pkgId) {
                                            showToast.error('Error', 'Package details are no longer available.');
                                            return;
                                        }
                                        router.push({
                                            pathname: '/package/[id]' as any,
                                            params: { id: pkgId }
                                        });
                                    } else {
                                        showToast.error('Error', 'Could not find the original service to re-book.');
                                    }
                                }}
                                variant="primary"
                                size="md"
                                style={{ marginTop: 12 }}
                            />
                        </View>
                    )}

                    <View style={{ height: 40 }} />
                </ScrollView>
            )}
            {/* Rating Prompt Modal */}
            <Modal visible={showRatingModal} transparent animationType="slide" onRequestClose={() => setShowRatingModal(false)}>
                <View style={styles.ratingOverlay}>
                    <View style={styles.ratingSheet}>
                        <Text style={styles.ratingTitle}>How was your experience?</Text>
                        <Text style={styles.ratingSubtitle}>
                            {(booking as any)?.childServiceId?.name || 'Your booking'} is complete
                        </Text>
                        <View style={styles.starsRow}>
                            {[1, 2, 3, 4, 5].map((s) => (
                                <TouchableOpacity key={s} onPress={() => setRatingStars(s)} activeOpacity={0.7}>
                                    <Text style={[styles.star, s <= ratingStars ? styles.starFilled : styles.starEmpty]}>
                                        {s <= ratingStars ? '★' : '☆'}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                        {ratingStars > 0 && (
                            <Text style={styles.ratingLabel}>
                                {ratingStars === 1 ? 'Disappointing' : ratingStars === 2 ? 'Could be better' : ratingStars === 3 ? 'Good' : ratingStars === 4 ? 'Very Good' : 'Excellent!'}
                            </Text>
                        )}
                        <View style={styles.ratingActions}>
                            <TouchableOpacity
                                style={[styles.ratingSubmitBtn, ratingStars === 0 && { opacity: 0.4 }]}
                                onPress={() => ratingStars > 0 && ratingMutation.mutate()}
                                disabled={ratingStars === 0 || ratingMutation.isPending}
                            >
                                {ratingMutation.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.ratingSubmitText}>Submit Rating</Text>}
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => {
                                    setShowRatingModal(false);
                                    router.push({
                                        pathname: '/booking/feedback' as any,
                                        params: {
                                            bookingId: id,
                                            bookingType: 'Service',
                                            childServiceId: (booking as any)?.childServiceId?._id || (booking as any)?.childServiceId,
                                            name: (booking as any)?.childServiceId?.name || 'Service',
                                        },
                                    });
                                }}
                            >
                                <Text style={styles.ratingDetailLink}>Write detailed review →</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => setShowRatingModal(false)}>
                                <Text style={styles.ratingSkipLink}>Maybe later</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* ── Cancel Confirmation Modal ── */}
            <Modal
                visible={showCancelConfirmModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowCancelConfirmModal(false)}
            >
                <View style={styles.confirmOverlay}>
                    <View style={styles.confirmBox}>
                        <View style={styles.confirmIconContainer}>
                            <XCircle size={40} color="#EF4444" />
                        </View>
                        <Text style={styles.confirmTitle}>Cancel Booking?</Text>
                        <Text style={styles.confirmSubtitle}>
                            Are you sure you want to cancel this booking? This action cannot be undone.
                        </Text>
                        <View style={styles.confirmActions}>
                            <TouchableOpacity
                                style={styles.confirmCancelBtn}
                                onPress={() => setShowCancelConfirmModal(false)}
                                disabled={isCancelling}
                            >
                                <Text style={styles.confirmCancelText}>No, Keep</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.confirmSubmitBtn}
                                onPress={async () => {
                                    if (isCancelling) return;
                                    try {
                                        setIsCancelling(true);
                                        await bookingsService.updateServiceBookingStatus(booking._id, 'CANCELLED');
                                        await refetch();
                                        triggerLocalNotification('Booking Cancelled', 'Your service booking has been cancelled.');
                                        setShowCancelConfirmModal(false);
                                    } catch (error: any) {
                                        showToast.error('Error', error?.response?.data?.message || 'Failed to cancel booking');
                                    } finally {
                                        setIsCancelling(false);
                                    }
                                }}
                                disabled={isCancelling}
                            >
                                {isCancelling ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <Text style={styles.confirmSubmitText}>Yes, Cancel</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
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
    timelineDotInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#fff' },
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

    // Rating modal
    ratingOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    ratingSheet: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        padding: 28,
        paddingBottom: 44,
        alignItems: 'center',
    },
    ratingTitle: { fontSize: FontSize.xl, fontWeight: '800', color: '#1F2A37', marginBottom: 6 },
    ratingSubtitle: { fontSize: FontSize.sm, color: '#6B7280', marginBottom: 28, textAlign: 'center' },
    starsRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
    star: { fontSize: 46 },
    starFilled: { color: '#F59E0B' },
    starEmpty: { color: '#D1D5DB' },
    ratingLabel: { fontSize: FontSize.base, fontWeight: '600', color: Colors.primary, marginBottom: 28 },
    ratingActions: { width: '100%', gap: 12, alignItems: 'center' },
    ratingSubmitBtn: {
        width: '100%',
        backgroundColor: Colors.primary,
        borderRadius: 16,
        height: 52,
        justifyContent: 'center',
        alignItems: 'center',
    },
    ratingSubmitText: { color: '#fff', fontSize: FontSize.base, fontWeight: '700' },
    ratingDetailLink: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: '600' },
    ratingSkipLink: { fontSize: FontSize.sm, color: '#9CA3AF' },

    confirmOverlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    confirmBox: {
        width: '100%',
        maxWidth: 340,
        backgroundColor: '#fff',
        borderRadius: 24,
        padding: 24,
        alignItems: 'center',
        ...Shadows.float,
        elevation: 24,
    },
    confirmIconContainer: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: '#FEF2F2',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    confirmTitle: {
        fontSize: FontSize.lg,
        fontWeight: '900',
        color: '#0F172A',
        marginBottom: 8,
        textAlign: 'center',
    },
    confirmSubtitle: {
        fontSize: FontSize.sm,
        color: '#64748B',
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 24,
    },
    confirmActions: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
    },
    confirmCancelBtn: {
        flex: 1,
        height: 48,
        borderRadius: 14,
        backgroundColor: '#F1F5F9',
        justifyContent: 'center',
        alignItems: 'center',
    },
    confirmCancelText: {
        fontSize: FontSize.sm,
        fontWeight: '700',
        color: '#475569',
    },
    confirmSubmitBtn: {
        flex: 1,
        height: 48,
        borderRadius: 14,
        backgroundColor: '#EF4444',
        justifyContent: 'center',
        alignItems: 'center',
    },
    confirmSubmitText: {
        fontSize: FontSize.sm,
        fontWeight: '700',
        color: '#fff',
    },
});
