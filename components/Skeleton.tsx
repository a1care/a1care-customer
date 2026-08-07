import React, { useEffect, useRef } from 'react';
import { Animated, ViewStyle, StyleProp } from 'react-native';

interface SkeletonProps {
    style?: StyleProp<ViewStyle>;
}

export function Skeleton({ style }: SkeletonProps) {
    const opacity = useRef(new Animated.Value(0.3)).current;

    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(opacity, {
                    toValue: 0.7,
                    duration: 800,
                    useNativeDriver: false,
                }),
                Animated.timing(opacity, {
                    toValue: 0.3,
                    duration: 800,
                    useNativeDriver: false,
                })
            ])
        ).start();
    }, [opacity]);

    return (
        <Animated.View style={[{ backgroundColor: '#E2E8F0', borderRadius: 8, opacity }, style]} />
    );
}
