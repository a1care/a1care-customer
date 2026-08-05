import React from 'react';
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

interface ConfirmModalProps {
    /** Control visibility */
    visible: boolean;
    /** Modal title */
    title: string;
    /** Descriptive body text */
    body: string;
    /** Label on the confirm button */
    confirmLabel?: string;
    /** Label on the cancel button */
    cancelLabel?: string;
    /** Ionicons icon name shown in the icon circle */
    icon?: IoniconsName;
    /** Color of the icon and confirm button */
    confirmColor?: string;
    /** Background color of the icon circle */
    iconBg?: string;
    /** Show a spinner instead of confirm label while processing */
    loading?: boolean;
    /** Called when the confirm button is pressed */
    onConfirm: () => void;
    /** Called when the cancel button or overlay is pressed */
    onCancel: () => void;
}

/**
 * Global premium confirmation modal — use this everywhere instead of
 * Alert.alert / window.confirm for a consistent MNC-level UX.
 *
 * Usage:
 *   <ConfirmModal
 *     visible={showLogout}
 *     title="Sign Out?"
 *     body="You will be signed out of your account."
 *     confirmLabel="Yes, Sign Out"
 *     icon="log-out-outline"
 *     confirmColor="#EF4444"
 *     onConfirm={performLogout}
 *     onCancel={() => setShowLogout(false)}
 *   />
 */
export default function ConfirmModal({
    visible,
    title,
    body,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    icon = 'alert-circle-outline',
    confirmColor = '#EF4444',
    iconBg,
    loading = false,
    onConfirm,
    onCancel,
}: ConfirmModalProps) {
    const resolvedIconBg = iconBg ?? `${confirmColor}20`;

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            statusBarTranslucent
            onRequestClose={onCancel}
        >
            <TouchableOpacity
                style={styles.overlay}
                activeOpacity={1}
                onPress={onCancel}
            >
                {/* Prevent tap-through on the sheet */}
                <TouchableOpacity activeOpacity={1} style={styles.sheet}>

                    {/* Icon circle */}
                    <View style={[styles.iconCircle, { backgroundColor: resolvedIconBg }]}>
                        <Ionicons name={icon} size={34} color={confirmColor} />
                    </View>

                    {/* Text */}
                    <Text style={styles.title}>{title}</Text>
                    <Text style={styles.body}>{body}</Text>

                    {/* Confirm button */}
                    <TouchableOpacity
                        style={[styles.confirmBtn, { backgroundColor: confirmColor, shadowColor: confirmColor }]}
                        onPress={onConfirm}
                        activeOpacity={0.88}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.confirmText}>{confirmLabel}</Text>
                        )}
                    </TouchableOpacity>

                    {/* Cancel button */}
                    <TouchableOpacity
                        style={styles.cancelBtn}
                        onPress={onCancel}
                        activeOpacity={0.85}
                        disabled={loading}
                    >
                        <Text style={styles.cancelText}>{cancelLabel}</Text>
                    </TouchableOpacity>

                </TouchableOpacity>
            </TouchableOpacity>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(10, 20, 50, 0.62)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 28,
    },
    sheet: {
        backgroundColor: '#FFFFFF',
        borderRadius: 32,
        padding: 28,
        width: '100%',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 20 },
        shadowOpacity: 0.14,
        shadowRadius: 40,
        elevation: 20,
    },
    iconCircle: {
        width: 76,
        height: 76,
        borderRadius: 38,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    title: {
        fontSize: 22,
        fontWeight: '900',
        color: '#0F172A',
        marginBottom: 10,
        letterSpacing: -0.3,
        textAlign: 'center',
    },
    body: {
        fontSize: 14,
        color: '#64748B',
        textAlign: 'center',
        lineHeight: 22,
        fontWeight: '500',
        marginBottom: 28,
    },
    confirmBtn: {
        borderRadius: 28,
        paddingVertical: 16,
        width: '100%',
        alignItems: 'center',
        marginBottom: 12,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.28,
        shadowRadius: 14,
        elevation: 6,
    },
    confirmText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '900',
        letterSpacing: 0.3,
    },
    cancelBtn: {
        paddingVertical: 14,
        width: '100%',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        borderRadius: 22,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    cancelText: {
        color: '#64748B',
        fontSize: 15,
        fontWeight: '800',
    },
});
