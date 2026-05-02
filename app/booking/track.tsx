import React, { useRef, useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { bookingsService } from '@/services/bookings.service';
import { Colors, Shadows } from '@/constants/colors';
import { FontSize } from '@/constants/spacing';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { io, Socket } from 'socket.io-client';

const API_URL = process.env.EXPO_PUBLIC_API_URL?.replace('/api', '') || 'https://api.a1carehospital.in';

export default function TrackingScreen() {
    const { id, providerId } = useLocalSearchParams<{ id: string, providerId: string }>();
    const router = useRouter();
    const socketRef = useRef<Socket | null>(null);
    const [liveLocation, setLiveLocation] = useState<any>(null);

    const { data: initialLocation, isLoading, refetch } = useQuery({
        queryKey: ['tracking', providerId],
        queryFn: () => bookingsService.getProviderLocation(providerId!),
        enabled: !!providerId,
    });

    useEffect(() => {
        if (initialLocation) setLiveLocation(initialLocation);
    }, [initialLocation]);

    useEffect(() => {
        if (!id) return;
        socketRef.current = io(API_URL);
        const socket = socketRef.current;

        socket.on('connect', () => {
            socket.emit('join_room', id);
        });

        socket.on('location_update', (data) => {
            setLiveLocation(data);
        });

        return () => {
            socket.disconnect();
        };
    }, [id]);

    const location = liveLocation;

    const mapUrl = location 
        ? `https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}`
        : null;

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
                </TouchableOpacity>
                <View style={styles.headerInfo}>
                    <Text style={styles.headerTitle}>Live Tracking</Text>
                    <Text style={styles.headerSub}>Booking ID: #{id?.slice(-6).toUpperCase()}</Text>
                </View>
                <TouchableOpacity onPress={() => refetch()} style={styles.refreshBtn}>
                    <Ionicons name="refresh" size={20} color={Colors.primary} />
                </TouchableOpacity>
            </View>

            {isLoading && !location ? (
                <View style={styles.center}>
                    <ActivityIndicator color={Colors.primary} />
                    <Text style={styles.loadingText}>Fetching live location...</Text>
                </View>
            ) : !location ? (
                <View style={styles.center}>
                    <Ionicons name="navigate-outline" size={60} color={Colors.muted} />
                    <Text style={styles.noLocText}>Provider location not available yet.</Text>
                    <Text style={styles.noLocSub}>They will appear here once they start the journey.</Text>
                </View>
            ) : (
                <View style={{ flex: 1 }}>
                    <WebView 
                        source={{ uri: `https://www.google.com/maps/embed/v1/view?key=${process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY}&center=${location.latitude},${location.longitude}&zoom=17` }}
                        style={{ flex: 1 }}
                    />
                    
                    <View style={styles.infoCard}>
                        <View style={styles.providerRow}>
                            <View style={styles.markerCircle}>
                                <FontAwesome5 name="motorcycle" size={20} color={Colors.primary} />
                            </View>
                            <View>
                                <Text style={styles.cardTitle}>Provider is on the way</Text>
                                <Text style={styles.cardSub}>Updating live every 10 seconds</Text>
                            </View>
                        </View>
                        
                        <View style={styles.statGrid}>
                            <View style={styles.statBox}>
                                <Text style={styles.statLabel}>LATITUDE</Text>
                                <Text style={styles.statVal}>{location.latitude.toFixed(5)}</Text>
                            </View>
                            <View style={styles.statBox}>
                                <Text style={styles.statLabel}>LONGITUDE</Text>
                                <Text style={styles.statVal}>{location.longitude.toFixed(5)}</Text>
                            </View>
                        </View>
                    </View>
                </View>
            )}
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
    refreshBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primaryLight, justifyContent: 'center', alignItems: 'center' },
    center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 30 },
    loadingText: { marginTop: 15, color: Colors.textSecondary, fontSize: FontSize.sm },
    noLocText: { fontSize: FontSize.base, fontWeight: '700', color: Colors.textPrimary, marginTop: 20 },
    noLocSub: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', marginTop: 8 },
    infoCard: {
        position: 'absolute',
        bottom: 30,
        left: 20,
        right: 20,
        backgroundColor: Colors.white,
        borderRadius: 24,
        padding: 20,
        ...Shadows.card,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    providerRow: { flexDirection: 'row', alignItems: 'center', gap: 15, marginBottom: 20 },
    markerCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primaryLight, justifyContent: 'center', alignItems: 'center' },
    cardTitle: { fontSize: FontSize.base, fontWeight: '700', color: Colors.textPrimary },
    cardSub: { fontSize: 12, color: Colors.health, fontWeight: '600' },
    statGrid: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 15 },
    statBox: { flex: 1, alignItems: 'center' },
    statLabel: { fontSize: 9, color: Colors.muted, fontWeight: '800', marginBottom: 4 },
    statVal: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
});
