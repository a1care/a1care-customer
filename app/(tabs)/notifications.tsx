import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    RefreshControl,
    ActivityIndicator,
    TouchableOpacity,
    Alert,
    Platform,
    Animated,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { notificationsService, Notification } from '@/services/notifications.service';
import {
    Bell,
    CheckCircle2,
    Tag,
    Stethoscope,
    ShieldAlert,
    Clock,
    CreditCard,
    Ticket,
    Activity,
    Users,
    Trash2,
    ChevronLeft,
} from 'lucide-react-native';
import { Colors, Shadows } from '@/constants/colors';
import { LinearGradient } from 'expo-linear-gradient';
import { useNotificationStore } from '@/stores/notification.store';
import { useCallback } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { showToast } from '@/utils/toast';

// ── Icon/Color Mapping ───────────────────────────────────────────────────
const TYPE_META: Record<string, { icon: any; color: string; bgColor: string }> = {
    ServiceRequest:      { icon: Stethoscope, color: '#2F80ED', bgColor: '#EBF3FD' },
    DoctorAppointment:   { icon: Activity,    color: '#22C55E', bgColor: '#DCFCE7' },
    Wallet:              { icon: CreditCard,  color: '#F59E0B', bgColor: '#FEF3C7' },
    Ticket:              { icon: Ticket,      color: '#E11D48', bgColor: '#FFF1F2' },
    Broadcast:           { icon: Tag,         color: '#9B51E0', bgColor: '#F5EBFF' },
    Auth:                { icon: ShieldAlert, color: '#6366F1', bgColor: '#EEF2FF' },
    Partner:             { icon: Users,       color: '#0D9488', bgColor: '#CCFBF1' },
    default:             { icon: Bell,        color: Colors.primary, bgColor: '#EBF3FD' },
};

function getMeta(refType?: string) {
    return TYPE_META[refType ?? ''] ?? TYPE_META.default;
}

function timeAgo(dateStr: string) {
    try {
        const diff = Date.now() - new Date(dateStr).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1)  return 'Just now';
        if (mins < 60) return `${mins}m ago`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24)  return `${hrs}h ago`;
        const days = Math.floor(hrs / 24);
        if (days < 7)  return `${days}d ago`;
        return new Date(dateStr).toLocaleDateString();
    } catch {
        return 'Recently';
    }
}

// Fallback data if API is empty
const DUMMY_FALLBACK: any[] = [];

const mergeNotifications = (remoteList: any[], localList: any[]) => {
    const seen = new Set<string>();
    const out: any[] = [];

    [...localList, ...remoteList]
        .sort((a: any, b: any) => new Date(b?.createdAt || 0).getTime() - new Date(a?.createdAt || 0).getTime())
        .forEach((n: any) => {
            const title = String(n?.title || '').trim().toLowerCase();
            const body = String(n?.body || '').trim().toLowerCase();
            const refType = String(n?.refType || '').trim().toLowerCase();
            const minuteBucket = Math.floor(new Date(n?.createdAt || 0).getTime() / 60000);
            // Dedupe same event from local + server even when IDs differ.
            const key = `${title}|${body}|${refType}|${minuteBucket}`;
            if (seen.has(key)) return;
            seen.add(key);
            out.push(n);
        });

    return out;
};

const NotificationsSkeleton = ({ pulseAnim }: { pulseAnim: Animated.Value }) => {
    return (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
            {[1, 2, 3, 4, 5, 6].map((i) => (
                <Animated.View 
                    key={i} 
                    style={[
                        styles.card, 
                        { opacity: pulseAnim, backgroundColor: '#E2E8F0', height: 86, elevation: 0 }
                    ]}
                />
            ))}
        </ScrollView>
    );
};

export default function NotificationsScreen() {
    const router = useRouter();
    const qc = useQueryClient();
    const { setUnreadCount } = useNotificationStore();
    const [localList, setLocalList] = useState<any[]>([]);
    const [isPullRefreshing, setIsPullRefreshing] = useState(false);

    const { isAuthenticated } = useAuthStore();

    const pulseAnim = React.useRef(new Animated.Value(0.3)).current;
    React.useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
                Animated.timing(pulseAnim, { toValue: 0.3, duration: 800, useNativeDriver: true })
            ])
        ).start();
    }, []);

    const { data, isLoading, refetch } = useQuery({
        queryKey: ['notifications'],
        queryFn: () => notificationsService.getAll(1),
        retry: 1,
        staleTime: 30 * 1000,
        enabled: isAuthenticated,
    });

    useEffect(() => {
        let mounted = true;
        const hydrate = async () => {
            const localSaved = await notificationsService.getLocalNotifications();
            const remote = data?.notifications ?? [];
            const merged = mergeNotifications(remote, localSaved);
            if (!mounted) return;
            setLocalList(merged.length > 0 ? merged : DUMMY_FALLBACK);
            setUnreadCount(merged.filter((n: any) => !n.isRead).length);
        };

        if (data?.notifications || !isLoading) {
            hydrate();
        }

        return () => { mounted = false; };
    }, [data, isLoading]);

    const unreadCount = localList.filter(n => !n.isRead).length;

    // Don't auto-mark all read on open — user should tap to read

    // Mutations
    const markAllMutation = useMutation({
        mutationFn: async () => {
            // Only call server if we have real IDs that are unread
            const realUnread = localList.filter(n => !n.isRead && !String(n._id).startsWith('local-'));
            if (realUnread.length > 0) {
                await notificationsService.markAllRead();
            }
        },
        onMutate: () => {
            setLocalList(prev => prev.map(n => ({ ...n, isRead: true })));
            setUnreadCount(0);
            qc.setQueryData(['notifications'], (prev: any) => prev ? { ...prev, unreadCount: 0, notifications: (prev.notifications || []).map((n: any) => ({ ...n, isRead: true })) } : prev);
            notificationsService.markAllLocalRead();
        },
        // Avoid refetch loops: we already updated local + cache optimistically above.
    });

    const markOneMutation = useMutation({
        mutationFn: async (id: string) => {
            if (!String(id).startsWith('local-')) {
                await notificationsService.markRead(id);
            }
        },
        onMutate: (id: string) => {
            setLocalList(prev => prev.map(n => n._id === id ? { ...n, isRead: true } : n));
            qc.setQueryData(['notifications'], (prev: any) => {
                if (!prev) return prev;
                const updated = (prev.notifications || []).map((n: any) => n._id === id ? { ...n, isRead: true } : n);
                const newUnreadCount = updated.filter((n: any) => !n.isRead).length;
                setUnreadCount(newUnreadCount);
                return { ...prev, notifications: updated, unreadCount: newUnreadCount };
            });
            notificationsService.markLocalRead(id);
        },
        // Avoid refetch loops: keep UI responsive with optimistic cache updates.
    });

    const clearAllMutation = useMutation({
        mutationFn: () => notificationsService.clearAll(),
        onMutate: () => {
            setLocalList([]);
            setUnreadCount(0);
            qc.setQueryData(['notifications'], { notifications: [], unreadCount: 0, total: 0, page: 1, pages: 1 });
            notificationsService.clearLocalNotifications();
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['notifications'] });
        },
        onError: () => {
            showToast.error('Error', 'Failed to clear notifications');
        }
    });

    const deleteOneMutation = useMutation({
        mutationFn: async (id: string) => {
            if (!String(id).startsWith('local-')) {
                await notificationsService.markRead(id);
            }
        },
        onMutate: (id: string) => {
            setLocalList(prev => {
                const updated = prev.filter(n => n._id !== id);
                setUnreadCount(updated.filter(n => !n.isRead).length);
                return updated;
            });
            notificationsService.markLocalRead(id);
        },
    });

    const handlePress = (n: any) => {
        if (!n.isRead) markOneMutation.mutate(n._id);
        const screen = n.data?.screen;
        if (screen) {
            router.push(screen as any);
            return;
        }
        switch (n.refType) {
            case 'DoctorAppointment':
            case 'ServiceRequest':
                router.push('/(tabs)/bookings' as any);
                break;
            case 'Wallet':
                router.push('/wallet' as any);
                break;
            case 'Ticket':
                router.push('/support/index' as any);
                break;
            case 'Broadcast':
            case 'Auth':
                showToast.info(n.title || 'Notification', n.body || undefined);
                break;
            default:
                if (n.title || n.body) {
                    showToast.info(n.title || 'Notification', n.body || undefined);
                }
                break;
        }
    };

    const handleClearAll = () => {
        if (localList.length === 0) return;
        if (Platform.OS === 'web') {
            if (window.confirm('Are you sure you want to delete all notifications? This cannot be undone.')) {
                clearAllMutation.mutate();
            }
        } else {
            Alert.alert(
                "Clear Notifications",
                "Are you sure you want to delete all notifications? This cannot be undone.",
                [
                    { text: "Cancel", style: "cancel" },
                    { text: "Clear All", style: "destructive", onPress: () => clearAllMutation.mutate() }
                ]
            );
        }
    };

    const handleManualRefresh = async () => {
        try {
            setIsPullRefreshing(true);
            await refetch();
        } finally {
            setIsPullRefreshing(false);
        }
    };

    return (
        <SafeAreaView style={styles.root} edges={['top']}>
            <LinearGradient colors={['#F8FAFE', '#FFFFFF']} style={StyleSheet.absoluteFillObject} />

            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/')} style={styles.backBtn}>
                    <ChevronLeft size={20} color="#1E293B" />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={styles.headerTitle}>Alerts & Updates</Text>
                    <Text style={styles.headerSub}>
                        {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up!'}
                    </Text>
                </View>



                <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity
                        style={[styles.headerActionBtn, unreadCount === 0 && { opacity: 0.35 }]}
                        onPress={() => markAllMutation.mutate()}
                        disabled={unreadCount === 0 || markAllMutation.isPending}
                    >
                        {markAllMutation.isPending 
                            ? <ActivityIndicator size="small" color={Colors.primary} />
                            : <CheckCircle2 size={13} color={Colors.primary} />
                        }
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.headerActionBtn, { backgroundColor: '#FFF1F2' }]}
                        onPress={handleClearAll}
                        disabled={localList.length === 0 || clearAllMutation.isPending}
                    >
                        {clearAllMutation.isPending 
                            ? <ActivityIndicator size="small" color="#E11D48" />
                            : <Text style={[styles.markAllText, { color: '#E11D48' }]}>Clear All</Text>
                        }
                    </TouchableOpacity>
                </View>
            </View>

            {isLoading ? (
                <NotificationsSkeleton pulseAnim={pulseAnim} />
            ) : (
                <ScrollView
                    contentContainerStyle={styles.list}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl refreshing={isPullRefreshing} onRefresh={handleManualRefresh} />
                    }
                >
                    {localList.map((n) => {
                        const meta = getMeta(n.refType);
                        const Icon = meta.icon;
                        return (
                            <TouchableOpacity
                                key={n._id}
                                style={[styles.card, !n.isRead && styles.cardUnread]}
                                onPress={() => handlePress(n)}
                            >
                                <View style={[styles.iconBox, { backgroundColor: meta.bgColor }]}>
                                    <Icon size={22} color={meta.color} />
                                </View>
                                <View style={styles.content}>
                                    <View style={styles.row}>
                                        <Text style={[styles.title, { flex: 1 }]}>{n.title}</Text>
                                        <TouchableOpacity
                                            onPress={(e) => { e.stopPropagation(); deleteOneMutation.mutate(n._id); }}
                                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                            style={{ marginLeft: 8 }}
                                        >
                                            <Trash2 size={14} color={Colors.muted} />
                                        </TouchableOpacity>
                                    </View>
                                    <Text style={styles.body} numberOfLines={2}>{n.body}</Text>
                                    <View style={styles.footer}>
                                        <Clock size={11} color={Colors.muted} />
                                        <Text style={styles.time}>{timeAgo(n.createdAt)}</Text>
                                        {!n.isRead && <View style={styles.dot} />}
                                    </View>
                                </View>
                            </TouchableOpacity>
                        );
                    })}
                    <View style={{ height: 100 }} />
                </ScrollView>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1 },
    center: { flex: 1, justifyContent: 'center' },
    header: { flexDirection: 'row', justifyContent: 'space-between', padding: 20 },
    backBtn: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
        alignSelf: 'center',
    },
    headerTitle: { fontSize: 24, fontWeight: '900', color: '#0F172A' },
    headerSub: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },
    markAllText: { fontSize: 12, fontWeight: '700', color: Colors.primary },
    headerActionBtn: { 
        flexDirection: 'row', alignItems: 'center', gap: 6, 
        paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, 
        backgroundColor: '#EBF3FD' 
    },
    list: { paddingHorizontal: 20 },
    card: { 
        flexDirection: 'row', backgroundColor: '#FFF', borderRadius: 20, 
        padding: 16, marginBottom: 12, elevation: 1 
    },
    cardUnread: { backgroundColor: '#F8FBFF', borderWidth: 1, borderColor: '#EBF3FD' },
    deleteBtn: { padding: 4 },
    iconBox: { width: 48, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    content: { flex: 1, marginLeft: 12 },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    title: { fontSize: 14, fontWeight: '800', color: '#0F172A' },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary },
    body: { fontSize: 13, color: '#64748B', lineHeight: 18, marginBottom: 8 },
    footer: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    time: { fontSize: 11, color: Colors.muted, fontWeight: '600' },
});
