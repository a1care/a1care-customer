import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    ImageBackground,
    Modal,
    TouchableWithoutFeedback,
    Linking,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation } from '@tanstack/react-query';
import { bookingsService } from '@/services/bookings.service';
import { Colors } from '@/constants/colors';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { socketService } from '@/services/socket.service';

// ── A1Care Brand Color Palette (Premium) ──────────────────────────────
const PRIMARY      = '#059669';          // A1Care primary green
const HEADER_COLOR = '#FFFFFF';          // crisp white header
const AVATAR_BG    = '#0F172A';          // dark navy
const MY_BUBBLE    = '#059669';          // sent messages: brand green
const MY_BUBBLE_TEXT = '#FFFFFF';        // white text on green
const THEIR_BUBBLE = '#FFFFFF';          // received: white
const THEIR_TEXT   = '#0F172A';          // dark text
const BG_CHAT      = '#F4F7FC';          // very light gray background
const TICK_COLOR   = '#A7F3D0';          // light mint tick on green bubble

const QUICK_REPLIES = [
    "I'm on my way 🚗",
    "Please be ready",
    "Reached your location 📍",
    "Running 5 min late",
    "Can you share location?",
    "Thank you! 🙏",
];

function formatMsgTime(dateStr: string) {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function isSameDay(a: string, b: string) {
    const da = new Date(a), db = new Date(b);
    return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
}

function dayLabel(dateStr: string) {
    const d = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
    if (isSameDay(dateStr, today.toISOString())) return 'Today';
    if (isSameDay(dateStr, yesterday.toISOString())) return 'Yesterday';
    return d.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function BookingChatScreen() {
    const { id, name, mobile } = useLocalSearchParams<{ id: string; name: string; mobile?: string }>();
    const router = useRouter();
    const scrollRef = useRef<ScrollView>(null);
    const [typedMessage, setTypedMessage] = useState('');
    const [chatMessages, setChatMessages] = useState<any[]>([]);
    const [showOptions, setShowOptions] = useState(false);
    const [isBlocked, setIsBlocked] = useState(false);
    const providerName = Array.isArray(name) ? name[0] : (name || 'Service Provider');
    const providerMobile = Array.isArray(mobile) ? mobile[0] : mobile;

    const { data: initialData, isLoading } = useQuery({
        queryKey: ['booking-chat', id],
        queryFn: () => bookingsService.getBookingMessages(id!),
        enabled: !!id && id !== '[id]',
    });

    useEffect(() => {
        if ((initialData?.length ?? 0) > 0) {
            setChatMessages(initialData || []);
        }
    }, [initialData]);

    useEffect(() => {
        if (!id) return;
        const socket = socketService.getSocket();
        if (!socket) return;
        
        socket.emit('join_room', id);
        
        const handleReceiveMessage = (data: any) => {
            if (data.roomId === id || data.bookingId === id) {
                setChatMessages(prev => {
                    if (prev.find((m: any) => m._id && m._id === data._id)) return prev;
                    return [...prev, data];
                });
            }
        };
        
        socket.on('receive_message', handleReceiveMessage);
        return () => { 
            socket.off('receive_message', handleReceiveMessage);
            socket.emit('leave_room', id);
        };
    }, [id]);

    const sendMutation = useMutation({
        mutationFn: (msg: string) => bookingsService.sendBookingMessage(id!, msg),
        onSuccess: (newMsg: any) => {
            const socket = socketService.getSocket();
            socket?.emit('send_message', { ...newMsg, roomId: id, senderType: 'User' });
            setChatMessages(prev => [...prev, newMsg]);
            setTypedMessage('');
        },
        onError: () => Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to send message. Please try again.' }),
    });

    const handleSend = (msg?: string) => {
        const text = (msg || typedMessage).trim();
        if (!text || sendMutation.isPending) return;
        sendMutation.mutate(text);
    };

    useEffect(() => {
        if (chatMessages.length > 0)
            setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);
    }, [chatMessages]);

    const initials = providerName.split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase();

    const handleBack = () => {
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/(tabs)/bookings' as any);
        }
    };

    const handleCall = () => {
        if (providerMobile) {
            Linking.openURL(`tel:${providerMobile}`);
        } else {
            Toast.show({ type: 'error', text1: 'Not Available', text2: 'Phone number is not available for this provider.' });
        }
    };

    useEffect(() => {
        if (id) {
            AsyncStorage.getItem(`blocked_customer_${id}`).then(val => {
                if (val === 'true') setIsBlocked(true);
            });
        }
    }, [id]);

    const toggleBlock = async () => {
        const newVal = !isBlocked;
        setIsBlocked(newVal);
        await AsyncStorage.setItem(`blocked_customer_${id}`, newVal ? 'true' : 'false');
        setShowOptions(false);
    };

    const handleOptions = () => {
        setShowOptions(true);
    };

    return (
        <SafeAreaView style={styles.root} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={handleBack} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Ionicons name="arrow-back" size={24} color="#0F172A" />
                </TouchableOpacity>

                <View style={styles.avatarCircle}>
                    <Text style={styles.avatarText}>{initials}</Text>
                </View>

                <View style={styles.headerMeta}>
                    <Text style={styles.headerName} numberOfLines={1}>{providerName}</Text>
                    <View style={styles.headerSubRow}>
                        <View style={styles.greenDot} />
                        <Text style={styles.headerSub}>Booking #{id?.slice(-6).toUpperCase()}</Text>
                    </View>
                </View>

                <TouchableOpacity style={styles.headerAction} onPress={handleCall}>
                    <Ionicons name="call" size={22} color="#0F172A" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.headerAction} onPress={handleOptions}>
                    <Ionicons name="ellipsis-vertical" size={22} color="#0F172A" />
                </TouchableOpacity>
            </View>

            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior="padding"
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
            >
                <View style={{ flex: 1, backgroundColor: BG_CHAT }}>
                {isLoading && chatMessages.length === 0 ? (
                    <View style={styles.center}>
                        <ActivityIndicator color={PRIMARY} size="large" />
                    </View>
                ) : (
                    <ScrollView
                        ref={scrollRef}
                        contentContainerStyle={styles.msgList}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                    >
                        {chatMessages.length === 0 && (
                            <View style={styles.emptyWrap}>
                                <View style={styles.lockBadge}>
                                    <Ionicons name="lock-closed" size={11} color="#64748B" />
                                    <Text style={styles.lockText}>
                                        Messages are end-to-end private between you and the provider
                                    </Text>
                                </View>
                            </View>
                        )}

                        {chatMessages.map((msg: any, idx: number) => {
                            const isMe = msg.senderType === 'Patient' || msg.senderType === 'User';
                            const showDay = idx === 0 || !isSameDay(msg.createdAt, chatMessages[idx - 1]?.createdAt);
                            
                            return (
                                <React.Fragment key={msg._id || idx}>
                                    {showDay && (
                                        <View style={styles.dayChip}>
                                            <Text style={styles.dayText}>{dayLabel(msg.createdAt)}</Text>
                                        </View>
                                    )}
                                    <View style={[styles.msgRow, isMe ? styles.rowMe : styles.rowThem]}>
                                        <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
                                            <Text style={[styles.msgText, { color: isMe ? MY_BUBBLE_TEXT : THEIR_TEXT }]}>
                                                {msg.message}
                                            </Text>
                                            <View style={styles.metaRow}>
                                                <Text style={[styles.msgTime, { color: isMe ? 'rgba(255,255,255,0.8)' : '#94A3B8' }]}>{formatMsgTime(msg.createdAt)}</Text>
                                                {isMe && (
                                                    <Ionicons
                                                        name="checkmark-done"
                                                        size={14}
                                                        color={TICK_COLOR}
                                                        style={{ marginLeft: 3 }}
                                                    />
                                                )}
                                            </View>
                                        </View>
                                    </View>
                                </React.Fragment>
                            );
                        })}
                    </ScrollView>
                )}
            </View>

            {chatMessages.length === 0 && (
                <View style={styles.quickWrap}>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.quickList}
                        keyboardShouldPersistTaps="handled"
                    >
                        {QUICK_REPLIES.map((q) => (
                            <TouchableOpacity
                                key={q}
                                style={styles.quickChip}
                                activeOpacity={0.7}
                                onPress={() => handleSend(q)}
                            >
                                <Text style={styles.quickText} numberOfLines={1}>{q}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            )}

            {isBlocked ? (
                <TouchableOpacity style={styles.blockedBar} onPress={toggleBlock}>
                    <Ionicons name="lock-closed" size={18} color="#64748B" />
                    <Text style={styles.blockedText}>You blocked this provider. Tap to unblock.</Text>
                </TouchableOpacity>
            ) : (
                <View style={styles.inputBar}>
                    <View style={styles.inputWrap}>
                        <TouchableOpacity style={{ paddingHorizontal: 8 }}>
                            <Ionicons name="happy-outline" size={22} color="#94A3B8" />
                        </TouchableOpacity>
                        <TextInput
                            style={styles.input}
                            placeholder="Reply..."
                            placeholderTextColor="#94A3B8"
                            value={typedMessage}
                            onChangeText={setTypedMessage}
                            multiline
                        />
                    </View>
                    <TouchableOpacity
                        style={styles.sendBtn}
                        onPress={() => handleSend()}
                        disabled={sendMutation.isPending}
                        activeOpacity={0.85}
                    >
                        {sendMutation.isPending
                            ? <ActivityIndicator color="#fff" size="small" />
                            : <Ionicons name="send" size={20} color="#fff" />
                        }
                    </TouchableOpacity>
                </View>
            )}
            </KeyboardAvoidingView>

            {/* Options Bottom Sheet */}
            <Modal visible={showOptions} transparent animationType="fade">
                <TouchableWithoutFeedback onPress={() => setShowOptions(false)}>
                    <View style={styles.modalOverlay}>
                        <TouchableWithoutFeedback>
                            <View style={styles.optionsSheet}>
                                <View style={styles.sheetHandle} />
                                <Text style={styles.sheetTitle}>Chat Options</Text>
                                
                                <TouchableOpacity style={styles.optionRow} onPress={() => { setShowOptions(false); handleCall(); }}>
                                    <View style={[styles.optionIcon, { backgroundColor: '#F0FDF4' }]}>
                                        <Ionicons name="call" size={20} color="#16A34A" />
                                    </View>
                                    <Text style={styles.optionText}>Call Provider</Text>
                                </TouchableOpacity>

                                <TouchableOpacity style={styles.optionRow} onPress={toggleBlock}>
                                    <View style={[styles.optionIcon, { backgroundColor: isBlocked ? '#F1F5F9' : '#FEF2F2' }]}>
                                        <Ionicons name={isBlocked ? "lock-open" : "warning"} size={20} color={isBlocked ? "#64748B" : "#DC2626"} />
                                    </View>
                                    <Text style={[styles.optionText, { color: isBlocked ? '#64748B' : '#DC2626' }]}>
                                        {isBlocked ? "Unblock Provider" : "Report / Block"}
                                    </Text>
                                </TouchableOpacity>

                                <TouchableOpacity style={[styles.optionRow, { borderBottomWidth: 0 }]} onPress={() => setShowOptions(false)}>
                                    <View style={[styles.optionIcon, { backgroundColor: '#F1F5F9' }]}>
                                        <Ionicons name="close" size={20} color="#64748B" />
                                    </View>
                                    <Text style={styles.optionText}>Cancel</Text>
                                </TouchableOpacity>
                            </View>
                        </TouchableWithoutFeedback>
                    </View>
                </TouchableWithoutFeedback>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: BG_CHAT },

    header: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: HEADER_COLOR,
        paddingHorizontal: 16, paddingVertical: 14, gap: 12,
        shadowColor: '#0F172A', shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 4 },
        elevation: 8, zIndex: 10
    },
    backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
    avatarCircle: {
        width: 44, height: 44, borderRadius: 22,
        backgroundColor: AVATAR_BG,
        alignItems: 'center', justifyContent: 'center',
    },
    avatarText: { color: '#fff', fontWeight: '900', fontSize: 16, letterSpacing: 0.5 },
    headerMeta: { flex: 1 },
    headerName: { color: '#0F172A', fontWeight: '900', fontSize: 18, letterSpacing: -0.5 },
    headerSubRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
    greenDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: PRIMARY },
    headerSub: { color: '#64748B', fontSize: 12, fontWeight: '700' },
    headerAction: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },

    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    msgList: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 16 },

    emptyWrap: { alignItems: 'center', paddingTop: 32 },
    lockBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 16, paddingVertical: 10,
        borderRadius: 20, maxWidth: '85%',
        shadowColor: '#0F172A', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
        elevation: 2,
    },
    lockText: { fontSize: 12, color: '#64748B', textAlign: 'center', lineHeight: 18, fontWeight: '600' },

    dayChip: {
        alignSelf: 'center', backgroundColor: '#E2E8F0',
        paddingHorizontal: 16, paddingVertical: 6,
        borderRadius: 16, marginVertical: 16,
    },
    dayText: { fontSize: 11, color: '#475569', fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },

    msgRow: { marginBottom: 6 },
    rowMe: { alignItems: 'flex-end' },
    rowThem: { alignItems: 'flex-start' },

    bubble: {
        maxWidth: '82%',
        paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10,
        borderRadius: 20,
    },
    bubbleMe: { backgroundColor: MY_BUBBLE, borderBottomRightRadius: 4 },
    bubbleThem: { 
        backgroundColor: THEIR_BUBBLE, 
        borderBottomLeftRadius: 4,
        shadowColor: '#0F172A', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
        elevation: 2
    },

    msgText: { fontSize: 15, lineHeight: 22, fontWeight: '500' },
    metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 4, gap: 2 },
    msgTime: { fontSize: 11, fontWeight: '600' },

    // Quick replies
    quickWrap: { backgroundColor: 'transparent', paddingBottom: 8, paddingTop: 8 },
    quickList: { paddingHorizontal: 16, flexDirection: 'row', gap: 8 },
    quickChip: {
        backgroundColor: '#ECFDF5',
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 10,
    },
    quickText: { fontSize: 14, color: PRIMARY, fontWeight: '800' },

    // Input bar
    inputBar: {
        flexDirection: 'row', alignItems: 'flex-end',
        gap: 10, paddingHorizontal: 16, paddingVertical: 12,
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1, borderTopColor: '#F1F5F9',
        elevation: 10, shadowColor: '#0F172A', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: -4 }
    },
    inputWrap: {
        flex: 1, flexDirection: 'row', alignItems: 'center',
        backgroundColor: '#F1F5F9',
        borderRadius: 24,
        paddingVertical: 4, paddingRight: 6, paddingLeft: 6, minHeight: 50,
    },
    input: {
        flex: 1, fontSize: 16, color: '#0F172A',
        paddingHorizontal: 12, maxHeight: 120, lineHeight: 22, fontWeight: '500'
    },
    sendBtn: {
        width: 46, height: 46, borderRadius: 23,
        backgroundColor: PRIMARY,
        alignItems: 'center', justifyContent: 'center',
        elevation: 2,
    },
    blockedBar: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        paddingVertical: 18, backgroundColor: '#F8FAFC',
        borderTopWidth: 1, borderTopColor: '#E2E8F0',
    },
    blockedText: {
        fontSize: 14, color: '#64748B', fontWeight: '600',
    },

    // Modal
    modalOverlay: {
        flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.4)',
        justifyContent: 'flex-end',
    },
    optionsSheet: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 24, borderTopRightRadius: 24,
        paddingHorizontal: 20, paddingBottom: 30, paddingTop: 12,
        shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 10,
    },
    sheetHandle: {
        width: 40, height: 4, borderRadius: 2,
        backgroundColor: '#E2E8F0',
        alignSelf: 'center', marginBottom: 20,
    },
    sheetTitle: {
        fontSize: 18, fontWeight: '800', color: '#0F172A',
        marginBottom: 16,
    },
    optionRow: {
        flexDirection: 'row', alignItems: 'center', gap: 14,
        paddingVertical: 14,
        borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
    },
    optionIcon: {
        width: 40, height: 40, borderRadius: 20,
        justifyContent: 'center', alignItems: 'center',
    },
    optionText: {
        fontSize: 16, fontWeight: '600', color: '#0F172A',
    }
});
