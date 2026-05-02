import React, { useState } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    RefreshControl,
    BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ticketsService } from '@/services/tickets.service';
import { useConfigStore } from '@/stores/config.store';
import { Linking } from 'react-native';
import { Colors, Shadows } from '@/constants/colors';
import { FontSize } from '@/constants/spacing';
import { ErrorState } from '@/components/ui/EmptyState';

const FAQS = [
    { q: "How do I cancel my booking?", a: "You can cancel any booking before the provider is dispatched from the 'My Bookings' section." },
    { q: "When will I get my refund?", a: "Refunds for prepaid bookings typically reflect in your source account within 3-5 business days." },
    { q: "How do I prepare for a lab test?", a: "Depending on the test, you may need to fast for 8-12 hours. We will notify you of specific requirements before your slot." },
];

export default function SupportDashboardScreen() {
    const router = useRouter();
    const qc = useQueryClient();
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Hardware back button should go to Profile Menu
    useFocusEffect(
        React.useCallback(() => {
            const onBackPress = () => {
                router.push('/profile');
                return true;
            };
            const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
            return () => subscription.remove();
        }, [])
    );

    const { config } = useConfigStore();
    const supportPhone = config?.contact?.supportPhone || '1800-123-4567';

    const handleCall = () => {
        Linking.openURL(`tel:${supportPhone.replace(/\s+/g, '')}`);
    };

    const {
        data: tickets,
        isLoading,
        isError,
        refetch,
        isRefetching
    } = useQuery({
        queryKey: ['tickets'],
        queryFn: ticketsService.getMyTickets,
    });

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Pending': return '#F39C12';
            case 'In Progress': return '#3498DB';
            case 'Resolved': return '#27AE60';
            case 'Closed': return '#7F8C8D';
            default: return Colors.textSecondary;
        }
    };

    return (
        <SafeAreaView style={styles.root} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.push('/profile')} style={styles.backBtn}>
                    <Text style={styles.backText}>←</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Help & Support</Text>
                <View style={{ width: 44 }} />
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scroll}
                refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} colors={[Colors.primary]} />}
            >
                {/* Tickets Section */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>My Tickets</Text>
                    <TouchableOpacity onPress={() => router.push('/support/create')} style={styles.createBtn}>
                        <Text style={styles.createBtnText}>+ New Ticket</Text>
                    </TouchableOpacity>
                </View>

                {isLoading ? (
                    <ActivityIndicator size="small" color={Colors.primary} style={styles.loader} />
                ) : isError ? (
                    <ErrorState message="Could not load tickets" onRetry={refetch} />
                ) : (tickets ?? []).length === 0 ? (
                    <View style={styles.emptyCard}>
                        <Text style={styles.emptyIcon}>🎫</Text>
                        <Text style={styles.emptyTitle}>No active tickets</Text>
                        <Text style={styles.emptySub}>If you have an issue, raise a ticket and we'll help you out.</Text>
                    </View>
                ) : (
                    (tickets ?? []).map((t) => (
                        <TouchableOpacity
                            key={t._id}
                            style={styles.ticketCard}
                            activeOpacity={0.8}
                            onPress={() => router.push({
                                pathname: '/support/chat',
                                params: { ticketId: t._id, subject: t.subject }
                            })}
                        >
                            <View style={styles.ticketTopRow}>
                                <Text style={styles.ticketSubject} numberOfLines={1}>{t.subject}</Text>
                                <View style={[styles.statusBadge, { borderColor: getStatusColor(t.status) }]}>
                                    <Text style={[styles.statusText, { color: getStatusColor(t.status) }]}>{t.status}</Text>
                                </View>
                            </View>
                            <Text style={styles.ticketDesc} numberOfLines={2}>{t.description}</Text>
                            <View style={styles.ticketBottomRow}>
                                <Text style={styles.tickerDate}>
                                    {new Date(t.createdAt).toLocaleDateString()}
                                </Text>
                                <Text style={styles.ticketPriority}>
                                    Priority: {t.priority}
                                </Text>
                            </View>
                        </TouchableOpacity>
                    ))
                )}

                {/* FAQs Section */}
                <Text style={[styles.sectionTitle, { marginTop: 32, marginBottom: 12 }]}>Frequently Asked Questions</Text>
                <View style={styles.faqContainer}>
                    {FAQS.map((faq, idx) => (
                        <View key={idx} style={styles.faqItem}>
                            <Text style={styles.faqQ}>Q: {faq.q}</Text>
                            <Text style={styles.faqA}>{faq.a}</Text>
                        </View>
                    ))}
                </View>

                {/* Contact Us */}
                <View style={styles.contactCard}>
                    <Text style={styles.contactTitle}>Still need help?</Text>
                    <Text style={styles.contactSub}>Reach out to our 24/7 support line.</Text>
                    <TouchableOpacity style={styles.callBtn} onPress={handleCall}>
                        <Text style={styles.callBtnText}>📞 Call {supportPhone}</Text>
                    </TouchableOpacity>
                </View>

                <View style={{ height: 60 }} />
            </ScrollView>
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

    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    sectionTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary },
    createBtn: {
        backgroundColor: Colors.primaryLight,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
    },
    createBtnText: { color: Colors.primary, fontSize: FontSize.sm, fontWeight: '700' },

    loader: { marginVertical: 32 },

    emptyCard: {
        backgroundColor: Colors.card,
        borderRadius: 16,
        padding: 24,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: Colors.border,
        borderStyle: 'dashed',
    },
    emptyIcon: { fontSize: 40, marginBottom: 12 },
    emptyTitle: { fontSize: FontSize.base, fontWeight: '700', color: Colors.textPrimary },
    emptySub: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', marginTop: 4 },

    ticketCard: {
        backgroundColor: Colors.card,
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        ...Shadows.card,
    },
    ticketTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    ticketSubject: { flex: 1, fontSize: FontSize.base, fontWeight: '700', color: Colors.textPrimary, paddingRight: 10 },
    statusBadge: { borderWidth: 1, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
    statusText: { fontSize: 10, fontWeight: '700' },
    ticketDesc: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: 12, lineHeight: 20 },
    ticketBottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    tickerDate: { fontSize: 11, color: Colors.muted },
    ticketPriority: { fontSize: 11, color: Colors.textSecondary, fontWeight: '500' },

    faqContainer: {
        backgroundColor: Colors.card,
        borderRadius: 16,
        padding: 16,
        ...Shadows.card,
    },
    faqItem: { marginBottom: 16, borderBottomWidth: 1, borderBottomColor: Colors.border, paddingBottom: 16 },
    faqQ: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textPrimary, marginBottom: 6 },
    faqA: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },

    contactCard: {
        backgroundColor: Colors.primaryLight,
        borderRadius: 16,
        padding: 20,
        marginTop: 24,
        alignItems: 'center',
    },
    contactTitle: { fontSize: FontSize.base, fontWeight: '700', color: Colors.primary, marginBottom: 4 },
    contactSub: { fontSize: FontSize.sm, color: Colors.primary, opacity: 0.8, marginBottom: 16 },
    callBtn: {
        backgroundColor: Colors.primary,
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 24,
    },
    callBtnText: { color: '#fff', fontWeight: '700', fontSize: FontSize.sm },
});
