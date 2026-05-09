import React from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    RefreshControl,
    Alert,
    Modal,
    TextInput,
    BackHandler,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { walletService } from '@/services/wallet.service';
import { paymentService } from '@/services/payment.service';
import { Colors, Shadows } from '@/constants/colors';
import { FontSize } from '@/constants/spacing';
import { ErrorState } from '@/components/ui/EmptyState';
import { formatCurrency } from '@/utils/formatters';

export default function WalletScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const qc = useQueryClient();
    const [isAddModalVisible, setIsAddModalVisible] = React.useState(false);
    const [amountInput, setAmountInput] = React.useState('');

    const {
        data: wallet,
        isLoading,
        isError,
        refetch,
        isRefetching
    } = useQuery({
        queryKey: ['wallet'],
        queryFn: walletService.getWallet,
    });

    // Ensure admin-side topups show up as soon as the screen is opened
    useFocusEffect(
        React.useCallback(() => {
            refetch();
            
            const onBackPress = () => {
                router.push('/profile');
                return true;
            };
            const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
            return () => subscription.remove();
        }, [refetch])
    );

    const addMoneyMutation = useMutation({
        mutationFn: async (amount: number) => {
            console.log(`[Wallet] Starting topup: ${amount}`);
            // STEP 1: Create Order in Backend (Pending state)
            const order = await paymentService.createOrder({
                amount,
                type: "WALLET_TOPUP"
            });
            console.log(`[Wallet] Order created: ${order._id}. Now initiating gateway...`);

            // STEP 2: Initiate with Gateway (Get Hash and Params)
            const params = await paymentService.initiatePayment(order._id);
            console.log(`[Wallet] Gateway initiation success. Redirecting to Easebuzz...`);

            // STEP 3: Navigate to Payment Checkout Screen
            router.push({
                pathname: "/checkout/easebuzz" as any,
                params: { ...params }
            });
            
            return order;
        },
        onError: (err: any) => {
             Alert.alert("Payment Error", "Unable to start payment. Please try again.");
        }
    });

    const handleAddMoneySubmit = () => {
        const amt = parseFloat(amountInput);
        if (isNaN(amt) || amt <= 0) {
            Alert.alert("Invalid Amount", "Please enter a valid amount to add.");
            return;
        }
        addMoneyMutation.mutate(amt);
        setIsAddModalVisible(false);
        setAmountInput('');
    };

    const quickAmounts = [100, 500, 1000, 2000];

    return (
        <SafeAreaView style={styles.root} edges={['top']}>
            {/* Header */}
            <View style={[styles.header, { paddingTop: Math.max(insets.top, 14) }]}>
                <TouchableOpacity onPress={() => router.push('/profile')} style={styles.backBtn}>
                    <Text style={styles.backText}>←</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>My Wallet</Text>
                <View style={{ width: 44 }} />
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scroll}
                refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} colors={[Colors.primary]} />}
            >
                {isLoading ? (
                    <View style={styles.center}>
                        <ActivityIndicator size="large" color={Colors.primary} />
                    </View>
                ) : isError ? (
                    <ErrorState message="Could not load wallet details" onRetry={refetch} />
                ) : (
                    <>
                        {/* Balance Card */}
                        <TouchableOpacity activeOpacity={0.9} onPress={() => { }}>
                            <LinearGradient
                                colors={["#0D9488", "#2DD4BF"]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.balanceCard}
                            >
                                <Text style={styles.balanceLabel}>Available Balance</Text>
                                <Text style={styles.balanceAmount} numberOfLines={1} adjustsFontSizeToFit>{formatCurrency(wallet?.balance ?? 0)}</Text>
                                
                                <TouchableOpacity style={styles.addBtn} onPress={() => setIsAddModalVisible(true)}>
                                    <Text style={styles.addBtnText}>+ Add Money</Text>
                                </TouchableOpacity>
                            </LinearGradient>
                        </TouchableOpacity>

                        {/* Recent Transactions */}
                        <Text style={styles.sectionTitle}>Recent Transactions</Text>
                        {(wallet?.transactions ?? []).length === 0 ? (
                            <View style={styles.emptyTransactions}>
                                <Text style={styles.emptyIcon}>💸</Text>
                                <Text style={styles.emptyText}>No transactions yet.</Text>
                            </View>
                        ) : (
                            wallet!.transactions.slice().reverse().map((t) => (
                                <View key={t._id} style={styles.transactionCard}>
                                    <View style={styles.transIconContainer}>
                                        <Text style={styles.transIcon}>{t.type === 'Credit' ? '📥' : '📤'}</Text>
                                    </View>
                                    <View style={styles.transInfo}>
                                        <Text style={styles.transDesc}>{t.description}</Text>
                                        <Text style={styles.transDate}>{new Date(t.date).toLocaleString()}</Text>
                                    </View>
                                    <Text style={[styles.transAmount, { color: t.type === 'Credit' ? Colors.health : Colors.emergency }]}>
                                        {t.type === 'Credit' ? '+' : '-'}{formatCurrency(t.amount)}
                                    </Text>
                                </View>
                            ))
                        )}
                    </>
                )}
                <View style={{ height: 40 }} />
            </ScrollView>

            {/* Add Money Modal */}
            <Modal
                visible={isAddModalVisible}
                transparent
                animationType="slide"
                onRequestClose={() => setIsAddModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Add Money</Text>
                            <TouchableOpacity onPress={() => setIsAddModalVisible(false)}>
                                <Text style={styles.closeText}>✕</Text>
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.inputLabel}>Enter Amount (₹)</Text>
                        <TextInput
                            style={styles.amountInput}
                            placeholder="0.00"
                            keyboardType="numeric"
                            value={amountInput}
                            onChangeText={setAmountInput}
                            autoFocus
                        />

                        <View style={styles.quickGrid}>
                            {quickAmounts.map(amt => (
                                <TouchableOpacity
                                    key={amt}
                                    style={styles.quickChip}
                                    onPress={() => setAmountInput(amt.toString())}
                                >
                                    <Text style={styles.quickChipText}>+₹{amt}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <TouchableOpacity
                            style={[styles.confirmAddBtn, addMoneyMutation.isPending && { opacity: 0.7 }]}
                            onPress={handleAddMoneySubmit}
                            disabled={addMoneyMutation.isPending}
                        >
                            {addMoneyMutation.isPending ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.confirmAddText}>Confirm & Add</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
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
    center: { paddingVertical: 100, alignItems: 'center' },
    balanceCard: {
        borderRadius: 24,
        padding: 32,
        alignItems: 'center',
        marginBottom: 32,
        elevation: 15,
        shadowColor: "#0D9488",
        shadowOffset: { width: 10, height: 15 },
        shadowOpacity: 0.25,
        shadowRadius: 20,
    },
    balanceLabel: { fontSize: FontSize.sm, color: 'rgba(255,255,255,0.8)', marginBottom: 8, fontWeight: '600' },
    balanceAmount: { fontSize: 44, fontWeight: '900', color: '#fff', marginBottom: 24, letterSpacing: -1 },
    addBtn: {
        backgroundColor: '#fff',
        paddingHorizontal: 28,
        paddingVertical: 14,
        borderRadius: 18,
        elevation: 5,
        shadowColor: "#000",
        shadowOpacity: 0.1,
        shadowRadius: 10,
    },
    addBtnText: { color: '#0D9488', fontWeight: '800', fontSize: FontSize.base },
    sectionTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary, marginBottom: 16 },
    transactionCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.card,
        padding: 16,
        borderRadius: 16,
        marginBottom: 12,
        ...Shadows.card,
    },
    transIconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: Colors.background,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    transIcon: { fontSize: 20 },
    transInfo: { flex: 1 },
    transDesc: { fontSize: FontSize.base, fontWeight: '600', color: Colors.textPrimary, marginBottom: 4 },
    transDate: { fontSize: 11, color: Colors.muted },
    transAmount: { fontSize: FontSize.base, fontWeight: '700' },
    emptyTransactions: { paddingVertical: 40, alignItems: 'center' },
    emptyIcon: { fontSize: 40, marginBottom: 12 },
    emptyText: { fontSize: FontSize.sm, color: Colors.textSecondary },

    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: Colors.card,
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        padding: 24,
        paddingBottom: 40,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    modalTitle: {
        fontSize: FontSize.lg,
        fontWeight: '700',
        color: Colors.textPrimary,
    },
    closeText: {
        fontSize: 18,
        color: Colors.textSecondary,
        padding: 4,
    },
    inputLabel: {
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
        marginBottom: 8,
    },
    amountInput: {
        fontSize: 32,
        fontWeight: '700',
        color: Colors.textPrimary,
        borderBottomWidth: 2,
        borderBottomColor: Colors.primary,
        paddingVertical: 8,
        marginBottom: 20,
    },
    quickGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 32,
    },
    quickChip: {
        backgroundColor: Colors.background,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    quickChipText: {
        fontSize: FontSize.sm,
        fontWeight: '600',
        color: Colors.primary,
    },
    confirmAddBtn: {
        backgroundColor: Colors.primary,
        borderRadius: 16,
        height: 56,
        justifyContent: 'center',
        alignItems: 'center',
        ...Shadows.card,
    },
    confirmAddText: {
        color: '#fff',
        fontSize: FontSize.base,
        fontWeight: '700',
    },
});
