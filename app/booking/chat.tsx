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
    Alert,
    ImageBackground,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation } from '@tanstack/react-query';
import { bookingsService } from '@/services/bookings.service';
import { Colors } from '@/constants/colors';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { io, Socket } from 'socket.io-client';

const API_URL = process.env.EXPO_PUBLIC_API_URL?.replace('/api', '') || 'http://10.0.2.2:3000';

// ── A1Care Brand Color Palette ──────────────────────────────
const PRIMARY      = '#2D935C';          // A1Care primary green
const HEADER_COLOR = '#2D935C';          // same green for header
const AVATAR_BG    = '#1E6B43';          // darker shade for avatar
const MY_BUBBLE    = '#2D935C';          // sent messages: brand green
const MY_BUBBLE_TEXT = '#FFFFFF';        // white text on green
const THEIR_BUBBLE = '#FFFFFF';          // received: white
const THEIR_TEXT   = '#1E293B';          // dark text
const BG_CHAT      = '#F0F7F4';          // very light mint background
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
    const { id, name } = useLocalSearchParams<{ id: string, name: string }>();
    const router = useRouter();
    const scrollRef = useRef<ScrollView>(null);
    const [typedMessage, setTypedMessage] = useState('');
    const [chatMessages, setChatMessages] = useState<any[]>([]);
    const socketRef = useRef<Socket | null>(null);
    const providerName = Array.isArray(name) ? name[0] : (name || 'Service Provider');

    const { isLoading } = useQuery({
        queryKey: ['booking-chat', id],
        queryFn: () => bookingsService.getBookingMessages(id!),
        enabled: !!id && id !== '[id]',
    });

    useEffect(() => {
        if (!id) return;
        const socket = io(API_URL, { transports: ['websocket'] });
        socketRef.current = socket;
        socket.on('connect', () => socket.emit('join_room', id));
        socket.on('receive_message', (data: any) => {
            if (data.roomId === id) {
                setChatMessages(prev => {
                    if (prev.find((m: any) => m._id && m._id === data._id)) return prev;
                    return [...prev, data];
                });
            }
        });
        return () => { socket.disconnect(); };
    }, [id]);

    const sendMutation = useMutation({
        mutationFn: (msg: string) => bookingsService.sendBookingMessage(id!, msg),
        onSuccess: (newMsg: any) => {
            socketRef.current?.emit('send_message', { ...newMsg, roomId: id, senderType: 'User' });
            setChatMessages(prev => [...prev, newMsg]);
            setTypedMessage('');
        },
        onError: () => Alert.alert('Error', 'Failed to send message. Please try again.'),
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

    return (
        <SafeAreaView style={styles.root} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Ionicons name="arrow-back" size={22} color="#fff" />
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

                <TouchableOpacity style={styles.headerAction}>
                    <Ionicons name="call-outline" size={20} color="#fff" />
                </TouchableOpacity>
            </View>

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
                            const isMe = msg.senderType === 'User';
                            const showDay = idx === 0 || !isSameDay(msg.createdAt, chatMessages[idx - 1]?.createdAt);
                            const isLast = idx === chatMessages.length - 1;

                            return (
                                <React.Fragment key={msg._id || idx}>
                                    {showDay && (
                                        <View style={styles.dayChip}>
                                            <Text style={styles.dayText}>{dayLabel(msg.createdAt)}</Text>
                                        </View>
                                    )}
                                    <View style={[styles.msgRow, isMe ? styles.rowMe : styles.rowThem]}>
                                        <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
                                            {isMe
                                                ? <View style={styles.tailRight} />
                                                : <View style={styles.tailLeft} />
                                            }
                                            <Text style={[styles.msgText, { color: isMe ? MY_BUBBLE_TEXT : THEIR_TEXT }]}>
                                                {msg.message}
                                            </Text>
                                            <View style={styles.metaRow}>
                                                <Text style={[styles.msgTime, { color: isMe ? TICK_COLOR : '#8696A0' }]}>{formatMsgTime(msg.createdAt)}</Text>
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

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
            >
                <View style={styles.inputBar}>
                    <View style={styles.inputWrap}>
                        <TextInput
                            style={styles.input}
                            placeholder="Type a message"
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
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: HEADER_COLOR },

    // ── Header ──────────────────────────────────
    header: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: HEADER_COLOR,
        paddingHorizontal: 10, paddingVertical: 12,
        gap: 10,
        shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
        elevation: 4,
    },
    backBtn: { padding: 6, borderRadius: 20 },
    avatarCircle: {
        width: 42, height: 42, borderRadius: 21,
        backgroundColor: AVATAR_BG,
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)',
    },
    avatarText: { color: '#fff', fontWeight: '900', fontSize: 15, letterSpacing: 0.5 },
    headerMeta: { flex: 1 },
    headerName: { color: '#fff', fontWeight: '800', fontSize: 16 },
    headerSubRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
    greenDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#A7F3D0' },
    headerSub: { color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: '600' },
    headerAction: { padding: 8 },

    // ── Messages ────────────────────────────────
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    msgList: { paddingHorizontal: 12, paddingTop: 16, paddingBottom: 10 },

    emptyWrap: { alignItems: 'center', paddingTop: 28 },
    lockBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: 'rgba(255,255,255,0.92)',
        paddingHorizontal: 16, paddingVertical: 8,
        borderRadius: 12, maxWidth: 290,
        shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
        elevation: 1,
    },
    lockText: { fontSize: 11.5, color: '#64748B', textAlign: 'center', lineHeight: 17, fontWeight: '500' },

    // Day chip
    dayChip: {
        alignSelf: 'center',
        backgroundColor: '#D1FAE5',
        paddingHorizontal: 16, paddingVertical: 5,
        borderRadius: 14, marginVertical: 12,
        elevation: 1, borderWidth: 1, borderColor: '#A7F3D0',
    },
    dayText: { fontSize: 11.5, color: '#065F46', fontWeight: '700' },

    // Message rows
    msgRow: { marginBottom: 5 },
    rowMe: { alignItems: 'flex-end' },
    rowThem: { alignItems: 'flex-start' },

    bubble: {
        maxWidth: '78%',
        paddingHorizontal: 13, paddingTop: 9, paddingBottom: 7,
        borderRadius: 14,
        elevation: 2,
        shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
        position: 'relative',
    },
    bubbleMe: { backgroundColor: MY_BUBBLE, borderTopRightRadius: 3 },
    bubbleThem: { backgroundColor: THEIR_BUBBLE, borderTopLeftRadius: 3, borderWidth: 1, borderColor: '#E8F5EE' },

    tailRight: {
        position: 'absolute', top: 0, right: -8,
        width: 0, height: 0,
        borderTopWidth: 11, borderTopColor: MY_BUBBLE,
        borderLeftWidth: 9, borderLeftColor: 'transparent',
    },
    tailLeft: {
        position: 'absolute', top: 0, left: -8,
        width: 0, height: 0,
        borderTopWidth: 11, borderTopColor: THEIR_BUBBLE,
        borderRightWidth: 9, borderRightColor: 'transparent',
    },

    msgText: { fontSize: 14.5, lineHeight: 21 },
    metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 5, gap: 3 },
    msgTime: { fontSize: 10.5 },

    // ── Quick Replies ────────────────────────────
    quickWrap: { backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#E8F5EE', paddingBottom: 2 },
    quickList: { paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', gap: 8 },
    quickChip: {
        backgroundColor: '#F0FDF6',
        borderRadius: 20,
        paddingHorizontal: 15,
        paddingVertical: 8,
        borderWidth: 1.5,
        borderColor: '#A7F3D0',
        elevation: 0,
    },
    quickText: { fontSize: 13, color: PRIMARY, fontWeight: '700' },

    // ── Input Bar ────────────────────────────────
    inputBar: {
        flexDirection: 'row', alignItems: 'flex-end',
        gap: 8, paddingHorizontal: 10, paddingVertical: 10,
        backgroundColor: '#fff',
        borderTopWidth: 1, borderTopColor: '#E8F5EE',
    },
    inputWrap: {
        flex: 1, flexDirection: 'row', alignItems: 'center',
        backgroundColor: '#F8FAFC',
        borderRadius: 26, borderWidth: 1.5, borderColor: '#D1FAE5',
        paddingVertical: 6, paddingRight: 10, minHeight: 46,
    },
    input: {
        flex: 1, fontSize: 15, color: '#1E293B',
        paddingHorizontal: 10, maxHeight: 110, lineHeight: 20,
    },
    sendBtn: {
        width: 46, height: 46, borderRadius: 23,
        alignItems: 'center', justifyContent: 'center',
        elevation: 2,
    },
});
