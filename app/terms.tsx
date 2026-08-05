import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, BackHandler, useWindowDimensions, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useFocusEffect } from 'expo-router';
import RenderHtml from 'react-native-render-html';
import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';

const TERMS_SECTIONS = [
    {
        icon: 'medkit-outline' as const,
        color: '#DC2626', bg: '#FFF1F2',
        title: '1. Medical Disclaimer',
        body: 'A1Care facilitates the connection between patients and healthcare providers. We are not a medical institution. Any advice or services provided by doctors on our platform are the responsibility of the individual provider.',
    },
    {
        icon: 'card-outline' as const,
        color: '#7C3AED', bg: '#F3EEFF',
        title: '2. Payments & Refunds',
        body: 'All digital wallet top-ups are non-refundable unless a service is canceled 24 hours prior to the scheduled appointment. A1Care reserves the right to deduct platform fees prior to issuing refunds.',
    },
    {
        icon: 'ban-outline' as const,
        color: '#D97706', bg: '#FEF3C7',
        title: '3. Account Termination',
        body: 'We reserve the right to suspend or terminate accounts that violate our community guidelines, exhibit abusive behavior towards support staff, or attempt fraudulent transactions.',
    },
];

export default function TermsScreen() {
    const router = useRouter();
    const { width } = useWindowDimensions();

    const { data: termsData, isLoading } = useQuery({
        queryKey: ['cms-terms', 'CUSTOMER'],
        queryFn: async () => {
            const res = await api.get('/cms/public/CUSTOMER/TERMS');
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
                    <Text style={styles.headerTitle}>Terms of Service</Text>
                    <Text style={styles.headerSub}>A1Care User Agreement</Text>
                </View>
                <View style={{ width: 44 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

                {/* Hero Card */}
                <LinearGradient
                    colors={['#0D2E4D', '#1A5FAD', '#2878D0']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={styles.heroCard}
                >
                    <View style={styles.heroBlob1} />
                    <View style={styles.heroBlob2} />
                    <View style={styles.heroIconCircle}>
                        <Ionicons name="document-text" size={36} color="#fff" />
                    </View>
                    <Text style={styles.heroTitle}>Terms & Conditions</Text>
                    <Text style={styles.heroSub}>
                        By using A1Care, you agree to comply with and be bound by the following terms.
                    </Text>
                    <View style={styles.heroPill}>
                        <Ionicons name="time-outline" size={12} color="rgba(255,255,255,0.9)" />
                        <Text style={styles.heroPillText}>Effective Date: January 1, 2026</Text>
                    </View>
                </LinearGradient>

                {/* Content */}
                {termsData?.content ? (
                    <View style={styles.htmlCard}>
                        <RenderHtml
                            contentWidth={width - 80}
                            source={{ html: termsData.content }}
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
                            Welcome to A1Care. These Terms and Conditions outline the rules and regulations for the use of the A1Care mobile application and related healthcare services. Please read this agreement carefully before using our services.
                        </Text>

                        {TERMS_SECTIONS.map((sec, i) => (
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

                {/* Footer */}
                <View style={styles.footerNote}>
                    <Ionicons name="information-circle-outline" size={18} color="#64748B" />
                    <Text style={styles.footerNoteText}>
                        For questions about these terms, contact us at{' '}
                        <Text style={styles.footerNoteLink}>legal@a1care.in</Text>
                    </Text>
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F4F7FC' },

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

    // Intro
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

    // Section cards
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
    sectionTitle: { fontSize: 15, fontWeight: '900', color: '#0F172A', flex: 1 },
    sectionBody: { fontSize: 14, color: '#475569', lineHeight: 22, fontWeight: '500' },

    // HTML card
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
    htmlH2: { fontSize: 15, fontWeight: '800', color: '#0F172A', marginTop: 20, marginBottom: 8 } as any,
    htmlH3: { fontSize: 14, fontWeight: '800', color: '#334155', marginTop: 14, marginBottom: 6 } as any,
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
