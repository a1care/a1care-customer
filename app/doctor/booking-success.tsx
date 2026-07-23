import React, { useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Animated,
    Easing,
    ScrollView,
    Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';

export default function BookingSuccessScreen() {
    const router = useRouter();
    const {
        bookingId,
        doctorName,
        date,
        timeSlot,
        amount,
        paymentMode,
    } = useLocalSearchParams<{
        bookingId: string;
        doctorName: string;
        date: string;
        timeSlot: string;
        amount: string;
        paymentMode: string;
    }>();

    // Animations
    const scaleAnim = useRef(new Animated.Value(0)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(40)).current;
    const checkScale = useRef(new Animated.Value(0)).current;
    const ringAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        // Ripple ring
        Animated.loop(
            Animated.sequence([
                Animated.timing(ringAnim, { toValue: 1, duration: 1500, useNativeDriver: true, easing: Easing.out(Easing.ease) }),
                Animated.timing(ringAnim, { toValue: 0, duration: 0, useNativeDriver: true }),
            ])
        ).start();

        // Main content entrance
        Animated.sequence([
            Animated.spring(scaleAnim, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }),
            Animated.spring(checkScale, { toValue: 1, friction: 5, tension: 100, useNativeDriver: true }),
            Animated.parallel([
                Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
                Animated.spring(slideAnim, { toValue: 0, friction: 7, tension: 60, useNativeDriver: true }),
            ]),
        ]).start();
    }, []);

    const ringScale = ringAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] });
    const ringOpacity = ringAnim.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0.5, 0.1, 0] });

    const formattedDate = date
        ? new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', {
              weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
          })
        : '';

    return (
        <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
            <LinearGradient
                colors={['#F0FDF4', '#FFFFFF', '#FFFFFF']}
                style={StyleSheet.absoluteFillObject}
            />

            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

                {/* Success Icon */}
                <View style={styles.iconSection}>
                    {/* Ripple ring */}
                    <Animated.View style={[styles.ring, { transform: [{ scale: ringScale }], opacity: ringOpacity }]} />

                    <Animated.View style={[styles.iconCircle, { transform: [{ scale: scaleAnim }] }]}>
                        <LinearGradient colors={['#22C55E', '#16A34A']} style={styles.iconGradient}>
                            <Animated.View style={{ transform: [{ scale: checkScale }] }}>
                                <Ionicons name="checkmark" size={52} color="#FFFFFF" />
                            </Animated.View>
                        </LinearGradient>
                    </Animated.View>
                </View>

                {/* Text */}
                <Animated.View style={[styles.textBlock, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
                    <Text style={styles.congrats}>Booking Confirmed! 🎉</Text>
                    <Text style={styles.subText}>
                        Your appointment has been successfully booked. We look forward to seeing you!
                    </Text>
                </Animated.View>

                {/* Booking Details Card */}
                <Animated.View style={[styles.card, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
                    <Text style={styles.cardTitle}>Booking Details</Text>

                    <View style={styles.divider} />

                    <DetailRow icon="person-circle-outline" label="Doctor" value={doctorName ? `Dr. ${doctorName}` : '—'} />
                    <DetailRow icon="calendar-outline" label="Date" value={formattedDate || date || '—'} />
                    <DetailRow icon="time-outline" label="Time Slot" value={timeSlot || '—'} />
                    <DetailRow
                        icon="card-outline"
                        label="Payment"
                        value={paymentMode === 'COD' || paymentMode === 'OFFLINE' ? 'Cash on Pay' : 'Online Payment'}
                    />
                    {!!amount && amount !== '0' && (
                        <DetailRow icon="cash-outline" label="Amount" value={`₹ ${amount}`} accent />
                    )}
                </Animated.View>

                {/* Status Pill */}
                <Animated.View style={[styles.statusPill, { opacity: fadeAnim }]}>
                    <View style={styles.statusDot} />
                    <Text style={styles.statusPillText}>Status: Pending confirmation</Text>
                </Animated.View>

                {/* Actions */}
                <Animated.View style={[styles.actions, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
                    {/* Primary CTA */}
                    <TouchableOpacity
                        style={styles.trackBtn}
                        activeOpacity={0.85}
                        onPress={() => {
                            if (bookingId) {
                                router.replace({
                                    pathname: '/doctor/appointment/[id]',
                                    params: { id: bookingId },
                                } as any);
                            }
                        }}
                    >
                        <LinearGradient colors={['#2563EB', '#1D4ED8']} style={styles.trackGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                            <Ionicons name="navigate-circle-outline" size={22} color="#FFF" style={{ marginRight: 8 }} />
                            <Text style={styles.trackBtnText}>Track Booking</Text>
                        </LinearGradient>
                    </TouchableOpacity>

                    {/* Secondary */}
                    <TouchableOpacity
                        style={styles.homeBtn}
                        activeOpacity={0.8}
                        onPress={() => router.replace('/(tabs)/' as any)}
                    >
                        <Ionicons name="home-outline" size={18} color={Colors.primary} style={{ marginRight: 6 }} />
                        <Text style={styles.homeBtnText}>Back to Home</Text>
                    </TouchableOpacity>
                </Animated.View>

            </ScrollView>
        </SafeAreaView>
    );
}

function DetailRow({
    icon,
    label,
    value,
    accent,
}: {
    icon: string;
    label: string;
    value: string;
    accent?: boolean;
}) {
    return (
        <View style={styles.detailRow}>
            <View style={styles.detailLeft}>
                <Ionicons name={icon as any} size={18} color={accent ? '#16A34A' : '#6B7280'} />
                <Text style={styles.detailLabel}>{label}</Text>
            </View>
            <Text style={[styles.detailValue, accent && styles.detailValueAccent]}>{value}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    scroll: {
        flexGrow: 1,
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingTop: 32,
        paddingBottom: 40,
    },
    iconSection: {
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
        width: 130,
        height: 130,
    },
    ring: {
        position: 'absolute',
        width: 110,
        height: 110,
        borderRadius: 55,
        borderWidth: 3,
        borderColor: '#22C55E',
    },
    iconCircle: {
        width: 100,
        height: 100,
        borderRadius: 50,
        overflow: 'hidden',
        shadowColor: '#16A34A',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.35,
        shadowRadius: 16,
        elevation: 12,
    },
    iconGradient: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    textBlock: {
        alignItems: 'center',
        marginBottom: 28,
        paddingHorizontal: 8,
    },
    congrats: {
        fontSize: 26,
        fontWeight: '800',
        color: '#111827',
        textAlign: 'center',
        marginBottom: 10,
        letterSpacing: -0.5,
    },
    subText: {
        fontSize: 14,
        color: '#6B7280',
        textAlign: 'center',
        lineHeight: 22,
    },
    card: {
        width: '100%',
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 20,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
        elevation: 6,
        borderWidth: 1,
        borderColor: '#F3F4F6',
    },
    cardTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#374151',
        marginBottom: 12,
    },
    divider: {
        height: 1,
        backgroundColor: '#F3F4F6',
        marginBottom: 12,
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 9,
        borderBottomWidth: 1,
        borderBottomColor: '#F9FAFB',
    },
    detailLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flex: 1,
    },
    detailLabel: {
        fontSize: 13,
        color: '#6B7280',
        marginLeft: 6,
    },
    detailValue: {
        fontSize: 13,
        fontWeight: '600',
        color: '#111827',
        textAlign: 'right',
        flex: 1,
        flexShrink: 1,
        marginLeft: 8,
    },
    detailValueAccent: {
        color: '#16A34A',
        fontSize: 15,
        fontWeight: '700',
    },
    statusPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FEF9C3',
        borderRadius: 50,
        paddingHorizontal: 16,
        paddingVertical: 8,
        marginBottom: 28,
        gap: 8,
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#EAB308',
    },
    statusPillText: {
        fontSize: 13,
        color: '#92400E',
        fontWeight: '600',
    },
    actions: {
        width: '100%',
        gap: 12,
    },
    trackBtn: {
        width: '100%',
        borderRadius: 16,
        overflow: 'hidden',
        shadowColor: '#2563EB',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 8,
    },
    trackGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 17,
        paddingHorizontal: 24,
    },
    trackBtnText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '700',
        letterSpacing: 0.3,
    },
    homeBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 16,
        borderWidth: 1.5,
        borderColor: Colors.primary,
        backgroundColor: '#F0F9FF',
    },
    homeBtnText: {
        color: Colors.primary,
        fontSize: 15,
        fontWeight: '600',
    },
});
