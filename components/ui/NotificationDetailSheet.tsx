import React, { useEffect, useRef } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Modal,
    Animated,
    PanResponder,
    Dimensions,
    ScrollView,
    Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import {
    Bell,
    Stethoscope,
    ShieldAlert,
    Clock,
    CreditCard,
    Ticket,
    Activity,
    Users,
    Tag,
    ArrowRight,
} from 'lucide-react-native';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.62;

// ── Type metadata (mirrors notifications.tsx) ─────────────────────────────
const TYPE_META: Record<string, { icon: any; color: string; bgColor: string; label: string }> = {
    ServiceRequest:    { icon: Stethoscope, color: '#2563EB', bgColor: '#EEF4FF', label: 'Service Booking'    },
    DoctorAppointment: { icon: Activity,    color: '#16A34A', bgColor: '#ECFDF5', label: 'Doctor Appointment' },
    Wallet:            { icon: CreditCard,  color: '#D97706', bgColor: '#FEF3C7', label: 'Wallet Activity'    },
    Ticket:            { icon: Ticket,      color: '#E11D48', bgColor: '#FFF1F2', label: 'Support Ticket'     },
    Broadcast:         { icon: Tag,         color: '#9B51E0', bgColor: '#F5EBFF', label: 'Announcement'       },
    Auth:              { icon: ShieldAlert, color: '#6366F1', bgColor: '#EEF2FF', label: 'Account Security'   },
    Partner:           { icon: Users,       color: '#0D9488', bgColor: '#CCFBF1', label: 'Partner Update'     },
    Message:           { icon: Activity,    color: '#3B82F6', bgColor: '#EFF6FF', label: 'Message'            },
    default:           { icon: Bell,        color: '#2563EB', bgColor: '#EEF4FF', label: 'Notification'       },
};

function getMeta(refType?: string) {
    return TYPE_META[refType ?? ''] ?? TYPE_META.default;
}

function timeAgo(dateStr: string) {
    try {
        const diff = Date.now() - new Date(dateStr).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'Just now';
        if (mins < 60) return `${mins} minutes ago`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs} hour${hrs > 1 ? 's' : ''} ago`;
        const days = Math.floor(hrs / 24);
        if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;
        return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
        return 'Recently';
    }
}

/** Returns true for notification types that navigate instead of showing the sheet */
export function isNavigableNotification(refType?: string): boolean {
    return refType === 'ServiceRequest' || refType === 'DoctorAppointment';
}

interface NotificationDetailSheetProps {
    visible: boolean;
    notification: any | null;
    onClose: () => void;
    onAction?: (notification: any) => void;
}

export default function NotificationDetailSheet({
    visible,
    notification,
    onClose,
    onAction,
}: NotificationDetailSheetProps) {
    const translateY = useRef(new Animated.Value(SHEET_HEIGHT)).current;
    const backdropOpacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.spring(translateY, {
                    toValue: 0,
                    useNativeDriver: true,
                    damping: 22,
                    stiffness: 200,
                    mass: 0.8,
                }),
                Animated.timing(backdropOpacity, {
                    toValue: 1,
                    duration: 250,
                    useNativeDriver: true,
                }),
            ]).start();
        } else {
            Animated.parallel([
                Animated.timing(translateY, {
                    toValue: SHEET_HEIGHT,
                    duration: 260,
                    useNativeDriver: true,
                }),
                Animated.timing(backdropOpacity, {
                    toValue: 0,
                    duration: 200,
                    useNativeDriver: true,
                }),
            ]).start();
        }
    }, [visible]);

    // Drag to dismiss
    const panResponder = useRef(
        PanResponder.create({
            onMoveShouldSetPanResponder: (_, g) => g.dy > 6,
            onPanResponderMove: (_, g) => {
                if (g.dy > 0) translateY.setValue(g.dy);
            },
            onPanResponderRelease: (_, g) => {
                if (g.dy > 100 || g.vy > 0.8) {
                    onClose();
                } else {
                    Animated.spring(translateY, {
                        toValue: 0,
                        useNativeDriver: true,
                        damping: 20,
                        stiffness: 200,
                    }).start();
                }
            },
        })
    ).current;

    if (!notification) return null;

    const meta = getMeta(notification.refType);
    const Icon = meta.icon;

    // Decide if there's an action button based on type
    const hasAction = [
        'ServiceRequest', 'DoctorAppointment', 'Wallet', 'Ticket', 'Message'
    ].includes(notification.refType ?? '');

    const actionLabel =
        notification.refType === 'Wallet' ? 'View Wallet' :
        notification.refType === 'Ticket' ? 'View Support Ticket' :
        notification.refType === 'Message' ? 'Open Chat' :
        'View Details';

    return (
        <Modal
            visible={visible}
            transparent
            animationType="none"
            statusBarTranslucent
            onRequestClose={onClose}
        >
            {/* Backdrop */}
            <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
                <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
            </Animated.View>

            {/* Sheet */}
            <Animated.View
                style={[styles.sheet, { transform: [{ translateY }] }]}
                {...panResponder.panHandlers}
            >
                {/* Drag handle */}
                <View style={styles.dragHandle} />

                {/* Header gradient strip (like Razorpay's branding strip) */}
                <LinearGradient
                    colors={[meta.bgColor, '#FFFFFF']}
                    start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
                    style={styles.headerStrip}
                >
                    {/* Close button */}
                    <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.85}>
                        <Ionicons name="close" size={18} color="#64748B" />
                    </TouchableOpacity>

                    {/* Icon + type label */}
                    <View style={[styles.iconCircle, { backgroundColor: meta.bgColor, borderColor: `${meta.color}30` }]}>
                        <Icon size={28} color={meta.color} />
                    </View>
                    <Text style={[styles.typeLabel, { color: meta.color }]}>{meta.label}</Text>
                </LinearGradient>

                <ScrollView
                    contentContainerStyle={styles.body}
                    showsVerticalScrollIndicator={false}
                    bounces={false}
                >
                    {/* Title */}
                    <Text style={styles.title}>{notification.title}</Text>

                    {/* Time */}
                    <View style={styles.timeRow}>
                        <Clock size={13} color="#94A3B8" />
                        <Text style={styles.timeText}>{timeAgo(notification.createdAt)}</Text>
                    </View>

                    {/* Divider */}
                    <View style={styles.divider} />

                    {/* Message body */}
                    <Text style={styles.messageBody}>{notification.body}</Text>

                    {/* Extra data pills */}
                    {notification.data && Object.keys(notification.data).length > 0 && (
                        <View style={styles.dataSection}>
                            <Text style={styles.dataSectionLabel}>DETAILS</Text>
                            {Object.entries(notification.data)
                                .filter(([k]) => !['screen', 'type'].includes(k))
                                .map(([key, val]) => (
                                    <View key={key} style={styles.dataRow}>
                                        <Text style={styles.dataKey}>{key.replace(/([A-Z])/g, ' $1').trim()}</Text>
                                        <Text style={styles.dataVal} numberOfLines={1}>{String(val)}</Text>
                                    </View>
                                ))
                            }
                        </View>
                    )}
                </ScrollView>

                {/* Action button */}
                {hasAction && onAction && (
                    <View style={styles.actionArea}>
                        <TouchableOpacity
                            style={styles.actionBtn}
                            onPress={() => {
                                onClose();
                                setTimeout(() => onAction(notification), 320);
                            }}
                            activeOpacity={0.88}
                        >
                            <LinearGradient
                                colors={['#0B3370', '#2563EB']}
                                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                                style={styles.actionGrad}
                            >
                                <Text style={styles.actionText}>{actionLabel}</Text>
                                <ArrowRight size={18} color="#fff" />
                            </LinearGradient>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.dismissBtn} onPress={onClose} activeOpacity={0.8}>
                            <Text style={styles.dismissText}>Dismiss</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Safe area padding */}
                <View style={{ height: Platform.OS === 'ios' ? 28 : 14 }} />
            </Animated.View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(10, 20, 50, 0.55)',
    },
    sheet: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        maxHeight: SHEET_HEIGHT,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -8 },
        shadowOpacity: 0.15,
        shadowRadius: 24,
        elevation: 24,
        overflow: 'hidden',
    },
    dragHandle: {
        width: 44, height: 4, borderRadius: 2,
        backgroundColor: '#CBD5E1',
        alignSelf: 'center',
        marginTop: 12, marginBottom: 4,
    },

    // Header strip
    headerStrip: {
        alignItems: 'center',
        paddingTop: 18,
        paddingBottom: 24,
        paddingHorizontal: 24,
        position: 'relative',
    },
    closeBtn: {
        position: 'absolute', top: 14, right: 18,
        width: 34, height: 34, borderRadius: 17,
        backgroundColor: '#F1F5F9',
        justifyContent: 'center', alignItems: 'center',
    },
    iconCircle: {
        width: 72, height: 72, borderRadius: 36,
        justifyContent: 'center', alignItems: 'center',
        marginBottom: 12,
        borderWidth: 2,
    },
    typeLabel: {
        fontSize: 12, fontWeight: '900', letterSpacing: 1.2, textTransform: 'uppercase',
    },

    // Body
    body: {
        paddingHorizontal: 24,
        paddingTop: 4,
        paddingBottom: 16,
    },
    title: {
        fontSize: 20, fontWeight: '900', color: '#0F172A',
        letterSpacing: -0.3, marginBottom: 10, lineHeight: 27,
    },
    timeRow: {
        flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16,
    },
    timeText: { fontSize: 12, color: '#94A3B8', fontWeight: '600' },
    divider: { height: 1, backgroundColor: '#F1F5F9', marginBottom: 16 },
    messageBody: {
        fontSize: 15, color: '#475569', lineHeight: 24,
        fontWeight: '500', marginBottom: 20,
    },

    // Extra data
    dataSection: {
        backgroundColor: '#F8FAFC',
        borderRadius: 18, padding: 16,
        borderWidth: 1, borderColor: '#E8EEF5',
        gap: 10,
    },
    dataSectionLabel: {
        fontSize: 10, fontWeight: '900', color: '#94A3B8', letterSpacing: 1.4, marginBottom: 4,
    },
    dataRow: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    },
    dataKey: { fontSize: 13, color: '#64748B', fontWeight: '600', flex: 1, textTransform: 'capitalize' },
    dataVal: { fontSize: 13, color: '#0F172A', fontWeight: '800', flex: 1, textAlign: 'right' },

    // Action
    actionArea: {
        paddingHorizontal: 20,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
        gap: 10,
    },
    actionBtn: {
        borderRadius: 30, overflow: 'hidden',
        shadowColor: '#0B3370',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.28,
        shadowRadius: 16,
        elevation: 8,
    },
    actionGrad: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 10, paddingVertical: 17,
    },
    actionText: { color: '#fff', fontSize: 16, fontWeight: '900', letterSpacing: 0.3 },
    dismissBtn: {
        paddingVertical: 13,
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        borderRadius: 22,
        borderWidth: 1, borderColor: '#E2E8F0',
    },
    dismissText: { color: '#64748B', fontSize: 14, fontWeight: '800' },
});
