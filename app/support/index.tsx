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
    Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { ticketsService } from '@/services/tickets.service';
import { useConfigStore } from '@/stores/config.store';
import { Colors } from '@/constants/colors';
import { ErrorState } from '@/components/ui/EmptyState';

const FAQS = [
    { q: 'How do I cancel my booking?', a: "You can cancel any booking before the provider is dispatched from the 'My Bookings' section.", icon: 'calendar-outline' as const },
    { q: 'When will I get my refund?', a: 'Refunds for prepaid bookings typically reflect in your source account within 3-5 business days.', icon: 'card-outline' as const },
    { q: 'How do I prepare for a lab test?', a: 'Depending on the test, you may need to fast for 8-12 hours. We will notify you of specific requirements before your slot.', icon: 'flask-outline' as const },
];

const getStatusConfig = (status: string) => {
    switch (status) {
        case 'Pending': return { color: '#D97706', bg: '#FEF3C7', border: '#FDE68A' };
        case 'In Progress': return { color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' };
        case 'Resolved': return { color: '#16A34A', bg: '#ECFDF5', border: '#BBF7D0' };
        case 'Closed': return { color: '#64748B', bg: '#F1F5F9', border: '#E2E8F0' };
        default: return { color: '#64748B', bg: '#F1F5F9', border: '#E2E8F0' };
    }
};

export default function SupportDashboardScreen() {
    const router = useRouter();
    const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

    useFocusEffect(
        React.useCallback(() => {
            const onBackPress = () => { router.push('/profile'); return true; };
            const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
            return () => subscription.remove();
        }, [])
    );

    const { config } = useConfigStore();
    const supportPhone = config?.contact?.supportPhone || '90000 00000';

    const handleCall = () => Linking.openURL(`tel:${supportPhone.replace(/\s+/g, '')}`);

    const { data: tickets, isLoading, isError, refetch, isRefetching } = useQuery({
        queryKey: ['tickets'],
        queryFn: ticketsService.getMyTickets,
    });

    return (
        <SafeAreaView style={styles.root} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.push('/profile')} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={22} color="#0F172A" />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={styles.headerTitle}>Help & Support</Text>
                    <Text style={styles.headerSub}>We're here to help you</Text>
                </View>
                <View style={{ width: 44 }} />
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scroll}
                refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} colors={[Colors.primary]} />}
            >
                {/* My Tickets */}
                <View style={styles.sectionRow}>
                    <View style={styles.sectionLabelRow}>
                        <View style={[styles.sectionDot, { backgroundColor: '#2563EB' }]} />
                        <Text style={styles.sectionTitle}>My Tickets</Text>
                    </View>
                    <TouchableOpacity onPress={() => router.push('/support/create')} style={styles.newTicketBtn}>
                        <Ionicons name="add" size={14} color="#2563EB" />
                        <Text style={styles.newTicketText}>New Ticket</Text>
                    </TouchableOpacity>
                </View>

                {isLoading ? (
                    <ActivityIndicator size="small" color={Colors.primary} style={{ marginVertical: 28 }} />
                ) : isError ? (
                    <ErrorState message="Could not load tickets" onRetry={refetch} />
                ) : (tickets ?? []).length === 0 ? (
                    <View style={styles.emptyCard}>
                        <View style={styles.emptyIconBox}>
                            <Text style={{ fontSize: 32 }}>🎫</Text>
                        </View>
                        <Text style={styles.emptyTitle}>No active tickets</Text>
                        <Text style={styles.emptySub}>If you have an issue, raise a ticket and we'll help you out.</Text>
                        <TouchableOpacity onPress={() => router.push('/support/create')} style={styles.emptyCreateBtn}>
                            <Text style={styles.emptyCreateBtnText}>Raise a Ticket</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View style={{ gap: 12, marginBottom: 8 }}>
                        {(tickets ?? []).map((t) => {
                            const sc = getStatusConfig(t.status);
                            return (
                                <TouchableOpacity
                                    key={t._id}
                                    style={styles.ticketCard}
                                    activeOpacity={0.85}
                                    onPress={() => router.push({ pathname: '/support/chat', params: { ticketId: t._id, subject: t.subject } })}
                                >
                                    <View style={styles.ticketTopRow}>
                                        <View style={styles.ticketIconBox}>
                                            <Ionicons name="ticket-outline" size={18} color="#2563EB" />
                                        </View>
                                        <Text style={styles.ticketSubject} numberOfLines={1}>{t.subject}</Text>
                                        <View style={[styles.statusBadge, { backgroundColor: sc.bg, borderColor: sc.border }]}>
                                            <Text style={[styles.statusText, { color: sc.color }]}>{t.status}</Text>
                                        </View>
                                    </View>
                                    <Text style={styles.ticketDesc} numberOfLines={2}>{t.description}</Text>
                                    <View style={styles.ticketBottomRow}>
                                        <Ionicons name="time-outline" size={12} color="#94A3B8" />
                                        <Text style={styles.ticketDate}>{new Date(t.createdAt).toLocaleDateString()}</Text>
                                        <View style={styles.ticketPriorityPill}>
                                            <Text style={styles.ticketPriorityText}>{t.priority}</Text>
                                        </View>
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                )}

                {/* FAQs */}
                <View style={styles.sectionRow}>
                    <View style={styles.sectionLabelRow}>
                        <View style={[styles.sectionDot, { backgroundColor: '#7C3AED' }]} />
                        <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
                    </View>
                </View>

                <View style={styles.faqCard}>
                    {FAQS.map((faq, idx) => {
                        const isOpen = expandedFaq === idx;
                        return (
                            <View key={idx}>
                                <TouchableOpacity
                                    style={styles.faqRow}
                                    onPress={() => setExpandedFaq(isOpen ? null : idx)}
                                    activeOpacity={0.85}
                                >
                                    <View style={styles.faqIconBox}>
                                        <Ionicons name={faq.icon} size={16} color="#7C3AED" />
                                    </View>
                                    <Text style={styles.faqQ} numberOfLines={isOpen ? undefined : 1}>{faq.q}</Text>
                                    <Ionicons
                                        name={isOpen ? 'chevron-up' : 'chevron-down'}
                                        size={16}
                                        color="#94A3B8"
                                    />
                                </TouchableOpacity>
                                {isOpen && (
                                    <View style={styles.faqAnswer}>
                                        <Text style={styles.faqA}>{faq.a}</Text>
                                    </View>
                                )}
                                {idx < FAQS.length - 1 && <View style={styles.faqDivider} />}
                            </View>
                        );
                    })}
                </View>

                {/* Contact / Still Need Help */}
                <LinearGradient
                    colors={['#0B3370', '#1A5FAD']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={styles.contactCard}
                >
                    <View style={styles.contactBlob} />
                    <View style={styles.contactIconCircle}>
                        <Ionicons name="headset-outline" size={28} color="#fff" />
                    </View>
                    <Text style={styles.contactTitle}>Still need help?</Text>
                    <Text style={styles.contactSub}>Our support team is available 24/7 to assist you.</Text>
                    <TouchableOpacity style={styles.callBtn} onPress={handleCall} activeOpacity={0.88}>
                        <Ionicons name="call" size={16} color="#0B3370" />
                        <Text style={styles.callBtnText}>Call {supportPhone}</Text>
                    </TouchableOpacity>
                </LinearGradient>

                <View style={{ height: 50 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#F4F7FC' },

    // Header
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 14,
        backgroundColor: '#FFFFFF',
        shadowColor: '#0A1A3A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 12,
        elevation: 4,
    },
    backBtn: {
        width: 44, height: 44, borderRadius: 22,
        backgroundColor: '#F1F5F9',
        justifyContent: 'center', alignItems: 'center',
        marginRight: 14,
    },
    headerTitle: { fontSize: 20, fontWeight: '900', color: '#0F172A', letterSpacing: -0.3 },
    headerSub: { fontSize: 12, color: '#94A3B8', fontWeight: '600', marginTop: 2 },

    scroll: { paddingHorizontal: 20, paddingTop: 24 },

    // Section rows
    sectionRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    sectionLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    sectionDot: { width: 8, height: 8, borderRadius: 4 },
    sectionTitle: { fontSize: 17, fontWeight: '900', color: '#0F172A', letterSpacing: -0.2 },
    newTicketBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        backgroundColor: '#EEF4FF',
        paddingHorizontal: 12, paddingVertical: 7,
        borderRadius: 14,
        borderWidth: 1, borderColor: '#BFDBFE',
    },
    newTicketText: { color: '#2563EB', fontSize: 13, fontWeight: '800' },

    // Empty
    emptyCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 24, padding: 28,
        alignItems: 'center', marginBottom: 24,
        shadowColor: '#0A1A3A',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.04, shadowRadius: 20, elevation: 4,
    },
    emptyIconBox: {
        width: 72, height: 72, borderRadius: 36,
        backgroundColor: '#F8FAFC',
        justifyContent: 'center', alignItems: 'center', marginBottom: 14,
    },
    emptyTitle: { fontSize: 17, fontWeight: '900', color: '#0F172A', marginBottom: 6 },
    emptySub: { fontSize: 13, color: '#64748B', textAlign: 'center', lineHeight: 20, fontWeight: '500', marginBottom: 20 },
    emptyCreateBtn: {
        backgroundColor: '#EEF4FF',
        paddingHorizontal: 24, paddingVertical: 12,
        borderRadius: 20, borderWidth: 1, borderColor: '#BFDBFE',
    },
    emptyCreateBtnText: { color: '#2563EB', fontSize: 14, fontWeight: '900' },

    // Ticket Card
    ticketCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 22, padding: 18,
        shadowColor: '#0A1A3A',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.04, shadowRadius: 18, elevation: 4,
        borderWidth: 1, borderColor: '#E8EEF5',
    },
    ticketTopRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 10 },
    ticketIconBox: {
        width: 36, height: 36, borderRadius: 12,
        backgroundColor: '#EEF4FF',
        justifyContent: 'center', alignItems: 'center',
    },
    ticketSubject: { flex: 1, fontSize: 15, fontWeight: '900', color: '#0F172A' },
    statusBadge: {
        borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 14,
    },
    statusText: { fontSize: 11, fontWeight: '800' },
    ticketDesc: { fontSize: 13, color: '#64748B', marginBottom: 12, lineHeight: 19, fontWeight: '500' },
    ticketBottomRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    ticketDate: { flex: 1, fontSize: 12, color: '#94A3B8', fontWeight: '600' },
    ticketPriorityPill: {
        backgroundColor: '#F1F5F9', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10,
    },
    ticketPriorityText: { fontSize: 10, fontWeight: '800', color: '#64748B' },

    // FAQ
    faqCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 24, paddingHorizontal: 4,
        shadowColor: '#0A1A3A',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.04, shadowRadius: 20, elevation: 4,
        marginBottom: 24,
        overflow: 'hidden',
    },
    faqRow: {
        flexDirection: 'row', alignItems: 'center',
        padding: 18, gap: 12,
    },
    faqIconBox: {
        width: 36, height: 36, borderRadius: 12,
        backgroundColor: '#F3EEFF',
        justifyContent: 'center', alignItems: 'center',
    },
    faqQ: { flex: 1, fontSize: 14, fontWeight: '800', color: '#0F172A' },
    faqAnswer: {
        paddingHorizontal: 18, paddingBottom: 16, paddingLeft: 66,
    },
    faqA: { fontSize: 13, color: '#64748B', lineHeight: 21, fontWeight: '500' },
    faqDivider: { height: 1, backgroundColor: '#F1F5F9', marginHorizontal: 18 },

    // Contact
    contactCard: {
        borderRadius: 28, padding: 28,
        alignItems: 'center', overflow: 'hidden',
        position: 'relative',
        shadowColor: '#0B3370',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.22, shadowRadius: 24, elevation: 10,
    },
    contactBlob: {
        position: 'absolute', top: -50, right: -50,
        width: 160, height: 160, borderRadius: 80,
        backgroundColor: 'rgba(255,255,255,0.06)',
    },
    contactIconCircle: {
        width: 68, height: 68, borderRadius: 34,
        backgroundColor: 'rgba(255,255,255,0.15)',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
        justifyContent: 'center', alignItems: 'center',
        marginBottom: 16,
    },
    contactTitle: { fontSize: 20, fontWeight: '900', color: '#fff', marginBottom: 8 },
    contactSub: { fontSize: 13, color: 'rgba(255,255,255,0.8)', textAlign: 'center', lineHeight: 20, fontWeight: '500', marginBottom: 22 },
    callBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 28, paddingVertical: 16,
        borderRadius: 28,
        shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12, shadowRadius: 12, elevation: 6,
    },
    callBtnText: { color: '#0B3370', fontWeight: '900', fontSize: 15 },
});
