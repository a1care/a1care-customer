import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, BackHandler } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';

import { useConfigStore } from '@/stores/config.store';

export default function PrivacyScreen() {
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
                <Text style={styles.headerTitle}>Privacy Policy</Text>
            </View>
            <ScrollView contentContainerStyle={styles.content}>
                <Text style={styles.title}>Your Privacy Matters</Text>
                {config?.contact.privacyPolicy ? (
                    <Text style={styles.text}>{config.contact.privacyPolicy}</Text>
                ) : (
                    <>
                        <Text style={styles.text}>
                            At A1Care, we are committed to protecting your personal, medical, and financial data. We employ industry-standard encryption protocols for data at rest and in transit.
                        </Text>
                        <Text style={styles.subtitle}>Data Collection</Text>
                        <Text style={styles.text}>
                            We collect your location (for matching providers nearby), your contact details (for OT messages), and basic KYC data for providing you seamless medical bookings.
                        </Text>
                        <Text style={styles.subtitle}>Information Sharing</Text>
                        <Text style={styles.text}>
                            We only share necessary details (like your name and location) with the healthcare provider whom you've booked. We do not sell your data to third party advertisers.
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
