import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, BackHandler } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';

import { useConfigStore } from '@/stores/config.store';

export default function FAQScreen() {
    const router = useRouter();
    const { config } = useConfigStore();
    const [expanded, setExpanded] = useState<number | null>(null);

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

    const defaultFaqs = [
        { q: "How do I book a service?", a: "You can book a service by browsing through the categories on the Home screen and selecting the service or doctor of your choice." },
        { q: "What are your payment methods?", a: "We accept payments via A1Care Wallet, UPI, Credit/Debit cards, and NetBanking." },
        { q: "How do I cancel my request?", a: "You can cancel any pending request from your 'My Bookings' section. Cancellation fees may apply if the provider is already en route." },
        { q: "Is home consultation available?", a: "Yes, many of our partner doctors and services support home visits. Look for the 'Home Visit' badge." },
    ];

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.push('/profile')} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#1E293B" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Frequently Asked Qs</Text>
            </View>
            <ScrollView contentContainerStyle={styles.content}>
                {config?.contact.faq ? (
                    <View style={styles.card}>
                        <Text style={styles.answer}>{config.contact.faq}</Text>
                    </View>
                ) : (
                    defaultFaqs.map((faq, i) => (
                        <View key={i} style={styles.card}>
                            <Text style={styles.question}>{faq.q}</Text>
                            <Text style={styles.answer}>{faq.a}</Text>
                        </View>
                    ))
                )}
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
