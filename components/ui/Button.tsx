import React from 'react';
import {
    TouchableOpacity,
    Text,
    ActivityIndicator,
    StyleSheet,
    View,
    ViewStyle,
    TextStyle,
} from 'react-native';
import { Colors, Shadows } from '@/constants/colors';
import { FontSize } from '@/constants/spacing';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
    label: string;
    onPress: () => void;
    variant?: ButtonVariant;
    size?: ButtonSize;
    loading?: boolean;
    disabled?: boolean;
    fullWidth?: boolean;
    style?: ViewStyle;
    textStyle?: TextStyle;
    icon?: string | React.ReactNode; 
}

export function Button({
    label,
    onPress,
    variant = 'primary',
    size = 'md',
    loading = false,
    disabled = false,
    fullWidth = false,
    style,
    textStyle,
    icon,
}: ButtonProps) {
    const isDisabled = !!disabled || !!loading;

    return (
        <TouchableOpacity
            style={[
                styles.base,
                styles[`variant_${variant}`],
                styles[`size_${size}`],
                fullWidth ? styles.fullWidth : {},
                isDisabled ? styles.disabled : {},
                style,
            ]}
            onPress={onPress}
            disabled={!!isDisabled}
            activeOpacity={0.82}
        >
            {loading ? (
                <ActivityIndicator
                    color={variant === 'primary' || variant === 'danger' ? '#fff' : Colors.primary}
                    size="small"
                />
            ) : (
                <>
                    {typeof icon === 'string' ? (
                        <Text style={[styles.text, styles[`text_${variant}`], styles[`textSize_${size}`], textStyle]}>
                            {icon ? `${icon}  ` : ''}{label}
                        </Text>
                    ) : (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            {icon}
                            <Text style={[styles.text, styles[`text_${variant}`], styles[`textSize_${size}`], textStyle]}>
                                {label}
                            </Text>
                        </View>
                    )}
                </>
            )}
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    base: {
        borderRadius: 16, // Rounded corners (16-24px)
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
    },
    fullWidth: { width: '100%' },
    disabled: { opacity: 0.55 },

    // Variants
    variant_primary: {
        backgroundColor: Colors.primary,
        ...Shadows.card, // Minimal shadows as requested
    },
    variant_secondary: {
        backgroundColor: Colors.primaryLight
    },
    variant_danger: {
        backgroundColor: Colors.emergency
    },
    variant_ghost: { backgroundColor: 'transparent' },
    variant_outline: {
        backgroundColor: 'transparent',
        borderWidth: 1.5,
        borderColor: Colors.primary,
    },

    // Sizes
    size_sm: { paddingVertical: 8, paddingHorizontal: 12 },
    size_md: { paddingVertical: 12, paddingHorizontal: 18 },
    size_lg: { paddingVertical: 14, paddingHorizontal: 22 },

    // Text
    text: { fontWeight: '700' },
    text_primary: { color: '#fff' },
    text_secondary: { color: Colors.primary },
    text_danger: { color: '#fff' },
    text_ghost: { color: Colors.primary },
    text_outline: { color: Colors.primary },

    textSize_sm: { fontSize: FontSize.xs },
    textSize_md: { fontSize: FontSize.sm },
    textSize_lg: { fontSize: FontSize.base },
});
