import React, { useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { CheckCircle, XCircle, ChevronLeft, CreditCard, AlertCircle, RotateCcw } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useQueryClient } from "@tanstack/react-query";

const { width } = Dimensions.get("window");

export default function PaymentStatusScreen() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const { status, txnId, amount, type, description, bookingId, bookingType, paidAt, date, timeSlot, providerName, paymentMode } = useLocalSearchParams() as any;
    const txnDate = paidAt ? new Date(Number(paidAt)) : new Date();
    const isSuccess = status?.toUpperCase() === "SUCCESS";
    const isWallet = type === "WALLET_TOPUP";

    useEffect(() => {
        if (isSuccess) {
            queryClient.invalidateQueries({ queryKey: ["wallet"] });
            if (!isWallet) {
                queryClient.invalidateQueries({ queryKey: ["appointments"] });
                queryClient.invalidateQueries({ queryKey: ["service-booking"] });
            }
        }
    }, [isSuccess]);

    const typeLabel =
        type === "WALLET_TOPUP" ? "Wallet Top-up" :
        type === "BOOKING" ? "Booking Payment" :
        type === "SUBSCRIPTION" ? "Partner Plan" :
        "Payment";

    const primaryAction = () => {
        if (isWallet) { 
            router.replace("/wallet" as any); 
            return; 
        }
        if (bookingId) {
            const isDoctor = bookingType === "Doctor";
            const pathname = isDoctor ? "/doctor/appointment/[id]" : "/booking/[id]";
            router.replace({ pathname, params: { id: bookingId } } as any);
            return;
        }
        if (!isSuccess) {
            if (router.canGoBack()) {
                router.back();
            } else {
                router.replace("/(tabs)" as any);
            }
            return;
        }
        router.replace("/(tabs)/bookings" as any);
    };

    const primaryLabel = isSuccess
        ? (isWallet ? "Back to Wallet" : "View Booking")
        : "Try Again";

    return (
        <SafeAreaView style={styles.container}>
            <LinearGradient
                colors={isSuccess ? ["#E8F5E9", "#FFFFFF"] : ["#FEF2F2", "#FFFFFF"]}
                style={styles.headerGradient}
            >
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.replace("/(tabs)" as any)} style={styles.backButton}>
                        <ChevronLeft size={24} color={"#1E293B"} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Receipt</Text>
                    <View style={{ width: 40 }} />
                </View>

                <View style={styles.statusContainer}>
                    {isSuccess ? (
                        <View style={styles.iconCircleSuccess}>
                            <CheckCircle size={60} color="#10B981" />
                        </View>
                    ) : (
                        <View style={styles.iconCircleErrorPremium}>
                            <View style={styles.iconGlowError}>
                                <XCircle size={56} color="#FFFFFF" strokeWidth={2} />
                            </View>
                        </View>
                    )}
                    <Text style={[styles.statusText, { color: isSuccess ? "#047857" : "#B91C1C" }]}>
                        {isSuccess ? "Payment Successful!" : "Payment Failed"}
                    </Text>
                    <Text style={styles.amountText}>₹{parseFloat(amount || "0").toFixed(2)}</Text>
                    
                    {!isSuccess && (
                        <Text style={styles.errorSubtext}>
                            We couldn't process your payment. If any amount was deducted, it will be refunded automatically within 3-5 business days.
                        </Text>
                    )}
                </View>
            </LinearGradient>

            <ScrollView contentContainerStyle={styles.detailsContainer} showsVerticalScrollIndicator={false} bounces={false}>
                {/* Receipt Card */}
                <View style={styles.receiptWrapper}>
                    <View style={styles.receiptTopHole} />
                    <View style={styles.receiptBottomHole} />
                    
                    <View style={styles.card}>
                        <Text style={styles.receiptTitle}>Transaction Details</Text>
                        
                        {description ? (
                            <>
                                <View style={styles.detailRow}>
                                    <Text style={styles.detailLabel}>Description</Text>
                                    <Text style={[styles.detailValue, { flex: 1, textAlign: 'right' }]} numberOfLines={2}>{description}</Text>
                                </View>
                                <View style={styles.dashedDivider} />
                            </>
                    ) : null}
                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Transaction ID</Text>
                        <Text style={styles.detailValue} selectable>{txnId || "N/A"}</Text>
                    </View>
                    <View style={styles.dashedDivider} />
                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Payment Type</Text>
                        <Text style={styles.detailValue}>{typeLabel}</Text>
                    </View>
                    <View style={styles.dashedDivider} />
                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Method</Text>
                        <Text style={styles.detailValue}>
                            {String(paymentMode) === 'PACKAGE' ? 'Free via Package' : String(paymentMode) === 'WALLET' ? 'A1 Wallet' : String(description || '').includes('Easebuzz') ? 'Easebuzz Payment Gateway' : 'UPI / Online Payments'}
                        </Text>
                    </View>
                    <View style={styles.dashedDivider} />
                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Date & Time</Text>
                        <Text style={styles.detailValue}>
                            {txnDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} at {txnDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                    </View>
                    
                    <View style={styles.totalBox}>
                        <Text style={styles.totalLabel}>Amount {isSuccess ? 'Paid' : 'Attempted'}</Text>
                        <Text style={[styles.totalValue, { color: isSuccess ? '#059669' : '#DC2626' }]}>
                            ₹{parseFloat(amount || "0").toFixed(2)}
                        </Text>
                    </View>
                </View>
                </View>

                {isSuccess && isWallet && (
                    <View style={styles.infoBox}>
                        <CreditCard size={20} color="#3B82F6" />
                        <Text style={styles.infoText}>Your wallet balance has been credited automatically.</Text>
                    </View>
                )}

                {!isSuccess && (
                    <View style={styles.errorHelpBox}>
                        <AlertCircle size={24} color="#D97706" style={{ marginTop: 2 }} />
                        <View style={{ flex: 1, marginLeft: 12 }}>
                            <Text style={styles.errorHelpTitle}>What happens next?</Text>
                            <Text style={styles.errorHelpText}>Your booking has been placed on hold. Please try another payment method or try again to secure your booking.</Text>
                        </View>
                    </View>
                )}

                {isSuccess && !isWallet && (
                    <View style={styles.bookingCard}>
                        <Text style={styles.bookingCardTitle}>Appointment Details</Text>
                        
                        <View style={styles.bookingRow}>
                            <Text style={styles.bookingLabel}>Booking Ref</Text>
                            <Text style={styles.bookingValue}>#{bookingId || "N/A"}</Text>
                        </View>
                        <View style={styles.bookingDivider} />

                        {providerName ? (
                            <>
                                <View style={styles.bookingRow}>
                                    <Text style={styles.bookingLabel}>Doctor / Provider</Text>
                                    <Text style={styles.bookingValue}>Dr. {providerName}</Text>
                                </View>
                                <View style={styles.bookingDivider} />
                            </>
                        ) : null}

                        {date ? (
                            <>
                                <View style={styles.bookingRow}>
                                    <Text style={styles.bookingLabel}>Scheduled Date</Text>
                                    <Text style={styles.bookingValue}>
                                        {new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                    </Text>
                                </View>
                                <View style={styles.bookingDivider} />
                            </>
                        ) : null}

                        {timeSlot ? (
                            <>
                                <View style={styles.bookingRow}>
                                    <Text style={styles.bookingLabel}>Time Slot</Text>
                                    <Text style={styles.bookingValue}>{timeSlot}</Text>
                                </View>
                                <View style={styles.bookingDivider} />
                            </>
                        ) : null}

                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 8 }}>
                            <CheckCircle size={16} color="#10B981" />
                            <Text style={{ fontSize: 13, color: '#059669', fontWeight: '600' }}>Confirmed & Active</Text>
                        </View>
                    </View>
                )}
                <View style={{ height: 40 }} />
            </ScrollView>

            <View style={styles.footer}>
                <TouchableOpacity
                    style={styles.primaryBtnWrap}
                    onPress={primaryAction}
                    activeOpacity={0.88}
                >
                    <LinearGradient 
                        colors={isSuccess ? ["#059669", "#047857"] : ["#DC2626", "#B91C1C"]} 
                        start={{x: 0, y: 0}} end={{x: 1, y: 1}}
                        style={styles.primaryBtnGradient}
                    >
                        {!isSuccess && <RotateCcw size={20} color="#FFFFFF" style={{ marginRight: 8 }} />}
                        <Text style={styles.primaryBtnText}>{primaryLabel}</Text>
                    </LinearGradient>
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.secondaryBtn}
                    onPress={() => router.replace("/(tabs)" as any)}
                    activeOpacity={0.7}
                >
                    <Text style={styles.secondaryBtnText}>Return to Home</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#F4F7FC" },
    headerGradient: {
        paddingBottom: 60,
        borderBottomLeftRadius: 40,
        borderBottomRightRadius: 40,
        paddingTop: 10,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 20,
        paddingTop: 10,
    },
    backButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: "rgba(0,0,0,0.06)",
        justifyContent: "center",
        alignItems: "center",
    },
    headerTitle: { fontSize: 18, fontWeight: "800", color: "#0F172A", letterSpacing: -0.3 },
    statusContainer: {
        alignItems: "center",
        marginTop: 20,
        paddingHorizontal: 30,
    },
    iconCircleSuccess: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: "rgba(16, 185, 129, 0.12)",
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 16,
    },
    iconCircleErrorPremium: {
        width: 110,
        height: 110,
        borderRadius: 55,
        backgroundColor: "rgba(239, 68, 68, 0.1)",
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 16,
    },
    iconGlowError: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: "#DC2626",
        justifyContent: "center",
        alignItems: "center",
        shadowColor: "#DC2626",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
        elevation: 8,
    },
    statusText: { fontSize: 28, fontWeight: "900", marginBottom: 8, letterSpacing: -0.5 },
    amountText: { fontSize: 44, fontWeight: "900", color: "#0F172A", letterSpacing: -1.5 },
    errorSubtext: {
        fontSize: 14,
        color: "#64748B",
        textAlign: "center",
        marginTop: 12,
        lineHeight: 22,
        fontWeight: "500",
    },
    detailsContainer: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 40, marginTop: -30 },
    
    // Receipt Styles
    receiptWrapper: {
        position: 'relative',
        backgroundColor: "#FFFFFF",
        borderRadius: 24,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.05,
        shadowRadius: 20,
        elevation: 6,
        overflow: 'hidden',
    },
    receiptTopHole: { position: 'absolute', top: -12, left: -12, width: 24, height: 24, borderRadius: 12, backgroundColor: '#F4F7FC', zIndex: 2 },
    receiptBottomHole: { position: 'absolute', top: -12, right: -12, width: 24, height: 24, borderRadius: 12, backgroundColor: '#F4F7FC', zIndex: 2 },
    
    card: {
        padding: 24,
        borderWidth: 1,
        borderColor: "rgba(226, 232, 240, 0.5)",
        borderRadius: 24,
    },
    receiptTitle: {
        fontSize: 14,
        fontWeight: "800",
        color: "#0F172A",
        textTransform: "uppercase",
        letterSpacing: 1,
        marginBottom: 20,
        textAlign: "center",
    },
    detailRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
        paddingVertical: 14,
    },
    detailLabel: { fontSize: 14, color: "#64748B", fontWeight: "600" },
    detailValue: { fontSize: 14, fontWeight: "800", color: "#0F172A", textAlign: "right" },
    dashedDivider: {
        height: 1,
        borderWidth: 1,
        borderColor: "#E2E8F0",
        borderStyle: "dashed",
        marginVertical: 4,
    },
    totalBox: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        padding: 16,
        borderRadius: 16,
        marginTop: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    totalLabel: { fontSize: 16, fontWeight: '700', color: '#334155' },
    totalValue: { fontSize: 20, fontWeight: '900' },
    
    infoBox: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#EFF6FF",
        padding: 16,
        borderRadius: 16,
        marginTop: 20,
        gap: 12,
        borderWidth: 1,
        borderColor: "#BFDBFE",
    },
    infoText: { fontSize: 14, color: "#1E40AF", flex: 1, fontWeight: "600", lineHeight: 20 },
    errorHelpBox: {
        flexDirection: "row",
        backgroundColor: "#FFFBEB",
        padding: 20,
        borderRadius: 20,
        marginTop: 24,
        borderWidth: 1,
        borderColor: "#FDE68A",
    },
    errorHelpTitle: { fontSize: 15, color: "#92400E", fontWeight: "800", marginBottom: 6 },
    errorHelpText: { fontSize: 13, color: "#92400E", lineHeight: 20, fontWeight: "500" },
    
    footer: { padding: 24, paddingBottom: 36, backgroundColor: "#FFFFFF", borderTopWidth: 1, borderColor: '#F1F5F9' },
    primaryBtnWrap: {
        borderRadius: 18,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
        elevation: 6,
        marginBottom: 16,
    },
    primaryBtnGradient: {
        height: 60,
        borderRadius: 18,
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
    },
    primaryBtnText: { color: "#FFFFFF", fontSize: 17, fontWeight: "900", letterSpacing: 0.5 },
    secondaryBtn: {
        height: 56,
        borderRadius: 18,
        backgroundColor: "#F8FAFC",
        justifyContent: "center",
        alignItems: "center",
        borderWidth: 1.5,
        borderColor: "#E2E8F0",
    },
    secondaryBtnText: { color: "#475569", fontSize: 16, fontWeight: "800" },
    bookingCard: {
        backgroundColor: "#FFFFFF",
        borderRadius: 24,
        padding: 24,
        borderWidth: 1,
        borderColor: "#E2E8F0",
        marginTop: 20,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
        elevation: 2,
    },
    bookingCardTitle: {
        fontSize: 17,
        fontWeight: "800",
        color: "#1E293B",
        marginBottom: 16,
    },
    bookingRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: 12,
    },
    bookingLabel: {
        fontSize: 14,
        color: "#64748B",
        fontWeight: "500",
    },
    bookingValue: {
        fontSize: 15,
        fontWeight: "700",
        color: "#1E293B",
    },
    bookingDivider: {
        height: 1,
        backgroundColor: "#F1F5F9",
    },
});
