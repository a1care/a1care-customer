import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    StyleSheet,
    ScrollView,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { authService } from '@/services/auth.service';
import { useAuthStore } from '@/stores/auth.store';
import { triggerLocalNotification } from '@/utils/notifications';
import * as Location from 'expo-location';

const OTP_LENGTH = 6;

export default function OtpScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ mobile: string }>();
    const mobile = Array.isArray(params.mobile) ? params.mobile[0] : params.mobile;
    const { setToken, setUser } = useAuthStore();

    // Guard: redirect back if navigated to OTP without a mobile number
    React.useEffect(() => {
        if (!mobile) router.replace('/(auth)/login');
    }, [mobile]);

    const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
    const [loading, setLoading] = useState(false);
    const [resendTimer, setResendTimer] = useState(30);
    const otpInputRef = useRef<TextInput | null>(null);
    const verifyingRef = useRef(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            otpInputRef.current?.focus();
        }, 250);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        if (resendTimer === 0) return;
        const t = setTimeout(() => setResendTimer((s) => s - 1), 1000);
        return () => clearTimeout(t);
    }, [resendTimer]);

    useEffect(() => {
        const code = otp.join('');
        if (code.length === OTP_LENGTH && !verifyingRef.current) {
            handleVerify(code);
        }
    }, [otp]);

    const syncOtp = (value: string) => {
        const digits = value.replace(/\D/g, '').slice(0, OTP_LENGTH);
        const nextOtp = Array(OTP_LENGTH).fill('');

        digits.split('').forEach((digit, index) => {
            nextOtp[index] = digit;
        });

        setOtp(nextOtp);
    };

    const handleChange = (value: string) => {
        syncOtp(value);
    };

    const focusOtpInput = () => {
        otpInputRef.current?.focus();
    };

    const requestLocationPermission = async () => {
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                console.log('Location permission denied');
            }
        } catch (error) {
            console.error('Error requesting location permission:', error);
        }
    };

    const handleVerify = async (codeParam?: string) => {
        const code = (codeParam ?? otp.join('')).replace(/\D/g, '');
        if (code.length < OTP_LENGTH) {
            Toast.show({
                type: 'error',
                text1: 'Enter OTP',
                text2: 'Please enter the complete 6-digit OTP.',
                position: 'top'
            });
            return;
        }
        if (verifyingRef.current) return;
        verifyingRef.current = true;
        setLoading(true);
        try {
            const res = await authService.verifyOtp(mobile, code);
            // ApiResponse wraps data: { token } inside res.data.data
            const token = res.data?.token;
            if (!token) throw new Error('No token received from server');
            setToken(token);
            let user;
            try {
                user = await authService.getProfile();
            } catch (profileErr) {
                // Token saved but profile fetch failed — clear broken state
                setToken('');
                throw new Error('Login succeeded but profile could not be loaded. Please try again.');
            }
            setUser(user);

            if (user.isRegistered) {
                triggerLocalNotification('Welcome back!', 'Great to see you again.');
            }
            // _layout.tsx routing handles navigation after auth state updates

            // Request location permission after navigation (non-blocking)
            requestLocationPermission();
        } catch (err: any) {
            let msg = 'Please check the code and try again.';
            if (err.message === 'Network Error') {
                msg = 'Unable to reach A1Care server. Please check your internet connection.';
            } else if (err.response?.data?.message) {
                msg = err.response.data.message;
            }
            Toast.show({
                type: 'error',
                text1: 'Verification Failed',
                text2: msg,
                position: 'top'
            });
        } finally {
            setLoading(false);
            verifyingRef.current = false;
        }
    };

    const handleResend = async () => {
        setLoading(true);
        try {
            await authService.sendOtp(mobile);
            setResendTimer(30);
            setOtp(Array(OTP_LENGTH).fill(''));
            focusOtpInput();
            Toast.show({
                type: 'success',
                text1: 'OTP Resent',
                text2: 'A new 6-digit code has been sent to your mobile.',
                position: 'top'
            });
        } catch (err: any) {
            let msg = err?.response?.data?.message || err?.message || "Failed to resend OTP.";
            Toast.show({
                type: 'error',
                text1: 'Resend Failed',
                text2: msg,
                position: 'top'
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <StatusBar style="light" />

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
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                        <Ionicons name="arrow-back" size={20} color="#fff" />
                    </TouchableOpacity>

                    {/* Logo mark */}
                    <View style={styles.logoMark}>
                        <Ionicons name="shield-checkmark" size={34} color="#fff" />
                    </View>

                    <Text style={styles.brandName}>
                        <Text style={{ color: '#7DD3FC' }}>A1</Text>
                        <Text style={{ color: '#fff' }}>Care </Text>
                        <Text style={{ color: '#93C5FD' }}>24/7</Text>
                    </Text>
                    <Text style={styles.heroTitle}>Verify Number</Text>
                    <Text style={styles.heroSub}>Secure code sent to +91 {mobile}</Text>

                    {/* Trust strips */}
                    <View style={styles.trustRow}>
                        {[
                            { icon: 'lock-closed-outline' as const, label: 'Encrypted' },
                            { icon: 'shield-half-outline' as const, label: 'Private' },
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

                    <Text style={styles.formTitle}>Enter OTP</Text>
                    <Text style={styles.formSub}>Please type the 6-digit code</Text>

                    {/* OTP Input */}
                    <TouchableOpacity activeOpacity={1} onPress={focusOtpInput} style={{ marginBottom: 24 }}>
                        <View style={styles.otpContainer}>
                            <TextInput
                                ref={otpInputRef}
                                style={styles.hiddenOtpInput}
                                value={otp.join('')}
                                onChangeText={handleChange}
                                keyboardType='number-pad'
                                textContentType="oneTimeCode"
                                autoComplete={Platform.OS === 'ios' ? 'one-time-code' : 'sms-otp'}
                                importantForAutofill="yes"
                                maxLength={OTP_LENGTH}
                                autoFocus
                                caretHidden
                                onSubmitEditing={() => handleVerify()}
                            />
                            {otp.map((digit, i) => {
                                const isFocused = i === otp.join('').length;
                                const hasValue = !!digit;
                                return (
                                    <View
                                        key={i}
                                        style={[
                                            styles.otpBox,
                                            hasValue && styles.otpBoxFilled,
                                            isFocused && styles.otpBoxFocused,
                                        ]}
                                    >
                                        <Text style={styles.otpDigit}>{digit}</Text>
                                    </View>
                                );
                            })}
                        </View>
                    </TouchableOpacity>

                    {/* Verify Button */}
                    <TouchableOpacity
                        onPress={() => handleVerify()}
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
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                    <Text style={styles.ctaText}>Verify & Continue</Text>
                                    <Ionicons name="arrow-forward" size={18} color="#fff" />
                                </View>
                            )}
                        </LinearGradient>
                    </TouchableOpacity>

                    {/* Resend Action */}
                    <View style={styles.resendRow}>
                        <Text style={styles.resendText}>Didn't receive the code? </Text>
                        {resendTimer > 0 ? (
                            <Text style={styles.timer}>Resend in {resendTimer}s</Text>
                        ) : (
                            <TouchableOpacity onPress={handleResend} activeOpacity={0.6}>
                                <Text style={styles.resendBtn}>Resend OTP</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </ScrollView>
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

    otpContainer: { 
        flexDirection: 'row', 
        justifyContent: 'space-between', 
        width: '100%',
        position: 'relative',
    },
    hiddenOtpInput: {
        position: 'absolute',
        opacity: 0.01,
        width: '100%',
        height: '100%',
    },
    otpBox: {
        width: 48, 
        height: 56, 
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        alignItems: 'center', 
        justifyContent: 'center',
        borderWidth: 1.5, 
        borderColor: '#E2E8F0',
        shadowColor: '#0A1A3A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.02,
        shadowRadius: 5,
        elevation: 1,
    },
    otpBoxFilled: { 
        borderColor: '#94A3B8',
    },
    otpBoxFocused: { 
        borderColor: '#2563EB',
        shadowColor: '#2563EB',
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
    },
    otpDigit: { 
        fontSize: 22, 
        fontWeight: '800', 
        color: '#0F172A' 
    },

    ctaWrap: {
        borderRadius: 30,
        overflow: 'hidden',
        shadowColor: '#0B3370',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.28,
        shadowRadius: 20,
        elevation: 8,
        marginBottom: 24,
    },
    cta: {
        height: 58,
        alignItems: 'center',
        justifyContent: 'center',
    },
    ctaText: { fontSize: 17, fontWeight: '900', color: '#fff', letterSpacing: 0.3 },

    resendRow: { 
        flexDirection: 'row', 
        justifyContent: 'center',
        alignItems: 'center',
    },
    resendText: { 
        color: '#64748B',
        fontSize: 14,
        fontWeight: '500',
    },
    timer: { 
        color: '#0F172A', 
        fontWeight: '700',
        fontSize: 14,
    },
    resendBtn: { 
        color: '#2563EB', 
        fontWeight: '800',
        fontSize: 14,
    },
});
