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
    ToastAndroid,
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
import { authService } from '@/services/auth.service';
import { useAuthStore } from '@/stores/auth.store';
import { Colors, Shadows } from '@/constants/colors';

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

    // Hardware back button should go to Profile Menu
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

    const pickImage = () => {
        setShowSourceModal(true);
    };

    const handleCameraSelection = async () => {
        setShowSourceModal(false);
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission Required', 'Camera access is needed to take a selfie.');
            return;
        }

        const result = await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
        });

        if (!result.canceled) {
            setSelectedImage(result.assets[0].uri);
        }
    };

    const handleGallerySelection = async () => {
        setShowSourceModal(false);
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission Required', 'Gallery access is needed to select a photo.');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
        });

        if (!result.canceled) {
            setSelectedImage(result.assets[0].uri);
        }
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

            formData.append('profile', {
                uri: Platform.OS === 'android' ? uri : uri.replace('file://', ''),
                name: fileName,
                type,
            } as any);
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

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.push('/profile')} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Edit Profile</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* Profile Image Section */}
                <View style={styles.imageSection}>
                    <TouchableOpacity onPress={pickImage} style={styles.imageContainer}>
                        {selectedImage || profile?.profileImage ? (
                            <Image
                                source={{ uri: (selectedImage || profile?.profileImage) as string }}
                                style={styles.profileImage}
                            />
                        ) : (
                            <View style={styles.imagePlaceholder}>
                                <Ionicons name="person" size={50} color="#CBD5E1" />
                            </View>
                        )}
                        <View style={styles.editIconBadge}>
                            <Ionicons name="camera" size={18} color="#FFF" />
                        </View>
                    </TouchableOpacity>
                    <Text style={styles.imageNote}>Tap to change profile picture</Text>
                </View>

                <View style={styles.formSection}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={styles.label}>Full Name <Text style={{ color: '#E74C3C' }}>*</Text></Text>
                        <Text style={{ fontSize: 11, color: name.length > 45 ? '#E74C3C' : '#94A3B8', fontWeight: '600' }}>{name.length}/50</Text>
                    </View>
                    <TextInput
                        style={styles.input}
                        value={name}
                        onChangeText={(text) => {
                            const clean = text.replace(/[^a-zA-Z\s]/g, '');
                            if (clean.length <= 50) setName(clean);
                        }}
                        placeholder="Enter your name"
                        maxLength={50}
                        autoCapitalize="words"
                    />

                    <Text style={styles.label}>Email Address <Text style={{ color: '#E74C3C' }}>*</Text></Text>
                    <TextInput
                        style={styles.input}
                        value={email}
                        onChangeText={setEmail}
                        placeholder="Enter your email"
                        keyboardType="email-address"
                        autoCapitalize="none"
                    />

                    <Text style={styles.label}>Gender <Text style={{ color: '#E74C3C' }}>*</Text></Text>
                    <View style={styles.genderContainer}>
                        {['Male', 'Female', 'Other'].map((g) => (
                            <TouchableOpacity
                                key={g}
                                style={[
                                    styles.genderBtn,
                                    gender === g && styles.genderBtnActive
                                ]}
                                onPress={() => setGender(g)}
                            >
                                <Text style={[
                                    styles.genderText,
                                    gender === g && styles.genderTextActive
                                ]}>{g}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <Text style={styles.label}>Mobile Number (Read-only)</Text>
                    <TextInput
                        style={[styles.input, styles.disabledInput]}
                        value={profile?.mobileNumber?.toString()}
                        editable={false}
                    />
                </View>

                <TouchableOpacity
                    style={styles.saveBtn}
                    onPress={handleSave}
                    disabled={updateMutation.isPending}
                >
                    {updateMutation.isPending ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.saveBtnText}>Save Changes</Text>
                    )}
                </TouchableOpacity>
            </ScrollView>

            {/* Image Source Selection Modal */}
            <Modal visible={showSourceModal} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setShowSourceModal(false)} />
                    <View style={styles.modalContentCompact}>
                        <Text style={styles.modalTitle}>Update Profile Picture</Text>
                        <View style={styles.sourceRow}>
                            <TouchableOpacity style={styles.sourceBtn} onPress={handleCameraSelection}>
                                <View style={[styles.sourceIconBox, { backgroundColor: '#F0F9FF' }]}><Ionicons name="camera" size={32} color="#1A7FD4" /></View>
                                <Text style={styles.sourceText}>Take Photo</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.sourceBtn} onPress={handleGallerySelection}>
                                <View style={[styles.sourceIconBox, { backgroundColor: '#F0FDF4' }]}><Ionicons name="images" size={32} color="#27AE60" /></View>
                                <Text style={styles.sourceText}>Gallery</Text>
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
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    backBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
    scrollContent: { padding: 20 },
    imageSection: {
        alignItems: 'center',
        marginBottom: 30,
    },
    imageContainer: {
        position: 'relative',
        width: 110,
        height: 110,
        borderRadius: 55,
        backgroundColor: '#fff',
        ...Shadows.card,
        padding: 4,
    },
    profileImage: {
        width: '100%',
        height: '100%',
        borderRadius: 55,
    },
    imagePlaceholder: {
        width: '100%',
        height: '100%',
        borderRadius: 55,
        backgroundColor: '#F1F5F9',
        justifyContent: 'center',
        alignItems: 'center',
    },
    editIconBadge: {
        position: 'absolute',
        right: 0,
        bottom: 0,
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: Colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        borderColor: '#fff',
    },
    imageNote: {
        marginTop: 12,
        fontSize: 12,
        fontWeight: '600',
        color: Colors.primary,
    },
    formSection: { gap: 16 },
    label: { fontSize: 13, fontWeight: '800', color: '#1A4D7A', marginBottom: 6 },
    input: {
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        fontSize: 16,
        color: Colors.textPrimary,
    },
    disabledInput: { backgroundColor: '#F1F5F9', color: '#94A3B8' },
    row: { flexDirection: 'row' },
    genderContainer: { flexDirection: 'row', gap: 8 },
    genderBtn: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        alignItems: 'center',
        backgroundColor: '#fff',
    },
    genderBtnActive: {
        backgroundColor: Colors.primaryLight,
        borderColor: Colors.primary,
    },
    genderText: { fontSize: 13, color: '#64748B', fontWeight: '600' },
    genderTextActive: { color: Colors.primary },
    saveBtn: {
        backgroundColor: Colors.primary,
        borderRadius: 16,
        paddingVertical: 16,
        alignItems: 'center',
        marginTop: 40,
        ...Shadows.card,
    },
    saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContentCompact: { backgroundColor: '#fff', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 40 },
    modalTitle: { fontSize: 18, fontWeight: '900', color: '#0D2E4D', marginBottom: 10, textAlign: 'center' },
    sourceRow: { flexDirection: 'row', justifyContent: 'space-around', marginVertical: 24 },
    sourceBtn: { alignItems: 'center', gap: 12 },
    sourceIconBox: { width: 70, height: 70, borderRadius: 24, justifyContent: 'center', alignItems: 'center', elevation: 4, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10 },
    sourceText: { fontSize: 14, fontWeight: '700', color: '#4A6E8A' },
    cancelBtn: { alignItems: 'center', paddingVertical: 10 },
    cancelBtnText: { fontSize: 16, color: '#E74C3C', fontWeight: '700' },
});
