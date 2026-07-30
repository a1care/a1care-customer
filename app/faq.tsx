import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, BackHandler, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';

const DEFAULT_FAQS = [
    { question: "How do I book a service?", answer: "You can book a service by browsing through the categories on the Home screen and selecting the service or doctor of your choice." },
    { question: "What are your payment methods?", answer: "We accept payments via A1Care Wallet, UPI, Credit/Debit cards, and NetBanking." },
    { question: "How do I cancel my request?", answer: "You can cancel any pending request from your 'My Bookings' section. Cancellation fees may apply if the provider is already en route." },
    { question: "Is home consultation available?", answer: "Yes, many of our partner doctors and services support home visits. Look for the 'Home Visit' badge." },
];

export default function FAQScreen() {
    const router = useRouter();
    const [expanded, setExpanded] = useState<number | null>(null);

    const { data: faqData, isLoading } = useQuery({
        queryKey: ["cms-faq", "CUSTOMER"],
        queryFn: async () => {
            const res = await api.get("/cms/public/CUSTOMER/FAQ");
            return res.data.data;
        }
    });

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

    const faqItems = faqData?.faqs && faqData.faqs.length > 0 ? faqData.faqs : DEFAULT_FAQS;

    if (isLoading) {
        return (
            <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color="#2D935C" />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.push('/profile')} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#1E293B" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Frequently Asked Qs</Text>
            </View>
            <ScrollView contentContainerStyle={styles.content}>
                {faqItems.map((faq: any, i: number) => (
                    <TouchableOpacity 
                        key={i} 
                        style={styles.card} 
                        activeOpacity={0.8}
                        onPress={() => setExpanded(expanded === i ? null : i)}
                    >
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text style={styles.question}>{faq.question || faq.q}</Text>
                            <Ionicons name={expanded === i ? "chevron-up" : "chevron-down"} size={20} color="#64748B" />
                        </View>
                        {expanded === i && (
                            <Text style={styles.answer}>{faq.answer || faq.a}</Text>
                        )}
                    </TouchableOpacity>
                ))}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#F8FAFC" },
    header: { flexDirection: 'row', alignItems: 'center', padding: 20, backgroundColor: "#FFF", borderBottomWidth: 1, borderColor: "#E2E8F0" },
    backBtn: { marginRight: 15 },
    headerTitle: { fontSize: 20, fontWeight: "800", color: "#1E293B" },
    content: { padding: 20 },
    card: { backgroundColor: "#FFF", padding: 16, borderRadius: 12, marginBottom: 16, elevation: 1 },
    question: { fontSize: 16, fontWeight: "700", color: "#1E293B", marginBottom: 8 },
    answer: { fontSize: 14, color: "#64748B", lineHeight: 22 },
});
