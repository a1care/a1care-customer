import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, BackHandler, useWindowDimensions, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useFocusEffect } from 'expo-router';
import RenderHtml from 'react-native-render-html';
import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';

const POLICY_SECTIONS = [
    { icon: 'person-outline' as const, color: '#2563EB', bg: '#EEF4FF', title: 'Data Collection', body: 'We collect your location (for matching providers nearby), your contact details (for OTP messages), and basic KYC data for providing you seamless medical bookings.' },
    { icon: 'share-social-outline' as const, color: '#7C3AED', bg: '#F3EEFF', title: 'Information Sharing', body: "We only share necessary details (like your name and location) with the healthcare provider you've booked. We do not sell your data to third-party advertisers." },
    { icon: 'shield-checkmark-outline' as const, color: '#16A34A', bg: '#ECFDF5', title: 'Data Security', body: 'We employ industry-standard encryption protocols for data at rest and in transit to ensure your health and financial information is always protected.' },
    { icon: 'lock-closed-outline' as const, color: '#D97706', bg: '#FEF3C7', title: 'Your Rights', body: 'You have the right to access, correct, or delete your personal data at any time. Contact our support team to exercise any of your data rights.' },
];

export default function PrivacyScreen() {
    const router = useRouter();
    const { width } = useWindowDimensions();

    const { data: privacyData, isLoading } = useQuery({
        queryKey: ['cms-privacy', 'CUSTOMER'],
        queryFn: async () => {
            const res = await api.get('/cms/public/CUSTOMER/PRIVACY');
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
                    <Text style={styles.headerTitle}>Privacy Policy</Text>
                    <Text style={styles.headerSub}>How we protect your data</Text>
                </View>
                <View style={{ width: 44 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

                {/* Hero Card */}
                <LinearGradient
                    colors={['#0B3370', '#1A5FAD', '#2878D0']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={styles.heroCard}
                >
                    <View style={styles.heroBlob1} />
                    <View style={styles.heroBlob2} />
                    <View style={styles.heroIconCircle}>
                        <Ionicons name="shield-checkmark" size={36} color="#fff" />
                    </View>
                    <Text style={styles.heroTitle}>Your Privacy Matters</Text>
                    <Text style={styles.heroSub}>
                        At A1Care, your privacy and the security of your health data are our top priorities.
                    </Text>
                    <View style={styles.heroPill}>
                        <Ionicons name="time-outline" size={12} color="rgba(255,255,255,0.9)" />
                        <Text style={styles.heroPillText}>Effective Date: January 1, 2026</Text>
                    </View>
                </LinearGradient>

                {/* Dynamic HTML content OR fallback cards */}
                {privacyData?.content ? (
                    <View style={styles.htmlCard}>
                        <RenderHtml
                            contentWidth={width - 80}
                            source={{ html: privacyData.content }}
                            tagsStyles={{
                                p: styles.htmlText,
                                span: styles.htmlText,
                                li: styles.htmlText,
                                h1: styles.htmlH1,
                                h2: styles.htmlH2,
                                h3: styles.htmlH3,
                                strong: styles.htmlBold,
                            }}
                        />
                    </View>
                ) : (
                    <>
                        <Text style={styles.introText}>
                            This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our mobile application and related healthcare services. Please read this policy carefully.
                        </Text>

                        {POLICY_SECTIONS.map((sec, i) => (
                            <View key={i} style={styles.sectionCard}>
                                <View style={styles.sectionTop}>
                                    <View style={[styles.sectionIconBox, { backgroundColor: sec.bg }]}>
                                        <Ionicons name={sec.icon} size={20} color={sec.color} />
                                    </View>
                                    <Text style={styles.sectionTitle}>{sec.title}</Text>
                                </View>
                                <Text style={styles.sectionBody}>{sec.body}</Text>
                            </View>
                        ))}
                    </>
                )}

                {/* Footer note */}
                <View style={styles.footerNote}>
                    <Ionicons name="information-circle-outline" size={18} color="#64748B" />
                    <Text style={styles.footerNoteText}>
                        For questions about this policy, contact us at{' '}
                        <Text style={styles.footerNoteLink}>privacy@a1care.in</Text>
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

    content: { paddingHorizontal: 20, paddingTop: 24 },

    // Hero
    heroCard: {
        borderRadius: 28,
        padding: 28,
        marginBottom: 24,
        alignItems: 'center',
        overflow: 'hidden',
        position: 'relative',
        shadowColor: '#0B3370',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.22,
        shadowRadius: 24,
        elevation: 10,
    },
    heroBlob1: { position: 'absolute', top: -40, right: -40, width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(255,255,255,0.06)' },
    heroBlob2: { position: 'absolute', bottom: -20, left: -20, width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.05)' },
    heroIconCircle: {
        width: 76, height: 76, borderRadius: 38,
        backgroundColor: 'rgba(255,255,255,0.15)',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
        justifyContent: 'center', alignItems: 'center',
        marginBottom: 16,
    },
    heroTitle: { fontSize: 22, fontWeight: '900', color: '#fff', marginBottom: 10, textAlign: 'center' },
    heroSub: { fontSize: 13, color: 'rgba(255,255,255,0.82)', textAlign: 'center', lineHeight: 20, fontWeight: '500', marginBottom: 18 },
    heroPill: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: 'rgba(255,255,255,0.15)',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
        paddingHorizontal: 14, paddingVertical: 7,
        borderRadius: 20,
    },
    heroPillText: { color: 'rgba(255,255,255,0.9)', fontSize: 12, fontWeight: '700' },

    // Intro text
    introText: {
        fontSize: 14,
        color: '#475569',
        lineHeight: 22,
        fontWeight: '500',
        marginBottom: 20,
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 18,
        shadowColor: '#0A1A3A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.03,
        shadowRadius: 10,
        elevation: 2,
    },

    // Policy section cards
    sectionCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: 20,
        marginBottom: 14,
        shadowColor: '#0A1A3A',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.04,
        shadowRadius: 18,
        elevation: 4,
        borderWidth: 1,
        borderColor: '#E8EEF5',
    },
    sectionTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
    sectionIconBox: {
        width: 44, height: 44, borderRadius: 16,
        justifyContent: 'center', alignItems: 'center',
    },
    sectionTitle: { fontSize: 16, fontWeight: '900', color: '#0F172A', letterSpacing: -0.2, flex: 1 },
    sectionBody: { fontSize: 14, color: '#475569', lineHeight: 22, fontWeight: '500' },

    // HTML rendering (when backend content exists)
    htmlCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: 20,
        marginBottom: 16,
        shadowColor: '#0A1A3A',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.04,
        shadowRadius: 18,
        elevation: 4,
    },
    htmlText: { fontSize: 14, color: '#475569', lineHeight: 24, fontWeight: '500' } as any,
    htmlH1: { fontSize: 16, fontWeight: '900', color: '#0F172A', marginBottom: 8 } as any,
    htmlH2: { fontSize: 18, fontWeight: '800', color: '#0F172A', marginTop: 20, marginBottom: 8 } as any,
    htmlH3: { fontSize: 15, fontWeight: '800', color: '#334155', marginTop: 14, marginBottom: 6 } as any,
    htmlBold: { fontWeight: '800', color: '#0F172A' } as any,

    // Footer
    footerNote: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
        backgroundColor: '#FFFFFF',
        padding: 16,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: '#E8EEF5',
        marginTop: 4,
    },
    footerNoteText: { flex: 1, fontSize: 13, color: '#64748B', fontWeight: '600', lineHeight: 20 },
    footerNoteLink: { color: '#0B3370', fontWeight: '900' },
});
