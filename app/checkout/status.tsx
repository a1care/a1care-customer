import React, { useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { CheckCircle, XCircle, ChevronLeft, CreditCard, RefreshCw } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useQueryClient } from "@tanstack/react-query";

export default function PaymentStatusScreen() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const { status, txnId, amount, type, description, bookingId, bookingType, paidAt, date, timeSlot, providerName } = useLocalSearchParams() as any;
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
        "Payment";

    const primaryAction = () => {
        if (!isSuccess) { router.back(); return; }
        if (isWallet) { router.replace("/wallet" as any); return; }
        if (bookingId) {
            const isDoctor = bookingType === "Doctor";
            const pathname = isDoctor ? "/doctor/appointment/[id]" : "/booking/[id]";
            router.replace({ pathname, params: { id: bookingId } } as any);
            return;
        }
        router.replace("/(tabs)/bookings" as any);
    };

    const primaryLabel = isSuccess
        ? (isWallet ? "Back to Wallet" : "View Booking")
        : "Go Back";

    return (
        <SafeAreaView style={styles.container}>
            <LinearGradient
                colors={isSuccess ? ["#E8F5E9", "#FFFFFF"] : ["#FFEBEE", "#FFFFFF"]}
                style={styles.headerGradient}
            >
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.replace("/(tabs)" as any)} style={styles.backButton}>
                        <ChevronLeft size={24} color="#1E293B" />
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
                        <View style={styles.iconCircleError}>
                            <XCircle size={60} color="#EF4444" />
                        </View>
                    )}
                    <Text style={[styles.statusText, { color: isSuccess ? "#059669" : "#DC2626" }]}>
                        {isSuccess ? "Payment Successful!" : "Payment Failed"}
                    </Text>
                    <Text style={styles.amountText}>₹{parseFloat(amount || "0").toFixed(2)}</Text>
                </View>
            </LinearGradient>

            <ScrollView style={styles.detailsContainer}>
                <View style={styles.card}>
                    {description ? (
                        <>
                            <View style={styles.detailRow}>
                                <Text style={styles.detailLabel}>Description</Text>
                                <Text style={[styles.detailValue, { flex: 1, textAlign: 'right' }]} numberOfLines={2}>{description}</Text>
                            </View>
                            <View style={styles.divider} />
                        </>
                    ) : null}
                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Transaction ID</Text>
                        <Text style={styles.detailValue} numberOfLines={1}>{txnId || "N/A"}</Text>
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Payment Type</Text>
                        <Text style={styles.detailValue}>{typeLabel}</Text>
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Method</Text>
                        <Text style={styles.detailValue}>{String(description || '').includes('Easebuzz') ? 'Easebuzz' : 'Razorpay'}</Text>
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Date & Time</Text>
                        <Text style={styles.detailValue}>
                            {txnDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </Text>
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Amount Paid</Text>
                        <Text style={[styles.detailValue, { color: isSuccess ? '#059669' : '#DC2626', fontWeight: '800' }]}>
                            ₹{parseFloat(amount || "0").toFixed(2)}
                        </Text>
                    </View>
                </View>

                {isSuccess && isWallet && (
                    <View style={styles.infoBox}>
                        <CreditCard size={20} color="#3B82F6" />
                        <Text style={styles.infoText}>Your wallet balance has been credited automatically.</Text>
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
            </ScrollView>

            <View style={styles.footer}>
                <TouchableOpacity
                    style={[styles.button, { backgroundColor: isSuccess ? "#10B981" : "#1E293B" }]}
                    onPress={primaryAction}
                >
                    <Text style={styles.buttonText}>{primaryLabel}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.button, { backgroundColor: "transparent", marginTop: 12, borderWidth: 1, borderColor: "#E2E8F0" }]}
                    onPress={() => router.replace("/(tabs)" as any)}
                >
                    <Text style={[styles.buttonText, { color: "#64748B" }]}>Return to Home</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#FFFFFF" },
    headerGradient: {
        paddingBottom: 40,
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 20,
        paddingTop: 10,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: "rgba(0,0,0,0.05)",
        justifyContent: "center",
        alignItems: "center",
    },
    headerTitle: { fontSize: 18, fontWeight: "600", color: "#1E293B" },
    statusContainer: {
        alignItems: "center",
        marginTop: 30,
    },
    iconCircleSuccess: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: "rgba(16, 185, 129, 0.1)",
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 20,
    },
    iconCircleError: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: "rgba(239, 68, 68, 0.1)",
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 20,
    },
    statusText: { fontSize: 24, fontWeight: "700", marginBottom: 10 },
    amountText: { fontSize: 36, fontWeight: "800", color: "#1E293B" },
    detailsContainer: { flex: 1, padding: 20 },
    card: {
        backgroundColor: "#F8FAFC",
        borderRadius: 20,
        padding: 20,
        borderWidth: 1,
        borderColor: "#E2E8F0",
    },
    detailRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: 12,
    },
    detailLabel: { fontSize: 14, color: "#64748B" },
    detailValue: { fontSize: 14, fontWeight: "600", color: "#1E293B" },
    divider: { height: 1, backgroundColor: "#E2E8F0" },
    infoBox: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#EFF6FF",
        padding: 15,
        borderRadius: 15,
        marginTop: 20,
        gap: 10,
    },
    infoText: { fontSize: 13, color: "#1E40AF", flex: 1 },
    footer: { padding: 20, paddingBottom: 30 },
    button: {
        height: 56,
        borderRadius: 16,
        justifyContent: "center",
        alignItems: "center",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
    },
    buttonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
    bookingCard: {
        backgroundColor: "#FFFFFF",
        borderRadius: 20,
        padding: 20,
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
        fontSize: 16,
        fontWeight: "700",
        color: "#1E293B",
        marginBottom: 16,
    },
    bookingRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: 10,
    },
    bookingLabel: {
        fontSize: 13,
        color: "#64748B",
        fontWeight: "500",
    },
    bookingValue: {
        fontSize: 14,
        fontWeight: "600",
        color: "#1E293B",
    },
    bookingDivider: {
        height: 1,
        backgroundColor: "#F1F5F9",
    },
});
