import React, { useEffect, useRef } from 'react';
import {
    TouchableOpacity,
    StyleSheet,
    Animated,
    Platform,
    Linking,
    View
} from 'react-native';
import { Ambulance } from 'lucide-react-native';
import { Colors, Shadows } from '@/constants/colors';
import { LinearGradient } from 'expo-linear-gradient';

interface EmergencyButtonProps {
    bottom?: number;
}

export function EmergencyFAB({ bottom = 100 }: EmergencyButtonProps) {
    const pulseAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1.15,
                    duration: 1500,
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 1500,
                    useNativeDriver: true,
                }),
            ])
        ).start();
    }, []);

    const handlePress = () => {
        Linking.openURL('tel:108'); // Direct Emergency line
    };

    return (
        <View style={[styles.container, { bottom }]}>
            <Animated.View style={[styles.pulseCircle, {
                transform: [{ scale: pulseAnim }], opacity: pulseAnim.interpolate({
                    inputRange: [1, 1.15],
                    outputRange: [0.6, 0]
                })
            }]} />
            <TouchableOpacity
                onPress={handlePress}
                activeOpacity={0.9}
                style={styles.touchable}
            >
                <LinearGradient
                    colors={['#FF4D4D', '#D32F2F']}
                    style={styles.fab}
                >
                    <Ambulance size={28} color="#fff" strokeWidth={2.5} />
                </LinearGradient>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        right: 20,
        zIndex: 9999,
        width: 64,
        height: 64,
        justifyContent: 'center',
        alignItems: 'center',
    },
    pulseCircle: {
        position: 'absolute',
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#FF4D4D',
    },
    touchable: {
        width: 60,
        height: 60,
        borderRadius: 30,
        ...Shadows.float,
    },
    fab: {
        width: 60,
        height: 60,
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.3)',
    },
});
