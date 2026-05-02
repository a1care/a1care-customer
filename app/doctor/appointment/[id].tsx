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
import { Colors, Shadows } from '@/constants/colors';
import { FontSize } from '@/constants/spacing';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/EmptyState';
import { formatDateTime } from '@/utils/formatters';
import { MapPin, MessageSquare, XCircle, Stethoscope } from 'lucide-react-native';

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_STEPS: Array<{ status: string; label: string; icon: string; desc: string }> = [
    { status: 'Pending', icon: '⏳', label: 'Pending', desc: 'Waiting for confirmation' },
    { status: 'Confirmed', icon: '✅', label: 'Confirmed', desc: 'Appointment confirmed' },
    { status: 'Completed', icon: '🎉', label: 'Completed', desc: 'Consultation finished' },
];

const STATUS_ORDER = STATUS_STEPS.map((s) => s.status);

const STATUS_BG: Record<string, string> = {
    Pending: '#FEF9C3',
    Confirmed: '#D1EFE0',
    Completed: '#D1FAE5',
    Cancelled: '#FEE2E2',
};

function StatusHero({ status }: { status: string }) {
    const step = STATUS_STEPS.find((s) => s.status === status);
    const bg = STATUS_BG[status] ?? '#F3F4F6';
    return (
        <View style={[styles.statusHero, { backgroundColor: bg }]}>
            <Text style={styles.statusHeroIcon}>{step?.icon ?? '🔵'}</Text>
            <Text style={styles.statusHeroLabel}>{step?.label ?? status}</Text>
            <Text style={styles.statusHeroDesc}>{step?.desc ?? ''}</Text>
        </View>
    );
}

function Timeline({ status }: { status: string }) {
    const currentIdx = STATUS_ORDER.indexOf(status);
    const isCancelled = status === 'Cancelled';

    if (isCancelled) {
        return (
            <View style={[styles.card, styles.cancelledBox]}>
                <Text style={styles.cancelledText}>❌ This appointment has been cancelled.</Text>
            </View>
        );
    }

    return (
        <View style={styles.card}>
            <Text style={styles.cardTitle}>Appointment Progress</Text>
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
                                {s.icon} {s.label}
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

export default function AppointmentDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();

    const { data: appt, isLoading, isError, refetch } = useQuery({
        queryKey: ['doctor-appointment', id],
        queryFn: () => bookingsService.getAppointmentById(id!),
        refetchInterval: 15000,
        retry: 2,
    });

    const handleBack = () => {
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/bookings');
        }
    };

    return (
        <SafeAreaView style={styles.root} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
                    <Text style={styles.backText}>←</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Appointment Details</Text>
                <TouchableOpacity onPress={() => refetch()} style={styles.refreshBtn}>
                    <Text style={styles.refreshText}>↻</Text>
                </TouchableOpacity>
            </View>

            {isLoading ? (
                <View style={styles.centerLoader}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                    <Text style={styles.loaderText}>Loading appointment…</Text>
                </View>
            ) : isError || !appt ? (
                <ErrorState
                    message="Could not load appointment details"
                    onRetry={() => refetch()}
                />
            ) : (
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
                    {/* Status Hero */}
                    <StatusHero status={appt.status} />

                    {/* Info Card */}
                    <View style={styles.card}>
                        <View style={styles.doctorHeader}>
                            <View style={styles.doctorIcon}>
                                <Stethoscope size={24} color={Colors.primary} />
                            </View>
                            <View>
                                <Text style={styles.doctorName}>Doctor Appointment</Text>
                                <Text style={styles.specialization}>General Physician</Text>
                            </View>
                        </View>

                        <View style={styles.divider} />

                        {(() => {
                            const isOnline = appt.paymentMode === 'ONLINE';
                            const isPaid = appt.paymentStatus === 'COMPLETED';
                            const paymentLabel = isOnline ? (isPaid ? 'Paid online' : 'Online (pending)') : 'Cash on pay';

                            return [
                                { label: 'Date', value: appt.date ? new Date(appt.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—' },
                                { 
                                    label: 'Time Slot', 
                                    value: appt.startingTime && appt.endingTime 
                                        ? `${appt.startingTime} - ${appt.endingTime}` 
                                        : (appt.timeSlot ?? '—') 
                                },
                                { label: 'Payment', value: paymentLabel },
                                { label: 'Amount', value: `₹${appt.totalAmount}` },
                            ];
                        })().map((r) => (
                            <View key={r.label} style={styles.infoRow}>
                                <Text style={styles.infoLabel}>{r.label}</Text>
                                <Text style={styles.infoValue}>{r.value}</Text>
                            </View>
                        ))}
                    </View>

                    {/* Timeline */}
                    <Timeline status={appt.status} />

                    {/* Actions */}
                    {appt.status === 'Completed' && (
                        <View style={styles.card}>
                            <Text style={styles.cardTitle}>Rate Your Experience</Text>
                            <Text style={styles.descText}>
                                Please share your feedback about the consultation.
                            </Text>
                            <Button
                                label="Write a Review"
                                onPress={() => {
                                    const dr = appt.doctorId;
                                    const drId = typeof dr === 'object' ? dr._id : dr;
                                    const drName = typeof dr === 'object' ? dr.name : 'Doctor';

                                    router.push({
                                        pathname: '/booking/feedback',
                                        params: {
                                            bookingId: appt._id,
                                            bookingType: 'Doctor',
                                            doctorId: drId,
                                            name: drName
                                        }
                                    });
                                }}
                                variant="outline"
                                size="sm"
                                style={{ marginTop: 12 }}
                            />
                        </View>
                    )}

                    {(appt.status === 'Pending' || appt.status === 'Confirmed') && (
                        <View style={styles.card}>
                            <Text style={styles.cardTitle}>Manage Appointment</Text>
                            <Button
                                label="Cancel Appointment"
                                icon={<XCircle size={18} color="#fff" />}
                                onPress={() => {
                                    import('react-native').then(({ Alert }) => {
                                        Alert.alert(
                                            'Cancel Appointment',
                                            'Are you sure you want to cancel this appointment?',
                                            [
                                                { text: 'No', style: 'cancel' },
                                                {
                                                    text: 'Yes, Cancel',
                                                    style: 'destructive',
                                                    onPress: async () => {
                                                        try {
                                                            await bookingsService.updateAppointmentStatus(appt._id, 'Cancelled');
                                                            refetch();
                                                        } catch (error: any) {
                                                            Alert.alert('Error', error?.response?.data?.message || 'Failed to cancel appointment');
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
                            />
                        </View>
                    )}

                    <View style={{ height: 40 }} />
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
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 14,
        backgroundColor: Colors.card,
        ...Shadows.card,
    },
    backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center' },
    backText: { fontSize: 20, color: Colors.textPrimary },
    headerTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary },
    refreshBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.primaryLight, justifyContent: 'center', alignItems: 'center' },
    refreshText: { fontSize: 20, color: Colors.primary, fontWeight: '700' },
    centerLoader: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
    loaderText: { color: Colors.textSecondary, fontSize: FontSize.base },
    scroll: { padding: 16, gap: 12 },
    statusHero: { borderRadius: 22, padding: 28, alignItems: 'center' },
    statusHeroIcon: { fontSize: 52, marginBottom: 12 },
    statusHeroLabel: { fontSize: FontSize['2xl'], fontWeight: '700', color: Colors.textPrimary, marginBottom: 6 },
    statusHeroDesc: { fontSize: FontSize.sm, color: Colors.textSecondary },
    card: { backgroundColor: Colors.card, borderRadius: 16, padding: 16, ...Shadows.card },
    cardTitle: { fontSize: FontSize.base, fontWeight: '700', color: Colors.textPrimary, marginBottom: 14 },
    doctorHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
    doctorIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.primaryLight, justifyContent: 'center', alignItems: 'center' },
    doctorName: { fontSize: FontSize.base, fontWeight: '700', color: Colors.textPrimary },
    specialization: { fontSize: 12, color: Colors.textSecondary },
    divider: { height: 1, backgroundColor: Colors.border, marginBottom: 16 },
    infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
    infoLabel: { fontSize: FontSize.sm, color: Colors.textSecondary },
    infoValue: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textPrimary },
    timelineRow: { flexDirection: 'row', marginBottom: 4, minHeight: 40 },
    timelineLeft: { alignItems: 'center', width: 32 },
    timelineDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.border, justifyContent: 'center', alignItems: 'center' },
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
    descText: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
});
