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
import { ticketsService } from '@/services/tickets.service';
import { Colors, Shadows } from '@/constants/colors';
import { FontSize } from '@/constants/spacing';
import { Send, Image as ImageIcon, MessageCircle } from 'lucide-react-native';

export default function SupportChatScreen() {
    const { ticketId, subject } = useLocalSearchParams<{ ticketId: string, subject: string }>();
    const router = useRouter();
    const qc = useQueryClient();
    const scrollRef = useRef<ScrollView>(null);
    const [typedMessage, setTypedMessage] = useState('');

    const { data: messages, isLoading, isError, refetch } = useQuery({
        queryKey: ['chat', ticketId],
        queryFn: () => ticketsService.getMessages(ticketId!),
        refetchInterval: 5000, // Poll every 5 seconds for simulation of real-time
        enabled: !!ticketId,
    });

    const mutation = useMutation({
        mutationFn: (msg: string) => ticketsService.sendChatMessage(ticketId!, msg),
        onSuccess: () => {
            setTypedMessage('');
            qc.invalidateQueries({ queryKey: ['chat', ticketId] });
            setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
        },
        onError: () => {
            Alert.alert("Error", "Failed to send message. Please try again.");
        }
    });

    const handleSend = () => {
        if (!typedMessage.trim()) return;
        mutation.mutate(typedMessage);
    };

    useEffect(() => {
        if (messages && messages.length > 0) {
            setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 300);
        }
    }, [messages]);

    return (
        <SafeAreaView style={styles.root} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Text style={styles.backText}>←</Text>
                </TouchableOpacity>
                <View style={styles.headerInfo}>
                    <Text style={styles.headerTitle} numberOfLines={1}>{subject || 'Support Chat'}</Text>
                    <Text style={styles.headerStatus}>Typically replies in 5 mins</Text>
                </View>
                <View style={{ width: 44 }} />
            </View>

            {isLoading && !messages ? (
                <View style={styles.center}>
                    <ActivityIndicator color={Colors.primary} />
                </View>
            ) : isError ? (
                <View style={styles.center}>
                    <Text style={styles.errorText}>Could not load messages</Text>
                    <TouchableOpacity onPress={() => refetch()} style={styles.retryBtn}>
                        <Text style={styles.retryText}>Retry</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <ScrollView 
                    ref={scrollRef}
                    contentContainerStyle={styles.messageList}
                    showsVerticalScrollIndicator={false}
                >
                    {messages && messages.length === 0 && (
                        <View style={styles.emptyContainer}>
                            <View style={styles.welcomeIcon}>
                                <MessageCircle size={32} color={Colors.primary} />
                            </View>
                            <Text style={styles.welcomeTitle}>Support Thread Started</Text>
                            <Text style={styles.welcomeSub}>Our agents are looking into your ticket. How can we help you today?</Text>
                        </View>
                    )}

                    {messages?.map((msg: any) => {
                        const isMe = msg.senderType === 'User';
                        return (
                            <View key={msg._id} style={[styles.messageBubble, isMe ? styles.myBubble : styles.theirBubble]}>
                                <Text style={[styles.messageText, isMe ? styles.myText : styles.theirText]}>
                                    {msg.message}
                                </Text>
                                <Text style={[styles.messageTime, isMe ? styles.myTime : styles.theirTime]}>
                                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </Text>
                            </View>
                        );
                    })}
                </ScrollView>
            )}

            <KeyboardAvoidingView 
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
            >
                <View style={styles.inputArea}>
                    <TouchableOpacity style={styles.plusBtn}>
                        <ImageIcon size={22} color={Colors.muted} />
                    </TouchableOpacity>
                    <TextInput
                        style={styles.input}
                        placeholder="Type a message..."
                        placeholderTextColor={Colors.muted}
                        value={typedMessage}
                        onChangeText={setTypedMessage}
                        multiline
                    />
                    <TouchableOpacity 
                        style={[styles.sendBtn, !typedMessage.trim() && styles.sendBtnDisabled]} 
                        onPress={handleSend}
                    >
                        <Send size={20} color="#fff" />
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#F8FAFC' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#fff',
        ...Shadows.card,
        zIndex: 10,
    },
    backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', borderRadius: 20, backgroundColor: '#F1F5F9' },
    backText: { fontSize: 24, color: Colors.textPrimary },
    headerInfo: { flex: 1, marginLeft: 12 },
    headerTitle: { fontSize: 16, fontWeight: '800', color: Colors.textPrimary },
    headerStatus: { fontSize: 11, color: Colors.health, fontWeight: '600', marginTop: 1 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    messageList: { padding: 16, paddingTop: 20 },
    messageBubble: {
        maxWidth: '80%',
        padding: 12,
        borderRadius: 18,
        marginBottom: 12,
        ...Shadows.card,
    },
    myBubble: { alignSelf: 'flex-end', backgroundColor: Colors.primary, borderBottomRightRadius: 4 },
    theirBubble: { alignSelf: 'flex-start', backgroundColor: '#fff', borderBottomLeftRadius: 4 },
    messageText: { fontSize: 14, lineHeight: 20 },
    myText: { color: '#fff' },
    theirText: { color: Colors.textPrimary },
    messageTime: { fontSize: 9, marginTop: 4, alignSelf: 'flex-end' },
    myTime: { color: 'rgba(255,255,255,0.7)' },
    theirTime: { color: Colors.muted },
    inputArea: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        paddingBottom: Platform.OS === 'ios' ? 24 : 12,
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
    },
    plusBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
    input: {
        flex: 1,
        backgroundColor: '#F1F5F9',
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 8,
        marginHorizontal: 8,
        fontSize: 14,
        maxHeight: 100,
    },
    sendBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: Colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    sendBtnDisabled: { opacity: 0.5 },
    emptyContainer: { alignItems: 'center', marginTop: 100, paddingHorizontal: 40 },
    welcomeIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.primaryLight, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
    welcomeTitle: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary, marginBottom: 8 },
    welcomeSub: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
    errorText: { color: Colors.emergency, marginBottom: 12 },
    retryBtn: { padding: 10, backgroundColor: Colors.primary, borderRadius: 8 },
    retryText: { color: '#fff', fontWeight: '600' },
});
