import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    ScrollView,
    TouchableOpacity,
    StyleSheet,
    Alert,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ticketsService } from '@/services/tickets.service';
import { Colors, Shadows } from '@/constants/colors';
import { FontSize } from '@/constants/spacing';
import { Button } from '@/components/ui/Button';

const CATEGORIES = [
    'Booking Issue',
    'Payment/Refund',
    'Service Quality',
    'Technical Problem',
    'Other',
];

export default function CreateTicketScreen() {
    const router = useRouter();
    const qc = useQueryClient();

    const [category, setCategory] = useState(CATEGORIES[0]);
    const [description, setDescription] = useState('');

    const createMutation = useMutation({
        mutationFn: () => ticketsService.createTicket({
            subject: category,
            description,
            priority: 'Medium', // default priority
        }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['tickets'] });
            router.replace('/support');
            Toast.show({
                type: 'success',
                text1: 'Ticket Created',
                text2: 'Your support ticket has been created and logged.',
                position: 'top',
            });
        },
        onError: (err: any) => {
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: err?.response?.data?.message ?? 'Could not create ticket. Please try again.',
                position: 'top'
            });
        },
    });

    const handleSubmit = () => {
        if (!description.trim()) {
            Toast.show({
                type: 'error',
                text1: 'Missing Description',
                text2: 'Please describe your issue.',
                position: 'top'
            });
            return;
        }
        createMutation.mutate();
    };

    return (
        <SafeAreaView style={styles.root} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Text style={styles.backText}>←</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>New Ticket</Text>
                <View style={{ width: 44 }} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
                <View style={styles.infoBox}>
                    <Text style={styles.infoIcon}>📝</Text>
                    <Text style={styles.infoText}>Describe your problem clearly. Our support team typically responds within 2-4 hours.</Text>
                </View>

                {/* Category Selection */}
                <Text style={styles.label}>Select Category <Text style={{ color: '#E74C3C' }}>*</Text></Text>
                <View style={styles.catGrid}>
                    {CATEGORIES.map(c => (
                        <TouchableOpacity
                            key={c}
                            style={[styles.catPill, category === c ? styles.catPillActive : {}]}
                            onPress={() => setCategory(c)}
                        >
                            <Text style={[styles.catText, category === c ? styles.catTextActive : {}]}>
                                {c}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Description */}
                <Text style={[styles.label, { marginTop: 24 }]}>Description <Text style={{ color: '#E74C3C' }}>*</Text></Text>
                <TextInput
                    style={styles.input}
                    placeholder="Provide details about your issue, booking ID, or professional's name..."
                    placeholderTextColor={Colors.muted}
                    multiline
                    numberOfLines={6}
                    value={description}
                    onChangeText={setDescription}
                    textAlignVertical="top"
                />

                <Button
                    label="Submit Ticket"
                    onPress={handleSubmit}
                    loading={createMutation.isPending}
                    variant="primary"
                    size="lg"
                    style={{ marginTop: 32 }}
                    fullWidth
                />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: Colors.background },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 14,
        backgroundColor: Colors.card,
        ...Shadows.card,
    },
    backBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: Colors.background,
        justifyContent: 'center',
        alignItems: 'center',
    },
    backText: { fontSize: 24, color: Colors.textPrimary },
    headerTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary },

    scroll: { padding: 16 },

    infoBox: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: '#F0F9FF',
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#BAE6FD',
        marginBottom: 24,
        gap: 12,
    },
    infoIcon: { fontSize: 24 },
    infoText: { flex: 1, fontSize: FontSize.sm, color: '#0369A1', lineHeight: 20 },

    label: { fontSize: FontSize.base, fontWeight: '700', color: Colors.textPrimary, marginBottom: 12 },

    catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    catPill: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
        backgroundColor: Colors.card,
        borderWidth: 1.5,
        borderColor: Colors.border,
        ...Shadows.card,
    },
    catPillActive: {
        backgroundColor: Colors.primaryLight,
        borderColor: Colors.primary,
    },
    catText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary },
    catTextActive: { color: Colors.primary },

    input: {
        backgroundColor: Colors.card,
        borderWidth: 1.5,
        borderColor: Colors.border,
        borderRadius: 16,
        padding: 16,
        fontSize: FontSize.base,
        color: Colors.textPrimary,
        height: 150,
        ...Shadows.card,
    },
});
