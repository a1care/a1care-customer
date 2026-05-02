import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, BackHandler } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';

import { useConfigStore } from '@/stores/config.store';

export default function TermsScreen() {
    const router = useRouter();

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

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.push('/profile')} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#1E293B" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Terms of Service</Text>
            </View>
            <ScrollView contentContainerStyle={styles.content}>
                <Text style={styles.title}>A1Care User Agreement</Text>
                {config?.contact.termsAndConditions ? (
                    <Text style={styles.text}>{config.contact.termsAndConditions}</Text>
                ) : (
                    <>
                        <Text style={styles.subtitle}>1. Medical Disclaimer</Text>
                        <Text style={styles.text}>
                            A1Care facilitates the connection between patients and healthcare providers. We are not a medical institution. Any advice or services provided by doctors on our platform are the responsibility of the individual provider.
                        </Text>
                        <Text style={styles.subtitle}>2. Payments & Refunds</Text>
                        <Text style={styles.text}>
                            All digital wallet top-ups are non-refundable unless a service is canceled 24 hours prior to the scheduled appointment. A1Care reserves the right to deduct platform fees prior to issuing refunds.
                        </Text>
                        <Text style={styles.subtitle}>3. Account Termination</Text>
                        <Text style={styles.text}>
                            We reserve the right to suspend or terminate accounts that violate our community guidelines, exhibit abusive behavior towards support staff, or attempt fraudulent transactions.
                        </Text>
                    </>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#FFF" },
    header: { flexDirection: 'row', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderColor: "#E2E8F0" },
    backBtn: { marginRight: 15 },
    headerTitle: { fontSize: 20, fontWeight: "800", color: "#1E293B" },
    content: { padding: 20 },
    title: { fontSize: 24, fontWeight: "800", color: "#1E293B", marginBottom: 16 },
    subtitle: { fontSize: 18, fontWeight: "700", color: "#334155", marginTop: 24, marginBottom: 8 },
    text: { fontSize: 15, color: "#475569", lineHeight: 24 },
});
