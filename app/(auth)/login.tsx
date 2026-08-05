import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import Toast from 'react-native-toast-message';
import { authService } from '@/services/auth.service';
import { useAuthStore } from '@/stores/auth.store';
import { Ionicons } from '@expo/vector-icons';

export default function LoginScreen() {
    const router = useRouter();
    const { setToken, setUser } = useAuthStore();
    const [mobile, setMobile] = useState('');
    const [loading, setLoading] = useState(false);
    const [focused, setFocused] = useState(false);
    const [showRestoreModal, setShowRestoreModal] = useState(false);
    const [restoring, setRestoring] = useState(false);

    const handleSendOtp = async () => {
        const cleaned = mobile.replace(/\D/g, '');
        if (!/^[6-9]\d{9}$/.test(cleaned)) {
            Toast.show({
                type: 'error',
                text1: 'Invalid Number',
                text2: 'Please enter a valid 10-digit Indian mobile number.',
                position: 'top'
            });
            return;
        }
        setLoading(true);
        try {
            await authService.sendOtp(cleaned);
            Toast.show({
                type: 'success',
                text1: 'OTP Sent',
                text2: `A verification code has been sent to +91 ${cleaned}`,
                position: 'top'
            });
            router.push({ pathname: '/(auth)/otp', params: { mobile: cleaned } });
        } catch (err: any) {
            let msg = err?.response?.data?.message || err?.message || 'Failed to send OTP.';
            if (msg === 'ACCOUNT_DELETED') {
                setShowRestoreModal(true);
                return;
            }
            Toast.show({ type: 'error', text1: 'Send OTP Failed', text2: msg, position: 'top' });
        } finally {
            setLoading(false);
        }
    };

    const handleRestoreAccount = async () => {
        const cleaned = mobile.replace(/\D/g, '');
        setRestoring(true);
        try {
            await authService.api.post(`/patient/auth/restore`, { mobileNumber: cleaned });
            setShowRestoreModal(false);
            Toast.show({ type: 'success', text1: 'Account Restored', text2: 'Your account is active again!', position: 'top' });
            handleSendOtp();
        } catch (err: any) {
            Toast.show({ type: 'error', text1: 'Restore Failed', text2: err?.response?.data?.message || 'Could not restore account', position: 'top' });
        } finally {
            setRestoring(false);
        }
    };

    return (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <StatusBar style="light" />

            {/* Full-screen split: top hero + bottom form */}
            <ScrollView
                contentContainerStyle={{ flexGrow: 1 }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                bounces={false}
            >
                {/* ── Top Hero ── */}
                <LinearGradient
                    colors={['#0B3370', '#1A5FAD', '#2878D0']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={styles.hero}
                >
                    {/* Blobs */}
                    <View style={styles.blob1} />
                    <View style={styles.blob2} />
                    <View style={styles.blob3} />

                    {/* Back */}
                    {router.canGoBack() && (
                        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                            <Ionicons name="arrow-back" size={20} color="#fff" />
                        </TouchableOpacity>
                    )}

                    {/* Logo mark */}
                    <View style={styles.logoMark}>
                        <Ionicons name="heart-circle" size={38} color="#fff" />
                    </View>

                    <Text style={styles.brandName}>
                        <Text style={{ color: '#7DD3FC' }}>A1</Text>
                        <Text style={{ color: '#fff' }}>Care </Text>
                        <Text style={{ color: '#93C5FD' }}>24/7</Text>
                    </Text>
                    <Text style={styles.heroTitle}>Welcome Back 👋</Text>
                    <Text style={styles.heroSub}>Your trusted healthcare companion</Text>

                    {/* Trust strips */}
                    <View style={styles.trustRow}>
                        {[
                            { icon: 'shield-checkmark-outline' as const, label: '100% Secure' },
                            { icon: 'time-outline' as const, label: '24/7 Support' },
                            { icon: 'people-outline' as const, label: '10K+ Users' },
                        ].map((t, i) => (
                            <View key={i} style={styles.trustPill}>
                                <Ionicons name={t.icon} size={13} color="rgba(255,255,255,0.9)" />
                                <Text style={styles.trustText}>{t.label}</Text>
                            </View>
                        ))}
                    </View>
                </LinearGradient>

                {/* ── Bottom Form Card ── */}
                <View style={styles.formCard}>
                    <View style={styles.dragHandle} />

                    <Text style={styles.formTitle}>Sign In / Register</Text>
                    <Text style={styles.formSub}>Enter your mobile number to get started</Text>

                    {/* Mobile input */}
                    <View style={styles.inputLabel}>
                        <Text style={styles.labelText}>Mobile Number</Text>
                        <Text style={styles.required}> *</Text>
                    </View>

                    <View style={[styles.inputWrapper, focused && styles.inputWrapperFocused]}>
                        <View style={styles.prefixBox}>
                            <Ionicons name="call-outline" size={16} color="#0B3370" />
                            <Text style={styles.prefix}>+91</Text>
                        </View>
                        <View style={styles.inputDivider} />
                        <TextInput
                            style={styles.input}
                            placeholder="98765 43210"
                            keyboardType="phone-pad"
                            value={mobile}
                            onChangeText={(text) => setMobile(text.replace(/\D/g, ''))}
                            maxLength={10}
                            placeholderTextColor="#CBD5E1"
                            onFocus={() => setFocused(true)}
                            onBlur={() => setFocused(false)}
                        />
                        {mobile.length === 10 && (
                            <View style={styles.validCheck}>
                                <Ionicons name="checkmark-circle" size={20} color="#16A34A" />
                            </View>
                        )}
                    </View>

                    {/* OTP Button */}
                    <TouchableOpacity
                        onPress={handleSendOtp}
                        disabled={loading}
                        activeOpacity={0.88}
                        style={styles.ctaWrap}
                    >
                        <LinearGradient
                            colors={['#0B3370', '#2563EB']}
                            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                            style={styles.cta}
                        >
                            {loading ? (
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                    <ActivityIndicator color="#fff" />
                                    <Text style={styles.ctaText}>Sending OTP...</Text>
                                </View>
                            ) : (
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                    <Text style={styles.ctaText}>Send OTP</Text>
                                    <Ionicons name="arrow-forward" size={18} color="#fff" />
                                </View>
                            )}
                        </LinearGradient>
                    </TouchableOpacity>

                    {/* Guest link */}
                    <TouchableOpacity
                        onPress={() => router.replace('/(tabs)')}
                        style={styles.guestBtn}
                        activeOpacity={0.7}
                    >
                        <Text style={styles.guestText}>Continue as Guest</Text>
                        <Ionicons name="chevron-forward" size={14} color="#64748B" />
                    </TouchableOpacity>

                    {/* Disclaimer */}
                    <Text style={styles.disclaimer}>
                        By continuing, you agree to our{' '}
                        <Text onPress={() => router.push('/terms')} style={styles.disclaimerLink}>Terms</Text>
                        {' & '}
                        <Text onPress={() => router.push('/privacy')} style={styles.disclaimerLink}>Privacy Policy</Text>
                    </Text>
                </View>
            </ScrollView>

            {/* ── Restore Account Modal ── */}
            <Modal visible={showRestoreModal} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalSheet}>
                        <View style={styles.modalIconCircle}>
                            <Ionicons name="warning-outline" size={34} color="#EF4444" />
                        </View>
                        <Text style={styles.modalTitle}>Account Disabled</Text>
                        <Text style={styles.modalDesc}>
                            Your account is currently disabled and scheduled for deletion. You can reactivate it right now if this was a mistake.
                        </Text>
                        <TouchableOpacity
                            style={styles.restoreBtn}
                            onPress={handleRestoreAccount}
                            disabled={restoring}
                            activeOpacity={0.88}
                        >
                            <LinearGradient colors={['#16A34A', '#15803D']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.restoreGrad}>
                                {restoring ? <ActivityIndicator color="#fff" /> : <Text style={styles.restoreText}>Restore My Account</Text>}
                            </LinearGradient>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowRestoreModal(false)} disabled={restoring} activeOpacity={0.85}>
                            <Text style={styles.cancelText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    // ── Hero ──
    hero: {
        paddingTop: 60,
        paddingBottom: 44,
        paddingHorizontal: 28,
        alignItems: 'center',
        overflow: 'hidden',
        position: 'relative',
    },
    blob1: { position: 'absolute', top: -60, right: -60, width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.06)' },
    blob2: { position: 'absolute', bottom: -40, left: -40, width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(255,255,255,0.05)' },
    blob3: { position: 'absolute', top: 20, left: 10, width: 70, height: 70, borderRadius: 35, backgroundColor: 'rgba(255,255,255,0.04)' },

    backBtn: {
        position: 'absolute', top: 18, left: 18,
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.15)',
        justifyContent: 'center', alignItems: 'center',
    },
    logoMark: {
        width: 70, height: 70, borderRadius: 35,
        backgroundColor: 'rgba(255,255,255,0.15)',
        borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)',
        justifyContent: 'center', alignItems: 'center',
        marginBottom: 14,
    },
    brandName: { fontSize: 22, fontWeight: '900', marginBottom: 8, letterSpacing: 0.5 },
    heroTitle: { fontSize: 28, fontWeight: '900', color: '#fff', letterSpacing: -0.5, marginBottom: 8 },
    heroSub: { fontSize: 14, color: 'rgba(255,255,255,0.75)', fontWeight: '500', marginBottom: 24 },

    trustRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center' },
    trustPill: {
        flexDirection: 'row', alignItems: 'center', gap: 5,
        backgroundColor: 'rgba(255,255,255,0.14)',
        borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
    },
    trustText: { fontSize: 11, color: 'rgba(255,255,255,0.9)', fontWeight: '700' },

    // ── Form Card ──
    formCard: {
        flex: 1,
        backgroundColor: '#F4F7FC',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        marginTop: -24,
        paddingHorizontal: 24,
        paddingTop: 20,
        paddingBottom: 48,
    },
    dragHandle: {
        width: 42, height: 4, borderRadius: 2,
        backgroundColor: '#CBD5E1',
        alignSelf: 'center',
        marginBottom: 24,
    },
    formTitle: { fontSize: 24, fontWeight: '900', color: '#0F172A', letterSpacing: -0.4, marginBottom: 6 },
    formSub: { fontSize: 14, color: '#64748B', fontWeight: '500', marginBottom: 28 },

    inputLabel: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    labelText: { fontSize: 13, fontWeight: '800', color: '#0F172A' },
    required: { fontSize: 13, color: '#EF4444', fontWeight: '900' },

    inputWrapper: {
        flexDirection: 'row', alignItems: 'center',
        height: 58,
        backgroundColor: '#FFFFFF',
        borderRadius: 18,
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
        paddingHorizontal: 16,
        shadowColor: '#0A1A3A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 10,
        elevation: 3,
        marginBottom: 20,
        gap: 0,
    },
    inputWrapperFocused: {
        borderColor: '#2563EB',
        shadowColor: '#2563EB',
        shadowOpacity: 0.12,
        shadowRadius: 14,
        elevation: 5,
    },
    prefixBox: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingRight: 12 },
    prefix: { fontSize: 15, fontWeight: '800', color: '#0B3370' },
    inputDivider: { width: 1, height: 22, backgroundColor: '#E2E8F0', marginRight: 14 },
    input: { flex: 1, fontSize: 17, color: '#0F172A', fontWeight: '700', letterSpacing: 1 },
    validCheck: { marginLeft: 8 },

    ctaWrap: {
        borderRadius: 30,
        overflow: 'hidden',
        shadowColor: '#0B3370',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.28,
        shadowRadius: 20,
        elevation: 8,
        marginBottom: 16,
    },
    cta: {
        height: 58,
        alignItems: 'center',
        justifyContent: 'center',
    },
    ctaText: { fontSize: 17, fontWeight: '900', color: '#fff', letterSpacing: 0.3 },

    guestBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 4, paddingVertical: 14,
        backgroundColor: '#FFFFFF',
        borderRadius: 22,
        borderWidth: 1, borderColor: '#E2E8F0',
        marginBottom: 20,
    },
    guestText: { fontSize: 14, color: '#64748B', fontWeight: '700' },

    disclaimer: { fontSize: 12, color: '#94A3B8', textAlign: 'center', lineHeight: 18, fontWeight: '500' },
    disclaimerLink: { color: '#2563EB', fontWeight: '800' },

    // ── Restore Modal ──
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(10,20,50,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 28,
    },
    modalSheet: {
        backgroundColor: '#FFFFFF',
        borderRadius: 32,
        padding: 28,
        width: '100%',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 20 },
        shadowOpacity: 0.15,
        shadowRadius: 40,
        elevation: 20,
    },
    modalIconCircle: {
        width: 76, height: 76, borderRadius: 38,
        backgroundColor: '#FEF2F2',
        justifyContent: 'center', alignItems: 'center',
        marginBottom: 18,
    },
    modalTitle: { fontSize: 22, fontWeight: '900', color: '#0F172A', marginBottom: 10, letterSpacing: -0.3, textAlign: 'center' },
    modalDesc: { fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 22, fontWeight: '500', marginBottom: 28 },
    restoreBtn: {
        width: '100%', borderRadius: 28, overflow: 'hidden', marginBottom: 12,
        shadowColor: '#16A34A', shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.25, shadowRadius: 14, elevation: 6,
    },
    restoreGrad: { height: 56, alignItems: 'center', justifyContent: 'center' },
    restoreText: { fontSize: 16, fontWeight: '900', color: '#fff', letterSpacing: 0.3 },
    cancelBtn: {
        paddingVertical: 14, width: '100%',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        borderRadius: 22,
        borderWidth: 1, borderColor: '#E2E8F0',
    },
    cancelText: { color: '#64748B', fontSize: 15, fontWeight: '800' },
});
