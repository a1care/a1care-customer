import React, { useState } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    Alert,
    Dimensions,
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
import { Colors, Shadows } from '@/constants/colors';
import { FontSize } from '@/constants/spacing';
import { formatCurrency } from '@/utils/formatters';
import { addressService } from '@/services/address.service';

const { width } = Dimensions.get('window');

export default function HealthPackageDetail() {
    const { id, from } = useLocalSearchParams<{ id: string; from?: string }>();
    const router = useRouter();
    const qc = useQueryClient();
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const source = Array.isArray(from) ? from[0] : from;

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
        enabled: !!id,
    });

    const { data: addresses } = useQuery({
        queryKey: ['addresses'],
        queryFn: addressService.getAll,
    });

    const primaryAddress = addresses?.find(a => a.isPrimary) || addresses?.[0];

    const bookMutation = useMutation({
        mutationFn: async (paymentMode: 'ONLINE' | 'OFFLINE') => {
            return await bookingsService.createServiceBooking({
                healthPackageId: id!,
                price: pkg.price,
                paymentMode,
                addressId: primaryAddress?._id,
                bookingType: 'SCHEDULED',
                fulfillmentMode: 'HOME_VISIT',
                scheduledTime: new Date().toISOString(),
            });
        },
        onSuccess: (data, variables) => {
            qc.invalidateQueries({ queryKey: ['service-bookings'] });
            qc.invalidateQueries({ queryKey: ['service-bookings-all'] });
            if (variables === 'OFFLINE') {
                setSubmitted(true);
            }
        },
        onError: (err: any) => {
            Alert.alert("Booking Failed", err?.response?.data?.message || "Something went wrong. Please try again.");
        }
    });

    const handleBooking = async (mode: 'ONLINE' | 'OFFLINE') => {
        if (mode === 'ONLINE') {
            try {
                setSubmitting(true);
                console.log(`[PackageDetail] Starting online payment for: ${id} | Price: ${pkg.price}`);
                // 1. Create Booking (Pending)
                const booking = await bookMutation.mutateAsync('ONLINE');
                console.log(`[PackageDetail] Booking created: ${booking._id}. Now creating payment order...`);

                // 2. Create Order
                const order = await paymentService.createOrder({
                    amount: pkg.price,
                    type: "BOOKING",
                    referenceId: booking._id
                });
                console.log(`[PackageDetail] Order created: ${order._id}. Now initiating gateway...`);

                // 3. Initiate
                const params = await paymentService.initiatePayment(order._id);
                console.log(`[PackageDetail] Gateway initiation success. Redirecting to Easebuzz...`);

                // 4. Checkout
                router.push({
                    pathname: "/checkout/easebuzz" as any,
                    params: { ...params }
                });
            } catch (err: any) {
                console.error("Package Payment Error:", err);
                Alert.alert("Payment Error", "Unable to start online payment. Please use COD.");
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
                    <Text style={styles.successTitle}>Booking Placed!</Text>
                    <Text style={styles.successSub}>
                        Your health package request has been received. Our partner will visit your doorstep for sample collection.
                    </Text>
                    <TouchableOpacity
                        style={styles.successBtn}
                        onPress={() => router.replace('/bookings')}
                    >
                        <Text style={styles.successBtnText}>View Bookings</Text>
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

                <View style={{ height: 100 }} />
            </ScrollView>

            {/* Bottom Action */}
            <View style={styles.footer}>
                <View style={styles.footerPrice}>
                    <Text style={styles.footerLabel}>Total Amount</Text>
                    <Text style={styles.footerAmount}>₹{pkg.price}</Text>
                </View>
                <TouchableOpacity
                    style={[styles.bookBtn, (submitting || !primaryAddress) && { opacity: 0.7 }]}
                    onPress={() => {
                        if (!primaryAddress) {
                            Alert.alert("Address Required", "Please add a collection address before booking.");
                            return;
                        }
                        Alert.alert(
                            "Confirm Booking",
                            "Choose your payment method",
                            [
                                { text: "Cash on pay", onPress: () => handleBooking('OFFLINE') },
                                { text: "Pay Online", onPress: () => handleBooking('ONLINE') },
                                { text: "Cancel", style: 'cancel' }
                            ]
                        )
                    }}
                    disabled={submitting}
                >
                    {submitting ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.bookBtnText}>Book Now</Text>
                    )}
                </TouchableOpacity>
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
        borderRadius: 24,
        padding: 24,
        marginBottom: 24,
        ...Shadows.medium,
        minHeight: 180,
    },
    heroBadge: {
        alignSelf: 'flex-start',
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
        marginBottom: 12,
    },
    heroBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
    pkgName: { fontSize: 24, fontWeight: '800', color: '#fff', marginBottom: 12 },
    priceRow: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 20 },
    priceText: { fontSize: 32, fontWeight: '900', color: '#fff', marginRight: 10 },
    originalPrice: { fontSize: FontSize.base, color: 'rgba(255,255,255,0.6)', textDecorationLine: 'line-through', marginRight: 10 },
    discountTag: { backgroundColor: '#FFD700', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    discountText: { color: '#000', fontSize: 10, fontWeight: '800' },
    heroFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingTop: 16,
        borderTopWidth: 0.5,
        borderTopColor: 'rgba(255,255,255,0.3)'
    },
    heroStat: { flexDirection: 'row', alignItems: 'center' },
    heroStatDivider: { width: 1, height: 16, backgroundColor: 'rgba(255,255,255,0.3)', marginHorizontal: 16 },
    heroStatText: { color: '#fff', fontSize: FontSize.sm, fontWeight: '600', marginLeft: 6 },
    section: { marginBottom: 24, paddingHorizontal: 4 },
    sectionTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary, marginBottom: 12 },
    description: { fontSize: FontSize.base, color: Colors.textSecondary, lineHeight: 22 },
    testsGrid: { flexWrap: 'wrap', flexDirection: 'row' },
    testItem: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.card,
        padding: 12,
        borderRadius: 12,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    testDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.primary, marginRight: 12 },
    testText: { fontSize: FontSize.base, color: Colors.textPrimary, fontWeight: '500' },
    infoBox: {
        flexDirection: 'row',
        backgroundColor: Colors.primary + '10',
        padding: 20,
        borderRadius: 20,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: Colors.primary + '30',
    },
    infoContent: { flex: 1, marginLeft: 16 },
    infoTitle: { fontSize: FontSize.base, fontWeight: '700', color: Colors.primary, marginBottom: 4 },
    infoSub: { fontSize: 12, color: Colors.textSecondary, lineHeight: 18 },
    rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    changeBtnText: { color: Colors.primary, fontSize: FontSize.sm, fontWeight: '700' },
    addressCard: {
        flexDirection: 'row',
        backgroundColor: Colors.card,
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: Colors.border,
        alignItems: 'center',
    },
    addressInfo: { flex: 1, marginLeft: 12 },
    addressLabel: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textPrimary, marginBottom: 2 },
    addressText: { fontSize: 13, color: Colors.textSecondary },
    addAddressBox: {
        backgroundColor: Colors.card,
        padding: 20,
        borderRadius: 16,
        borderStyle: 'dashed',
        borderWidth: 1,
        borderColor: Colors.primary,
        alignItems: 'center',
    },
    addAddressText: { color: Colors.primary, fontWeight: '700' },
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: Colors.card,
        paddingHorizontal: 20,
        paddingVertical: 16,
        paddingBottom: 34,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderTopWidth: 1,
        borderTopColor: Colors.border,
        ...Shadows.medium,
    },
    footerPrice: { flex: 1 },
    footerLabel: { fontSize: 12, color: Colors.muted, marginBottom: 2 },
    footerAmount: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.health },
    bookBtn: {
        backgroundColor: Colors.primary,
        paddingHorizontal: 40,
        paddingVertical: 16,
        borderRadius: 16,
        ...Shadows.card,
    },
    bookBtnText: { color: '#fff', fontSize: FontSize.base, fontWeight: '800' },
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
});
