import React, { useMemo, useState, useEffect } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { servicesService } from '@/services/services.service';
import { bookingsService } from '@/services/bookings.service';
import { walletService } from '@/services/wallet.service';
import { paymentService } from '@/services/payment.service';
import { Colors, Shadows } from '@/constants/colors';
import { FontSize } from '@/constants/spacing';
import { Button } from '@/components/ui/Button';
import { triggerLocalNotification } from '@/utils/notifications';
import { showToast } from '@/utils/toast';
import { useAuthStore } from '@/stores/auth.store';
import RazorpayCheckout from 'react-native-razorpay';

const DEPARTMENTS = [
    { id: 'ortho', name: 'Orthopaedics', icon: 'bone' },
    { id: 'pulmo', name: 'Pulmonology', icon: 'lungs' },
    { id: 'cardio', name: 'Cardiology', icon: 'heart-pulse' },
    { id: 'pedia', name: 'Paediatrics', icon: 'baby-carriage' },
    { id: 'neuro', name: 'Neurology', icon: 'brain' },
    { id: 'gyna', name: 'Gynaecology', icon: 'gender-female' },
];

const SYMPTOMS = [
    { id: 'fever', name: 'Fever', icon: 'thermometer-outline' },
    { id: 'stomach', name: 'Stomach Ache', icon: 'medkit-outline' },
    { id: 'rashes', name: 'Skin Rashes', icon: 'bandage-outline' },
    { id: 'cough', name: 'Cough/Cold', icon: 'water-outline' },
    { id: 'headache', name: 'Headache', icon: 'flash-outline' },
];

const SLOT_OPTIONS = [
    '09:00 AM', '09:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM',
    '02:00 PM', '02:30 PM', '03:00 PM', '03:30 PM', '04:00 PM', '04:30 PM'
];

const toLocalYMD = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

const parse12HourSlot = (slot: string) => {
    const [timePart = '', meridiemRaw = 'AM'] = String(slot).trim().split(' ');
    const [hh = '0', mm = '0'] = timePart.split(':');
    let hours = Number(hh);
    const minutes = Number(mm);
    const meridiem = meridiemRaw.toUpperCase();

    if (meridiem === 'PM' && hours !== 12) hours += 12;
    if (meridiem === 'AM' && hours === 12) hours = 0;

    return { hours, minutes: Number.isNaN(minutes) ? 0 : minutes };
};

const buildScheduledIsoFromLocal = (dateYmd: string, slot: string) => {
    const [y, m, d] = dateYmd.split('-').map(Number);
    const { hours, minutes } = parse12HourSlot(slot);
    if (!y || !m || !d) return undefined;
    const localDate = new Date(y, m - 1, d, hours, minutes, 0, 0);
    return localDate.toISOString();
};

const formatLocalDateLabel = (dateYmd: string) => {
    const d = new Date(`${dateYmd}T00:00:00`);
    if (Number.isNaN(d.getTime())) return dateYmd;
    return d.toLocaleDateString('en-US', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });
};

const slotToMinutes = (slot: string) => {
    const [time, meridiem] = slot.split(' ');
    let [hh, mm] = time.split(':').map(Number);
    if (meridiem === 'PM' && hh !== 12) hh += 12;
    if (meridiem === 'AM' && hh === 12) hh = 0;
    return hh * 60 + mm;
};

export default function HospitalBookingScreen() {
    const router = useRouter();
    const { id } = useLocalSearchParams<{ id: string }>();
    const qc = useQueryClient();

    const [selectedDept, setSelectedDept] = useState('');
    const [selectedSymptom, setSelectedSymptom] = useState('');
    const todayYmd = useMemo(() => toLocalYMD(new Date()), []);
    const [selectedDate, setSelectedDate] = useState(todayYmd);
    const [selectedTime, setSelectedTime] = useState('');
    const [paymentMethod, setPaymentMethod] = useState<'OFFLINE' | 'ONLINE' | 'WALLET' | null>(null);
    const [step, setStep] = useState<'details' | 'payment'>('details');
    const [submitted, setSubmitted] = useState(false);
    const [submittingOnline, setSubmittingOnline] = useState(false);

    // Fetch wallet balance
    const { data: wallet } = useQuery({
        queryKey: ['wallet'],
        queryFn: walletService.getWallet,
    });

    // Fetch service detail
    const { data: service, isLoading } = useQuery({
        queryKey: ['child-service', id],
        queryFn: () => servicesService.getChildServiceById(id!),
        enabled: !!id && id !== '[id]',
    });

    // Date generation for next 7 days (local timezone-safe)
    const dates = useMemo(() => Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() + i);
        return {
            full: toLocalYMD(d),
            dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
            dayNum: d.getDate(),
            month: d.toLocaleDateString('en-US', { month: 'short' }),
        };
    }), []);

    // For today's date, hide elapsed slots based on current time
    const timeSlots = useMemo(() => {
        if (selectedDate !== todayYmd) return SLOT_OPTIONS;
        const now = new Date();
        const nowMinutes = now.getHours() * 60 + now.getMinutes();
        return SLOT_OPTIONS.filter(slot => slotToMinutes(slot) > nowMinutes);
    }, [selectedDate, todayYmd]);

    useEffect(() => {
        if (selectedTime && !timeSlots.includes(selectedTime)) {
            setSelectedTime('');
        }
    }, [selectedDate, selectedTime, timeSlots]);

    const bookMutation = useMutation({
        mutationFn: () => {
            const reason = selectedDept ? `Dept: ${DEPARTMENTS.find(d => d.id === selectedDept)?.name}` :
                selectedSymptom ? `Symptom: ${SYMPTOMS.find(s => s.id === selectedSymptom)?.name}` :
                    'General OP';

            const isoStr = (selectedDate && selectedTime)
                ? buildScheduledIsoFromLocal(selectedDate, selectedTime)
                : undefined;

            return bookingsService.createServiceBooking({
                childServiceId: id!,
                scheduledTime: isoStr,
                bookingType: 'SCHEDULED',
                fulfillmentMode: 'HOSPITAL_VISIT',
                price: service?.price || 0,
                paymentMode: paymentMethod,
                notes: reason
            });
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['service-bookings'] });
            qc.invalidateQueries({ queryKey: ['service-bookings-all'] });
            triggerLocalNotification(
                'OP Token Booked',
                selectedTime
                    ? `Your OP token is confirmed for ${formatLocalDateLabel(selectedDate)} at ${selectedTime}.`
                    : `Your OP token is confirmed for ${formatLocalDateLabel(selectedDate)}.`
            );
            setSubmitted(true);
        },
        onError: (err: any) => {
            const msg = err?.response?.data?.message || err.message || 'Booking failed';
            showToast.error('Booking Failed', msg);
        }
    });

    const handleConfirm = async () => {
        const isAuthenticated = useAuthStore.getState().isAuthenticated;
        if (!isAuthenticated) {
            Alert.alert(
                'Sign In Required',
                'Please sign in or create an account to complete your booking.',
                [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Sign In', onPress: () => router.push('/(auth)/login') }
                ]
            );
            return;
        }

        if (step === 'details') {
            if (!selectedDept) {
                showToast.warn('Select Specialization', 'Please select a specialization to proceed.');
                return;
            }
            if (!selectedTime) {
                showToast.warn('Select Time Slot', 'Please select a preferred time slot.');
                return;
            }
            setStep('payment');
        } else {
            if (!paymentMethod) {
                showToast.warn('Payment Method Required', 'Please select a payment method.');
                return;
            }
            const payableAmount = service?.price || 0;

            if (paymentMethod === 'WALLET') {
                const walletBalance = wallet?.balance ?? 0;
                if (walletBalance < payableAmount) {
                    Alert.alert(
                        'Insufficient Balance',
                        `Your wallet balance (₹${walletBalance}) is not enough for this payment (₹${payableAmount}). Please add funds or choose another payment method.`,
                        [{ text: 'OK' }]
                    );
                    return;
                }
                let createdBookingId: string | null = null;
                try {
                    setSubmittingOnline(true);
                    const booking = await bookMutation.mutateAsync();
                    createdBookingId = booking._id;
                    const order = await paymentService.createOrder({
                        amount: payableAmount,
                        type: "BOOKING",
                        referenceId: booking._id,
                    });
                    await paymentService.payWithWallet(order._id);
                    triggerLocalNotification(
                        'OP Token Booked',
                        selectedTime
                            ? `Your OP token is confirmed for ${formatLocalDateLabel(selectedDate)} at ${selectedTime}. Paid ₹${payableAmount} from wallet.`
                            : `Your OP token is confirmed for ${formatLocalDateLabel(selectedDate)}.`
                    );
                    qc.invalidateQueries({ queryKey: ['wallet'] });
                    qc.invalidateQueries({ queryKey: ['service-bookings'] });
                    qc.invalidateQueries({ queryKey: ['service-bookings-all'] });
                    setSubmitted(true);
                } catch (err: any) {
                    if (createdBookingId) {
                        bookingsService.updateServiceBookingStatus(createdBookingId, 'CANCELLED').catch(() => {});
                    }
                    const msg = err?.response?.data?.message || err?.message || 'Wallet payment failed. Please check your balance and try again.';
                    Alert.alert('Payment Error', msg);
                } finally {
                    setSubmittingOnline(false);
                }
            } else if (paymentMethod === 'ONLINE') {
                let createdBookingId: string | null = null;
                try {
                    setSubmittingOnline(true);
                    const booking = await bookMutation.mutateAsync();
                    createdBookingId = booking._id;
                    const order = await paymentService.createOrder({
                        amount: payableAmount,
                        type: "BOOKING",
                        referenceId: booking._id
                    });
                    const razorData = await paymentService.initiateRazorpay(order._id);
                    const data = await RazorpayCheckout.open({
                        key: razorData.key,
                        amount: razorData.razorOrder.amount,
                        currency: 'INR',
                        name: 'A1Care 24/7',
                        description: `Hospital Booking for ${service?.name}`,
                        order_id: razorData.razorOrder.id,
                        prefill: {
                            email: razorData.customer.email || '',
                            contact: razorData.customer.contact || '',
                            name: razorData.customer.name || '',
                        },
                        theme: { color: Colors.primary },
                    });
                    await paymentService.verifyRazorpay({
                        razorpay_order_id: (data as any).razorpay_order_id,
                        razorpay_payment_id: (data as any).razorpay_payment_id,
                        razorpay_signature: (data as any).razorpay_signature,
                        orderId: order._id,
                    });
                    triggerLocalNotification('Booking Confirmed', `Your booking for ${service?.name} is confirmed.`);
                    qc.invalidateQueries({ queryKey: ['appointments'] });
                    router.replace({
                        pathname: '/checkout/status' as any,
                        params: {
                            status: 'SUCCESS',
                            txnId: order.txnId,
                            amount: String(payableAmount),
                            type: 'BOOKING',
                            description: `Hospital Booking for ${service?.name}`,
                            bookingId: booking._id,
                            date: new Date().toISOString(),
                            providerName: '',
                        }
                    });
                } catch (err: any) {
                    if (createdBookingId) {
                        bookingsService.updateServiceBookingStatus(createdBookingId, 'CANCELLED').catch(() => {});
                    }
                    if (err.code === 2) {
                        showToast.warn('Payment Cancelled', 'You cancelled the payment. Your booking was not confirmed.');
                    } else {
                        router.replace({
                            pathname: '/checkout/status' as any,
                            params: {
                                status: 'FAILED',
                                amount: String(payableAmount),
                                type: 'BOOKING',
                                description: `Hospital Booking for ${service?.name}`,
                            },
                        });
                    }
                } finally {
                    setSubmittingOnline(false);
                }
            } else {
                bookMutation.mutate();
            }
        }
    };

    if (isLoading) {
        return (
            <SafeAreaView style={styles.root}>
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                </View>
            </SafeAreaView>
        );
    }

    if (submitted) {
        return (
            <SafeAreaView style={styles.root}>
                <View style={styles.successContainer}>
                    <View style={styles.successIcon}>
                        <Ionicons name="checkmark-circle" size={80} color={Colors.health} />
                    </View>
                    <Text style={styles.successTitle}>OP Token Reserved!</Text>
                    <Text style={styles.successSub}>Your visit at A1care Super-Speciality has been scheduled.</Text>

                    <View style={styles.opTicket}>
                        <View style={styles.ticketHeader}>
                            <Text style={styles.ticketLabel}>HOSPITAL PARTNER TOKEN</Text>
                            <Ionicons name="medical" size={20} color={Colors.health} />
                        </View>
                        <View style={styles.ticketBody}>
                            <View style={styles.ticketRow}>
                                <View style={{ flex: 1.2 }}>
                                    <Text style={styles.infoLabel}>DEPARTMENT / REASON</Text>
                                    <Text style={styles.infoValue}>
                                        {selectedDept ? DEPARTMENTS.find(d => d.id === selectedDept)?.name :
                                            selectedSymptom ? SYMPTOMS.find(s => s.id === selectedSymptom)?.name : 'General'}
                                    </Text>
                                </View>
                                <View style={{ flex: 1, alignItems: 'flex-end' }}>
                                    <Text style={styles.infoLabel}>DATE</Text>
                                    <Text style={styles.infoValue}>{formatLocalDateLabel(selectedDate)}</Text>
                                </View>
                            </View>
                            <View style={[styles.ticketRow, { marginTop: 16 }]}>
                                <View>
                                    <Text style={styles.infoLabel}>REPORTING TIME</Text>
                                    <Text style={styles.infoValue}>{selectedTime}</Text>
                                </View>
                                <View style={{ alignItems: 'flex-end' }}>
                                    <Text style={styles.infoLabel}>STATUS</Text>
                                    <Text style={[styles.infoValue, { color: Colors.health }]}>ACTIVE</Text>
                                </View>
                            </View>
                        </View>
                        <View style={styles.ticketFooter}>
                            <Text style={styles.footerText}>Show this screen at the OP Help Desk</Text>
                        </View>
                    </View>

                    <Button
                        label="View All Bookings"
                        onPress={() => router.push('/(tabs)/bookings')}
                        style={{ width: '100%', marginBottom: 12 }}
                    />
                    <Button
                        label="Back to Home"
                        variant="ghost"
                        onPress={() => router.push('/(tabs)')}
                        style={{ width: '100%' }}
                    />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.root}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => step === 'payment' ? setStep('details') : router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{step === 'payment' ? 'Payment Method' : 'Reserve OP Token'}</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                {step === 'details' ? (
                    <>
                        {/* Premium Header */}
                        <View style={{ marginBottom: 24, padding: 24, backgroundColor: '#EFF6FF', borderRadius: 24, overflow: 'hidden' }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                <View style={{ flex: 1, paddingRight: 16 }}>
                                    <Text style={{ fontSize: 22, fontWeight: '800', color: '#1E3A8A', marginBottom: 6 }}>Book Consultation</Text>
                                    <Text style={{ fontSize: 14, color: '#3B82F6', lineHeight: 20 }}>Schedule an in-person visit with our top specialists.</Text>
                                </View>
                                <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#DBEAFE', justifyContent: 'center', alignItems: 'center' }}>
                                    <Ionicons name="medical" size={32} color="#2563EB" />
                                </View>
                            </View>
                        </View>

                        {/* 1. Specializations */}
                        <Text style={[styles.sectionTitle, { fontSize: 18, fontWeight: '800', color: '#0F172A', marginBottom: 14 }]}>Specialization</Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 28 }}>
                            {DEPARTMENTS.map((dept) => (
                                <TouchableOpacity
                                    key={dept.id}
                                    style={[styles.premiumDeptCard, selectedDept === dept.id && styles.premiumDeptCardActive]}
                                    onPress={() => {
                                        setSelectedDept(dept.id);
                                        setSelectedSymptom('');
                                    }}
                                    activeOpacity={0.7}
                                >
                                    <View style={[styles.premiumDeptIcon, selectedDept === dept.id && styles.premiumDeptIconActive]}>
                                        <MaterialCommunityIcons
                                            name={dept.icon as any}
                                            size={28}
                                            color={selectedDept === dept.id ? '#fff' : '#3B82F6'}
                                        />
                                    </View>
                                    <Text style={[styles.premiumDeptName, selectedDept === dept.id && styles.premiumDeptNameActive]}>{dept.name}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* 3. Date Selection */}
                        <Text style={[styles.sectionTitle, { fontSize: 18, fontWeight: '800', color: '#0F172A', marginBottom: 14 }]}>Date & Time</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20, marginHorizontal: -20 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}>
                            {dates.map((d) => (
                                <TouchableOpacity
                                    key={d.full}
                                    style={[styles.premiumDateCard, selectedDate === d.full && styles.premiumDateCardActive]}
                                    onPress={() => setSelectedDate(d.full)}
                                    activeOpacity={0.7}
                                >
                                    <Text style={[styles.premiumDateMonth, selectedDate === d.full && { color: '#93C5FD' }]}>{d.month}</Text>
                                    <Text style={[styles.premiumDateNum, selectedDate === d.full && { color: '#fff' }]}>{d.dayNum}</Text>
                                    <Text style={[styles.premiumDateDay, selectedDate === d.full && { color: '#93C5FD' }]}>{d.dayName}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

                        {/* 4. Time Selection */}
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 }}>
                            {timeSlots.map((slot) => (
                                <TouchableOpacity
                                    key={slot}
                                    style={[styles.premiumTimeChip, selectedTime === slot && styles.premiumTimeChipActive]}
                                    onPress={() => setSelectedTime(slot)}
                                    activeOpacity={0.7}
                                >
                                    <Text style={[styles.premiumTimeText, selectedTime === slot && styles.premiumTimeTextActive]}>{slot}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                        {timeSlots.length === 0 && (
                            <View style={{ padding: 16, backgroundColor: '#FEF2F2', borderRadius: 12, marginBottom: 24 }}>
                                <Text style={{ fontSize: 13, color: '#991B1B', fontWeight: '500', textAlign: 'center' }}>No slots remaining today. Please choose another date.</Text>
                            </View>
                        )}
                    </>
                ) : (
                    <View style={{ gap: 20 }}>


                        {/* Premium Payment Header */}
                        <View style={{ marginBottom: 10 }}>
                            <Text style={{ fontSize: 22, fontWeight: '800', color: '#0F172A', marginBottom: 4 }}>Select Payment</Text>
                            <Text style={{ fontSize: 14, color: '#64748B' }}>Choose how you'd like to pay for your token</Text>
                        </View>

                        {/* Payment Method: A1 Wallet */}
                        <TouchableOpacity
                            style={[styles.premiumPayCard, paymentMethod === 'WALLET' && styles.premiumPayCardActive]}
                            onPress={() => setPaymentMethod('WALLET')}
                            activeOpacity={0.8}
                        >
                            <View style={[styles.premiumPayIcon, paymentMethod === 'WALLET' ? { backgroundColor: '#16A34A' } : { backgroundColor: '#F0FDF4' }]}>
                                <Ionicons name="wallet" size={24} color={paymentMethod === 'WALLET' ? '#fff' : '#16A34A'} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.premiumPayTitle, paymentMethod === 'WALLET' && { color: '#0F172A' }]}>A1 Wallet</Text>
                                <Text style={styles.premiumPaySub}>
                                    Balance: ₹{(wallet?.balance ?? 0).toFixed(2)}
                                </Text>
                            </View>
                            <View style={[styles.premiumRadio, paymentMethod === 'WALLET' && styles.premiumRadioActive]}>
                                {paymentMethod === 'WALLET' && <View style={styles.premiumRadioInner} />}
                            </View>
                        </TouchableOpacity>
                        
                        {/* Check Balance Logic */}
                        {paymentMethod === 'WALLET' && (wallet?.balance ?? 0) < (service?.price || 200) && (
                            <View style={{ marginTop: -8, backgroundColor: '#FEF2F2', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#FCA5A5' }}>
                                <Text style={{ color: '#991B1B', fontSize: 13, fontWeight: '600', textAlign: 'center' }}>⚠️ Insufficient wallet balance. Please top up or choose another method.</Text>
                            </View>
                        )}

                        {/* Payment Method: Online */}
                        <TouchableOpacity
                            style={[styles.premiumPayCard, paymentMethod === 'ONLINE' && styles.premiumPayCardActive]}
                            onPress={() => setPaymentMethod('ONLINE')}
                            activeOpacity={0.8}
                        >
                            <View style={[styles.premiumPayIcon, paymentMethod === 'ONLINE' ? { backgroundColor: '#2563EB' } : { backgroundColor: '#EFF6FF' }]}>
                                <Ionicons name="card" size={24} color={paymentMethod === 'ONLINE' ? '#fff' : '#2563EB'} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.premiumPayTitle, paymentMethod === 'ONLINE' && { color: '#0F172A' }]}>Pay Online / UPI</Text>
                                <Text style={styles.premiumPaySub}>GPay, PhonePe, Cards, Net Banking</Text>
                            </View>
                            <View style={[styles.premiumRadio, paymentMethod === 'ONLINE' && styles.premiumRadioActive]}>
                                {paymentMethod === 'ONLINE' && <View style={styles.premiumRadioInner} />}
                            </View>
                        </TouchableOpacity>

                        {/* Booking Summary */}
                        <View style={styles.premiumSummaryBox}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 8 }}>
                                <Ionicons name="receipt" size={20} color="#64748B" />
                                <Text style={styles.premiumSummaryTitle}>Booking Summary</Text>
                            </View>
                            <View style={styles.premiumSummaryRow}>
                                <Text style={styles.premiumSummaryLabel}>Consultation Fee</Text>
                                <Text style={styles.premiumSummaryVal}>₹{service?.price || 200}</Text>
                            </View>
                            <View style={styles.premiumSummaryRow}>
                                <Text style={styles.premiumSummaryLabel}>Platform Fee</Text>
                                <Text style={[styles.premiumSummaryVal, { color: '#16A34A' }]}>Free</Text>
                            </View>
                            
                            <View style={styles.premiumSummaryDivider} />
                            
                            <View style={styles.premiumSummaryRow}>
                                <Text style={[styles.premiumSummaryLabel, { fontWeight: '800', color: '#0F172A', fontSize: 16 }]}>Total Payable</Text>
                                <Text style={[styles.premiumSummaryVal, { color: '#2563EB', fontSize: 20, fontWeight: '900' }]}>₹{service?.price || 200}</Text>
                            </View>
                        </View>
                    </View>
                )}
                <View style={{ height: 40 }} />
            </ScrollView>

            <View style={styles.bottomBar}>
                <Button
                    label={
                        submittingOnline ? "Processing..." :
                        bookMutation.isPending ? "Confirming..." :
                        step === 'details' ? "Proceed to Payment" :
                        !paymentMethod ? "Select Payment Method" :
                        paymentMethod === 'ONLINE' ? "Pay Online" :
                        paymentMethod === 'WALLET' ? "Pay from Wallet" :
                        "Complete OP Booking"
                    }
                    onPress={handleConfirm}
                    disabled={bookMutation.isPending || submittingOnline}
                    fullWidth
                    size="lg"
                />
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: Colors.background },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: Colors.card,
        justifyContent: 'space-between',
        ...Shadows.card,
    },
    backBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#F8FAFC',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary },
    content: { padding: 20 },

    sectionTitle: { fontSize: FontSize.base, fontWeight: '700', color: Colors.textPrimary, marginBottom: 16 },

    // Departments
    chipScroll: { marginBottom: 20, marginLeft: -4 },
    deptCard: {
        backgroundColor: Colors.card,
        padding: 12,
        borderRadius: 16,
        marginHorizontal: 4,
        alignItems: 'center',
        width: 110,
        borderWidth: 1,
        borderColor: Colors.border,
        ...Shadows.card,
    },
    deptIconBg: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: Colors.primaryLight,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    deptName: { fontSize: 12, fontWeight: '600', color: Colors.textPrimary, textAlign: 'center' },
    activeChip: { backgroundColor: Colors.primary, borderColor: Colors.primary },

    // Symptoms
    symptomGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
    symptomChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 16,
        backgroundColor: Colors.card,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: Colors.border,
        gap: 6,
    },
    symptomText: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },

    // Date/Time
    dateScroll: { marginBottom: 20, marginLeft: -4 },
    dateChip: {
        width: 60,
        height: 70,
        backgroundColor: Colors.card,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginHorizontal: 4,
        borderWidth: 1,
        borderColor: Colors.border,
        ...Shadows.card,
    },
    dateChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
    dateDay: { fontSize: 12, color: Colors.textSecondary, marginBottom: 4 },
    dateNum: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },

    timeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
    timeChip: {
        paddingVertical: 12,
        paddingHorizontal: 16,
        backgroundColor: Colors.card,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: Colors.border,
        width: '31%',
        alignItems: 'center',
    },
    timeChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
    timeText: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary },

    noteBox: {
        backgroundColor: '#F8FAFC',
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    noteText: { fontSize: 13, color: Colors.textSecondary, lineHeight: 20 },

    bottomBar: {
        padding: 20,
        backgroundColor: Colors.card,
        ...Shadows.float,
    },

    // Success
    successContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    successIcon: { marginBottom: 20 },
    successTitle: { fontSize: 26, fontWeight: '800', color: Colors.textPrimary, marginBottom: 8 },
    successSub: { fontSize: FontSize.base, color: Colors.textSecondary, textAlign: 'center', marginBottom: 32 },
    opTicket: {
        width: '100%',
        backgroundColor: '#fff',
        borderRadius: 20,
        borderWidth: 2,
        borderColor: Colors.border,
        borderStyle: 'dashed',
        overflow: 'hidden',
        marginBottom: 32,
    },
    ticketHeader: {
        backgroundColor: '#F8FAFC',
        padding: 16,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    ticketLabel: { fontSize: 10, fontWeight: '800', color: Colors.muted, letterSpacing: 1 },
    ticketBody: { padding: 20 },
    ticketRow: { flexDirection: 'row', justifyContent: 'space-between' },
    infoLabel: { fontSize: 10, fontWeight: '700', color: Colors.textSecondary, marginBottom: 4 },
    infoValue: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
    ticketFooter: { backgroundColor: '#F0F9FF', padding: 12, alignItems: 'center' },
    footerText: { fontSize: 12, fontWeight: '600', color: Colors.primary },

    // Payment Styles
    payCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 18,
        backgroundColor: Colors.card,
        borderRadius: 20,
        borderWidth: 1.5,
        borderColor: Colors.border,
        gap: 16,
        ...Shadows.card,
    },
    activePayCard: {
        backgroundColor: '#F0F7FF',
        borderColor: Colors.primary,
        borderWidth: 2,
    },
    payIcon: {
        width: 52,
        height: 52,
        borderRadius: 14,
        backgroundColor: Colors.primaryLight,
        justifyContent: 'center',
        alignItems: 'center',
    },
    payTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: Colors.textPrimary,
    },
    paySub: {
        fontSize: 13,
        color: Colors.textSecondary,
        marginTop: 2,
    },
    radio: {
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 2,
        borderColor: Colors.border,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fff',
    },
    radioActive: {
        borderColor: Colors.primary,
    },
    radioInner: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: Colors.primary,
    },
    summaryBox: {
        marginTop: 12,
        backgroundColor: Colors.card,
        padding: 22,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: Colors.border,
        ...Shadows.card,
    },
    summaryTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: Colors.textPrimary,
        marginBottom: 16,
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    summaryLabel: {
        fontSize: 14,
        color: Colors.textSecondary,
    },
    summaryVal: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.textPrimary,
    },

    // Premium UI Overrides
    premiumDeptCard: {
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 20,
        alignItems: 'center',
        width: '31%',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 10,
        elevation: 2,
    },
    premiumDeptCardActive: {
        backgroundColor: '#2563EB',
        borderColor: '#2563EB',
        shadowColor: '#2563EB',
        shadowOpacity: 0.2,
    },
    premiumDeptIcon: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: '#EFF6FF',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    premiumDeptIconActive: {
        backgroundColor: 'rgba(255,255,255,0.2)',
    },
    premiumDeptName: {
        fontSize: 13,
        fontWeight: '700',
        color: '#1E293B',
        textAlign: 'center',
    },
    premiumDeptNameActive: {
        color: '#ffffff',
    },
    premiumSymptomChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 16,
        backgroundColor: '#fff',
        borderRadius: 100,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        gap: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 6,
        elevation: 1,
    },
    premiumSymptomChipActive: {
        backgroundColor: '#1E293B',
        borderColor: '#1E293B',
    },
    premiumSymptomText: {
        fontSize: 14,
        color: '#475569',
        fontWeight: '600',
    },
    premiumSymptomTextActive: {
        color: '#fff',
    },
    premiumDateCard: {
        width: 68,
        height: 84,
        backgroundColor: '#fff',
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
    },
    premiumDateCardActive: {
        backgroundColor: '#2563EB',
        borderColor: '#2563EB',
        shadowColor: '#2563EB',
        shadowOpacity: 0.25,
    },
    premiumDateMonth: { fontSize: 11, fontWeight: '700', color: '#64748B', textTransform: 'uppercase', marginBottom: 2 },
    premiumDateNum: { fontSize: 22, fontWeight: '800', color: '#0F172A', marginBottom: 2 },
    premiumDateDay: { fontSize: 12, fontWeight: '600', color: '#64748B' },
    premiumTimeChip: {
        paddingVertical: 14,
        paddingHorizontal: 16,
        backgroundColor: '#fff',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        width: '31%',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 4,
        elevation: 1,
    },
    premiumTimeChipActive: {
        backgroundColor: '#2563EB',
        borderColor: '#2563EB',
    },
    premiumTimeText: { fontSize: 14, fontWeight: '700', color: '#475569' },
    premiumTimeTextActive: { color: '#fff' },

    // Premium Payment Styles
    premiumPayCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 20,
        backgroundColor: '#fff',
        borderRadius: 24,
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
        gap: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.03,
        shadowRadius: 10,
        elevation: 2,
    },
    premiumPayCardActive: {
        backgroundColor: '#F8FAFC',
        borderColor: '#2563EB',
        shadowColor: '#2563EB',
        shadowOpacity: 0.1,
    },
    premiumPayIcon: {
        width: 52,
        height: 52,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    premiumPayTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: '#334155',
    },
    premiumPaySub: {
        fontSize: 13,
        fontWeight: '500',
        color: '#64748B',
        marginTop: 4,
    },
    premiumRadio: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#CBD5E1',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fff',
    },
    premiumRadioActive: {
        borderColor: '#2563EB',
    },
    premiumRadioInner: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#2563EB',
    },
    premiumSummaryBox: {
        marginTop: 12,
        backgroundColor: '#F8FAFC',
        padding: 24,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    premiumSummaryTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: '#0F172A',
    },
    premiumSummaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    premiumSummaryLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#475569',
    },
    premiumSummaryVal: {
        fontSize: 15,
        fontWeight: '800',
        color: '#0F172A',
    },
    premiumSummaryDivider: {
        height: 1,
        backgroundColor: '#E2E8F0',
        marginVertical: 16,
    },
});
