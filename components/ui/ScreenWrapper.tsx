import React from 'react';
import { View, Text, ScrollView, RefreshControl, StyleSheet, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Shadows } from '@/constants/colors';
import { FontSize } from '@/constants/spacing';

interface ScreenWrapperProps {
    children: React.ReactNode;
    onRefresh?: () => Promise<void>;
    scroll?: boolean;
    style?: ViewStyle;
    contentStyle?: ViewStyle;
    padTop?: boolean;
}

export function ScreenWrapper({
    children,
    onRefresh,
    scroll = true,
    style,
    contentStyle,
    padTop = false,
}: ScreenWrapperProps) {
    const [refreshing, setRefreshing] = React.useState(false);

    const handleRefresh = async () => {
        if (!onRefresh) return;
        setRefreshing(true);
        await onRefresh();
        setRefreshing(false);
    };

    if (!scroll) {
        return (
            <SafeAreaView style={[styles.root, style]} edges={['top']}>
                <View style={[styles.contentBase, padTop ? styles.padTop : {}, contentStyle]}>
                    {children}
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.root, style]} edges={['top']}>
            <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                refreshControl={
                    onRefresh ? (
                        <RefreshControl
                            refreshing={!!refreshing}
                            onRefresh={handleRefresh}
                            colors={[Colors.primary]}
                        />
                    ) : undefined
                }
                contentContainerStyle={[styles.scrollContent, padTop ? styles.padTop : {}, contentStyle]}
            >
                {children}
            </ScrollView>
        </SafeAreaView>
    );
}

interface ScreenHeaderProps {
    title: string;
    subtitle?: string;
    right?: React.ReactNode;
}

export function ScreenHeader({ title, subtitle, right }: ScreenHeaderProps) {
    return (
        <View style={styles.header}>
            <View style={{ flex: 1 }}>
                <Text style={styles.headerTitle}>{title}</Text>
                {subtitle && <Text style={styles.headerSubtitle}>{subtitle}</Text>}
            </View>
            {right && <View>{right}</View>}
        </View>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: Colors.background },
    contentBase: { flex: 1 },
    padTop: { paddingTop: 8 },
    scrollContent: { paddingBottom: 100 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 14,
        backgroundColor: Colors.card,
        ...Shadows.card,
    },
    headerTitle: { fontSize: FontSize['2xl'], fontWeight: '700', color: Colors.textPrimary },
    headerSubtitle: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
});
