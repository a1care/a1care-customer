import React, { useState, useMemo, useEffect } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { doctorsService } from '@/services/doctors.service';
import { bookingsService } from '@/services/bookings.service';
import { walletService } from '@/services/wallet.service';
import { paymentService } from '@/services/payment.service';
import { Colors, Shadows } from '@/constants/colors';
import { FontSize } from '@/constants/spacing';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/EmptyState';
import { formatCurrency } from '@/utils/formatters';
import { triggerLocalNotification } from '@/utils/notifications';

const toLocalYMD = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

const formatSlotTimeLocal = (raw: string) => {
    const value = String(raw || '').trim();
    if (!value) return value;

    if (/[AaPp][Mm]/.test(value)) return value;

    if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(value)) {
        const [hStr, mStr] = value.split(':');
        const h = Number(hStr);
        const m = Number(mStr);
        if (!Number.isNaN(h) && !Number.isNaN(m)) {
            const dt = new Date();
            dt.setHours(h, m, 0, 0);
            return dt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
        }
    }

    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
        return parsed.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    }

    return value;
};

export default function DoctorBookingScreen() {
    const { id, serviceName: nameParam } = useLocalSearchParams<{ id: string; serviceName?: string }>();
    const router = useRouter();
    const qc = useQueryClient();

    const [selectedDate, setSelectedDate] = useState(() => toLocalYMD(new Date()));
    const [selectedSlot, setSelectedSlot] = useState<{ startingTime: string; endingTime: string } | null>(null);
    const [paymentMethod, setPaymentMethod] = useState<'COD' | 'WALLET' | 'ONLINE'>('COD');
    const [chosenSpecialization, setChosenSpecialization] = useState<string>(nameParam || "");

    // 1. Fetch Doctor Details (Dynamic Price)
    const { data: doctor, isLoading: doctorLoading, isError: doctorError, refetch: refetchDoctor } = useQuery({
        queryKey: ['doctor', id],
        queryFn: () => doctorsService.getById(id!),
        enabled: !!id,
    });

    useEffect(() => {
        if (doctor && !chosenSpecialization) {
            if (doctor.specialization && doctor.specialization.length > 0) {
                setChosenSpecialization(doctor.specialization[0]);
            }
        }
    }, [doctor]);

    // 2. Fetch Slots with 12s polling
    const { data: slots, isLoading: slotsLoading, isError: slotsError, refetch: refetchSlots, isFetching: isFetchingSlots } = useQuery({
        queryKey: ['slots', id, selectedDate],
        queryFn: () => doctorsService.getSlots(id!, selectedDate),
        enabled: !!id && !!selectedDate,
        refetchInterval: 12000,
    });

    const { data: wallet } = useQuery({
        queryKey: ['wallet'],
        queryFn: walletService.getWallet,
    });

    // Dates for the next 7 days
    const dates = useMemo(() => Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() + i);
        return toLocalYMD(d);
    }), []);

    // Booking mutation
    const bookMutation = useMutation({
        mutationFn: (slot: { startingTime: string; endingTime: string }) =>
            bookingsService.bookDoctor(id!, {
                date: selectedDate,
                startingTime: slot.startingTime,
                endingTime: slot.endingTime,
                paymentMode: paymentMethod === 'WALLET' ? 'ONLINE' : 'OFFLINE',
                serviceName: chosenSpecialization || "Doctor Consultation"
            }),
        onSuccess: () => {
            const prettyDate = new Date(`${selectedDate}T00:00:00`).toLocaleDateString([], {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
                year: 'numeric',
            });
            const prettyTime = selectedSlot ? formatSlotTimeLocal(selectedSlot.startingTime) : '';
            triggerLocalNotification(
                'Appointment Booking Placed',
                `Your appointment with Dr. ${doctor?.name} is placed for ${prettyDate} at ${prettyTime}.`
            );
            Alert.alert('Appointment Booking Placed', `Your appointment with Dr. ${doctor?.name} is placed for ${prettyDate} at ${prettyTime}.`, [
                { text: 'View Bookings', onPress: () => router.push('/bookings') },
                { text: 'OK', onPress: () => router.replace('/(tabs)') },
            ]);
            qc.invalidateQueries({ queryKey: ['appointments'] });
        },
        onError: (err: any) => {
            Alert.alert('Booking Failed', err?.response?.data?.message ?? 'Could not book appointment. Please try again.');
        },
    });

    const handleBook = async () => {
        if (!selectedSlot) {
            Alert.alert('Select Slot', 'Please choose a time slot to continue.');
            return;
        }

        /* 
        if (paymentMethod === 'WALLET' && (wallet?.balance ?? 0) < (doctor?.consultationFee ?? 0)) {
            Alert.alert('Insufficient Balance', 'Your wallet balance is lower than the consultation fee. Please top up or use COD.');
            return;
        }

        if (paymentMethod === 'ONLINE') {
            try {
                // ... online payment integration commented out
            } catch (err: any) {
                // ...
            }
        } else {
        */
        // Default to COD flow
        bookMutation.mutate(selectedSlot);
        // }
    };

    if (doctorError) return <ErrorState message="Could not find doctor context" onRetry={refetchDoctor} />;

    return (
        <SafeAreaView style={styles.root} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Text style={styles.backText}>←</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Select Slot</Text>
                <View style={{ width: 44 }} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
                {/* Doctor Info */}
                <View style={styles.infoBox}>
                    <Text style={styles.infoLabel}>Consulting with</Text>
                    <Text style={styles.doctorName}>Dr. {doctor?.name || '...'}</Text>
                    {doctor?.workingHours && (
                        <View style={styles.workingBadge}>
                            <Text style={styles.workingBadgeText}>🕒 {doctor.workingHours}</Text>
                        </View>
                    )}
                </View>

                {/* Date Selector */}
                <Text style={styles.sectionTitle}>Select Date</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dateList}>
                    {dates.map((date) => {
                        const d = new Date(`${date}T00:00:00`);
                        const isSelected = selectedDate === date;
                        return (
                            <TouchableOpacity
                                key={date}
                                style={[styles.dateCard, isSelected ? styles.dateCardActive : {}]}
                                onPress={() => {
                                    setSelectedDate(date);
                                    setSelectedSlot(null);
                                }}
                            >
                                <Text style={[styles.dayText, isSelected ? styles.dayTextActive : {}]}>
                                    {d.toLocaleDateString('en-US', { weekday: 'short' })}
                                </Text>
                                <Text style={[styles.numText, isSelected ? styles.numTextActive : {}]}>
                                    {d.getDate()}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>

                {/* Slot Selector */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Available Slots</Text>
                    {isFetchingSlots && <ActivityIndicator size="small" color={Colors.primary} />}
                </View>

                {slotsLoading ? (
                    <ActivityIndicator size="small" color={Colors.primary} style={{ marginTop: 20 }} />
                ) : slotsError ? (
                    <ErrorState message="Failed to load slots" onRetry={refetchSlots} />
                ) : (slots ?? []).length === 0 ? (
                    <View style={styles.emptySlots}>
                        <Text style={styles.emptySlotsIcon}>🌙</Text>
                        <Text style={styles.emptySlotsText}>No slots available for this day.</Text>
                        <Text style={styles.emptySlotsSub}>Please try another date.</Text>
                    </View>
                ) : (
                    <View style={styles.slotsGrid}>
                        {slots!.map((slot) => {
                            const isSelected = selectedSlot?.startingTime === slot.startingTime;
                            return (
                                <TouchableOpacity
                                    key={slot.startingTime}
                                    style={[styles.slotCard, isSelected ? styles.slotCardActive : {}]}
                                    onPress={() => setSelectedSlot(slot)}
                                    activeOpacity={0.8}
                                >
                                    <Text style={[styles.slotText, isSelected ? styles.slotTextActive : {}]}>
                                        {formatSlotTimeLocal(slot.startingTime)}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                )}

                {/* Concurrency Disclaimer */}
                <View style={styles.disclaimerBox}>
                    <Text style={styles.disclaimerIcon}>ℹ️</Text>
                    <Text style={styles.disclaimerText}>
                        Slots are shared and can be booked by multiple users concurrently. Selection does not guarantee availability until booking is confirmed.
                    </Text>
                </View>

                {/* Payment Method Selector */}
                <Text style={[styles.sectionTitle, { marginTop: 32 }]}>Payment Method</Text>
                <View style={styles.paymentMethods}>
                    <TouchableOpacity
                        style={[styles.payCard, styles.payCardActive]}
                        onPress={() => setPaymentMethod('COD')}
                    >
                        {/* <Text style={styles.payIcon}>💵</Text> */}
                        <View style={{ flex: 1 }}>
                            <Text style={styles.payLabel}>Cash on Pay</Text>
                            <Text style={styles.paySub}>Pay at clinic/home</Text>
                        </View>
                        <View style={[styles.radio, styles.radioActive]}>
                            <View style={styles.radioInner} />
                        </View>
                    </TouchableOpacity>
                </View>

                <View style={{ height: 180 }} />
            </ScrollView>

            {/* Footer */}
            <View style={styles.footer}>
                <View style={styles.priceRow}>
                    <Text style={styles.priceLabel}>Consultation Fee</Text>
                    <Text style={styles.priceVal}>{doctor?.consultationFee ? `₹${doctor.consultationFee}` : '...'}</Text>
                </View>
                <Button
                    label={paymentMethod === 'WALLET' ? 'Book & Pay from Wallet' : paymentMethod === 'ONLINE' ? 'Confirm & Pay Online' : 'Confirm & Book (COD)'}
                    onPress={handleBook}
                    loading={bookMutation.isPending}
                    disabled={!selectedSlot || !doctor}
                    variant="primary"
                    size="lg"
                    fullWidth
                />
                <Text style={styles.footerNote}>
                    {paymentMethod === 'WALLET' ? 'Amount will be deducted from your wallet' : paymentMethod === 'ONLINE' ? 'You will be redirected to Easebuzz gateway' : 'Pay at clinic / home after consultation'}
                </Text>
            </View>
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
    backBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: Colors.background,
        justifyContent: 'center',
        alignItems: 'center',
    },
    backText: { fontSize: 24, color: Colors.textPrimary },
    headerTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary },

    scroll: { padding: 16 },

    infoBox: {
        backgroundColor: Colors.card,
        borderRadius: 16,
        padding: 16,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    infoLabel: { fontSize: 12, color: Colors.textSecondary, marginBottom: 4 },
    doctorName: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary },

    sectionTitle: { fontSize: FontSize.base, fontWeight: '700', color: Colors.textPrimary, marginBottom: 16 },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },

    dateList: { marginBottom: 24 },
    dateCard: {
        width: 60,
        height: 80,
        borderRadius: 16,
        backgroundColor: Colors.card,
        marginRight: 10,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: Colors.border,
    },
    dateCardActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
    dayText: { fontSize: 12, color: Colors.textSecondary, marginBottom: 4 },
    dayTextActive: { color: 'rgba(255,255,255,0.8)' },
    numText: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary },
    numTextActive: { color: '#fff' },

    slotsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    slotCard: {
        width: '31%',
        paddingVertical: 12,
        borderRadius: 12,
        backgroundColor: Colors.card,
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: Colors.border,
    },
    slotCardActive: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
    slotText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textPrimary },
    slotTextActive: { color: Colors.primary },

    emptySlots: { alignItems: 'center', paddingVertical: 40 },
    emptySlotsIcon: { fontSize: 40, marginBottom: 12 },
    emptySlotsText: { fontSize: FontSize.base, fontWeight: '600', color: Colors.textPrimary },
    emptySlotsSub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 4 },

    disclaimerBox: {
        flexDirection: 'row',
        backgroundColor: '#F7FEE7',
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#D9F99D',
        marginTop: 32,
        gap: 10,
    },
    disclaimerIcon: { fontSize: 16 },
    disclaimerText: { flex: 1, fontSize: 11, color: '#3F6212', lineHeight: 16 },

    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: 16,
        paddingBottom: 32,
        backgroundColor: Colors.card,
        ...Shadows.float,
        gap: 12,
    },
    priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    priceLabel: { fontSize: FontSize.sm, color: Colors.textSecondary },
    priceVal: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary },
    footerNote: { textAlign: 'center', fontSize: 10, color: Colors.muted },

    paymentMethods: { gap: 12 },
    payCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 16,
        backgroundColor: Colors.card,
        borderWidth: 1.5,
        borderColor: Colors.border,
        gap: 16,
    },
    payCardActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight + '20' },
    payIcon: { fontSize: 24 },
    payLabel: { fontSize: FontSize.base, fontWeight: '700', color: Colors.textPrimary },
    paySub: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
    radio: {
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 2,
        borderColor: Colors.border,
        justifyContent: 'center',
        alignItems: 'center',
    },
    radioActive: { borderColor: Colors.primary },
    radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primary },

    workingBadge: {
        backgroundColor: '#F8FAFC',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        marginTop: 8,
        alignSelf: 'flex-start',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    workingBadgeText: {
        fontSize: 12,
        fontWeight: '600',
        color: Colors.health,
    },
});

