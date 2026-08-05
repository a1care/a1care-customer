import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    ScrollView,
    ActivityIndicator,
    Image,
    Platform,
    BackHandler,
    Modal,
    Alert,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { authService } from '@/services/auth.service';
import { useAuthStore } from '@/stores/auth.store';
import { Colors, Shadows } from '@/constants/colors';

const GENDER_OPTIONS = [
    { label: 'Male', icon: 'man-outline' as const },
    { label: 'Female', icon: 'woman-outline' as const },
    { label: 'Other', icon: 'transgender-outline' as const },
];

export default function ProfileEditScreen() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const { setUser } = useAuthStore();

    const { data: profile, isLoading } = useQuery({
        queryKey: ['profile'],
        queryFn: authService.getProfile,
    });

    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [gender, setGender] = useState('');
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [showSourceModal, setShowSourceModal] = useState(false);
    const [focusedField, setFocusedField] = useState<string | null>(null);

    useFocusEffect(
        React.useCallback(() => {
            const onBackPress = () => {
                router.push('/profile');
                return true;
            };
            const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
            return () => subscription.remove();
        }, [])
    );

    useEffect(() => {
        if (profile) {
            setName(profile.name || '');
            setEmail(profile.email || '');
            setGender(profile.gender || '');
        }
    }, [profile]);

    const updateMutation = useMutation({
        mutationFn: (data: any) => authService.updateProfile(data),
        onSuccess: (data) => {
            if (data) setUser(data);
            queryClient.setQueryData(['profile'], data);
            queryClient.invalidateQueries({ queryKey: ['profile'] });
            Toast.show({
                type: 'success',
                text1: 'Success',
                text2: 'Profile updated successfully',
                position: 'top',
                onHide: () => router.push('/profile')
            });
        },
        onError: (error: any) => {
            const errorMsg = error.response?.data?.message || error.message || 'Failed to update profile';
            Toast.show({
                type: 'error',
                text1: 'Update Failed',
                text2: errorMsg,
                position: 'top'
            });
        },
    });

    const pickImage = () => { setShowSourceModal(true); };

    const handleCameraSelection = async () => {
        setShowSourceModal(false);
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission Required', 'Camera access is needed to take a selfie.');
            return;
        }
        const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.8 });
        if (!result.canceled) setSelectedImage(result.assets[0].uri);
    };

    const handleGallerySelection = async () => {
        setShowSourceModal(false);
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission Required', 'Gallery access is needed to select a photo.');
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.8 });
        if (!result.canceled) setSelectedImage(result.assets[0].uri);
    };

    const handleSave = () => {
        const nameRegex = /^[a-zA-Z\s]+$/;
        if (!name.trim()) {
            Toast.show({ type: 'error', text1: 'Name Required', text2: 'Please enter your full name.', position: 'top' });
            return;
        }
        if (!nameRegex.test(name.trim())) {
            Toast.show({ type: 'error', text1: 'Invalid Name', text2: 'Name can only contain letters and spaces.', position: 'top' });
            return;
        }
        if (name.trim().length > 50) {
            Toast.show({ type: 'error', text1: 'Name Too Long', text2: 'Full name cannot exceed 50 characters.', position: 'top' });
            return;
        }
        const formData = new FormData();
        formData.append('name', name);
        formData.append('email', email);
        formData.append('gender', gender);
        if (selectedImage) {
            const uri = selectedImage;
            const fileName = uri.split('/').pop() || 'photo.jpg';
            const match = /\.(\w+)$/.exec(fileName);
            const type = match ? `image/${match[1]}` : `image`;
            formData.append('profile', { uri: Platform.OS === 'android' ? uri : uri.replace('file://', ''), name: fileName, type } as any);
        }
        updateMutation.mutate(formData);
    };

    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.primary} />
            </View>
        );
    }

    const avatarUri = selectedImage || profile?.profileImage;

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.push('/profile')} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={22} color="#0F172A" />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={styles.headerTitle}>Edit Profile</Text>
                    <Text style={styles.headerSub}>Update your personal information</Text>
                </View>
                <View style={{ width: 44 }} />
            </View>

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                {/* Profile Avatar Section */}
                <View style={styles.avatarSection}>
                    <TouchableOpacity onPress={pickImage} activeOpacity={0.88} style={styles.avatarWrapper}>
                        {avatarUri ? (
                            <Image source={{ uri: avatarUri as string }} style={styles.avatarImage} />
                        ) : (
                            <LinearGradient
                                colors={['#1A4D8F', '#0B3370']}
                                style={styles.avatarPlaceholder}
                            >
                                <Ionicons name="person" size={52} color="rgba(255,255,255,0.7)" />
                            </LinearGradient>
                        )}
                        {/* Camera badge */}
                        <LinearGradient
                            colors={['#2563EB', '#0B3370']}
                            style={styles.cameraBadge}
                        >
                            <Ionicons name="camera" size={16} color="#fff" />
                        </LinearGradient>
                    </TouchableOpacity>
                    <Text style={styles.avatarHint}>Tap to change photo</Text>
                </View>

                {/* Form Card */}
                <View style={styles.formCard}>

                    {/* Full Name */}
                    <View style={styles.fieldGroup}>
                        <View style={styles.labelRow}>
                            <View style={styles.labelIconBox}>
                                <Ionicons name="person-outline" size={13} color="#0B3370" />
                            </View>
                            <Text style={styles.label}>Full Name <Text style={styles.required}>*</Text></Text>
                            <Text style={[styles.charCount, name.length > 45 && { color: '#EF4444' }]}>{name.length}/50</Text>
                        </View>
                        <TextInput
                            style={[styles.input, focusedField === 'name' && styles.inputFocused]}
                            value={name}
                            onChangeText={(text) => {
                                const clean = text.replace(/[^a-zA-Z\s]/g, '');
                                if (clean.length <= 50) setName(clean);
                            }}
                            placeholder="Enter your full name"
                            placeholderTextColor="#CBD5E1"
                            maxLength={50}
                            autoCapitalize="words"
                            onFocus={() => setFocusedField('name')}
                            onBlur={() => setFocusedField(null)}
                        />
                    </View>

                    {/* Divider */}
                    <View style={styles.fieldDivider} />

                    {/* Email */}
                    <View style={styles.fieldGroup}>
                        <View style={styles.labelRow}>
                            <View style={styles.labelIconBox}>
                                <Ionicons name="mail-outline" size={13} color="#0B3370" />
                            </View>
                            <Text style={styles.label}>Email Address <Text style={styles.required}>*</Text></Text>
                        </View>
                        <TextInput
                            style={[styles.input, focusedField === 'email' && styles.inputFocused]}
                            value={email}
                            onChangeText={setEmail}
                            placeholder="Enter your email address"
                            placeholderTextColor="#CBD5E1"
                            keyboardType="email-address"
                            autoCapitalize="none"
                            onFocus={() => setFocusedField('email')}
                            onBlur={() => setFocusedField(null)}
                        />
                    </View>

                    {/* Divider */}
                    <View style={styles.fieldDivider} />

                    {/* Gender */}
                    <View style={styles.fieldGroup}>
                        <View style={styles.labelRow}>
                            <View style={styles.labelIconBox}>
                                <Ionicons name="people-outline" size={13} color="#0B3370" />
                            </View>
                            <Text style={styles.label}>Gender <Text style={styles.required}>*</Text></Text>
                        </View>
                        <View style={styles.genderContainer}>
                            {GENDER_OPTIONS.map((g) => (
                                <TouchableOpacity
                                    key={g.label}
                                    style={[styles.genderBtn, gender === g.label && styles.genderBtnActive]}
                                    onPress={() => setGender(g.label)}
                                    activeOpacity={0.85}
                                >
                                    <Ionicons
                                        name={g.icon}
                                        size={18}
                                        color={gender === g.label ? '#0B3370' : '#94A3B8'}
                                    />
                                    <Text style={[styles.genderText, gender === g.label && styles.genderTextActive]}>
                                        {g.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    {/* Divider */}
                    <View style={styles.fieldDivider} />

                    {/* Mobile (read-only) */}
                    <View style={styles.fieldGroup}>
                        <View style={styles.labelRow}>
                            <View style={[styles.labelIconBox, { backgroundColor: '#F1F5F9' }]}>
                                <Ionicons name="lock-closed-outline" size={13} color="#94A3B8" />
                            </View>
                            <Text style={[styles.label, { color: '#94A3B8' }]}>Mobile Number</Text>
                        </View>
                        <TextInput
                            style={[styles.input, styles.disabledInput]}
                            value={profile?.mobileNumber?.toString()}
                            editable={false}
                            placeholderTextColor="#CBD5E1"
                        />
                    </View>
                </View>

                {/* Save Button */}
                <TouchableOpacity
                    style={[styles.saveBtn, updateMutation.isPending && { opacity: 0.75 }]}
                    onPress={handleSave}
                    disabled={updateMutation.isPending}
                    activeOpacity={0.88}
                >
                    {updateMutation.isPending ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <>
                            <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                            <Text style={styles.saveBtnText}>Save Changes</Text>
                        </>
                    )}
                </TouchableOpacity>

                <View style={{ height: 40 }} />
            </ScrollView>

            {/* Image Source Modal */}
            <Modal visible={showSourceModal} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setShowSourceModal(false)} />
                    <View style={styles.modalSheet}>
                        <View style={styles.modalHandle} />
                        <Text style={styles.modalTitle}>Update Profile Photo</Text>
                        <Text style={styles.modalSubtitle}>Choose how you'd like to update your picture</Text>
                        <View style={styles.sourceRow}>
                            <TouchableOpacity style={styles.sourceCard} onPress={handleCameraSelection} activeOpacity={0.85}>
                                <LinearGradient colors={['#EFF6FF', '#DBEAFE']} style={styles.sourceIconBox}>
                                    <Ionicons name="camera" size={32} color="#2563EB" />
                                </LinearGradient>
                                <Text style={styles.sourceLabel}>Camera</Text>
                                <Text style={styles.sourceHint}>Take a selfie</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.sourceCard} onPress={handleGallerySelection} activeOpacity={0.85}>
                                <LinearGradient colors={['#F0FDF4', '#DCFCE7']} style={styles.sourceIconBox}>
                                    <Ionicons name="images" size={32} color="#16A34A" />
                                </LinearGradient>
                                <Text style={styles.sourceLabel}>Gallery</Text>
                                <Text style={styles.sourceHint}>Choose from library</Text>
                            </TouchableOpacity>
                        </View>
                        <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowSourceModal(false)}>
                            <Text style={styles.cancelBtnText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F4F7FC' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    // Header
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 14,
        backgroundColor: '#FFFFFF',
        shadowColor: '#0A1A3A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 12,
        elevation: 4,
    },
    backBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#F1F5F9',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: { fontSize: 20, fontWeight: '900', color: '#0F172A', letterSpacing: -0.3 },
    headerSub: { fontSize: 12, color: '#94A3B8', fontWeight: '600', marginTop: 2 },

    // Scroll
    scrollContent: { paddingHorizontal: 20, paddingTop: 28 },

    // Avatar
    avatarSection: { alignItems: 'center', marginBottom: 28 },
    avatarWrapper: {
        position: 'relative',
        width: 120,
        height: 120,
        borderRadius: 60,
        shadowColor: '#0B3370',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.18,
        shadowRadius: 24,
        elevation: 10,
    },
    avatarImage: { width: 120, height: 120, borderRadius: 60, borderWidth: 4, borderColor: '#fff' },
    avatarPlaceholder: {
        width: 120,
        height: 120,
        borderRadius: 60,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 4,
        borderColor: '#fff',
    },
    cameraBadge: {
        position: 'absolute',
        right: 2,
        bottom: 2,
        width: 38,
        height: 38,
        borderRadius: 19,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        borderColor: '#fff',
        shadowColor: '#0B3370',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },
    avatarHint: { marginTop: 14, fontSize: 13, fontWeight: '700', color: '#0B3370' },

    // Form Card
    formCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 28,
        paddingHorizontal: 20,
        paddingVertical: 8,
        shadowColor: '#0A1A3A',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.05,
        shadowRadius: 24,
        elevation: 6,
        marginBottom: 24,
    },
    fieldGroup: { paddingVertical: 18 },
    fieldDivider: { height: 1, backgroundColor: '#F1F5F9', marginHorizontal: -4 },
    labelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 },
    labelIconBox: {
        width: 26,
        height: 26,
        borderRadius: 8,
        backgroundColor: '#EEF4FF',
        justifyContent: 'center',
        alignItems: 'center',
    },
    label: { flex: 1, fontSize: 13, fontWeight: '800', color: '#0F172A', letterSpacing: 0.1 },
    required: { color: '#EF4444' },
    charCount: { fontSize: 11, color: '#94A3B8', fontWeight: '700' },
    readOnlyBadge: {
        backgroundColor: '#F1F5F9',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10,
    },
    readOnlyBadgeText: { fontSize: 10, fontWeight: '800', color: '#94A3B8', letterSpacing: 0.3 },

    // Inputs
    input: {
        backgroundColor: '#F8FAFC',
        borderWidth: 1.5,
        borderColor: '#E8EEF5',
        borderRadius: 16,
        paddingHorizontal: 18,
        paddingVertical: 15,
        fontSize: 16,
        fontWeight: '700',
        color: '#0F172A',
    },
    inputFocused: {
        borderColor: '#2563EB',
        backgroundColor: '#FAFCFF',
        shadowColor: '#2563EB',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 2,
    },
    disabledInput: {
        backgroundColor: '#F8FAFC',
        color: '#94A3B8',
        borderColor: '#F1F5F9',
        fontWeight: '600',
    },

    // Gender
    genderContainer: { flexDirection: 'row', gap: 10 },
    genderBtn: {
        flex: 1,
        flexDirection: 'column',
        alignItems: 'center',
        paddingVertical: 14,
        gap: 6,
        borderRadius: 18,
        borderWidth: 1.5,
        borderColor: '#E8EEF5',
        backgroundColor: '#F8FAFC',
    },
    genderBtnActive: {
        backgroundColor: '#EEF4FF',
        borderColor: '#2563EB',
        shadowColor: '#2563EB',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
    },
    genderText: { fontSize: 13, color: '#64748B', fontWeight: '700' },
    genderTextActive: { color: '#0B3370', fontWeight: '900' },

    // Save Button
    saveBtn: {
        backgroundColor: '#0B3370',
        borderRadius: 30,
        paddingVertical: 18,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        shadowColor: '#0B3370',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10,
    },
    saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '900', letterSpacing: 0.4 },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(10,20,50,0.55)', justifyContent: 'flex-end' },
    modalSheet: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 36,
        borderTopRightRadius: 36,
        padding: 24,
        paddingBottom: 44,
    },
    modalHandle: {
        width: 44,
        height: 5,
        borderRadius: 3,
        backgroundColor: '#E2E8F0',
        alignSelf: 'center',
        marginBottom: 20,
    },
    modalTitle: { fontSize: 20, fontWeight: '900', color: '#0F172A', textAlign: 'center', marginBottom: 6 },
    modalSubtitle: { fontSize: 13, color: '#64748B', fontWeight: '600', textAlign: 'center', marginBottom: 28 },
    sourceRow: { flexDirection: 'row', justifyContent: 'center', gap: 20, marginBottom: 24 },
    sourceCard: { alignItems: 'center', gap: 10 },
    sourceIconBox: {
        width: 86,
        height: 86,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowRadius: 16,
        elevation: 4,
    },
    sourceLabel: { fontSize: 15, fontWeight: '900', color: '#0F172A' },
    sourceHint: { fontSize: 11, color: '#94A3B8', fontWeight: '600' },
    cancelBtn: { alignItems: 'center', paddingVertical: 12 },
    cancelBtnText: { fontSize: 15, color: '#EF4444', fontWeight: '800' },
});
