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
import { CustomAlert } from '@/stores/alert.store';
import ConfirmModal from '@/components/ui/ConfirmModal';
import NotificationDetailSheet, { isNavigableNotification } from '@/components/ui/NotificationDetailSheet';

// ── Icon/Color Mapping ───────────────────────────────────────────────────
const TYPE_META: Record<string, { icon: any; color: string; bgColor: string }> = {
    ServiceRequest:      { icon: Stethoscope, color: '#2F80ED', bgColor: '#EBF3FD' },
    DoctorAppointment:   { icon: Activity,    color: '#22C55E', bgColor: '#DCFCE7' },
    Wallet:              { icon: CreditCard,  color: '#F59E0B', bgColor: '#FEF3C7' },
    Ticket:              { icon: Ticket,      color: '#E11D48', bgColor: '#FFF1F2' },
    Broadcast:           { icon: Tag,         color: '#9B51E0', bgColor: '#F5EBFF' },
    Auth:                { icon: ShieldAlert, color: '#6366F1', bgColor: '#EEF2FF' },
    Partner:             { icon: Users,       color: '#0D9488', bgColor: '#CCFBF1' },
    Message:             { icon: Activity,    color: '#3B82F6', bgColor: '#EFF6FF' }, // Reusing an icon but giving it a distinct blue styling
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
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8 }} showsVerticalScrollIndicator={false}>
            {[1, 2, 3, 4, 5].map((i) => (
                <Animated.View
                    key={i}
                    style={[
                        {
                            opacity: pulseAnim,
                            backgroundColor: '#E8EEF5',
                            height: 88,
                            borderRadius: 24,
                            marginBottom: 14,
                        }
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
    const [showClearModal, setShowClearModal] = useState(false);
    const [selectedNotif, setSelectedNotif] = useState<any | null>(null);
    const [sheetVisible, setSheetVisible] = useState(false);

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
        // Always mark as read
        if (!n.isRead) markOneMutation.mutate(n._id);

        const screen = n.data?.screen;
        if (screen) {
            router.push(screen as any);
            return;
        }

        // Booking-related → navigate directly
        if (isNavigableNotification(n.refType)) {
            switch (n.refType) {
                case 'DoctorAppointment':
                    router.push('/(tabs)/bookings' as any);
                    break;
                case 'ServiceRequest':
                    router.push('/(tabs)/bookings' as any);
                    break;
            }
            return;
        }

        // Everything else → open the premium detail sheet
        setSelectedNotif(n);
        setSheetVisible(true);
    };

    // Called from the sheet's action button for non-booking types
    const handleSheetAction = (n: any) => {
        switch (n.refType) {
            case 'Wallet':
                router.push('/wallet' as any);
                break;
            case 'Ticket':
                router.push('/support/index' as any);
                break;
            case 'Message':
                if (n.data?.type === 'BOOKING_CHAT') {
                    router.push(`/booking/chat?id=${n.data.threadId}` as any);
                } else if (n.data?.type === 'TICKET_CHAT') {
                    router.push(`/support/chat?id=${n.data.threadId}` as any);
                }
                break;
            default:
                break;
        }
    };

    const handleClearAll = () => {
        if (localList.length === 0) return;
        setShowClearModal(true);
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

            {/* ── Header ── */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/')} style={styles.backBtn}>
                    <ChevronLeft size={20} color="#0F172A" />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={styles.headerTitle}>Alerts & Updates</Text>
                    <Text style={styles.headerSub}>
                        {unreadCount > 0 ? `${unreadCount} unread notifications` : 'All caught up ✓'}
                    </Text>
                </View>
                <TouchableOpacity
                    style={[styles.clearBtn, (localList.length === 0 || clearAllMutation.isPending) && { opacity: 0.4 }]}
                    onPress={handleClearAll}
                    disabled={localList.length === 0 || clearAllMutation.isPending}
                >
                    {clearAllMutation.isPending
                        ? <ActivityIndicator size="small" color="#E11D48" />
                        : <Text style={styles.clearBtnText}>Clear All</Text>
                    }
                </TouchableOpacity>
            </View>



            {isLoading ? (
                <NotificationsSkeleton pulseAnim={pulseAnim} />
            ) : localList.length === 0 ? (
                <View style={styles.emptyState}>
                    <View style={styles.emptyIconCircle}>
                        <Bell size={36} color="#2563EB" />
                    </View>
                    <Text style={styles.emptyTitle}>You're all caught up!</Text>
                    <Text style={styles.emptySub}>No notifications right now. We'll alert you when something needs your attention.</Text>
                </View>
            ) : (
                <ScrollView
                    contentContainerStyle={styles.list}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl refreshing={isPullRefreshing} onRefresh={handleManualRefresh} tintColor="#2563EB" />
                    }
                >
                    {localList.map((n) => {
                        const meta = getMeta(n.refType);
                        const Icon = meta.icon;
                        const isUnread = !n.isRead;
                        return (
                            <TouchableOpacity
                                key={n._id}
                                style={[styles.card, isUnread && styles.cardUnread]}
                                onPress={() => handlePress(n)}
                                activeOpacity={0.88}
                            >
                                {/* Unread left accent */}
                                {isUnread && <View style={[styles.unreadAccent, { backgroundColor: meta.color }]} />}

                                {/* Icon */}
                                <View style={[styles.iconBox, { backgroundColor: meta.bgColor }]}>
                                    <Icon size={22} color={meta.color} />
                                </View>

                                {/* Content */}
                                <View style={styles.content}>
                                    <View style={styles.row}>
                                        <Text style={[styles.notifTitle, isUnread && styles.notifTitleUnread]} numberOfLines={1}>
                                            {n.title}
                                        </Text>
                                        <TouchableOpacity
                                            onPress={(e) => { e.stopPropagation(); deleteOneMutation.mutate(n._id); }}
                                            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                                            style={styles.deleteBtn}
                                        >
                                            <Trash2 size={16} color="#EF4444" />
                                        </TouchableOpacity>
                                    </View>
                                    <Text style={styles.notifBody} numberOfLines={2}>{n.body}</Text>
                                    <View style={styles.notifFooter}>
                                        <Clock size={11} color="#94A3B8" />
                                        <Text style={styles.notifTime}>{timeAgo(n.createdAt)}</Text>
                                        {isUnread && (
                                            <View style={[styles.unreadDot, { backgroundColor: meta.color }]} />
                                        )}
                                    </View>
                                </View>
                            </TouchableOpacity>
                        );
                    })}
                    <View style={{ height: 100 }} />
                </ScrollView>
            )}

            <ConfirmModal
                visible={showClearModal}
                title="Clear All Notifications?"
                body="This will permanently delete all your notifications. This action cannot be undone."
                confirmLabel="Yes, Clear All"
                icon="trash-outline"
                confirmColor="#E11D48"
                loading={clearAllMutation.isPending}
                onConfirm={() => { setShowClearModal(false); clearAllMutation.mutate(); }}
                onCancel={() => setShowClearModal(false)}
            />

            <NotificationDetailSheet
                visible={sheetVisible}
                notification={selectedNotif}
                onClose={() => setSheetVisible(false)}
                onAction={handleSheetAction}
            />

        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#F4F7FC' },

    // Header
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
        alignItems: 'center', justifyContent: 'center',
        marginRight: 14,
    },
    headerTitle: { fontSize: 20, fontWeight: '900', color: '#0F172A', letterSpacing: -0.3 },
    headerSub: { fontSize: 12, color: '#94A3B8', fontWeight: '600', marginTop: 2 },
    clearBtn: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 14, paddingVertical: 8,
        backgroundColor: '#FFF1F2',
        borderRadius: 20,
        borderWidth: 1, borderColor: '#FCA5A5',
    },
    clearBtnText: { fontSize: 12, fontWeight: '900', color: '#E11D48' },

    // Mark all strip
    markAllStrip: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        marginHorizontal: 20, marginTop: 12, marginBottom: 4,
        backgroundColor: '#EEF4FF',
        borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10,
        borderWidth: 1, borderColor: '#BFDBFE',
    },
    markAllStripText: { fontSize: 13, fontWeight: '800', color: '#2563EB', flex: 1 },
    markAllText: { fontSize: 12, fontWeight: '700', color: Colors.primary },
    headerActionBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20,
        backgroundColor: '#EBF3FD'
    },

    list: { paddingHorizontal: 20, paddingTop: 14 },

    // Cards
    card: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#0A1A3A',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.04,
        shadowRadius: 14,
        elevation: 3,
        borderWidth: 1,
        borderColor: '#E8EEF5',
        overflow: 'hidden',
        position: 'relative',
    },
    cardUnread: {
        backgroundColor: '#FAFCFF',
        borderColor: '#BFDBFE',
        shadowColor: '#2563EB',
        shadowOpacity: 0.06,
    },
    unreadAccent: {
        position: 'absolute',
        left: 0, top: 0, bottom: 0,
        width: 4,
        borderTopLeftRadius: 24,
        borderBottomLeftRadius: 24,
    },
    iconBox: {
        width: 52, height: 52, borderRadius: 18,
        justifyContent: 'center', alignItems: 'center',
        marginRight: 14,
        flexShrink: 0,
    },
    content: { flex: 1 },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 5 },
    notifTitle: { fontSize: 14, fontWeight: '700', color: '#334155', flex: 1, lineHeight: 20 },
    notifTitleUnread: { fontWeight: '900', color: '#0F172A' },
    deleteBtn: {
        width: 32, height: 32, borderRadius: 16,
        backgroundColor: '#FEF2F2',
        justifyContent: 'center', alignItems: 'center',
        marginLeft: 10,
    },
    notifBody: { fontSize: 13, color: '#64748B', lineHeight: 19, marginBottom: 8, fontWeight: '500' },
    notifFooter: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    notifTime: { fontSize: 11, color: '#94A3B8', fontWeight: '600' },
    unreadDot: { width: 7, height: 7, borderRadius: 3.5, marginLeft: 4 },

    // Empty state
    emptyState: {
        flex: 1, alignItems: 'center', justifyContent: 'center',
        paddingHorizontal: 40, paddingVertical: 60,
    },
    emptyIconCircle: {
        width: 100, height: 100, borderRadius: 50,
        backgroundColor: '#EEF4FF',
        justifyContent: 'center', alignItems: 'center',
        marginBottom: 22,
        shadowColor: '#2563EB',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 18, elevation: 5,
    },
    emptyTitle: { fontSize: 22, fontWeight: '900', color: '#0F172A', textAlign: 'center', letterSpacing: -0.3, marginBottom: 10 },
    emptySub: { fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 22, fontWeight: '500' },

    // legacy aliases kept for skeleton
    center: { flex: 1, justifyContent: 'center' },
    title: { fontSize: 14, fontWeight: '800', color: '#0F172A' },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary },
    body: { fontSize: 13, color: '#64748B', lineHeight: 18, marginBottom: 8 },
    footer: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    time: { fontSize: 11, color: Colors.muted, fontWeight: '600' },
});
