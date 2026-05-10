import React, { useRef, useState } from "react";
import {
    View,
    Text,
    TouchableOpacity,
    Dimensions,
    StyleSheet,
    FlatList,
    NativeScrollEvent,
    NativeSyntheticEvent,
} from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    interpolate,
    Extrapolate,
    useAnimatedScrollHandler,
} from "react-native-reanimated";

import { Colors } from "@/constants/colors";

const { width, height } = Dimensions.get("window");


const slides = [
    {
        id: "1",
        image: require("../assets/images/onboarding1.png"),
        title: "Expert Doctors\nAt Your Home",
        subtitle: "Skip the waiting room. Get professional consultations in the comfort of your living room.",
    },
    {
        id: "2",
        image: require("../assets/images/onboarding2.png"),
        title: "Professional\nNursing Care",
        subtitle: "Dedicated nursing and post-operative care by certified professionals at your doorstep.",
    },
    {
        id: "3",
        image: require("../assets/images/onboarding3.png"),
        title: "Fast & Accurate\nLab Diagnostics",
        subtitle: "Book blood tests and health checkups with quick home sample collection and digital reports.",
    },
];

const Slide = ({ item, index, scrollX }: { item: typeof slides[0], index: number, scrollX: Animated.SharedValue<number> }) => {
    const animatedStyle = useAnimatedStyle(() => {
        const opacity = interpolate(
            scrollX.value,
            [(index - 1) * width, index * width, (index + 1) * width],
            [0, 1, 0],
            Extrapolate.CLAMP
        );
        const translateY = interpolate(
            scrollX.value,
            [(index - 1) * width, index * width, (index + 1) * width],
            [100, 0, 100],
            Extrapolate.CLAMP
        );

        return {
            opacity,
            transform: [{ translateY }],
        };
    });

    const imageStyle = useAnimatedStyle(() => {
        const scale = interpolate(
            scrollX.value,
            [(index - 1) * width, index * width, (index + 1) * width],
            [0.8, 1, 0.8],
            Extrapolate.CLAMP
        );
        return {
            transform: [{ scale }],
        };
    });

    return (
        <View style={styles.slideContainer}>
            <Animated.View style={[styles.imageContainer, imageStyle]}>
                <Image source={item.image} style={styles.image} contentFit="contain" />
            </Animated.View>
            <Animated.View style={[styles.textContainer, animatedStyle]}>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.subtitle}>{item.subtitle}</Text>
            </Animated.View>
        </View>
    );
};

const Pagination = ({ scrollX }: { scrollX: Animated.SharedValue<number> }) => {
    return (
        <View style={styles.paginationContainer}>
            {slides.map((_, index) => {
                const animatedDotStyle = useAnimatedStyle(() => {
                    const widthDot = interpolate(
                        scrollX.value,
                        [(index - 1) * width, index * width, (index + 1) * width],
                        [10, 24, 10],
                        Extrapolate.CLAMP
                    );
                    const opacity = interpolate(
                        scrollX.value,
                        [(index - 1) * width, index * width, (index + 1) * width],
                        [0.4, 1, 0.4],
                        Extrapolate.CLAMP
                    );
                    return {
                        width: widthDot,
                        opacity,
                    };
                });

                return <Animated.View key={index} style={[styles.dot, animatedDotStyle]} />;
            })}
        </View>
    );
};

export default function OnboardingScreen() {
    const router = useRouter();
    const flatListRef = useRef<FlatList>(null);
    const scrollX = useSharedValue(0);
    const [currentIndex, setCurrentIndex] = useState(0);

    const onScroll = useAnimatedScrollHandler((event) => {
        scrollX.value = event.contentOffset.x;
    });

    const handleNext = () => {
        if (currentIndex < slides.length - 1) {
            flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
        } else {
            router.replace("/(auth)/login");
        }
    };

    const handleSkip = () => {
        router.replace("/(auth)/login");
    };

    return (
        <View style={styles.container}>
            <StatusBar style="dark" />
            
            {currentIndex < slides.length - 1 && (
                <TouchableOpacity onPress={handleSkip} style={styles.skipContainer}>
                    <Text style={styles.skipText}>Skip</Text>
                </TouchableOpacity>
            )}

            <Animated.FlatList
                ref={flatListRef as any}
                data={slides}
                renderItem={({ item, index }) => (
                    <Slide item={item} index={index} scrollX={scrollX} />
                )}
                keyExtractor={(item) => item.id}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={onScroll}
                scrollEventThrottle={16}
                onMomentumScrollEnd={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
                    setCurrentIndex(Math.round(e.nativeEvent.contentOffset.x / width));
                }}
            />

            <View style={styles.footer}>
                <Pagination scrollX={scrollX} />
                
                <TouchableOpacity 
                    onPress={handleNext} 
                    style={styles.nextButton}
                    activeOpacity={0.8}
                >
                    <Text style={styles.nextButtonText}>
                        {currentIndex === slides.length - 1 ? "Get Started" : "Next"}
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    skipContainer: {
        position: "absolute",
        top: 60,
        right: 24,
        zIndex: 10,
    },
    skipText: {
        fontSize: 16,
        fontWeight: "600",
        color: Colors.muted,
    },
    slideContainer: {
        width,
        alignItems: "center",
        paddingTop: height * 0.1,
    },
    imageContainer: {
        width: width * 0.85,
        height: height * 0.45,
        justifyContent: "center",
        alignItems: "center",
    },
    image: {
        width: "100%",
        height: "100%",
    },
    textContainer: {
        paddingHorizontal: 40,
        alignItems: "center",
        marginTop: 40,
    },
    title: {
        fontSize: 32,
        fontWeight: "800",
        color: Colors.textPrimary,
        textAlign: "center",
        lineHeight: 40,
    },
    subtitle: {
        fontSize: 16,
        color: Colors.textSecondary,
        textAlign: "center",
        marginTop: 16,
        lineHeight: 24,
    },
    footer: {
        position: "absolute",
        bottom: 50,
        left: 0,
        right: 0,
        paddingHorizontal: 24,
        alignItems: "center",
    },
    paginationContainer: {
        flexDirection: "row",
        height: 64,
        justifyContent: "center",
        alignItems: "center",
    },
    dot: {
        height: 10,
        borderRadius: 5,
        backgroundColor: Colors.accent,
        marginHorizontal: 4,
    },
    nextButton: {
        width: "100%",
        height: 56,
        backgroundColor: Colors.primary,
        borderRadius: 16,
        justifyContent: "center",
        alignItems: "center",
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 5,
    },
    nextButtonText: {
        fontSize: 18,
        fontWeight: "700",
        color: Colors.white,
    },
});
