import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, BackHandler, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useFocusEffect } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';

const DEFAULT_FAQS = [
    { question: 'How do I book a service?', answer: "You can book a service by browsing through the categories on the Home screen and selecting the service or doctor of your choice.", icon: 'calendar-outline' as const, color: '#2563EB', bg: '#EEF4FF' },
    { question: 'What are your payment methods?', answer: 'We accept payments via A1Care Wallet, UPI, Credit/Debit cards, and NetBanking.', icon: 'card-outline' as const, color: '#7C3AED', bg: '#F3EEFF' },
    { question: 'How do I cancel my request?', answer: "You can cancel any pending request from your 'My Bookings' section. Cancellation fees may apply if the provider is already en route.", icon: 'close-circle-outline' as const, color: '#DC2626', bg: '#FFF1F2' },
    { question: 'Is home consultation available?', answer: "Yes, many of our partner doctors and services support home visits. Look for the 'Home Visit' badge.", icon: 'home-outline' as const, color: '#16A34A', bg: '#ECFDF5' },
    { question: 'How are my health records kept secure?', answer: 'Your health records are encrypted and stored securely. Only you and the healthcare providers you authorize can access them.', icon: 'shield-checkmark-outline' as const, color: '#D97706', bg: '#FFFBEB' },
    { question: 'What forms of payment do you accept?', answer: 'We accept UPI, Credit/Debit cards, NetBanking, and your A1Care Wallet balance.', icon: 'wallet-outline' as const, color: '#0891B2', bg: '#ECFEFF' },
];

export default function FAQScreen() {
    const router = useRouter();
    const [expanded, setExpanded] = useState<number | null>(null);

    const { data: faqData, isLoading } = useQuery({
        queryKey: ['cms-faq', 'CUSTOMER'],
        queryFn: async () => {
            const res = await api.get('/cms/public/CUSTOMER/FAQ');
            return res.data.data;
        }
    });

    useFocusEffect(
        React.useCallback(() => {
            const onBackPress = () => { router.push('/profile'); return true; };
            const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
            return () => subscription.remove();
        }, [])
    );

    const rawFaqs = faqData?.faqs && faqData.faqs.length > 0 ? faqData.faqs : DEFAULT_FAQS;
    // Merge icon/color from DEFAULT_FAQS if backend FAQs don't have them
    const faqItems = rawFaqs.map((faq: any, i: number) => ({
        ...faq,
        icon: faq.icon ?? DEFAULT_FAQS[i % DEFAULT_FAQS.length].icon,
        color: faq.color ?? DEFAULT_FAQS[i % DEFAULT_FAQS.length].color,
        bg: faq.bg ?? DEFAULT_FAQS[i % DEFAULT_FAQS.length].bg,
    }));

    if (isLoading) {
        return (
            <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color="#0B3370" />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.push('/profile')} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={22} color="#0F172A" />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={styles.headerTitle}>FAQ</Text>
                    <Text style={styles.headerSub}>Frequently Asked Questions</Text>
                </View>
                <View style={styles.faqCountBadge}>
                    <Text style={styles.faqCountText}>{faqItems.length}</Text>
                </View>
            </View>

            <ScrollView
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
            >
                {/* Hero strip */}
                <LinearGradient
                    colors={['#0B3370', '#2563EB']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={styles.heroStrip}
                >
                    <View style={styles.heroBlob} />
                    <Ionicons name="help-circle-outline" size={32} color="rgba(255,255,255,0.8)" />
                    <View style={{ flex: 1, marginLeft: 14 }}>
                        <Text style={styles.heroTitle}>Got Questions?</Text>
                        <Text style={styles.heroSub}>Find quick answers to common queries below</Text>
                    </View>
                </LinearGradient>

                {/* FAQ Accordion */}
                <View style={styles.faqCard}>
                    {faqItems.map((faq: any, i: number) => {
                        const isOpen = expanded === i;
                        return (
                            <View key={i}>
                                <TouchableOpacity
                                    style={styles.faqRow}
                                    onPress={() => setExpanded(isOpen ? null : i)}
                                    activeOpacity={0.85}
                                >
                                    <View style={[styles.faqIconBox, { backgroundColor: faq.bg }]}>
                                        <Ionicons name={faq.icon} size={18} color={faq.color} />
                                    </View>
                                    <Text style={[styles.question, isOpen && { color: '#0B3370' }]} numberOfLines={isOpen ? undefined : 2}>
                                        {faq.question || faq.q}
                                    </Text>
                                    <View style={[styles.chevronBox, isOpen && styles.chevronBoxActive]}>
                                        <Ionicons
                                            name={isOpen ? 'chevron-up' : 'chevron-down'}
                                            size={15}
                                            color={isOpen ? '#0B3370' : '#94A3B8'}
                                        />
                                    </View>
                                </TouchableOpacity>

                                {isOpen && (
                                    <View style={styles.answerBox}>
                                        <View style={[styles.answerAccent, { backgroundColor: faq.color }]} />
                                        <Text style={styles.answer}>{faq.answer || faq.a}</Text>
                                    </View>
                                )}

                                {i < faqItems.length - 1 && <View style={styles.divider} />}
                            </View>
                        );
                    })}
                </View>

                {/* Bottom tip */}
                <View style={styles.tipBox}>
                    <Ionicons name="chatbubble-ellipses-outline" size={20} color="#0B3370" />
                    <Text style={styles.tipText}>
                        Can't find your answer?{' '}
                        <Text style={styles.tipLink} onPress={() => router.push('/support' as any)}>
                            Contact Support
                        </Text>
                    </Text>
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F4F7FC' },

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
    faqCountBadge: {
        backgroundColor: '#EEF4FF',
        paddingHorizontal: 10, paddingVertical: 6,
        borderRadius: 14, borderWidth: 1, borderColor: '#BFDBFE',
    },
    faqCountText: { fontSize: 13, fontWeight: '900', color: '#2563EB' },

    content: { paddingHorizontal: 20, paddingTop: 24 },

    // Hero
    heroStrip: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 24,
        padding: 20,
        marginBottom: 22,
        overflow: 'hidden',
        position: 'relative',
        shadowColor: '#0B3370',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 18,
        elevation: 8,
    },
    heroBlob: {
        position: 'absolute', top: -30, right: -30,
        width: 100, height: 100, borderRadius: 50,
        backgroundColor: 'rgba(255,255,255,0.07)',
    },
    heroTitle: { fontSize: 17, fontWeight: '900', color: '#fff', marginBottom: 4 },
    heroSub: { fontSize: 12, color: 'rgba(255,255,255,0.8)', fontWeight: '500', lineHeight: 18 },

    // FAQ Card
    faqCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 28,
        paddingHorizontal: 4,
        marginBottom: 16,
        shadowColor: '#0A1A3A',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.05,
        shadowRadius: 22,
        elevation: 6,
        overflow: 'hidden',
    },
    faqRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 18,
        paddingVertical: 18,
        gap: 14,
    },
    faqIconBox: {
        width: 40, height: 40, borderRadius: 14,
        justifyContent: 'center', alignItems: 'center',
    },
    question: { flex: 1, fontSize: 15, fontWeight: '800', color: '#0F172A', lineHeight: 21 },
    chevronBox: {
        width: 28, height: 28, borderRadius: 14,
        backgroundColor: '#F1F5F9',
        justifyContent: 'center', alignItems: 'center',
    },
    chevronBoxActive: {
        backgroundColor: '#EEF4FF',
        borderWidth: 1, borderColor: '#BFDBFE',
    },

    // Answer
    answerBox: {
        flexDirection: 'row',
        paddingHorizontal: 18,
        paddingBottom: 18,
        gap: 12,
    },
    answerAccent: {
        width: 3, borderRadius: 2,
        alignSelf: 'stretch',
        opacity: 0.7,
    },
    answer: {
        flex: 1,
        fontSize: 13,
        color: '#475569',
        lineHeight: 22,
        fontWeight: '500',
    },

    divider: { height: 1, backgroundColor: '#F1F5F9', marginHorizontal: 18 },

    // Tip
    tipBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: '#FFFFFF',
        padding: 18,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#E8EEF5',
        marginBottom: 8,
    },
    tipText: { flex: 1, fontSize: 13, color: '#64748B', fontWeight: '600', lineHeight: 19 },
    tipLink: { color: '#0B3370', fontWeight: '900', textDecorationLine: 'underline' },
});
