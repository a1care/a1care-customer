import React, { useState } from 'react';
import {
    View, Text, TouchableOpacity, Share, StyleSheet,
    ActivityIndicator, ScrollView, Alert, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useQuery, useMutation } from '@tanstack/react-query';
import { referralService } from '@/services/referral.service';
import { Colors } from '@/constants/colors';
import * as Clipboard from 'expo-clipboard';

export default function ReferralScreen() {
    const router = useRouter();
    const [friendCode, setFriendCode] = useState('');
    const [validating, setValidating] = useState(false);
    const [validResult, setValidResult] = useState<{ referrerName: string; rewardAmount: number } | null>(null);

    const { data, isLoading, isError } = useQuery({
        queryKey: ['referral-code'],
        queryFn: referralService.getMyCode,
    });

    const handleShare = async () => {
        if (!data?.shareMessage) return;
        try {
            await Share.share({ message: data.shareMessage });
        } catch (e) {
            // user dismissed
        }
    };

    const handleCopy = async () => {
        if (!data?.referralCode) return;
        await Clipboard.setStringAsync(data.referralCode);
        Alert.alert('Copied!', 'Referral code copied to clipboard.');
    };

    const handleValidateFriend = async () => {
        const code = friendCode.trim().toUpperCase();
        if (!code) { Alert.alert('Enter a code', 'Please enter a referral code to validate.'); return; }
        setValidating(true);
        setValidResult(null);
        try {
            const result = await referralService.validate(code);
            setValidResult(result);
        } catch (err: any) {
            Alert.alert('Invalid Code', err?.response?.data?.message || 'That referral code is not valid.');
        } finally {
            setValidating(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                        <Ionicons name="arrow-back" size={22} color="#0F172A" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Refer & Earn</Text>
                    <View style={{ width: 38 }} />
                </View>

                {/* Hero Banner */}
                <LinearGradient colors={['#1A7FD4', '#0D5FA0']} style={styles.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                    <View style={styles.heroBubble1} /><View style={styles.heroBubble2} />
                    <Ionicons name="gift" size={48} color="rgba(255,255,255,0.3)" style={{ marginBottom: 12 }} />
                    <Text style={styles.heroTitle}>Invite Friends, Earn ₹100</Text>
                    <Text style={styles.heroSub}>For every friend who books their first service using your code, you get ₹100 in your A1Care wallet.</Text>
                </LinearGradient>

                {/* Your Code */}
                <View style={styles.card}>
                    <Text style={styles.cardLabel}>YOUR REFERRAL CODE</Text>
                    {isLoading ? (
                        <ActivityIndicator color={Colors.primary} style={{ marginVertical: 16 }} />
                    ) : isError ? (
                        <Text style={{ color: '#EF4444', fontSize: 13 }}>Failed to load code</Text>
                    ) : (
                        <>
                            <View style={styles.codeRow}>
                                <Text style={styles.codeText}>{data?.referralCode ?? '—'}</Text>
                                <TouchableOpacity onPress={handleCopy} style={styles.copyBtn}>
                                    <Ionicons name="copy-outline" size={18} color={Colors.primary} />
                                </TouchableOpacity>
                            </View>
                            <TouchableOpacity onPress={handleShare} style={styles.shareBtn} activeOpacity={0.85}>
                                <LinearGradient colors={['#1A7FD4', '#0D5FA0']} style={styles.shareBtnInner} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                                    <Ionicons name="share-social" size={18} color="#FFF" />
                                    <Text style={styles.shareBtnText}>Share with Friends</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        </>
                    )}
                </View>

                {/* How it works */}
                <View style={styles.card}>
                    <Text style={styles.cardLabel}>HOW IT WORKS</Text>
                    {[
                        { icon: 'share-social-outline', text: 'Share your unique referral code with friends' },
                        { icon: 'person-add-outline', text: 'Friend signs up and enters your code' },
                        { icon: 'checkmark-circle-outline', text: 'They complete their first service booking' },
                        { icon: 'wallet-outline', text: 'You get ₹100 credited to your A1Care wallet' },
                    ].map((step, i) => (
                        <View key={i} style={styles.stepRow}>
                            <View style={styles.stepIconBox}>
                                <Ionicons name={step.icon as any} size={18} color={Colors.primary} />
                            </View>
                            <Text style={styles.stepText}>{step.text}</Text>
                        </View>
                    ))}
                </View>

                {/* Validate a friend's code */}
                <View style={styles.card}>
                    <Text style={styles.cardLabel}>HAVE A FRIEND'S CODE?</Text>
                    <Text style={styles.validateNote}>Enter a referral code to check if it's valid. Use it when booking a service to apply the reward.</Text>
                    <View style={styles.validateRow}>
                        <TextInput
                            style={styles.validateInput}
                            placeholder="Enter code (e.g. A1B2C3)"
                            placeholderTextColor="#94A3B8"
                            value={friendCode}
                            onChangeText={t => { setFriendCode(t.toUpperCase()); setValidResult(null); }}
                            autoCapitalize="characters"
                            maxLength={10}
                        />
                        <TouchableOpacity onPress={handleValidateFriend} style={styles.validateBtn} disabled={validating}>
                            {validating ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.validateBtnText}>Check</Text>}
                        </TouchableOpacity>
                    </View>
                    {validResult && (
                        <View style={styles.validBadge}>
                            <Ionicons name="checkmark-circle" size={16} color="#16A34A" />
                            <Text style={styles.validBadgeText}>Valid! Referred by {validResult.referrerName} — you'll earn ₹{validResult.rewardAmount} off</Text>
                        </View>
                    )}
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    scroll: { paddingHorizontal: 20, paddingBottom: 20 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16 },
    backBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
    headerTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
    hero: { borderRadius: 24, padding: 28, marginBottom: 20, alignItems: 'center', overflow: 'hidden', position: 'relative' },
    heroBubble1: { position: 'absolute', top: -40, right: -40, width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.08)' },
    heroBubble2: { position: 'absolute', bottom: -20, left: -20, width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.08)' },
    heroTitle: { fontSize: 22, fontWeight: '900', color: '#FFF', textAlign: 'center', marginBottom: 8 },
    heroSub: { fontSize: 13, color: 'rgba(255,255,255,0.8)', textAlign: 'center', lineHeight: 20 },
    card: { backgroundColor: '#FFF', borderRadius: 20, padding: 20, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 3 },
    cardLabel: { fontSize: 11, fontWeight: '900', color: '#94A3B8', letterSpacing: 1.2, marginBottom: 14 },
    codeRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EBF5FB', borderRadius: 14, paddingHorizontal: 20, paddingVertical: 14, marginBottom: 16 },
    codeText: { flex: 1, fontSize: 28, fontWeight: '900', color: '#1A7FD4', letterSpacing: 6 },
    copyBtn: { padding: 8 },
    shareBtn: { borderRadius: 14, overflow: 'hidden' },
    shareBtnInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14 },
    shareBtnText: { fontSize: 15, fontWeight: '800', color: '#FFF' },
    stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, marginBottom: 14 },
    stepIconBox: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#EBF5FB', justifyContent: 'center', alignItems: 'center' },
    stepText: { flex: 1, fontSize: 14, color: '#475569', fontWeight: '500', lineHeight: 20, marginTop: 7 },
    validateNote: { fontSize: 13, color: '#64748B', marginBottom: 14, lineHeight: 19 },
    validateRow: { flexDirection: 'row', gap: 10 },
    validateInput: { flex: 1, height: 48, borderRadius: 12, backgroundColor: '#F8FAFC', borderWidth: 1.5, borderColor: '#E2E8F0', paddingHorizontal: 14, fontSize: 16, fontWeight: '700', color: '#0F172A', letterSpacing: 2 },
    validateBtn: { height: 48, paddingHorizontal: 18, borderRadius: 12, backgroundColor: '#1A7FD4', justifyContent: 'center', alignItems: 'center' },
    validateBtnText: { fontSize: 14, fontWeight: '800', color: '#FFF' },
    validBadge: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#F0FDF4', borderRadius: 10, padding: 12, marginTop: 12 },
    validBadgeText: { flex: 1, fontSize: 13, color: '#16A34A', fontWeight: '600' },
});
