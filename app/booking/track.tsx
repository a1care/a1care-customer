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
import Map from '@/components/Map';
import { socketService } from '@/services/socket.service';

export default function TrackingScreen() {
    const { id, providerId, destLat, destLng } = useLocalSearchParams<{ id: string, providerId: string, destLat?: string, destLng?: string }>();
    const router = useRouter();
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
        const socket = socketService.getSocket();
        if (!socket) return;

        socket.emit('join_room', id);

        const handleLocationUpdate = (data: any) => {
            setLiveLocation(data);
        };

        socket.on('location_update', handleLocationUpdate);

        return () => {
            socket.off('location_update', handleLocationUpdate);
            socket.emit('leave_room', id);
        };
    }, [id]);

    const location = liveLocation;

    const mapUrl = location 
        ? `https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}`
        : null;

    const destLatNum = parseFloat(destLat || '');
    const destLngNum = parseFloat(destLng || '');

    // Haversine distance calculation
    const getDistanceAndEta = () => {
        if (!location?.latitude || !location?.longitude || isNaN(destLatNum) || isNaN(destLngNum)) {
            return { distanceStr: '-- km', durationStr: '-- mins' };
        }
        const toRad = (value: number) => (value * Math.PI) / 180;
        const R = 6371; // Earth radius in km
        const dLat = toRad(destLatNum - location.latitude);
        const dLon = toRad(destLngNum - location.longitude);
        const lat1 = toRad(location.latitude);
        const lat2 = toRad(destLatNum);

        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = R * c;

        // Estimate duration: assume average speed of 20 km/h in city traffic (3 mins per km)
        const durationMin = Math.max(1, Math.round(distance * 3));

        return {
            distanceStr: `${distance.toFixed(1)} km`,
            durationStr: `${durationMin} mins`,
        };
    };

    const { distanceStr, durationStr } = getDistanceAndEta();

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
                </View>
            ) : (
                <View style={{ flex: 1 }}>
                    <Map location={location} destLatNum={destLatNum} destLngNum={destLngNum} />
                    
                    <View style={styles.infoSheet}>
                        <View style={styles.dragHandle} />
                        
                        <View style={styles.sheetHeader}>
                            <View style={styles.pulseContainer}>
                                <View style={styles.pulseDot} />
                                <Text style={styles.liveText}>LIVE TRACKING</Text>
                            </View>
                            <Text style={styles.arrivingText}>Arriving in <Text style={styles.timeBold}>{durationStr}</Text></Text>
                        </View>
                        
                        <View style={styles.divider} />
                        
                        <View style={styles.providerRow}>
                            <View style={styles.markerCircle}>
                                <FontAwesome5 name="motorcycle" size={20} color="#F97316" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.cardTitle}>{provider?.name || 'Your Provider'} is on the way</Text>
                                <Text style={styles.cardSub} numberOfLines={1}>{provider?.role || 'Service Professional'}</Text>
                            </View>
                            <TouchableOpacity onPress={() => Linking.openURL(`tel:${provider?.mobile}`)} style={styles.callCircle}>
                                <Ionicons name="call" size={20} color="#059669" />
                            </TouchableOpacity>
                        </View>
                        
                        <View style={styles.statGrid}>
                            <View style={styles.statBox}>
                                <Text style={styles.statLabel}>DISTANCE REMAINING</Text>
                                <Text style={styles.statVal}>{distanceStr}</Text>
                            </View>
                            <View style={styles.statBoxRight}>
                                <Text style={styles.statLabel}>ESTIMATED TIME</Text>
                                <Text style={styles.statVal}>{durationStr}</Text>
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
    header: { flexDirection: "row", alignItems: "center", padding: 16, backgroundColor: Colors.white, ...Shadows.card, zIndex: 10 },
    backButton: { marginRight: 15 },
    headerInfo: { flex: 1 },
    headerTitle: { fontSize: FontSize.base, fontWeight: "800", color: '#0F172A' },
    headerSub: { fontSize: FontSize.xs, color: '#F97316', fontWeight: '600' },
    center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 30 },
    loadingText: { marginTop: 15, color: Colors.textSecondary, fontSize: FontSize.sm },
    infoSheet: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: Colors.white,
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        padding: 24,
        paddingTop: 12,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 20,
    },
    dragHandle: { width: 40, height: 4, backgroundColor: '#E2E8F0', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
    sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    pulseContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF2F2', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, gap: 6 },
    pulseDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#DC2626' },
    liveText: { fontSize: 10, fontWeight: '800', color: '#DC2626', letterSpacing: 0.5 },
    arrivingText: { fontSize: FontSize.sm, color: '#64748B', fontWeight: '500' },
    timeBold: { fontSize: FontSize.lg, color: '#0F172A', fontWeight: '800' },
    divider: { height: 1, backgroundColor: '#F1F5F9', marginBottom: 20 },
    providerRow: { flexDirection: 'row', alignItems: 'center', gap: 15, marginBottom: 24 },
    markerCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#FFF7ED', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#FFEDD5' },
    callCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#ECFDF5', justifyContent: 'center', alignItems: 'center' },
    cardTitle: { fontSize: FontSize.base, fontWeight: '800', color: '#0F172A', marginBottom: 4 },
    cardSub: { fontSize: 13, color: '#64748B', fontWeight: '500' },
    statGrid: { flexDirection: 'row', backgroundColor: '#F8FAFC', borderRadius: 16, padding: 16 },
    statBox: { flex: 1, borderRightWidth: 1, borderRightColor: '#E2E8F0' },
    statBoxRight: { flex: 1, alignItems: 'flex-end' },
    statLabel: { fontSize: 10, color: '#94A3B8', fontWeight: '700', letterSpacing: 0.5, marginBottom: 4 },
    statVal: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
    noLocText: { fontSize: FontSize.base, fontWeight: '700', color: Colors.textPrimary, marginTop: 20 },
});
