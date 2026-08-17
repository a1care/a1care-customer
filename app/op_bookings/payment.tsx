import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import RazorpayCheckout from 'react-native-razorpay';

import { walletService } from '@/services/wallet.service';
import { bookingsService } from '@/services/bookings.service';
import { paymentService } from '@/services/payment.service';
import { packagesService } from '@/services/packages.service';
import { triggerLocalNotification } from '@/utils/notifications';
import { showToast } from '@/utils/toast';

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
    return new Date(y, m - 1, d, hours, minutes, 0, 0).toISOString();
};

export default function PaymentMethodScreen() {
    const router = useRouter();
    const { id, deptName, date, time, price } = useLocalSearchParams<{ id: string, deptName: string, date: string, time: string, price: string }>();
    const qc = useQueryClient();
    const insets = useSafeAreaInsets();
    
    const [paymentMode, setPaymentMode] = useState<'WALLET' | 'ONLINE' | 'PACKAGE'>('WALLET');
    const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);

    const { data: walletData, isLoading: walletLoading } = useQuery({
        queryKey: ['wallet'],
        queryFn: walletService.getWallet,
    });

    const { data: packagesData, isLoading: packagesLoading } = useQuery({
        queryKey: ['active-packages'],
        queryFn: () => packagesService.getActivePackages('OP_TICKET'),
    });
    const activePackages = packagesData?.data || [];

    const bookMutation = useMutation({
        mutationFn: () => {
            const isoStr = buildScheduledIsoFromLocal(date!, time!);
            return bookingsService.createServiceBooking({
                childServiceId: id!,
                scheduledTime: isoStr,
                bookingType: 'SCHEDULED',
                fulfillmentMode: 'HOSPITAL_VISIT',
                price: Number(price) || 0,
                paymentMode: paymentMode,
                userPackageId: paymentMode === 'PACKAGE' ? (selectedPackageId || undefined) : undefined,
                notes: "OP Department: " + (deptName || 'General OP')
            });
        },
        onSuccess: async (data: any) => {
            const bookingId = data?._id;

            if (paymentMode === 'WALLET' || paymentMode === 'PACKAGE') {
                triggerLocalNotification('OP Ticket Confirmed', `Your OP Token for ${deptName || 'General OP'} is confirmed.`);
                qc.invalidateQueries({ queryKey: ['service-bookings'] });
                showToast.success('Booking Successful', `Paid via ${paymentMode === 'WALLET' ? 'Wallet' : 'Package'}`);
                router.replace('/(tabs)/bookings');
                return;
            }

            try {
                const order = await paymentService.createOrder({ amount: Number(price) || 0, type: 'BOOKING', referenceId: bookingId });
                const razorData = await paymentService.initiateRazorpay(order._id);
                const rzpData = await RazorpayCheckout.open({
                    key: razorData.key,
                    amount: razorData.razorOrder.amount,
                    currency: 'INR',
                    name: 'A1Care OP Booking',
                    description: 'OP Booking - ' + (deptName || 'General OP'),
                    order_id: razorData.razorOrder.id,
                    prefill: {
                        email: razorData.customer?.email || '',
                        contact: razorData.customer?.contact || '',
                        name: razorData.customer?.name || '',
                    },
                    theme: { color: '#2563EB' }
                });
                await paymentService.verifyRazorpay({
                    razorpay_order_id: (rzpData as any).razorpay_order_id,
                    razorpay_payment_id: (rzpData as any).razorpay_payment_id,
                    razorpay_signature: (rzpData as any).razorpay_signature,
                    orderId: order._id,
                });
                triggerLocalNotification('OP Ticket Confirmed', `Your OP Token for ${deptName || 'General OP'} is confirmed.`);
                qc.invalidateQueries({ queryKey: ['service-bookings'] });
                showToast.success('Booking Successful', 'Paid via Online Payment');
                router.replace('/(tabs)/bookings');
            } catch (err: any) {
                // Cancel the booking that was already created so it doesn't stay in unpaid limbo
                if (bookingId) {
                    await bookingsService.updateServiceBookingStatus(bookingId, 'CANCELLED').catch(() => {});
                }
                showToast.error('Payment Failed', err?.message || 'Please try again.');
            }
        },
        onError: (err: any) => {
            showToast.error('Booking Failed', err?.response?.data?.message || err.message);
        }
    });

    const handlePay = () => {
        if (paymentMode === 'WALLET') {
            const balance = walletData?.balance || 0;
            if (balance < (Number(price) || 0)) {
                return showToast.error('Insufficient Balance', 'Please recharge your wallet or pay online.');
            }
        }
        if (paymentMode === 'PACKAGE' && !selectedPackageId) {
            return showToast.error('Select a Package', 'Please select an active package to proceed.');
        }
        bookMutation.mutate();
    };

    const fee = paymentMode === 'PACKAGE' ? 0 : (Number(price) || 0);
    const originalFee = Number(price) || 0;

    return (
        <View style={[styles.root, { paddingTop: Math.max(insets.top, 20), paddingBottom: Math.max(insets.bottom, 0) }]}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#1E293B" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Payment Method</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
                
                <Text style={styles.title}>Select Payment</Text>
                <Text style={styles.subtitle}>Choose how you'd like to pay for your token</Text>

                {/* Package Option */}
                {activePackages.length > 0 && (
                    <View style={styles.packagesContainer}>
                        <Text style={styles.sectionHeader}>Your Active Packages</Text>
                        {activePackages.map((upkg: any) => (
                            <TouchableOpacity 
                                key={upkg._id}
                                style={[
                                    styles.payCard, 
                                    paymentMode === 'PACKAGE' && selectedPackageId === upkg._id && styles.payCardActive
                                ]}
                                onPress={() => {
                                    setPaymentMode('PACKAGE');
                                    setSelectedPackageId(upkg._id);
                                }}
                                activeOpacity={0.8}
                            >
                                <View style={[styles.iconBox, { backgroundColor: upkg.packageId?.color || '#F59E0B' }]}>
                                    <MaterialCommunityIcons name="star-circle" size={24} color="#FFF" />
                                </View>
                                <View style={styles.payInfo}>
                                    <Text style={styles.payName}>{upkg.packageId?.name || 'Health Package'}</Text>
                                    <Text style={[styles.payDesc, { color: '#059669', fontWeight: '600' }]}>
                                        {upkg.remainingUses} use{upkg.remainingUses > 1 ? 's' : ''} left
                                    </Text>
                                </View>
                                <View style={styles.radio}>
                                    {paymentMode === 'PACKAGE' && selectedPackageId === upkg._id && <View style={styles.radioFill} />}
                                </View>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}

                <Text style={[styles.sectionHeader, { marginTop: activePackages.length > 0 ? 12 : 0 }]}>Other Methods</Text>

                {/* Wallet Option */}
                <TouchableOpacity 
                    style={[styles.payCard, paymentMode === 'WALLET' && styles.payCardActive]}
                    onPress={() => setPaymentMode('WALLET')}
                    activeOpacity={0.8}
                >
                    <View style={[styles.iconBox, { backgroundColor: '#10B981' }]}>
                        <Ionicons name="wallet" size={24} color="#FFF" />
                    </View>
                    <View style={styles.payInfo}>
                        <Text style={styles.payName}>A1 Wallet</Text>
                        <Text style={styles.payDesc}>
                            {walletLoading ? 'Fetching balance...' : `Balance: ₹${(walletData?.balance || 0).toFixed(2)}`}
                        </Text>
                    </View>
                    <View style={styles.radio}>
                        {paymentMode === 'WALLET' && <View style={styles.radioFill} />}
                    </View>
                </TouchableOpacity>

                {/* Online Option */}
                <TouchableOpacity 
                    style={[styles.payCard, paymentMode === 'ONLINE' && styles.payCardActive]}
                    onPress={() => setPaymentMode('ONLINE')}
                    activeOpacity={0.8}
                >
                    <View style={[styles.iconBox, { backgroundColor: '#EFF6FF' }]}>
                        <Ionicons name="card" size={24} color="#2563EB" />
                    </View>
                    <View style={styles.payInfo}>
                        <Text style={styles.payName}>Pay Online / UPI</Text>
                        <Text style={styles.payDesc}>GPay, PhonePe, Cards, Net Banking</Text>
                    </View>
                    <View style={styles.radio}>
                        {paymentMode === 'ONLINE' && <View style={styles.radioFill} />}
                    </View>
                </TouchableOpacity>

                {/* Booking Summary */}
                <View style={styles.summaryCard}>
                    <View style={styles.summaryHeader}>
                        <MaterialCommunityIcons name="ticket-confirmation" size={20} color="#475569" />
                        <Text style={styles.summaryTitle}>Booking Summary</Text>
                    </View>
                    
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Consultation Fee</Text>
                        <Text style={styles.summaryValue}>₹{fee}</Text>
                    </View>
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Platform Fee</Text>
                        <Text style={[styles.summaryValue, { color: '#16A34A' }]}>Free</Text>
                    </View>

                    <View style={styles.summaryDivider} />

                    <View style={styles.summaryRow}>
                        <Text style={styles.totalLabel}>Total Payable</Text>
                        {paymentMode === 'PACKAGE' ? (
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Text style={[styles.totalValue, { textDecorationLine: 'line-through', color: '#94A3B8', fontSize: 14, marginRight: 8 }]}>
                                    ₹{originalFee}
                                </Text>
                                <Text style={[styles.totalValue, { color: '#16A34A' }]}>₹0</Text>
                            </View>
                        ) : (
                            <Text style={styles.totalValue}>₹{fee}</Text>
                        )}
                    </View>
                </View>

            </ScrollView>

            {/* Footer */}
            <View style={styles.footer}>
                <TouchableOpacity 
                    style={[styles.nextBtn, bookMutation.isPending && { opacity: 0.7 }]} 
                    onPress={handlePay}
                    disabled={bookMutation.isPending}
                >
                    {bookMutation.isPending ? (
                        <ActivityIndicator color="#FFF" />
                    ) : (
                        <Text style={styles.nextBtnText}>
                            {paymentMode === 'PACKAGE' ? 'Confirm Booking (₹0)' : paymentMode === 'WALLET' ? 'Pay from Wallet' : 'Pay Online'}
                        </Text>
                    )}
                </TouchableOpacity>
            </View>
        </View>
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
    scrollContent: { padding: 20, paddingBottom: 40 },
    
    title: { fontSize: 22, fontWeight: '800', color: '#0F172A', marginBottom: 6 },
    subtitle: { fontSize: 14, color: '#64748B', marginBottom: 24 },
    sectionHeader: { fontSize: 14, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', marginBottom: 12, letterSpacing: 0.5 },
    packagesContainer: { marginBottom: 12 },

    payCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        padding: 16,
        borderRadius: 20,
        marginBottom: 16,
        borderWidth: 2,
        borderColor: '#F1F5F9',
    },
    payCardActive: { borderColor: '#2563EB', backgroundColor: '#F8FAFC' },
    iconBox: { width: 48, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    payInfo: { flex: 1, marginLeft: 16 },
    payName: { fontSize: 16, fontWeight: '700', color: '#1E293B', marginBottom: 4 },
    payDesc: { fontSize: 13, color: '#64748B' },
    
    radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#CBD5E1', justifyContent: 'center', alignItems: 'center' },
    radioFill: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#2563EB' },

    summaryCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 20,
        marginTop: 8,
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    summaryHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
    summaryTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A', marginLeft: 8 },
    summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
    summaryLabel: { fontSize: 14, color: '#475569', fontWeight: '500' },
    summaryValue: { fontSize: 14, color: '#0F172A', fontWeight: '700' },
    summaryDivider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 12 },
    totalLabel: { fontSize: 16, color: '#0F172A', fontWeight: '800' },
    totalValue: { fontSize: 18, color: '#2563EB', fontWeight: '800' },

    footer: { padding: 16, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#F1F5F9' },
    nextBtn: { backgroundColor: '#1E3A8A', paddingVertical: 18, borderRadius: 16, alignItems: 'center' },
    nextBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' }
});
