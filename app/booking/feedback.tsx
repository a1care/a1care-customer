import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    Alert,
    ActivityIndicator,
    ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { reviewsService } from '@/services/reviews.service';
import { Colors, Shadows } from '@/constants/colors';
import { FontSize } from '@/constants/spacing';
import { Button } from '@/components/ui/Button';

const QUICK_TAGS = ["Excellent Service", "Punctual", "Professional", "Very Helpful", "Highly Recommend"];

export default function FeedbackScreen() {
    const { bookingId, bookingType, doctorId, childServiceId, name } = useLocalSearchParams<{
        bookingId: string;
        bookingType: 'Doctor' | 'Service';
        doctorId?: string;
        childServiceId?: string;
        name?: string;
    }>();

    const router = useRouter();
    const qc = useQueryClient();

    const [rating, setRating] = useState(0);
    const [comment, setComment] = useState('');

    const mutation = useMutation({
        mutationFn: () => reviewsService.addReview({
            bookingId: bookingId!,
            bookingType: bookingType!,
            rating,
            comment,
            doctorId,
            childServiceId,
        }),
        onSuccess: () => {
            Alert.alert("Thank You!", "Your feedback helps us improve our services.", [
                {
                    text: "Done", onPress: () => {
                        qc.invalidateQueries({ queryKey: ['doctor', doctorId] });
                        qc.invalidateQueries({ queryKey: ['reviews', doctorId] });
                        router.back();
                    }
                }
            ]);
        },
        onError: (err: any) => {
            Alert.alert("Error", err?.response?.data?.message || "Failed to submit review");
        }
    });

    const handleSubmit = () => {
        if (rating === 0) {
            Alert.alert("Rating Required", "Please select a star rating.");
            return;
        }
        mutation.mutate();
    };

    return (
        <SafeAreaView style={styles.root} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Text style={styles.backText}>✕</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Rate Your Experience</Text>
                <View style={{ width: 44 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
                <View style={styles.content}>
                    <View style={styles.iconContainer}>
                        <Text style={styles.mainIcon}>⭐</Text>
                    </View>

                    <Text style={styles.title}>How was your experience with</Text>
                    <Text style={styles.name}>{name || (bookingType === 'Doctor' ? 'the Doctor' : 'the Service')}</Text>

                    {/* Stars */}
                    <View style={styles.starsRow}>
                        {[1, 2, 3, 4, 5].map((star) => (
                            <TouchableOpacity
                                key={star}
                                onPress={() => setRating(star)}
                                activeOpacity={0.7}
                            >
                                <Text style={[styles.star, star <= rating ? styles.starFilled : styles.starEmpty]}>
                                    {star <= rating ? '★' : '☆'}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <Text style={styles.ratingText}>
                        {rating === 1 ? 'Disappointing' :
                            rating === 2 ? 'Could be better' :
                                rating === 3 ? 'Good' :
                                    rating === 4 ? 'Very Good' :
                                        rating === 5 ? 'Excellent!' : 'Tap a star to rate'}
                    </Text>

                    {/* Quick Tags */}
                    <View style={styles.tagsContainer}>
                        {QUICK_TAGS.map(tag => (
                            <TouchableOpacity
                                key={tag}
                                style={styles.tag}
                                onPress={() => setComment(prev => prev ? `${prev}, ${tag}` : tag)}
                            >
                                <Text style={styles.tagText}>+ {tag}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Comment Box */}
                    <TextInput
                        style={styles.input}
                        placeholder="Tell us more about your experience (optional)..."
                        placeholderTextColor={Colors.muted}
                        multiline
                        numberOfLines={4}
                        value={comment}
                        onChangeText={setComment}
                        textAlignVertical="top"
                    />
                </View>
            </ScrollView>

            <View style={styles.footer}>
                <Button
                    label="Submit Feedback"
                    onPress={handleSubmit}
                    loading={mutation.isPending}
                    variant="primary"
                    size="lg"
                    fullWidth
                />
            </View>
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
    },
    backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
    backText: { fontSize: 24, color: Colors.textSecondary },
    headerTitle: { fontSize: FontSize.base, fontWeight: '700', color: Colors.textPrimary },
    scroll: { padding: 24 },
    content: { alignItems: 'center' },
    iconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: Colors.primaryLight,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
    },
    mainIcon: { fontSize: 40 },
    title: { fontSize: FontSize.base, color: Colors.textSecondary, marginBottom: 4 },
    name: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.textPrimary, marginBottom: 32, textAlign: 'center' },
    starsRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
    star: { fontSize: 48 },
    starFilled: { color: '#F1C40F' },
    starEmpty: { color: Colors.border },
    ratingText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.primary, marginBottom: 32 },
    tagsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: 24 },
    tag: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        backgroundColor: '#F8F9FA',
        borderWidth: 1,
        borderColor: Colors.border,
    },
    tagText: { fontSize: 12, color: Colors.textSecondary, fontWeight: '500' },
    input: {
        width: '100%',
        backgroundColor: Colors.card,
        borderRadius: 16,
        padding: 16,
        fontSize: FontSize.base,
        color: Colors.textPrimary,
        height: 120,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    footer: { padding: 16, paddingBottom: 32, backgroundColor: Colors.card, ...Shadows.float },
});
