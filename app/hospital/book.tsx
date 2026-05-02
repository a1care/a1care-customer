import React, { useMemo, useState, useEffect } from 'react';
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
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { servicesService } from '@/services/services.service';
import { bookingsService } from '@/services/bookings.service';
import { Colors, Shadows } from '@/constants/colors';
import { FontSize } from '@/constants/spacing';
import { Button } from '@/components/ui/Button';

const DEPARTMENTS = [
    { id: 'ortho', name: 'Orthopaedics', icon: 'body-outline' },
    { id: 'pulmo', name: 'Pulmonology', icon: 'lungs-outline' },
    { id: 'cardio', name: 'Cardiology', icon: 'heart-outline' },
    { id: 'pedia', name: 'Paediatrics', icon: 'happy-outline' },
    { id: 'neuro', name: 'Neurology', icon: 'brain-outline' },
    { id: 'gyna', name: 'Gynaecology', icon: 'female-outline' },
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
    const [paymentMethod, setPaymentMethod] = useState<'OFFLINE'>('OFFLINE');
    const [step, setStep] = useState<'details' | 'payment'>('details');
    const [submitted, setSubmitted] = useState(false);

    // Fetch service detail
    const { data: service, isLoading } = useQuery({
        queryKey: ['child-service', id],
        queryFn: () => servicesService.getChildServiceById(id!),
        enabled: !!id,
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
            setSubmitted(true);
        },
        onError: (err: any) => {
            const msg = err?.response?.data?.message || err.message || 'Booking failed';
            Alert.alert('Booking Error', msg);
        }
    });

    const handleConfirm = async () => {
        if (step === 'details') {
            if (!selectedDept && !selectedSymptom) {
                Alert.alert('Select Reason', 'Please select a department or symptom to proceed.');
                return;
            }
            if (!selectedTime) {
                Alert.alert('Select Time', 'Please select a preferred time slot.');
                return;
            }
            setStep('payment');
        } else {
            bookMutation.mutate();
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
                        {/* 1. Specializations */}
                        <Text style={styles.sectionTitle}>Choose Specialization</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                            {DEPARTMENTS.map((dept) => (
                                <TouchableOpacity
                                    key={dept.id}
                                    style={[styles.deptCard, selectedDept === dept.id && styles.activeChip]}
                                    onPress={() => {
                                        setSelectedDept(dept.id);
                                        setSelectedSymptom('');
                                    }}
                                >
                                    <View style={[styles.deptIconBg, selectedDept === dept.id && { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                                        <Ionicons
                                            name={dept.icon as any}
                                            size={20}
                                            color={selectedDept === dept.id ? '#fff' : Colors.primary}
                                        />
                                    </View>
                                    <Text style={[styles.deptName, selectedDept === dept.id && { color: '#fff' }]}>{dept.name}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

                        {/* 2. Symptoms */}
                        <Text style={[styles.sectionTitle, { marginTop: 12 }]}>Common Symptoms (General)</Text>
                        <View style={styles.symptomGrid}>
                            {SYMPTOMS.map((sym) => (
                                <TouchableOpacity
                                    key={sym.id}
                                    style={[styles.symptomChip, selectedSymptom === sym.id && styles.activeChip]}
                                    onPress={() => {
                                        setSelectedSymptom(sym.id);
                                        setSelectedDept('');
                                    }}
                                >
                                    <Ionicons
                                        name={sym.icon as any}
                                        size={14}
                                        color={selectedSymptom === sym.id ? '#fff' : Colors.textSecondary}
                                    />
                                    <Text style={[styles.symptomText, selectedSymptom === sym.id && { color: '#fff' }]}>{sym.name}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* 3. Date Selection */}
                        <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Select Visit Date</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dateScroll}>
                            {dates.map((d) => (
                                <TouchableOpacity
                                    key={d.full}
                                    style={[styles.dateChip, selectedDate === d.full && styles.dateChipActive]}
                                    onPress={() => setSelectedDate(d.full)}
                                >
                                    <Text style={[styles.dateDay, selectedDate === d.full && { color: '#fff' }]}>{d.dayName}</Text>
                                    <Text style={[styles.dateNum, selectedDate === d.full && { color: '#fff' }]}>{d.dayNum}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

                        {/* 4. Time Selection */}
                        <Text style={styles.sectionTitle}>Select Preferred Slot</Text>
                        <View style={styles.timeGrid}>
                            {timeSlots.map((slot) => (
                                <TouchableOpacity
                                    key={slot}
                                    style={[styles.timeChip, selectedTime === slot && styles.timeChipActive]}
                                    onPress={() => setSelectedTime(slot)}
                                >
                                    <Text style={[styles.timeText, selectedTime === slot && { color: '#fff' }]}>{slot}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                        {timeSlots.length === 0 && (
                            <Text style={styles.noteText}>No slots remaining today. Please choose another date.</Text>
                        )}

                        <View style={styles.noteBox}>
                            <Text style={styles.noteText}>
                                <Ionicons name="information-circle" size={14} color={Colors.textSecondary} />
                                {" "}OP Registration fee of ₹{service?.price || 200} can be paid at the hospital counter.
                            </Text>
                        </View>
                    </>
                ) : (
                    <View style={{ gap: 20 }}>
                        <TouchableOpacity
                            style={[styles.payCard, styles.activePayCard]}
                            onPress={() => setPaymentMethod('OFFLINE')}
                        >
                            <View style={[styles.payIcon, { backgroundColor: Colors.primary }]}>
                                <Ionicons
                                    name="cash-outline"
                                    size={24}
                                    color="#fff"
                                />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.payTitle}>Pay at Hospital</Text>
                                <Text style={styles.paySub}>Pay directly at the OP desk</Text>
                            </View>
                            <View style={[styles.radio, styles.radioActive]}>
                                <View style={styles.radioInner} />
                            </View>
                        </TouchableOpacity>

                        <View style={styles.summaryBox}>
                            <Text style={styles.summaryTitle}>Booking Summary</Text>
                            <View style={styles.summaryRow}>
                                <Text style={styles.summaryLabel}>Registration Fee</Text>
                                <Text style={styles.summaryVal}>₹{service?.price || 200}</Text>
                            </View>
                            <View style={[styles.summaryRow, { borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 12, marginTop: 12 }]}>
                                <Text style={[styles.summaryLabel, { fontWeight: '700', color: Colors.textPrimary }]}>Total Payable</Text>
                                <Text style={[styles.summaryVal, { color: Colors.primary, fontSize: 18 }]}>₹{service?.price || 200}</Text>
                            </View>
                        </View>
                    </View>
                )}
                <View style={{ height: 40 }} />
            </ScrollView>

            <View style={styles.bottomBar}>
                <Button
                    label={bookMutation.isPending ? "Confirming..." : step === 'details' ? "Proceed to Payment" : "Complete OP Booking"}
                    onPress={handleConfirm}
                    disabled={bookMutation.isPending}
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
        marginBottom: 8,
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
});
