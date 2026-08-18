import React, { useState } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    Dimensions,
    Alert,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import api from '@/services/api';
import { Endpoints } from '@/constants/api';
import { bookingsService } from '@/services/bookings.service';
import { paymentService } from '@/services/payment.service';
import { walletService } from '@/services/wallet.service';
import { packagesService } from '@/services/packages.service';
import { Colors, Shadows } from '@/constants/colors';
import { FontSize } from '@/constants/spacing';
import { Button } from '@/components/ui/Button';
import { formatCurrency } from '@/utils/formatters';
import RazorpayCheckout from 'react-native-razorpay';
import { addressService } from '@/services/address.service';
import { showToast } from '@/utils/toast';
import { useAuthStore } from '@/stores/auth.store';

const { width } = Dimensions.get('window');

export default function HealthPackageDetail() {
    const { id, from } = useLocalSearchParams<{ id: string; from?: string }>();
    const router = useRouter();
    const qc = useQueryClient();
    const { user } = useAuthStore();
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [paymentMode, setPaymentMode] = useState<'OFFLINE' | 'ONLINE' | 'WALLET' | null>(null);
    const source = Array.isArray(from) ? from[0] : from;

    // Fetch wallet balance
    const { data: wallet } = useQuery({
        queryKey: ['wallet'],
        queryFn: walletService.getWallet,
    });

    // Dynamic back logic
    const handleBack = () => {
        if (router.canGoBack()) {
            router.back();
        } else if (source === 'home') {
            router.navigate('/');
        } else {
            router.navigate('/services');
        }
    };

    // ── Back Handler (Android) ──
    React.useEffect(() => {
        const subscription = require('react-native').BackHandler.addEventListener(
            'hardwareBackPress',
            () => {
                handleBack();
                return true;
            }
        );
        return () => subscription.remove();
    }, [source]);

    const { data: pkg, isLoading } = useQuery({
        queryKey: ['health-package', id],
        queryFn: async () => {
            const res = await api.get(Endpoints.HEALTH_PACKAGE_DETAIL(id!));
            return res.data.data;
        },
        enabled: !!id && id !== '[id]',
    });

    const { data: addresses } = useQuery({
        queryKey: ['addresses', user?.id || user?._id],
        queryFn: addressService.getAll,
    });

    const primaryAddress = addresses?.find(a => a.isPrimary) || addresses?.[0];

    const { data: activePackagesData } = useQuery({
        queryKey: ['active-packages'],
        queryFn: () => packagesService.getActivePackages(),
    });

    const activePackages = activePackagesData?.data || [];
    const alreadyOwns = activePackages.some((up: any) => up.packageId?._id === id);

    React.useEffect(() => {
        if (alreadyOwns) {
            showToast.success('Already Active', 'You currently have an active subscription to this package.');
        }
    }, [alreadyOwns]);

    const bookMutation = useMutation({
        mutationFn: async (mode: 'ONLINE' | 'OFFLINE' | 'WALLET') => {
            return await packagesService.purchasePackage({
                healthPackageId: id!,
                paymentMode: mode === 'WALLET' ? 'WALLET' : mode,
            });
        },
        onSuccess: (data, variables) => {
            qc.invalidateQueries({ queryKey: ['active-packages'] });
            qc.invalidateQueries({ queryKey: ['wallet'] });
            if (variables === 'OFFLINE') {
                setSubmitted(true);
            }
        },
        onError: (err: any) => {
            showToast.error("Booking Failed", err?.response?.data?.message || "Something went wrong. Please try again.");
        }
    });

    const handleBooking = async (mode: 'ONLINE' | 'OFFLINE' | 'WALLET' | null) => {
        if (!mode) {
            showToast.warn("Payment Method Required", "Please select a payment method.");
            return;
        }
        if (mode === 'WALLET') {
            const walletBalance = wallet?.balance ?? 0;
            if (walletBalance < pkg.price) {
                Alert.alert(
                    'Insufficient Balance',
                    `Your wallet balance (₹${walletBalance}) is not enough for this payment (₹${pkg.price}). Please top up or choose another payment method.`,
                    [{ text: 'OK' }]
                );
                return;
            }
            try {
                setSubmitting(true);
                const packageResp = await bookMutation.mutateAsync('WALLET');
                const order = await paymentService.createOrder({
                    amount: pkg.price,
                    type: "PACKAGE",
                    referenceId: packageResp._id,
                });
                await paymentService.payWithWallet(order._id);
                qc.invalidateQueries({ queryKey: ['wallet'] });
                qc.invalidateQueries({ queryKey: ['active-packages'] });
                setSubmitted(true);
            } catch (err: any) {
                const msg = err?.response?.data?.message || err?.message || 'Wallet payment failed.';
                Alert.alert('Payment Error', msg);
            } finally {
                setSubmitting(false);
            }
        } else if (mode === 'ONLINE') {
            let createdPackageId: string | null = null;
            try {
                setSubmitting(true);
                const packageResp = await bookMutation.mutateAsync('ONLINE');
                createdPackageId = packageResp._id;
                const order = await paymentService.createOrder({
                    amount: pkg.price,
                    type: "PACKAGE",
                    referenceId: packageResp._id
                });
                const razorData = await paymentService.initiateRazorpay(order._id);
                const data = await RazorpayCheckout.open({
                    key: razorData.key,
                    amount: razorData.razorOrder.amount,
                    currency: 'INR',
                    name: 'A1Care 24/7',
                    description: `Health Package: ${pkg.name}`,
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
                
                qc.invalidateQueries({ queryKey: ['active-packages'] });
                
                router.replace({
                    pathname: '/checkout/status' as any,
                    params: {
                        status: 'SUCCESS',
                        txnId: order.txnId,
                        amount: String(pkg.price),
                        type: 'PACKAGE',
                        description: `Health Package: ${pkg.name}`,
                        bookingId: packageResp._id,
                        date: new Date().toISOString(),
                    },
                });
            } catch (err: any) {
                // Ignore rollback for packages for now, it's PENDING.
                if (err.code === 2) {
                    showToast.warn('Payment Cancelled', 'You cancelled the payment.');
                } else {
                    router.replace({
                        pathname: '/checkout/status' as any,
                        params: {
                            status: 'FAILED',
                            amount: String(pkg.price),
                            type: 'PACKAGE',
                            description: `Health Package: ${pkg.name}`,
                        },
                    });
                }
            } finally {
                setSubmitting(false);
            }
        } else {
            bookMutation.mutate('OFFLINE');
        }
    };

    if (isLoading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color={Colors.primary} />
            </View>
        );
    }

    if (submitted) {
        return (
            <SafeAreaView style={styles.root}>
                <View style={styles.successContainer}>
                    <View style={styles.successIconBox}>
                        <Text style={{ fontSize: 60 }}>✅</Text>
                    </View>
                    <Text style={styles.successTitle}>Package Purchased!</Text>
                    <Text style={styles.successSub}>
                        Your health package is now active. You can use it to book covered services for free.
                    </Text>
                    <TouchableOpacity
                        style={styles.successBtn}
                        onPress={() => router.replace('/profile/my-packages' as any)}
                    >
                        <Text style={styles.successBtnText}>View My Packages</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    if (!pkg) return null;

    const discountPct = pkg.originalPrice > pkg.price
        ? Math.round(((pkg.originalPrice - pkg.price) / pkg.originalPrice) * 100)
        : 0;

    return (
        <SafeAreaView style={styles.root} edges={['top']}>
            <Stack.Screen options={{ headerShown: false }} />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
                    <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Package Details</Text>
                <View style={{ width: 44 }} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
                {/* Hero Card */}
                <LinearGradient
                    colors={[pkg.color || '#2F80ED', (pkg.color || '#2F80ED') + 'CC']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={styles.heroCard}
                >
                    {pkg.badge && (
                        <View style={styles.heroBadge}>
                            <Text style={styles.heroBadgeText}>{pkg.badge}</Text>
                        </View>
                    )}
                    <Text style={styles.pkgName}>{pkg.name}</Text>
                    <View style={styles.priceRow}>
                        <Text style={styles.priceText}>₹{pkg.price}</Text>
                        {discountPct > 0 && (
                            <>
                                <Text style={styles.originalPrice}>₹{pkg.originalPrice}</Text>
                                <View style={styles.discountTag}>
                                    <Text style={styles.discountText}>{discountPct}% OFF</Text>
                                </View>
                            </>
                        )}
                    </View>
                    <View style={styles.heroFooter}>
                        <View style={styles.heroStat}>
                            <Ionicons name="flask-outline" size={16} color="#fff" />
                            <Text style={styles.heroStatText}>{(pkg.testsIncluded || []).length} Tests</Text>
                        </View>
                        <View style={styles.heroStatDivider} />
                        <View style={styles.heroStat}>
                            <Ionicons name="time-outline" size={16} color="#fff" />
                            <Text style={styles.heroStatText}>{pkg.validityDays} Days Validity</Text>
                        </View>
                    </View>
                </LinearGradient>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>About this Package</Text>
                    <Text style={styles.description}>{pkg.description}</Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Tests Included ({(pkg.testsIncluded || []).length})</Text>
                    <View style={styles.testsGrid}>
                        {(pkg.testsIncluded || []).map((test: string, idx: number) => (
                            <View key={idx} style={styles.testItem}>
                                <View style={styles.testDot} />
                                <Text style={styles.testText}>{test}</Text>
                            </View>
                        ))}
                    </View>
                </View>

                <View style={[styles.section, styles.infoBox]}>
                    <MaterialCommunityIcons name="home-city-outline" size={24} color={Colors.primary} />
                    <View style={styles.infoContent}>
                        <Text style={styles.infoTitle}>Home Sample Collection</Text>
                        <Text style={styles.infoSub}>Our certified phlebotomist will visit your home to collect samples at your preferred time.</Text>
                    </View>
                </View>

                <View style={styles.section}>
                    <View style={styles.rowBetween}>
                        <Text style={styles.sectionTitle}>Collection Address</Text>
                        <TouchableOpacity onPress={() => router.push('/profile/addresses')}>
                            <Text style={styles.changeBtnText}>Change</Text>
                        </TouchableOpacity>
                    </View>
                    {primaryAddress ? (
                        <View style={styles.addressCard}>
                            <Ionicons name="location-outline" size={20} color={Colors.primary} />
                            <View style={styles.addressInfo}>
                                <Text style={styles.addressLabel}>{primaryAddress.label || 'Home'}</Text>
                                <Text style={styles.addressText} numberOfLines={2}>
                                    {primaryAddress.street}, {primaryAddress.city}, {primaryAddress.pincode}
                                </Text>
                            </View>
                        </View>
                    ) : (
                        <TouchableOpacity
                            style={styles.addAddressBox}
                            onPress={() => router.push('/profile/addresses')}
                        >
                            <Text style={styles.addAddressText}>+ Add Collection Address</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* Payment Method */}
                {!alreadyOwns && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Payment Method</Text>
                        <View style={{ gap: 12 }}>


                            {/* A1 Wallet */}
                            <TouchableOpacity
                                style={[styles.payCard, paymentMode === 'WALLET' && styles.payCardActive]}
                                onPress={() => setPaymentMode('WALLET')}
                            >
                                <View style={[styles.payIconBox, { backgroundColor: paymentMode === 'WALLET' ? '#16A34A' : '#ECFDF5' }]}>
                                    <Ionicons name="wallet-outline" size={22} color={paymentMode === 'WALLET' ? '#fff' : '#16A34A'} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.payCardLabel}>A1 Wallet</Text>
                                    <Text style={styles.payCardSub}>
                                        Balance: {formatCurrency(wallet?.balance ?? 0)}
                                        {((wallet?.balance ?? 0) < pkg.price) && (
                                            <Text style={{ color: '#EF4444', fontWeight: 'bold' }}> (Insufficient balance)</Text>
                                        )}
                                    </Text>
                                </View>
                                <View style={[styles.radio, paymentMode === 'WALLET' && styles.radioActive]}>
                                    {paymentMode === 'WALLET' && <View style={styles.radioInner} />}
                                </View>
                            </TouchableOpacity>

                            {/* Online */}
                            <TouchableOpacity
                                style={[styles.payCard, paymentMode === 'ONLINE' && styles.payCardActive]}
                                onPress={() => setPaymentMode('ONLINE')}
                            >
                                <View style={[styles.payIconBox, { backgroundColor: paymentMode === 'ONLINE' ? '#7C3AED' : '#F3EEFF' }]}>
                                    <Ionicons name="card-outline" size={22} color={paymentMode === 'ONLINE' ? '#fff' : '#7C3AED'} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.payCardLabel}>Pay Online</Text>
                                    <Text style={styles.payCardSub}>UPI, Card, Net Banking</Text>
                                </View>
                                <View style={[styles.radio, paymentMode === 'ONLINE' && styles.radioActive]}>
                                    {paymentMode === 'ONLINE' && <View style={styles.radioInner} />}
                                </View>
                            </TouchableOpacity>

                            {/* Wallet insufficient warning */}
                            {paymentMode === 'WALLET' && (wallet?.balance ?? 0) < pkg.price && (
                                <View style={styles.walletWarning}>
                                    <Ionicons name="warning-outline" size={14} color="#92400E" />
                                    <Text style={styles.walletWarningText}>
                                        Insufficient balance (₹{wallet?.balance ?? 0}). Please top up or choose another method.
                                    </Text>
                                </View>
                            )}
                        </View>
                    </View>
                )}

                <View style={{ height: 100 }} />
            </ScrollView>

            {/* Bottom Action */}
            <View style={styles.footer}>
                <View style={styles.footerPrice}>
                    <Text style={styles.footerLabel}>Total Amount</Text>
                    <Text style={styles.footerAmount}>₹{pkg.price}</Text>
                </View>
                {alreadyOwns ? (
                    <TouchableOpacity
                        style={styles.bookBtn}
                        onPress={() => router.replace('/profile/my-packages' as any)}
                    >
                        <Text style={styles.bookBtnText}>View My Packages</Text>
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity
                        style={[styles.bookBtn, (submitting || !primaryAddress) && { opacity: 0.7 }]}
                        onPress={() => {
                            if (!primaryAddress) {
                                showToast.warn("Address Required", "Please add a collection address before booking.");
                                return;
                            }
                            handleBooking(paymentMode);
                        }}
                        disabled={submitting}
                    >
                        {submitting ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.bookBtnText}>
                                {paymentMode === 'ONLINE' ? 'Pay Online' : paymentMode === 'WALLET' ? 'Pay from Wallet' : paymentMode === 'OFFLINE' ? 'Book Now' : 'Select Payment Method'}
                            </Text>
                        )}
                    </TouchableOpacity>
                )}
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
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: Colors.card,
    },
    backBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: Colors.background,
        justifyContent: 'center',
        alignItems: 'center',
        ...Shadows.small,
    },
    headerTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary },
    scroll: { padding: 16 },
    heroCard: {
        borderRadius: 32,
        padding: 28,
        marginBottom: 28,
        shadowColor: '#0A1A3A',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.15,
        shadowRadius: 24,
        elevation: 10,
        minHeight: 180,
    },
    heroBadge: {
        alignSelf: 'flex-start',
        backgroundColor: 'rgba(255,255,255,0.25)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        marginBottom: 16,
    },
    heroBadgeText: { color: '#fff', fontSize: 10, fontWeight: '900', letterSpacing: 1.2, textTransform: 'uppercase' },
    pkgName: { fontSize: 26, fontWeight: '900', color: '#fff', marginBottom: 12, letterSpacing: -0.5 },
    priceRow: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 24 },
    priceText: { fontSize: 36, fontWeight: '900', color: '#fff', marginRight: 12 },
    originalPrice: { fontSize: 16, color: 'rgba(255,255,255,0.7)', textDecorationLine: 'line-through', marginRight: 12, fontWeight: '600' },
    discountTag: { backgroundColor: '#10B981', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    discountText: { color: '#fff', fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
    heroFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingTop: 18,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.2)'
    },
    heroStat: { flexDirection: 'row', alignItems: 'center' },
    heroStatDivider: { width: 1, height: 16, backgroundColor: 'rgba(255,255,255,0.3)', marginHorizontal: 18 },
    heroStatText: { color: '#fff', fontSize: 13, fontWeight: '700', marginLeft: 8, letterSpacing: 0.2 },
    section: { marginBottom: 28, paddingHorizontal: 4 },
    sectionTitle: { fontSize: 20, fontWeight: '900', color: '#0F172A', marginBottom: 14, letterSpacing: -0.3 },
    description: { fontSize: 15, color: '#475569', lineHeight: 24, fontWeight: '500' },
    testsGrid: { flexWrap: 'wrap', flexDirection: 'row' },
    testItem: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        padding: 16,
        borderRadius: 16,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#E8EEF5',
        shadowColor: '#0A1A3A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.02,
        shadowRadius: 4,
        elevation: 1,
    },
    testDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#0B3370', marginRight: 14 },
    testText: { fontSize: 15, color: '#0F172A', fontWeight: '700' },
    infoBox: {
        flexDirection: 'row',
        backgroundColor: '#F4F8FF',
        padding: 24,
        borderRadius: 24,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E0E7FF',
    },
    infoContent: { flex: 1, marginLeft: 16 },
    infoTitle: { fontSize: 16, fontWeight: '900', color: '#0B3370', marginBottom: 6 },
    infoSub: { fontSize: 13, color: '#475569', lineHeight: 20, fontWeight: '500' },
    rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    changeBtnText: { color: '#0B3370', fontSize: 14, fontWeight: '900' },
    addressCard: {
        flexDirection: 'row',
        backgroundColor: '#FFFFFF',
        padding: 20,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: '#E8EEF5',
        alignItems: 'center',
        shadowColor: '#0A1A3A',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.03,
        shadowRadius: 16,
        elevation: 4,
    },
    addressInfo: { flex: 1, marginLeft: 14 },
    addressLabel: { fontSize: 15, fontWeight: '900', color: '#0F172A', marginBottom: 4 },
    addressText: { fontSize: 13, color: '#64748B', fontWeight: '500', lineHeight: 18 },
    addAddressBox: {
        backgroundColor: '#FAFCFF',
        padding: 24,
        borderRadius: 24,
        borderStyle: 'dashed',
        borderWidth: 1.5,
        borderColor: '#93C5FD',
        alignItems: 'center',
    },
    addAddressText: { color: '#1D4ED8', fontWeight: '800', fontSize: 14 },
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 24,
        paddingVertical: 20,
        paddingBottom: 38,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        shadowColor: '#0A1A3A',
        shadowOffset: { width: 0, height: -10 },
        shadowOpacity: 0.05,
        shadowRadius: 20,
        elevation: 20,
    },
    footerPrice: { flex: 1 },
    footerLabel: { fontSize: 12, color: '#64748B', marginBottom: 4, fontWeight: '700' },
    footerAmount: { fontSize: 26, fontWeight: '900', color: '#0F172A' },
    bookBtn: {
        backgroundColor: '#0B3370',
        paddingHorizontal: 36,
        paddingVertical: 18,
        borderRadius: 30,
        shadowColor: '#0B3370',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
        elevation: 8,
    },
    bookBtnText: { color: '#fff', fontSize: 15, fontWeight: '900', letterSpacing: 0.3 },
    successContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
    successIconBox: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: Colors.health + '20',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 32
    },
    successTitle: { fontSize: 28, fontWeight: '800', color: Colors.textPrimary, marginBottom: 12 },
    successSub: { fontSize: FontSize.base, color: Colors.textSecondary, textAlign: 'center', lineHeight: 24, marginBottom: 40 },
    successBtn: {
        backgroundColor: Colors.primary,
        width: '100%',
        paddingVertical: 18,
        borderRadius: 16,
        alignItems: 'center',
        ...Shadows.card,
    },
    successBtnText: { color: '#fff', fontSize: FontSize.base, fontWeight: '700' },

    // Payment method cards
    payCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 20,
        borderRadius: 24,
        backgroundColor: '#FFFFFF',
        borderWidth: 1.5,
        borderColor: '#E8EEF5',
        gap: 16,
        shadowColor: '#0A1A3A',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.03,
        shadowRadius: 16,
        elevation: 4,
    },
    payCardActive: { borderColor: '#3B82F6', backgroundColor: '#F0F7FF' },
    payIconBox: {
        width: 52,
        height: 52,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    payCardLabel: { fontSize: 16, fontWeight: '900', color: '#0F172A' },
    payCardSub: { fontSize: 13, color: '#64748B', marginTop: 4, fontWeight: '500' },
    radio: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#CBD5E1',
        justifyContent: 'center',
        alignItems: 'center',
    },
    radioActive: { borderColor: '#3B82F6' },
    radioInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#3B82F6' },
    walletWarning: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
        backgroundColor: '#FEF3C7',
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#FDE68A',
    },
    walletWarningText: { flex: 1, fontSize: 12, color: '#92400E', fontWeight: '600', lineHeight: 17 },
    alreadyOwnsBox: {
        flexDirection: 'row',
        backgroundColor: '#ECFDF5',
        padding: 24,
        borderRadius: 24,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#D1FAE5',
    },
    alreadyOwnsTitle: { fontSize: 16, fontWeight: '900', color: '#065F46', marginBottom: 6 },
    alreadyOwnsSub: { fontSize: 13, color: '#047857', lineHeight: 20, fontWeight: '500' },
});
