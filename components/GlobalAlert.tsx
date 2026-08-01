import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Dimensions } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useAlertStore, AlertAction } from '../stores/alert.store';

const { width } = Dimensions.get('window');

export default function GlobalAlert() {
    const { isOpen, title, message, type, actions, cancelable, hide } = useAlertStore();

    if (!isOpen) return null;

    const getIcon = () => {
        switch (type) {
            case 'success': return <Ionicons name="checkmark-circle" size={48} color="#10B981" />;
            case 'error': return <Ionicons name="close-circle" size={48} color="#EF4444" />;
            case 'warning': return <Ionicons name="warning" size={48} color="#F59E0B" />;
            case 'info':
            default: return <Ionicons name="information-circle" size={48} color="#3B82F6" />;
        }
    };

    const handleActionPress = (action: AlertAction) => {
        if (action.onPress) {
            action.onPress();
        }
        hide();
    };

    return (
        <Modal
            visible={isOpen}
            transparent={true}
            animationType="none"
            onRequestClose={() => {
                if (cancelable) hide();
            }}
        >
            <Animated.View 
                entering={FadeIn.duration(200)} 
                exiting={FadeOut.duration(200)} 
                style={styles.overlay}
            >
                {/* Blur background for premium feel */}
                <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill}>
                    <TouchableOpacity 
                        style={StyleSheet.absoluteFill} 
                        activeOpacity={1} 
                        onPress={() => cancelable && hide()} 
                    />
                </BlurView>

                <Animated.View 
                    entering={SlideInDown.springify().damping(20).stiffness(200)} 
                    exiting={SlideOutDown.duration(200)}
                    style={styles.alertBox}
                >
                    <View style={styles.iconContainer}>
                        {getIcon()}
                    </View>
                    
                    <Text style={styles.title}>{title}</Text>
                    {message ? <Text style={styles.message}>{message}</Text> : null}

                    <View style={styles.buttonContainer}>
                        {actions.map((action, index) => {
                            const isPrimary = action.style !== 'cancel' && action.style !== 'destructive' && index === actions.length - 1;
                            const isDestructive = action.style === 'destructive';
                            
                            return (
                                <TouchableOpacity 
                                    key={index} 
                                    style={[
                                        styles.button, 
                                        isPrimary ? styles.primaryButton : styles.secondaryButton,
                                        isDestructive && !isPrimary && styles.destructiveButtonOutline,
                                        isDestructive && isPrimary && styles.destructiveButton
                                    ]} 
                                    onPress={() => handleActionPress(action)}
                                >
                                    <Text style={[
                                        styles.buttonText,
                                        isPrimary ? styles.primaryButtonText : styles.secondaryButtonText,
                                        isDestructive && !isPrimary && styles.destructiveButtonTextOutline,
                                        isDestructive && isPrimary && styles.primaryButtonText
                                    ]}>
                                        {action.text}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </Animated.View>
            </Animated.View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(15, 23, 42, 0.4)', // dark slate transparent overlay fallback
    },
    alertBox: {
        width: width * 0.85,
        backgroundColor: '#FFFFFF',
        borderRadius: 28,
        padding: 24,
        alignItems: 'center',
        elevation: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
    },
    iconContainer: {
        marginBottom: 16,
    },
    title: {
        fontSize: 20,
        fontWeight: '800',
        color: '#1E293B',
        textAlign: 'center',
        marginBottom: 8,
    },
    message: {
        fontSize: 15,
        color: '#64748B',
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 24,
        fontWeight: '500'
    },
    buttonContainer: {
        flexDirection: 'row',
        width: '100%',
        gap: 12,
        justifyContent: 'center'
    },
    button: {
        flex: 1,
        height: 52,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    primaryButton: {
        backgroundColor: '#2D935C',
        elevation: 2,
        shadowColor: '#2D935C',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
    },
    secondaryButton: {
        backgroundColor: '#F1F5F9',
    },
    destructiveButton: {
        backgroundColor: '#EF4444',
        shadowColor: '#EF4444',
    },
    destructiveButtonOutline: {
        backgroundColor: '#FEF2F2',
        borderWidth: 1,
        borderColor: '#FCA5A5'
    },
    buttonText: {
        fontSize: 16,
        fontWeight: '700',
    },
    primaryButtonText: {
        color: '#FFFFFF',
    },
    secondaryButtonText: {
        color: '#475569',
    },
    destructiveButtonTextOutline: {
        color: '#EF4444'
    }
});
