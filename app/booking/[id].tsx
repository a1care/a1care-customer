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
import { socketService } from '@/services/socket.service';
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
import { MapPin, MessageSquare, XCircle, Clock3, Radio, ShieldCheck, Truck, CheckCircle2, Search, RotateCcw, CreditCard } from 'lucide-react-native';
import { triggerLocalNotification } from '@/utils/notifications';
import { showToast } from '@/utils/toast';
import { LinearGradient } from 'expo-linear-gradient';

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
        status === 'PAYMENT_PENDING' ? CreditCard :
        step?.key === 'pending' ? Clock3 :
        step?.key === 'partner_assigned' ? ShieldCheck :
        step?.key === 'broadcasted' ? Radio :
        step?.key === 'accepted' ? ShieldCheck :
        step?.key === 'in_progress' ? Truck :
        step?.key === 'completed' ? CheckCircle2 :
        Search;
    const heroLabel = status === 'RETURNED_TO_ADMIN' ? 'Re-scheduling' : step?.label ?? status.replace(/_/g, ' ');
    
    // Premium MNC Gradient Banner mapping
    const getGradient = () => {
        if (status === 'CANCELLED') return ['#FEF2F2', '#FEE2E2'];
        if (status === 'COMPLETED') return ['#F0FDF4', '#DCFCE7'];
        if (status === 'IN_PROGRESS' || status === 'ACCEPTED') return ['#EFF6FF', '#DBEAFE'];
        if (status === 'PAYMENT_PENDING') return ['#FFFBEB', '#FEF3C7'];
        if (status === 'BROADCASTED') return ['#F5EBFF', '#E9D5FF']; // Searching Provider
        return ['#F8FAFC', '#F1F5F9'];
    };

    const getTextColor = () => {
        if (status === 'CANCELLED') return '#991B1B';
        if (status === 'COMPLETED') return '#166534';
        if (status === 'IN_PROGRESS' || status === 'ACCEPTED') return '#1E40AF';
        if (status === 'PAYMENT_PENDING') return '#B45309';
        if (status === 'BROADCASTED') return '#6B21A8'; // Purple
        return '#0F172A';
    };

    return (
        <LinearGradient colors={getGradient()} style={styles.statusHero}>
            <View style={[styles.statusHeroIconWrap, { backgroundColor: 'rgba(255,255,255,0.6)' }]}>
                <HeroIcon size={28} color={getTextColor()} />
            </View>
            <View style={styles.statusHeroTextWrap}>
                <Text style={[styles.statusHeroLabel, { color: getTextColor() }]}>{heroLabel}</Text>
                {step?.desc ? <Text style={[styles.statusHeroDesc, { color: getTextColor() }]}>{step.desc}</Text> : null}
            </View>
        </LinearGradient>
    );
}

// ─── Timeline ─────────────────────────────────────────────────────────────────
function Timeline({ status }: { status: string }) {
    const currentIdx = STATUS_ORDER.indexOf(status);
    const isCancelled = status === 'CANCELLED';

    if (isCancelled) {
        return (
            <View style={[styles.card, styles.cancelledBox]}>
                <XCircle size={24} color="#EF4444" style={{ marginBottom: 8 }} />
                <Text style={styles.cancelledText}>This booking was cancelled</Text>
            </View>
        );
    }

    return (
        <View style={styles.card}>
            <Text style={styles.cardTitle}>Booking Progress</Text>
            <View style={styles.timelineContainer}>
                {STATUS_STEPS.map((s, idx) => {
                    const done = currentIdx > idx;
                    const active = currentIdx === idx;
                    const isLast = idx === STATUS_STEPS.length - 1;
                    
                    return (
                        <View key={s.status} style={styles.timelineRow}>
                            <View style={styles.timelineLeft}>
                                <View
                                    style={[
                                        styles.timelineDot,
                                        done && styles.timelineDotDone,
                                        active && styles.timelineDotActive,
                                    ]}
                                >
                                    {done ? (
                                        <Ionicons name="checkmark-sharp" size={14} color="#FFF" />
                                    ) : active ? (
                                        <View style={styles.timelineDotInnerActive} />
                                    ) : (
                                        <View style={styles.timelineDotInner} />
                                    )}
                                </View>
                                {!isLast && (
                                    <View style={[
                                        styles.timelineLine, 
                                        done && styles.timelineLineDone
                                    ]} />
                                )}
                            </View>
                            <View style={styles.timelineContent}>
                                <Text
                                    style={[
                                        styles.timelineLabel,
                                        active && styles.timelineLabelActive,
                                        done && styles.timelineLabelDone,
                                    ]}
                                >
                                    {s.label}
                                </Text>
                                {active && s.desc && (
                                    <Text style={styles.timelineDesc}>{s.desc}</Text>
                                )}
                            </View>
                        </View>
                    );
                })}
            </View>
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
        const socket = socketService.getSocket();
        if (!socket) return;
        
        socket.emit('join_room', id);
        
        const handleStatusUpdate = (data: { bookingId: string; status: string }) => {
            if (data.bookingId === id) refetch();
        };
        
        socket.on('booking_status_updated', handleStatusUpdate);
        
        return () => { 
            socket.off('booking_status_updated', handleStatusUpdate);
            socket.emit('leave_room', id);
        };
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
            doctorId: (booking as any)?.assignedProviderId?._id || (booking as any)?.assignedProviderId,
        }),
        onSuccess: () => {
            setShowRatingModal(false);
            qc.invalidateQueries({ queryKey: ['service-booking', id] });
            showToast.success('Thank You!', 'Your rating helps us improve.');
        },
        onError: (err: any) => { 
            showToast.error('Rating Failed', err?.response?.data?.message || 'Unable to submit your rating. Please try again.'); 
        },
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

    // Contact provider rules: ONLY show Chat/Track for ACCEPTED / IN_PROGRESS
    const showContactActions = booking && (booking.status === 'ACCEPTED' || booking.status === 'IN_PROGRESS');

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
                    style={styles.refreshBtn}
                    disabled={isRefetching || isManualRefreshing}
                >
                    {isRefetching || isManualRefreshing ? (
                        <ActivityIndicator size="small" color="#0B3370" />
                    ) : (
                        <RotateCcw size={18} color="#0B3370" />
                    )}
                </TouchableOpacity>
            </View>

            {isLoading ? (
                <View style={styles.centerLoader}>
                    <ActivityIndicator size="large" color="#0B3370" />
                    <Text style={styles.loaderText}>Loading details…</Text>
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
                        {(() => {
                            const isOnline = booking.paymentMode === 'ONLINE';
                            const isWallet = booking.paymentMode === 'WALLET';
                            const isPaid = booking.paymentStatus === 'COMPLETED';
                            const paymentLabel = isWallet ? 'Paid via Wallet' : isOnline ? (isPaid ? 'Paid online' : 'Online (pending)') : 'Cash on pay';

                            return [
                                { label: 'Booking ID', value: `#${booking._id.slice(-10).toUpperCase()}` },
                                { label: 'Status', value: <StatusBadge status={booking.status} size="sm" /> },
                                { label: 'Booked On', value: formatDateTime(booking.createdAt) },
                                { label: 'Address', value: getAddressText(booking) },
                                { label: 'Schedule', value: getScheduleText(booking) },
                                { label: 'Payment', value: paymentLabel },
                            ];
                        })().map((r, i, arr) => (
                            <View key={r.label} style={[styles.infoRow, i === arr.length - 1 && { borderBottomWidth: 0 }]}>
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

                    {/* Chat with Provider / Track Live — ONLY when accepted/in progress */}
                    {showContactActions && (
                        <View style={styles.card}>
                            <Text style={styles.cardTitle}>Contact Provider</Text>
                            <View style={styles.actionGrid}>
                                <TouchableOpacity
                                    style={styles.actionBtn}
                                    onPress={() => {
                                        const addr = booking.addressId;
                                        const lat = (addr && typeof addr === 'object') ? addr.location?.lat : booking.location?.lat;
                                        const lng = (addr && typeof addr === 'object') ? addr.location?.lng : booking.location?.lng;
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
                                    <View style={[styles.actionIcon, { backgroundColor: '#F0F9FF', borderColor: '#BAE6FD', borderWidth: 1 }]}>
                                        <MapPin size={22} color="#0284C7" />
                                    </View>
                                    <Text style={styles.actionLabel}>Track Live</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={styles.actionBtn}
                                    onPress={() => router.push({
                                        pathname: '/booking/chat' as any,
                                        params: {
                                            id: booking._id,
                                            name: (booking as any).assignedProviderId?.name || (booking as any).partnerId?.name || 'Service Provider',
                                            mobile: (booking as any).assignedProviderId?.mobile || (booking as any).partnerId?.mobile || ''
                                        }
                                    })}
                                >
                                    <View style={[styles.actionIcon, { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0', borderWidth: 1 }]}>
                                        <MessageSquare size={22} color="#16A34A" />
                                    </View>
                                    <Text style={styles.actionLabel}>Chat</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}

                    {/* Polling indicator */}
                    {shouldShowPollingNote ? (
                        <View style={styles.pollingNote}>
                            <Text style={styles.pollingText}>Status auto-updates every 12 seconds</Text>
                        </View>
                    ) : null}

                    {/* Actions */}
                    {booking.status === 'PENDING' || booking.status === 'BROADCASTED' || booking.status === 'ACCEPTED' ? (
                        <Button
                            label={isCancelling ? 'Cancelling...' : 'Cancel Booking'}
                            onPress={() => {
                                setShowCancelConfirmModal(true);
                            }}
                            variant="danger"
                            size="md"
                            fullWidth
                            disabled={isCancelling}
                            style={{ marginVertical: 8 }}
                        />
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
                                        doctorId: (booking as any).assignedProviderId?._id || (booking as any).assignedProviderId,
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
                                style={{ marginTop: 16 }}
                            />
                        </View>
                    )}

                    <View style={{ height: 60 }} />
                </ScrollView>
            )}
            
            {/* Rating Prompt Modal */}
            <Modal visible={showRatingModal} transparent animationType="slide" onRequestClose={() => setShowRatingModal(false)}>
                <View style={styles.ratingOverlay}>
                    <View style={styles.ratingSheet}>
                        <View style={styles.dragHandle} />
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
                                            doctorId: (booking as any)?.assignedProviderId?._id || (booking as any)?.assignedProviderId,
                                            name: (booking as any)?.childServiceId?.name || 'Service',
                                        },
                                    });
                                }}
                            >
                                <Text style={styles.ratingDetailLink}>Write detailed review</Text>
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
    root: { flex: 1, backgroundColor: '#F8FAFC' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 14,
        backgroundColor: '#FFFFFF',
    },
    backBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#F1F5F9',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: { fontSize: 17, fontWeight: '800', color: '#0F172A', flex: 1, textAlign: 'center' },
    refreshBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#EEF4FF',
        justifyContent: 'center',
        alignItems: 'center',
    },

    centerLoader: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
    loaderText: { color: '#64748B', fontSize: 15, fontWeight: '600' },

    scroll: { padding: 16, gap: 16 },

    // Status hero
    statusHero: {
        borderRadius: 24,
        padding: 20,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
    },
    statusHeroIconWrap: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
    statusHeroTextWrap: { flex: 1 },
    statusHeroLabel: { fontSize: 18, fontWeight: '800', marginBottom: 2 },
    statusHeroDesc: { fontSize: 13, fontWeight: '500', opacity: 0.9 },

    // Cards
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: 20,
        shadowColor: '#0A1A3A',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.06,
        shadowRadius: 16,
        elevation: 6,
    },
    cardTitle: { fontSize: 15, fontWeight: '900', color: '#0F172A', marginBottom: 16 },

    // Info rows
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
        gap: 12,
    },
    infoLabel: { fontSize: 13, color: '#64748B', flexShrink: 0, width: 90, fontWeight: '600' },
    infoValue: { fontSize: 14, fontWeight: '800', color: '#0F172A', flex: 1, textAlign: 'right' },

    // Timeline
    timelineContainer: {
        marginTop: 4,
    },
    timelineRow: { flexDirection: 'row', minHeight: 52 },
    timelineLeft: { alignItems: 'center', width: 32 },
    timelineDot: {
        width: 24,
        height: 24,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F1F5F9', // upcoming
        zIndex: 2,
    },
    timelineDotInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#CBD5E1' },
    timelineDotInnerActive: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#0B3370' },
    timelineDotActive: { backgroundColor: '#EEF4FF', borderWidth: 3, borderColor: '#BAE6FD' }, // active glow
    timelineDotDone: { backgroundColor: '#06B6D4' }, // solid cyan
    timelineLine: { width: 2, flex: 1, backgroundColor: '#E2E8F0', marginVertical: -2 },
    timelineLineDone: { backgroundColor: '#06B6D4' },
    timelineContent: { flex: 1, paddingLeft: 12, paddingBottom: 20 },
    timelineLabel: { fontSize: 14, color: '#94A3B8', fontWeight: '700' }, // slightly bolder but grey for upcoming
    timelineLabelActive: { color: '#0B3370', fontWeight: '900', fontSize: 15 },
    timelineLabelDone: { color: '#0F172A', fontWeight: '800' }, // dark grey instead of cyan to not look like a link
    timelineDesc: { fontSize: 13, color: '#64748B', marginTop: 4, fontWeight: '500', lineHeight: 18 },

    cancelledBox: { alignItems: 'center', padding: 24, backgroundColor: '#FEF2F2', borderColor: '#FCA5A5', borderWidth: 1 },
    cancelledText: { fontSize: 15, color: '#991B1B', fontWeight: '700', textAlign: 'center' },

    pollingNote: {
        backgroundColor: '#F8FAFC',
        borderRadius: 12,
        padding: 12,
        alignItems: 'center',
    },
    pollingText: { fontSize: 12, color: '#64748B', fontWeight: '600' },

    codReminderText: { fontSize: 13, color: '#64748B', textAlign: 'center', lineHeight: 20, marginBottom: 16, fontWeight: '500' },
    
    actionGrid: { flexDirection: 'row', gap: 16 },
    actionBtn: { flex: 1, alignItems: 'center', gap: 10 },
    actionIcon: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center' },
    actionLabel: { fontSize: 13, fontWeight: '700', color: '#0F172A' },

    // Rating modal
    ratingOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'flex-end' },
    ratingSheet: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        padding: 24,
        paddingBottom: Platform.OS === 'ios' ? 44 : 24,
        alignItems: 'center',
        shadowColor: '#000', shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.15, shadowRadius: 24, elevation: 24,
    },
    dragHandle: { width: 44, height: 4, borderRadius: 2, backgroundColor: '#CBD5E1', marginBottom: 24 },
    ratingTitle: { fontSize: 20, fontWeight: '900', color: '#0F172A', marginBottom: 8 },
    ratingSubtitle: { fontSize: 14, color: '#64748B', marginBottom: 28, textAlign: 'center', fontWeight: '500' },
    starsRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
    star: { fontSize: 44, letterSpacing: 4 },
    starFilled: { color: '#F59E0B' },
    starEmpty: { color: '#E2E8F0' },
    ratingLabel: { fontSize: 16, fontWeight: '800', color: '#0B3370', marginBottom: 32 },
    ratingActions: { width: '100%', gap: 16, alignItems: 'center' },
    ratingSubmitBtn: {
        width: '100%',
        backgroundColor: '#0B3370',
        borderRadius: 20,
        height: 56,
        justifyContent: 'center',
        alignItems: 'center',
    },
    ratingSubmitText: { color: '#fff', fontSize: 16, fontWeight: '900' },
    ratingDetailLink: { fontSize: 14, color: '#2563EB', fontWeight: '700' },
    ratingSkipLink: { fontSize: 14, color: '#94A3B8', fontWeight: '600' },

    confirmOverlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    confirmBox: {
        width: '100%',
        maxWidth: 340,
        backgroundColor: '#fff',
        borderRadius: 28,
        padding: 28,
        alignItems: 'center',
    },
    confirmIconContainer: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: '#FEF2F2',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    confirmTitle: {
        fontSize: 20,
        fontWeight: '900',
        color: '#0F172A',
        marginBottom: 10,
        textAlign: 'center',
    },
    confirmSubtitle: {
        fontSize: 14,
        color: '#64748B',
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 28,
        fontWeight: '500'
    },
    confirmActions: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
    },
    confirmCancelBtn: {
        flex: 1,
        height: 52,
        borderRadius: 16,
        backgroundColor: '#F1F5F9',
        justifyContent: 'center',
        alignItems: 'center',
    },
    confirmCancelText: {
        fontSize: 15,
        fontWeight: '800',
        color: '#475569',
    },
    confirmSubmitBtn: {
        flex: 1,
        height: 52,
        borderRadius: 16,
        backgroundColor: '#EF4444',
        justifyContent: 'center',
        alignItems: 'center',
    },
    confirmSubmitText: {
        fontSize: 15,
        fontWeight: '800',
        color: '#fff',
    },
});
