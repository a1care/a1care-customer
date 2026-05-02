import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Colors } from "../../constants/colors";

export default function EasebuzzCheckout() {
    const router = useRouter();

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                <Text style={styles.icon}>⚠️</Text>
                <Text style={styles.title}>Online Payment Disabled</Text>
                <Text style={styles.message}>
                    Online payments are currently unavailable. Please use Cash on Delivery (COD) for your bookings.
                </Text>
                <TouchableOpacity 
                    style={styles.button}
                    onPress={() => router.back()}
                >
                    <Text style={styles.buttonText}>Go Back</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#fff" },
    content: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: 32,
        gap: 16,
    },
    icon: { fontSize: 64 },
    title: {
        fontSize: 22,
        fontWeight: "700",
        color: Colors.textPrimary,
        textAlign: "center",
    },
    message: {
        fontSize: 16,
        color: Colors.textSecondary,
        textAlign: "center",
        lineHeight: 24,
        marginBottom: 20,
    },
    button: {
        backgroundColor: Colors.primary,
        paddingHorizontal: 40,
        paddingVertical: 14,
        borderRadius: 12,
    },
    buttonText: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "600",
    },
});
