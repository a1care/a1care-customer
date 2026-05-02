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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { bookingsService } from '@/services/bookings.service';
import { Colors, Shadows } from '@/constants/colors';
import { FontSize } from '@/constants/spacing';
import { Ionicons, Feather } from '@expo/vector-icons';
import { io, Socket } from 'socket.io-client';

const API_URL = process.env.EXPO_PUBLIC_API_URL?.replace('/api', '') || 'https://api.a1carehospital.in';

export default function BookingChatScreen() {
    const { id, name } = useLocalSearchParams<{ id: string, name: string }>();
    const router = useRouter();
    const queryClient = useQueryClient();
    const scrollRef = useRef<ScrollView>(null);
    const [typedMessage, setTypedMessage] = useState('');
    const socketRef = useRef<Socket | null>(null);

    // Fetch initial messages
    const { data: initialMessages = [], isLoading } = useQuery({
        queryKey: ['booking-chat', id],
        queryFn: () => bookingsService.getBookingMessages(id!),
        enabled: !!id,
    });

    const [chatMessages, setChatMessages] = useState<any[]>([]);

    useEffect(() => {
        if (initialMessages.length > 0) {
            setChatMessages(initialMessages);
        }
    }, [initialMessages]);

    useEffect(() => {
        if (!id) return;

        // Initialize socket
        socketRef.current = io(API_URL);
        const socket = socketRef.current;

        socket.on('connect', () => {
            console.log('Socket connected');
            socket.emit('join_room', id);
        });

        socket.on('receive_message', (data) => {
            if (data.roomId === id) {
                setChatMessages(prev => [...prev, data]);
            }
        });

        return () => {
            socket.disconnect();
        };
    }, [id]);

    const mutation = useMutation({
        mutationFn: (msg: string) => bookingsService.sendBookingMessage(id!, msg),
        onSuccess: (newMsg) => {
            setTypedMessage('');
            // Emit via socket for real-time delivery
            socketRef.current?.emit('send_message', {
                ...newMsg,
                roomId: id,
                senderType: 'User'
            });
            setChatMessages(prev => [...prev, newMsg]);
        },
        onError: () => {
            Alert.alert("Error", "Failed to send message.");
        }
    });

    const handleSend = () => {
        if (!typedMessage.trim() || mutation.isPending) return;
        mutation.mutate(typedMessage);
    };

    useEffect(() => {
        if (chatMessages.length > 0) {
            setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 300);
        }
    }, [chatMessages]);

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
                </TouchableOpacity>
                <View style={styles.headerInfo}>
                    <Text style={styles.headerTitle} numberOfLines={1}>{name || 'Service Provider'}</Text>
                    <Text style={styles.headerSub}>Booking ID: #{id?.slice(-6).toUpperCase()}</Text>
                </View>
            </View>

            {isLoading && chatMessages.length === 0 ? (
                <View style={styles.center}>
                    <ActivityIndicator color={Colors.primary} />
                </View>
            ) : (
                <ScrollView 
                    ref={scrollRef} 
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    {chatMessages.map((msg: any) => {
                        const isMe = msg.senderType === 'User';
                        return (
                            <View key={msg._id || Math.random()} style={[styles.bubble, isMe ? styles.myBubble : styles.theirBubble]}>
                                <Text style={[styles.msgText, isMe ? styles.myText : styles.theirText]}>{msg.message}</Text>
                                <Text style={[styles.timeText, isMe ? styles.myTime : styles.theirTime]}>
                                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </Text>
                            </View>
                        );
                    })}
                    {chatMessages.length === 0 && (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyText}>Send a message to start chatting with your provider.</Text>
                        </View>
                    )}
                </ScrollView>
            )}

            <KeyboardAvoidingView 
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
            >
                <View style={styles.inputArea}>
                    <TextInput
                        style={styles.input}
                        placeholder="Type a message..."
                        value={typedMessage}
                        onChangeText={setTypedMessage}
                        multiline
                    />
                    <TouchableOpacity 
                        style={[styles.sendButton, !typedMessage.trim() && { opacity: 0.5 }]} 
                        onPress={handleSend}
                    >
                        <Feather name="send" size={20} color="#FFF" />
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    header: { flexDirection: "row", alignItems: "center", padding: 16, backgroundColor: Colors.card, ...Shadows.card },
    backButton: { marginRight: 15 },
    headerInfo: { flex: 1 },
    headerTitle: { fontSize: FontSize.base, fontWeight: "700", color: Colors.textPrimary },
    headerSub: { fontSize: FontSize.xs, color: Colors.primary },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    scrollContent: { padding: 20 },
    bubble: { maxWidth: "80%", padding: 14, borderRadius: 20, marginBottom: 10 },
    myBubble: { alignSelf: "flex-end", backgroundColor: Colors.primary, borderBottomRightRadius: 4 },
    theirBubble: { alignSelf: "flex-start", backgroundColor: Colors.white, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: Colors.border },
    msgText: { fontSize: 14, lineHeight: 20 },
    myText: { color: Colors.white },
    theirText: { color: Colors.textPrimary },
    timeText: { fontSize: 10, marginTop: 4, alignSelf: "flex-end" },
    myTime: { color: "rgba(255,255,255,0.7)" },
    theirTime: { color: Colors.muted },
    inputArea: { flexDirection: "row", alignItems: "center", padding: 12, backgroundColor: Colors.card, borderTopWidth: 1, borderTopColor: Colors.border },
    input: { flex: 1, backgroundColor: Colors.background, borderRadius: 24, paddingHorizontal: 18, paddingVertical: 10, fontSize: 15, color: Colors.textPrimary, marginRight: 10, maxHeight: 100 },
    sendButton: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.primary, justifyContent: "center", alignItems: "center" },
    emptyState: { alignItems: 'center', marginTop: 40 },
    emptyText: { color: Colors.muted, fontSize: FontSize.sm, textAlign: 'center' }
});
