import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { servicesService } from '@/services/services.service';
import { useAuthStore } from '@/stores/auth.store';

export function ErrorBoundary({ error, retry }: { error: Error; retry: () => void }) {
    // Log to Metro console immediately
    console.error('[OP BOOKINGS ERROR BOUNDARY]', {
        name: error?.name,
        message: error?.message,
        stack: error?.stack,
    });

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#FFF1F2', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
            <Text style={{ fontSize: 13, fontWeight: '900', color: '#EF4444', textAlign: 'center', marginBottom: 6, letterSpacing: 1 }}>
                OP BOOKINGS ERROR
            </Text>
            <Text style={{ fontSize: 16, fontWeight: '800', color: '#991B1B', textAlign: 'center', marginBottom: 12 }}>
                {error?.name || 'Error'}
            </Text>
            <Text style={{ fontSize: 13, color: '#B91C1C', textAlign: 'center', marginBottom: 16, fontFamily: 'monospace' }}>
                {error?.message || 'Unknown error'}
            </Text>
            {__DEV__ && (
                <Text style={{ fontSize: 10, color: '#64748B', textAlign: 'left', marginBottom: 24, fontFamily: 'monospace' }} selectable>
                    {error?.stack?.slice(0, 600)}
                </Text>
            )}
            <TouchableOpacity onPress={retry} style={{ backgroundColor: '#2563EB', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 }}>
                <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>Try Again</Text>
            </TouchableOpacity>
        </SafeAreaView>
    );
}

const { width } = Dimensions.get('window');
const DEPARTMENTS = [
    { id: 'ortho', name: 'Orthopaedics', icon: 'bone' },
    { id: 'pulmo', name: 'Pulmonology', icon: 'lungs' },
    { id: 'cardio', name: 'Cardiology', icon: 'heart-pulse' },
    { id: 'pedia', name: 'Paediatrics', icon: 'baby-carriage' },
    { id: 'neuro', name: 'Neurology', icon: 'brain' },
    { id: 'gyna', name: 'Gynaecology', icon: 'gender-female' },
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

const slotToMinutes = (slot: string) => {
    const { hours, minutes } = parse12HourSlot(slot);
    return hours * 60 + minutes;
};

export default function HospitalBookingScreen() {
    const router = useRouter();
    const { id } = useLocalSearchParams<{ id: string }>();

    const [selectedDept, setSelectedDept] = useState('');
    const todayYmd = useMemo(() => toLocalYMD(new Date()), []);
    const [selectedDate, setSelectedDate] = useState(todayYmd);
    const [selectedTime, setSelectedTime] = useState('');

    const { data: service, isLoading } = useQuery({
        queryKey: ['child-service', id],
        queryFn: () => servicesService.getChildServiceById(id!),
        enabled: !!id && id !== '[id]',
    });

    const dates = useMemo(() => {
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        return Array.from({ length: 7 }, (_, i) => {
            const d = new Date();
            d.setDate(d.getDate() + i);
            return {
                full: toLocalYMD(d),
                dayName: dayNames[d.getDay()],
                dayNum: d.getDate(),
                month: monthNames[d.getMonth()],
            };
        });
    }, []);

    const timeSlots = useMemo(() => {
        if (selectedDate !== todayYmd) return SLOT_OPTIONS;
        const now = new Date();
        const nowMinutes = now.getHours() * 60 + now.getMinutes();
        return SLOT_OPTIONS.filter(slot => slotToMinutes(slot) > nowMinutes);
    }, [selectedDate, todayYmd]);

    useEffect(() => {
        if (selectedTime && !timeSlots.includes(selectedTime)) setSelectedTime('');
    }, [selectedDate, timeSlots]);

    // Booking & payment logic moved to payment.tsx

    const handleNext = () => {
        const isAuthenticated = useAuthStore.getState().isAuthenticated;
        if (!isAuthenticated) {
            Toast.show({ type: 'error', text1: 'Sign In Required', text2: 'Please sign in to continue.', onPress: () => router.push('/(auth)/login') });
            return;
        }

        if (!selectedDept) return Toast.show({ type: 'error', text1: 'Select Specialization' });
        if (!selectedTime) return Toast.show({ type: 'error', text1: 'Select Time Slot' });

        const deptName = DEPARTMENTS.find(d => d.id === selectedDept)?.name || 'General OP';
        
        router.push({
            pathname: '/op_bookings/payment' as any,
            params: {
                id: id,
                deptName: deptName,
                date: selectedDate,
                time: selectedTime,
                price: service?.price || 500
            }
        });
    };

    if (isLoading) {
        return (
            <SafeAreaView style={styles.root} edges={['top']}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                        <Ionicons name="arrow-back" size={24} color="#1E293B" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Reserve OP Token</Text>
                    <View style={{ width: 24 }} />
                </View>
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator size="large" color="#2563EB" />
                    <Text style={{ marginTop: 12, color: '#64748B' }}>Loading details...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.root} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#1E293B" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Reserve OP Token</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                
                {/* Hero Card */}
                <View style={styles.heroCard}>
                    <View style={styles.heroContent}>
                        <Text style={styles.heroTitle}>Book Consultation</Text>
                        <Text style={styles.heroSub}>Schedule an in-person visit with our top specialists.</Text>
                    </View>
                    <View style={styles.heroIconBg}>
                        <MaterialCommunityIcons name="asterisk" size={28} color="#1D4ED8" />
                    </View>
                </View>
                
                {/* Specialization */}
                <Text style={styles.sectionTitle}>Specialization</Text>
                <View style={styles.grid}>
                    {DEPARTMENTS.map((dept) => (
                        <TouchableOpacity
                            key={dept.id}
                            style={[styles.deptCard, selectedDept === dept.id && styles.deptCardActive]}
                            onPress={() => setSelectedDept(dept.id)}
                            activeOpacity={0.8}
                        >
                            <View style={styles.iconCircle}>
                                <MaterialCommunityIcons name={dept.icon as any} size={24} color="#2563EB" />
                            </View>
                            <Text style={styles.deptName} numberOfLines={1}>{dept.name}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Date & Time */}
                <Text style={styles.sectionTitle}>Date & Time</Text>
                
                {/* Dates */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dateScroll}>
                    {dates.map((d) => (
                        <TouchableOpacity
                            key={d.full}
                            style={[styles.dateCard, selectedDate === d.full && styles.dateCardActive]}
                            onPress={() => {
                                setSelectedDate(d.full);
                                setSelectedTime('');
                            }}
                        >
                            <Text style={[styles.monthName, selectedDate === d.full && styles.textWhite]}>{d.month.toUpperCase()}</Text>
                            <Text style={[styles.dayNum, selectedDate === d.full && styles.textWhite]}>{d.dayNum}</Text>
                            <Text style={[styles.dayName, selectedDate === d.full && styles.textWhite]}>{d.dayName}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                {/* Slots */}
                {timeSlots.length === 0 ? (
                    <View style={styles.noSlotsBox}>
                        <Text style={styles.noSlotsText}>No slots remaining today. Please choose another date.</Text>
                    </View>
                ) : (
                    <View style={styles.slotGrid}>
                        {timeSlots.map((slot) => (
                            <TouchableOpacity
                                key={slot}
                                style={[styles.slotCard, selectedTime === slot && styles.slotCardActive]}
                                onPress={() => setSelectedTime(slot)}
                            >
                                <Text style={[styles.slotText, selectedTime === slot && styles.textWhite]}>{slot}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}
            </ScrollView>

            <View style={styles.footer}>
                <TouchableOpacity 
                    style={[styles.nextBtn, (!selectedDept || !selectedTime) && { opacity: 0.7 }]} 
                    onPress={handleNext}
                >
                    <Text style={styles.nextBtnText}>Proceed to Payment</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#F8FAFC' },
    header: { 
        flexDirection: 'row', 
        justifyContent: 'space-between',
        alignItems: 'center', 
        padding: 16, 
        backgroundColor: '#FFFFFF',
    },
    backBtn: { padding: 4 },
    headerTitle: { fontSize: 16, fontWeight: '700', color: '#1E293B' },
    
    scroll: { flex: 1 },
    scrollContent: { padding: 16, paddingBottom: 40 },
    
    heroCard: {
        backgroundColor: '#EFF6FF',
        borderRadius: 16,
        padding: 20,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 24,
    },
    heroContent: { flex: 1, paddingRight: 16 },
    heroTitle: { fontSize: 18, fontWeight: '800', color: '#1E3A8A', marginBottom: 6 },
    heroSub: { fontSize: 13, color: '#3B82F6', lineHeight: 20, fontWeight: '500' },
    heroIconBg: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#DBEAFE', justifyContent: 'center', alignItems: 'center' },

    sectionTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A', marginBottom: 16 },
    
    grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 24 },
    deptCard: { 
        width: '31%',
        paddingVertical: 20,
        paddingHorizontal: 8,
        borderRadius: 16, 
        marginBottom: 12, 
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        borderWidth: 2, 
        borderColor: '#F1F5F9',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 8,
        elevation: 1,
    },
    deptCardActive: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
    iconCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
    deptName: { fontSize: 12, fontWeight: '700', color: '#1E293B', textAlign: 'center' },
    
    dateScroll: { flexDirection: 'row', marginBottom: 24 },
    dateCard: { 
        width: 70, 
        paddingVertical: 14, 
        borderRadius: 16, 
        backgroundColor: '#FFFFFF', 
        alignItems: 'center', 
        marginRight: 12, 
        borderWidth: 1, 
        borderColor: '#E2E8F0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 6,
        elevation: 1,
    },
    dateCardActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
    monthName: { fontSize: 11, fontWeight: '700', color: '#64748B', marginBottom: 6 },
    dayNum: { fontSize: 22, fontWeight: '800', color: '#0F172A', marginBottom: 4 },
    dayName: { fontSize: 12, fontWeight: '600', color: '#64748B' },
    textWhite: { color: '#FFFFFF' },
    
    slotGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start' },
    slotCard: { 
        width: '31%',
        paddingVertical: 14, 
        borderRadius: 12, 
        backgroundColor: '#FFFFFF', 
        borderWidth: 1, 
        borderColor: '#E2E8F0',
        alignItems: 'center',
        marginBottom: 12,
        marginRight: 8,
    },
    slotCardActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
    slotText: { fontSize: 13, fontWeight: '700', color: '#475569' },

    noSlotsBox: { backgroundColor: '#FEF2F2', padding: 16, borderRadius: 12, alignItems: 'center' },
    noSlotsText: { fontSize: 13, color: '#B91C1C', fontWeight: '600' },

    footer: { padding: 16, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#F1F5F9' },
    nextBtn: { backgroundColor: '#1E3A8A', paddingVertical: 18, borderRadius: 16, alignItems: 'center' },
    nextBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' }
});
