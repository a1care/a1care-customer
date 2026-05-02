import React, { useState } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    Alert,
    TextInput,
    ActivityIndicator,
    StyleSheet,
    RefreshControl,
    Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authService } from '@/services/auth.service';
import { addressService } from '@/services/address.service';
import { walletService } from '@/services/wallet.service';
import { useAuthStore } from '@/stores/auth.store';
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

// ─── Menu item row ────────────────────────────────────────────────────────────
function MenuLink({
    icon,
    title,
    subtitle,
    onPress,
    bgColor = "#F8FAFC",
    hideArrow = false
}: {
    icon: any,
    title: string,
    subtitle: string,
    onPress: () => void,
    bgColor?: string,
    hideArrow?: boolean
}) {
    return (
        <TouchableOpacity style={styles.menuItem} onPress={onPress}>
            <View style={[styles.menuIconBox, { backgroundColor: bgColor }]}>
                {icon}
            </View>
            <View style={styles.menuTextContainer}>
                <Text style={styles.menuTitle}>{title}</Text>
                <Text style={styles.menuSubtitle}>{subtitle}</Text>
            </View>
            {!hideArrow && <Ionicons name="chevron-forward" size={18} color="#94A3B8" />}
        </TouchableOpacity>
    );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function ProfileScreen() {
    const router = useRouter();
    const { user, logout } = useAuthStore();
    const qc = useQueryClient();
    const [refreshing, setRefreshing] = useState(false);

    // Profile
    const { data: profile, refetch: refetchProfile } = useQuery({
        queryKey: ['profile'],
        queryFn: authService.getProfile,
    });

    // Wallet
    const { data: wallet, refetch: refetchWallet } = useQuery({
        queryKey: ['wallet'],
        queryFn: walletService.getWallet,
    });

    const onRefresh = async () => {
        setRefreshing(true);
        await Promise.all([refetchProfile(), refetchWallet()]);
        setRefreshing(false);
    };

    const deleteMutation = useMutation({
        mutationFn: authService.requestDeletion,
        onSuccess: (data: any) => {
            Alert.alert("Success", data.message || "Deletion request submitted. Admin will review your request.");
        },
        onError: (err: any) => {
            Alert.alert("Error", err.response?.data?.message || "Failed to submit deletion request.");
        }
    });

    const handleDeleteAccount = () => {
        Alert.alert(
            'Delete Account',
            'Your account data will be preserved as per legal requirements, but you will no longer have access to this account. Admin needs to approve your request. Are you sure?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Request Deletion',
                    style: 'destructive',
                    onPress: () => deleteMutation.mutate(),
                },
            ]
        );
    };

    const handleLogout = () => {
        Alert.alert('Logout', 'Are you sure you want to logout?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Logout',
                style: 'destructive',
                onPress: async () => {
                    await logout();
                    router.replace('/(auth)/login');
                },
            },
        ]);
    };

    const displayUser = profile ?? user;

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
            >
                {/* User Info Section */}
                <View style={styles.headerGlow} />
                <View style={styles.userInfoRow}>
                    <View style={styles.userInfoText}>
                        <Text style={styles.greetingText} numberOfLines={1} ellipsizeMode="tail">Hello, {displayUser?.name || "User"}</Text>
                        <Text style={styles.infoSubText}>Mobile: {displayUser?.mobileNumber || "—"}</Text>

                        <LinearGradient
                            colors={['#FFD700', '#FFA500']}
                            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                            style={styles.premiumBadge}
                        >
                            <Ionicons name="star" size={10} color="#FFF" />
                            <Text style={styles.premiumBadgeText}>A1care Premium Member</Text>
                        </LinearGradient>
                    </View>
                    <TouchableOpacity
                        style={styles.avatarContainer}
                        onPress={() => router.push("/profile/edit")}
                    >
                        <LinearGradient
                            colors={['#1A7FD4', '#B06AB3']}
                            style={styles.avatarRing}
                        >
                            <View style={styles.avatarPlaceholder}>
                                {displayUser?.profileImage ? (
                                    <Image
                                        source={{ uri: displayUser.profileImage }}
                                        style={{ width: "100%", height: "100%", borderRadius: 40 }}
                                    />
                                ) : (
                                    <Ionicons name="person" size={40} color="#CBD5E1" />
                                )}
                            </View>
                        </LinearGradient>
                    </TouchableOpacity>
                </View>

                {/* Wallet Card */}
                <TouchableOpacity onPress={() => router.push("/wallet")} activeOpacity={0.9}>
                    <LinearGradient
                        colors={["#0D9488", "#2DD4BF"]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.walletCard}
                    >
                        {/* Decorative Patterns */}
                        <View style={styles.walletCircle1} />
                        <View style={styles.walletCircle2} />

                        <View style={styles.walletHeaderRow}>
                            <Text style={styles.walletTitle}>A1Care Wallet</Text>
                            <Ionicons name="card" size={24} color="rgba(255,255,255,0.3)" />
                        </View>

                        <Text style={styles.balanceLabel}>Current Balance</Text>
                        <Text style={styles.balanceAmount}>₹{wallet?.balance ?? "0"}</Text>

                        <View style={styles.walletFooter}>
                            <View>
                                <Text style={styles.walletId}>REF_ID: {displayUser?._id?.toString().slice(-8).toUpperCase() || "A1C8B2E9"}</Text>
                                <Text style={styles.walletUserName} numberOfLines={1} ellipsizeMode="tail">{displayUser?.name?.toUpperCase() || "USER NAME"}</Text>
                            </View>
                            <Text style={styles.disaText}>VISA</Text>
                        </View>
                    </LinearGradient>
                </TouchableOpacity>

                <Text style={styles.sectionTitle}>Medical & Health</Text>
                <View style={[styles.menuContainer, styles.elevated]}>
                    <MenuLink
                        icon={<Ionicons name="shield-checkmark" size={20} color="#0D9488" />}
                        bgColor="#F0FDFA"
                        title="Health Vault"
                        subtitle="Upload & manage medical reports"
                        onPress={() => router.push("/profile/health-vault")}
                    />
                </View>

                {/* Account & Settings */}
                <Text style={styles.sectionTitle}>Account & Settings</Text>
                <View style={[styles.menuContainer, styles.elevated]}>
                    <MenuLink
                        icon={<Ionicons name="person" size={20} color="#2F80ED" />}
                        bgColor="#EBF3FD"
                        title="My Profile"
                        subtitle="Manage personal information"
                        onPress={() => router.push("/profile/edit")}
                    />
                    <MenuLink
                        icon={<Ionicons name="location" size={20} color="#27AE60" />}
                        bgColor="#E9F7EF"
                        title="My Addresses"
                        subtitle="Manage your saved locations"
                        onPress={() => router.push("/profile/addresses")}
                    />
                    <MenuLink
                        icon={<Ionicons name="calendar" size={20} color="#9B51E0" />}
                        bgColor="#F5EBFF"
                        title="My Bookings"
                        subtitle="View your appointment history"
                        onPress={() => router.push("/bookings")}
                    />
                </View>

                {/* Support Section */}
                <Text style={styles.sectionTitle}>Support & Help</Text>
                <View style={[styles.menuContainer, styles.elevated]}>
                    <MenuLink
                        icon={<Ionicons name="ticket" size={20} color="#F2994A" />}
                        bgColor="#FFF7ED"
                        title="Raise Ticket"
                        subtitle="Report an issue or get assistance"
                        onPress={() => router.push("/support")}
                    />
                    <MenuLink
                        icon={<Ionicons name="help-circle" size={20} color="#607D8B" />}
                        bgColor="#ECEFF1"
                        title="FAQ"
                        subtitle="Frequently asked questions"
                        onPress={() => router.push("/faq")}
                    />
                </View>

                {/* Legal */}
                <Text style={styles.sectionTitle}>Legal & More</Text>
                <View style={[styles.menuContainer, styles.elevated]}>
                    <MenuLink
                        icon={<Ionicons name="shield-checkmark" size={20} color="#D63384" />}
                        bgColor="#FFF0F5"
                        title="Privacy Policy"
                        subtitle="How we protect your data"
                        onPress={() => router.push("/privacy")}
                    />
                    <MenuLink
                        icon={<Ionicons name="document-text" size={20} color="#475569" />}
                        bgColor="#F1F5F9"
                        title="Terms & Conditions"
                        subtitle="User agreement"
                        onPress={() => router.push("/terms")}
                    />
                </View>

                <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
                    <Ionicons name="log-out-outline" size={20} color="#EF4444" />
                    <Text style={styles.logoutText}>Logout</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                    style={[styles.logoutBtn, { backgroundColor: '#FEE2E2', marginTop: -10 }]} 
                    onPress={handleDeleteAccount}
                    disabled={deleteMutation.isPending}
                >
                    {deleteMutation.isPending ? (
                        <ActivityIndicator size="small" color="#EF4444" />
                    ) : (
                        <>
                            <Ionicons name="trash-outline" size={20} color="#B91C1C" />
                            <Text style={[styles.logoutText, { color: '#B91C1C' }]}>Delete Account</Text>
                        </>
                    )}
                </TouchableOpacity>

                <View style={{ height: 60 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#F8FAFC",
    },
    headerGlow: {
        position: 'absolute',
        top: -100,
        right: -50,
        width: 300,
        height: 300,
        borderRadius: 150,
        backgroundColor: 'rgba(26, 127, 212, 0.05)',
        zIndex: 0,
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingTop: 10,
    },
    userInfoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
        paddingVertical: 10,
    },
    userInfoText: {
        flex: 1,
    },
    greetingText: {
        fontSize: 26,
        fontWeight: '900',
        color: "#0F172A",
        marginBottom: 4,
        letterSpacing: -0.5,
    },
    infoSubText: {
        fontSize: 14,
        color: "#64748B",
        marginBottom: 6,
        fontWeight: '500',
    },
    premiumBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 100,
        alignSelf: 'flex-start',
        marginTop: 4,
        shadowColor: "#FFD700",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
    },
    premiumBadgeText: {
        fontSize: 11,
        fontWeight: '900',
        color: "#FFF",
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    avatarContainer: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 10,
    },
    avatarRing: {
        width: 76,
        height: 76,
        borderRadius: 38,
        padding: 3,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarPlaceholder: {
        width: 70,
        height: 70,
        borderRadius: 35,
        backgroundColor: "#FFF",
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    walletCard: {
        borderRadius: 32,
        padding: 24,
        height: 190,
        marginBottom: 32,
        elevation: 15,
        shadowColor: "#0D9488",
        shadowOffset: { width: 10, height: 15 },
        shadowOpacity: 0.25,
        shadowRadius: 20,
        position: 'relative',
        overflow: 'hidden',
    },
    walletCircle1: {
        position: 'absolute',
        top: -50,
        right: -50,
        width: 150,
        height: 150,
        borderRadius: 75,
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    walletCircle2: {
        position: 'absolute',
        bottom: -20,
        left: '20%',
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    walletHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    walletTitle: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '800',
        textTransform: 'uppercase',
        letterSpacing: 1.5,
        opacity: 0.7,
    },
    balanceLabel: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 12,
        marginTop: 14,
        fontWeight: '600',
    },
    balanceAmount: {
        color: '#FFF',
        fontSize: 44,
        fontWeight: '900',
        lineHeight: 52,
        letterSpacing: -1,
    },
    walletFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        marginTop: 'auto',
    },
    walletId: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    walletUserName: {
        color: '#FFF',
        fontSize: 15,
        fontWeight: '800',
        marginTop: 2,
        letterSpacing: 0.5,
    },
    disaText: {
        color: 'rgba(255,255,255,0.15)',
        fontSize: 32,
        fontWeight: '900',
        fontStyle: 'italic',
    },
    sectionTitle: {
        fontSize: 15,
        fontWeight: '900',
        color: "#475569",
        marginBottom: 16,
        marginTop: 8,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    elevated: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
        elevation: 5,
    },
    menuContainer: {
        backgroundColor: '#FFF',
        borderRadius: 28,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.03)',
        marginBottom: 30,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.02)',
    },
    menuIconBox: {
        width: 48,
        height: 48,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    menuTextContainer: {
        flex: 1,
    },
    menuTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#0F172A',
    },
    menuSubtitle: {
        fontSize: 12,
        color: '#64748B',
        marginTop: 2,
        fontWeight: '500',
    },
    logoutBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        backgroundColor: '#FFF1F2',
        borderRadius: 24,
        marginBottom: 20,
        gap: 12,
    },
    logoutText: {
        fontSize: 16,
        fontWeight: '800',
        color: '#E11D48',
    },
});

