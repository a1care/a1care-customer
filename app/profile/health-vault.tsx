import React, { useState, useRef } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    FlatList,
    RefreshControl,
    Linking,
    BackHandler,
    Platform,
    Modal,
    ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { medicalService, MedicalRecord } from '@/services/medical.service';
import { Colors, Shadows } from '@/constants/colors';
import { FontSize } from '@/constants/spacing';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { API_BASE_URL } from '@/constants/api';
import { showToast } from '@/utils/toast';

// ── Types ─────────────────────────────────────────────────────────────────────
type UploadType = 'prescriptions' | 'labReports';
type Tab = 'all' | 'prescriptions' | 'labReports';

// ── Helpers ───────────────────────────────────────────────────────────────────
const getFileUrl = (url: string) => {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    const baseUrl = API_BASE_URL.replace('/api', '');
    return `${baseUrl}/${url.replace(/\\/g, '/')}`;
};

const getUploadMimeType = (asset: { mimeType?: string | null; name?: string | null; uri: string }) => {
    if (asset.mimeType && asset.mimeType !== 'application/octet-stream') return asset.mimeType;
    const source = `${asset.name || ''} ${asset.uri}`.toLowerCase();
    if (source.includes('.pdf')) return 'application/pdf';
    if (source.includes('.png')) return 'image/png';
    if (source.includes('.heic')) return 'image/heic';
    return 'image/jpeg';
};

const normalizeUploadName = (asset: { name?: string | null; uri: string }, fallbackPrefix: string) => {
    if (asset.name) return asset.name;
    const uriName = asset.uri.split('/').pop();
    if (uriName && uriName.includes('.')) return uriName;
    return `${fallbackPrefix}-${Date.now()}.jpg`;
};

const getFileName = (url: string) => {
    const parts = url.split('/');
    const raw = parts[parts.length - 1] || 'File';
    // Strip query strings and decode
    return decodeURIComponent(raw.split('?')[0]);
};

// ── Record Card ───────────────────────────────────────────────────────────────
function RecordCard({ item, onDelete }: { item: MedicalRecord; onDelete: (id: string) => void }) {
    const [expanded, setExpanded] = useState(false);
    const isPrescription = item.prescriptions.length > 0 && item.labReports.length === 0;
    const accentColor = isPrescription ? '#6366F1' : '#10B981';
    const bgColor = isPrescription ? '#EEF2FF' : '#ECFDF5';
    const iconName = isPrescription ? 'pill' : 'flask-outline';
    const typeLabel = isPrescription ? 'Prescription' : 'Lab Report';
    const allFiles = [
        ...item.prescriptions.map(url => ({ url, type: 'prescription' as const })),
        ...item.labReports.map(url => ({ url, type: 'lab' as const })),
    ];

    return (
        <View style={styles.recordCard}>
            {/* Header */}
            <TouchableOpacity style={styles.recordHeader} onPress={() => setExpanded(e => !e)} activeOpacity={0.8}>
                <View style={[styles.iconBox, { backgroundColor: bgColor }]}>
                    <MaterialCommunityIcons name={iconName as any} size={24} color={accentColor} />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={styles.recordTitle}>
                        {item.diagnosis || typeLabel}
                    </Text>
                    <Text style={styles.recordDate}>
                        {new Date(item.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                    </Text>
                    {item.clinicalNotes ? (
                        <Text style={styles.notesText} numberOfLines={expanded ? 10 : 1}>{item.clinicalNotes}</Text>
                    ) : null}
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color="#94A3B8" />
                    <TouchableOpacity
                        onPress={() => onDelete(item._id)}
                        style={styles.deleteBtn}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                        <Ionicons name="trash-outline" size={18} color="#EF4444" />
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>

            {/* Files (expanded) */}
            {expanded && (
                <View style={styles.filesSection}>
                    <Text style={styles.filesSectionLabel}>{allFiles.length} file{allFiles.length !== 1 ? 's' : ''} attached</Text>
                    <View style={styles.filesGrid}>
                        {allFiles.map((f, i) => {
                            const isPdf = f.url.toLowerCase().includes('.pdf');
                            const color = f.type === 'prescription' ? '#6366F1' : '#10B981';
                            const iconN = isPdf ? 'document-text' : 'image-outline';
                            const name = getFileName(f.url);
                            return (
                                <TouchableOpacity
                                    key={i}
                                    style={[styles.fileChip, { borderColor: color + '40' }]}
                                    onPress={() => {
                                        const fileUrl = getFileUrl(f.url);
                                        if (Platform.OS === 'web') {
                                            window.open(fileUrl, '_blank');
                                        } else {
                                            Linking.openURL(fileUrl);
                                        }
                                    }}
                                >
                                    <Ionicons name={iconN as any} size={16} color={color} />
                                    <Text style={[styles.fileChipText, { color }]} numberOfLines={1}>{name}</Text>
                                    <Ionicons name="open-outline" size={12} color={color} style={{ opacity: 0.7 }} />
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>
            )}

            {/* File count badge when collapsed */}
            {!expanded && allFiles.length > 0 && (
                <View style={styles.fileCountRow}>
                    <Ionicons name="attach" size={14} color="#64748B" />
                    <Text style={styles.fileCountText}>{allFiles.length} file{allFiles.length !== 1 ? 's' : ''} — tap to view</Text>
                </View>
            )}
        </View>
    );
}

// ── Upload Card ───────────────────────────────────────────────────────────────
function UploadCard({ type, color, label, icon, onPress, disabled }: {
    type: UploadType; color: string; label: string; icon: string;
    onPress: () => void; disabled: boolean;
}) {
    return (
        <TouchableOpacity
            style={[styles.uploadCard, { borderColor: color }]}
            onPress={onPress}
            disabled={disabled}
            activeOpacity={0.8}
        >
            <View style={[styles.uploadIconWrap, { backgroundColor: color + '18' }]}>
                <MaterialCommunityIcons name={icon as any} size={30} color={color} />
            </View>
            <Text style={[styles.uploadLabel, { color }]}>{label}</Text>
            <Text style={styles.uploadHint}>Camera · Gallery · PDF</Text>
        </TouchableOpacity>
    );
}

// ── Tab Button ────────────────────────────────────────────────────────────────
function TabBtn({ label, active, count, onPress }: { label: string; active: boolean; count: number; onPress: () => void }) {
    return (
        <TouchableOpacity style={[styles.tab, active && styles.tabActive]} onPress={onPress} activeOpacity={0.75}>
            <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
            {count > 0 && (
                <View style={[styles.tabBadge, active && styles.tabBadgeActive]}>
                    <Text style={[styles.tabBadgeText, active && styles.tabBadgeTextActive]}>{count}</Text>
                </View>
            )}
        </TouchableOpacity>
    );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function HealthVaultScreen() {
    const router = useRouter();
    const qc = useQueryClient();
    const [isUploading, setIsUploading] = useState(false);
    const [uploadPickerType, setUploadPickerType] = useState<UploadType | null>(null);
    const [activeTab, setActiveTab] = useState<Tab>('all');
    const webFileInputRef = useRef<HTMLInputElement | null>(null);
    const [pendingWebUploadType, setPendingWebUploadType] = useState<UploadType | null>(null);

    useFocusEffect(
        React.useCallback(() => {
            const onBackPress = () => { router.push('/profile'); return true; };
            const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
            return () => sub.remove();
        }, [])
    );

    const { data: records = [], isLoading, isError, refetch, isRefetching } = useQuery({
        queryKey: ['medical-records'],
        queryFn: medicalService.getMyRecords,
    });

    // ── Filter by tab ──
    const filtered = records.filter(r => {
        if (activeTab === 'all') return true;
        if (activeTab === 'prescriptions') return r.prescriptions.length > 0;
        if (activeTab === 'labReports') return r.labReports.length > 0;
        return true;
    });

    const prescCount = records.filter(r => r.prescriptions.length > 0).length;
    const labCount = records.filter(r => r.labReports.length > 0).length;

    // ── Upload mutation ──
    const uploadMutation = useMutation({
        mutationFn: (formData: FormData) => medicalService.uploadRecord(formData),
        onSuccess: () => {
            showToast.success('Upload Successful', 'Your record has been saved to Health Vault.');
            qc.invalidateQueries({ queryKey: ['medical-records'] });
        },
        onError: (err: any) => {
            showToast.error('Upload Failed', err?.response?.data?.message || 'Please try again.');
        },
        onSettled: () => setIsUploading(false),
    });

    // ── Delete mutation ──
    const deleteMutation = useMutation({
        mutationFn: (id: string) => medicalService.deleteRecord(id),
        onSuccess: () => {
            showToast.success('Record Deleted', 'Medical record removed from your vault.');
            qc.invalidateQueries({ queryKey: ['medical-records'] });
        },
        onError: (err: any) => {
            showToast.error('Delete Failed', err?.response?.data?.message || 'Could not delete record.');
        },
    });

    // ── Confirm delete ──
    const handleDeleteRecord = (id: string) => {
        if (Platform.OS === 'web') {
            if (window.confirm('Are you sure you want to permanently delete this medical record?')) {
                deleteMutation.mutate(id);
            }
        } else {
            const Alert = require('react-native').Alert;
            Alert.alert(
                'Delete Record',
                'Are you sure you want to permanently delete this medical record?',
                [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate(id) },
                ]
            );
        }
    };

    // ── Upload helpers ──
    const uploadAssets = (type: UploadType, assets: Array<{ uri: string; name?: string | null; mimeType?: string | null }>) => {
        setIsUploading(true);
        const formData = new FormData();
        assets.forEach((asset, index) => {
            formData.append(type, {
                uri: Platform.OS === 'android' ? asset.uri : asset.uri.replace('file://', ''),
                name: normalizeUploadName(asset, `${type}-${index + 1}`),
                type: getUploadMimeType(asset),
            } as any);
        });
        uploadMutation.mutate(formData);
    };

    const handlePickDocument = async (type: UploadType) => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: ['application/pdf', 'image/*'],
                multiple: true,
            });
            if (result.canceled) return;
            uploadAssets(type, result.assets);
        } catch {
            setIsUploading(false);
        }
    };

    const handlePickCamera = async (type: UploadType) => {
        try {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') {
                showToast.warn('Permission Required', 'Camera access is needed to capture records.');
                return;
            }
            const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.85 });
            if (result.canceled || !result.assets?.length) return;
            uploadAssets(type, result.assets.map(a => ({ uri: a.uri, name: a.fileName || null, mimeType: a.mimeType || null })));
        } catch {
            setIsUploading(false);
        }
    };

    const handlePickGallery = async (type: UploadType) => {
        try {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                showToast.warn('Permission Required', 'Gallery access is needed to pick records.');
                return;
            }
            const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85, allowsMultipleSelection: true });
            if (result.canceled || !result.assets?.length) return;
            uploadAssets(type, result.assets.map(a => ({ uri: a.uri, name: a.fileName || null, mimeType: a.mimeType || null })));
        } catch {
            setIsUploading(false);
        }
    };

    // ── Web file picker ──
    const handleWebUpload = (type: UploadType) => {
        setPendingWebUploadType(type);
        if (Platform.OS === 'web') {
            // Create a hidden file input
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*,application/pdf';
            input.multiple = true;
            input.onchange = (e: any) => {
                const files: File[] = Array.from(e.target.files || []);
                if (!files.length) return;
                setIsUploading(true);
                const formData = new FormData();
                files.forEach(file => formData.append(type, file));
                uploadMutation.mutate(formData);
            };
            input.click();
        } else {
            setUploadPickerType(type);
        }
    };

    const handleBack = () => {
        if (router.canGoBack()) router.back();
        else router.replace('/profile');
    };

    const ListHeader = (
        <View>
            {/* Upload Cards */}
            <View style={styles.uploadSection}>
                <Text style={styles.sectionTitle}>Add New Records</Text>
                <View style={styles.uploadRow}>
                    <UploadCard
                        type="prescriptions"
                        color="#6366F1"
                        label="Prescription"
                        icon="pill"
                        onPress={() => handleWebUpload('prescriptions')}
                        disabled={isUploading}
                    />
                    <UploadCard
                        type="labReports"
                        color="#10B981"
                        label="Lab Report"
                        icon="flask-outline"
                        onPress={() => handleWebUpload('labReports')}
                        disabled={isUploading}
                    />
                </View>
                {isUploading && (
                    <View style={styles.uploadingBox}>
                        <ActivityIndicator size="small" color={Colors.primary} />
                        <Text style={styles.uploadingText}>Uploading your documents...</Text>
                    </View>
                )}
            </View>

            {/* Tabs */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll} contentContainerStyle={styles.tabsContainer}>
                <TabBtn label="All Records" active={activeTab === 'all'} count={records.length} onPress={() => setActiveTab('all')} />
                <TabBtn label="Prescriptions" active={activeTab === 'prescriptions'} count={prescCount} onPress={() => setActiveTab('prescriptions')} />
                <TabBtn label="Lab Reports" active={activeTab === 'labReports'} count={labCount} onPress={() => setActiveTab('labReports')} />
            </ScrollView>

            <Text style={styles.historyTitle}>
                {activeTab === 'all' ? 'All Records' : activeTab === 'prescriptions' ? 'Prescriptions' : 'Lab Reports'}
                <Text style={styles.historyCount}> ({filtered.length})</Text>
            </Text>
        </View>
    );

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#1E293B" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Health Vault</Text>
                <TouchableOpacity onPress={() => refetch()} style={styles.backBtn} disabled={isRefetching}>
                    {isRefetching
                        ? <ActivityIndicator size="small" color={Colors.primary} />
                        : <Ionicons name="refresh-outline" size={22} color={Colors.primary} />}
                </TouchableOpacity>
            </View>

            {isLoading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                    <Text style={styles.loadingText}>Loading your records...</Text>
                </View>
            ) : isError ? (
                <View style={styles.center}>
                    <Ionicons name="cloud-offline-outline" size={64} color="#CBD5E1" />
                    <Text style={styles.emptyTitle}>Could not load records</Text>
                    <TouchableOpacity onPress={() => refetch()} style={styles.retryBtn}>
                        <Text style={styles.retryBtnText}>Try Again</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <FlatList
                    data={filtered}
                    keyExtractor={item => item._id}
                    renderItem={({ item }) => <RecordCard item={item} onDelete={handleDeleteRecord} />}
                    contentContainerStyle={styles.list}
                    refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.primary} />}
                    ListHeaderComponent={ListHeader}
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <Ionicons name="shield-checkmark-outline" size={72} color="#CBD5E1" />
                            <Text style={styles.emptyTitle}>
                                {activeTab === 'all' ? 'Your Vault is Empty' : `No ${activeTab === 'prescriptions' ? 'Prescriptions' : 'Lab Reports'} Yet`}
                            </Text>
                            <Text style={styles.emptySub}>
                                {activeTab === 'all'
                                    ? 'Upload your prescriptions and lab reports to keep them safe and accessible.'
                                    : `Tap the upload card above to add your first ${activeTab === 'prescriptions' ? 'prescription' : 'lab report'}.`}
                            </Text>
                        </View>
                    }
                    ListFooterComponent={<View style={{ height: 100 }} />}
                />
            )}

            {/* Native Upload Picker Modal */}
            <Modal
                visible={!!uploadPickerType}
                transparent
                animationType="slide"
                onRequestClose={() => setUploadPickerType(null)}
            >
                <View style={styles.sheetOverlay}>
                    <TouchableOpacity style={styles.sheetBackdrop} activeOpacity={1} onPress={() => setUploadPickerType(null)} />
                    <View style={styles.sheetContainer}>
                        <View style={styles.sheetHandle} />
                        <Text style={styles.sheetTitle}>
                            Upload {uploadPickerType === 'prescriptions' ? 'Prescription' : 'Lab Report'}
                        </Text>
                        <Text style={styles.sheetSubtitle}>Choose how you'd like to add your document</Text>

                        <View style={styles.sheetActions}>
                            <TouchableOpacity
                                style={styles.sheetAction}
                                onPress={() => { const t = uploadPickerType!; setUploadPickerType(null); handlePickCamera(t); }}
                                disabled={isUploading}
                            >
                                <View style={[styles.sheetIconWrap, { backgroundColor: '#E8F1FB' }]}>
                                    <Ionicons name="camera" size={32} color="#2C7FD1" />
                                </View>
                                <Text style={styles.sheetActionText}>Camera</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.sheetAction}
                                onPress={() => { const t = uploadPickerType!; setUploadPickerType(null); handlePickGallery(t); }}
                                disabled={isUploading}
                            >
                                <View style={[styles.sheetIconWrap, { backgroundColor: '#EAF7F0' }]}>
                                    <Ionicons name="images" size={32} color="#12A56F" />
                                </View>
                                <Text style={styles.sheetActionText}>Gallery</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.sheetAction}
                                onPress={() => { const t = uploadPickerType!; setUploadPickerType(null); handlePickDocument(t); }}
                                disabled={isUploading}
                            >
                                <View style={[styles.sheetIconWrap, { backgroundColor: '#FFF3E0' }]}>
                                    <Ionicons name="document-attach" size={32} color="#F59E0B" />
                                </View>
                                <Text style={styles.sheetActionText}>Document</Text>
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity onPress={() => setUploadPickerType(null)} style={styles.sheetCancelBtn}>
                            <Text style={styles.sheetCancelText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F1F5F9' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 32 },
    loadingText: { fontSize: 14, color: '#64748B', marginTop: 8 },
    header: {
        flexDirection: 'row', alignItems: 'center', padding: 16,
        backgroundColor: '#FFF', justifyContent: 'space-between', ...Shadows.card,
    },
    backBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F1F5F9' },
    headerTitle: { fontSize: 20, fontWeight: '800', color: '#1E293B' },
    list: { padding: 16 },
    // Upload section
    uploadSection: { marginBottom: 8 },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: '#475569', marginBottom: 12 },
    uploadRow: { flexDirection: 'row', gap: 12 },
    uploadCard: {
        flex: 1, backgroundColor: '#FFF', borderRadius: 20, borderWidth: 2,
        borderStyle: 'dashed', alignItems: 'center', padding: 16, gap: 8, ...Shadows.small,
    },
    uploadIconWrap: { width: 60, height: 60, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
    uploadLabel: { fontSize: 13, fontWeight: '700', textAlign: 'center' },
    uploadHint: { fontSize: 11, color: '#94A3B8', textAlign: 'center' },
    uploadingBox: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14, justifyContent: 'center' },
    uploadingText: { fontSize: 13, color: Colors.primary, fontWeight: '600' },
    // Tabs
    tabsScroll: { marginBottom: 4 },
    tabsContainer: { flexDirection: 'row', gap: 8, paddingVertical: 12 },
    tab: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
        backgroundColor: '#E2E8F0',
    },
    tabActive: { backgroundColor: Colors.primary },
    tabText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
    tabTextActive: { color: '#FFF' },
    tabBadge: {
        backgroundColor: '#CBD5E1', borderRadius: 10,
        paddingHorizontal: 6, paddingVertical: 1,
    },
    tabBadgeActive: { backgroundColor: 'rgba(255,255,255,0.3)' },
    tabBadgeText: { fontSize: 11, fontWeight: '700', color: '#64748B' },
    tabBadgeTextActive: { color: '#FFF' },
    historyTitle: { fontSize: 18, fontWeight: '800', color: '#1E293B', marginBottom: 12, marginTop: 4 },
    historyCount: { fontSize: 14, fontWeight: '400', color: '#94A3B8' },
    // Record cards
    recordCard: {
        backgroundColor: '#FFF', borderRadius: 20, marginBottom: 12,
        overflow: 'hidden', ...Shadows.card, borderWidth: 1, borderColor: '#F1F5F9',
    },
    recordHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
    iconBox: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
    recordTitle: { fontSize: 15, fontWeight: '700', color: '#1E293B' },
    recordDate: { fontSize: 12, color: '#94A3B8', marginTop: 2 },
    notesText: { fontSize: 13, color: '#64748B', marginTop: 4, lineHeight: 18 },
    deleteBtn: { padding: 6, marginLeft: 2 },
    filesSection: { backgroundColor: '#F8FAFC', borderTopWidth: 1, borderTopColor: '#F1F5F9', padding: 14 },
    filesSectionLabel: { fontSize: 12, fontWeight: '600', color: '#64748B', marginBottom: 10 },
    filesGrid: { gap: 8 },
    fileChip: {
        flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFF',
        paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 1,
    },
    fileChipText: { flex: 1, fontSize: 13, fontWeight: '600' },
    fileCountRow: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        paddingHorizontal: 16, paddingBottom: 12,
    },
    fileCountText: { fontSize: 12, color: '#64748B' },
    // Empty state
    emptyState: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 40 },
    emptyTitle: { fontSize: 18, fontWeight: '800', color: '#1E293B', marginTop: 16 },
    emptySub: { fontSize: 14, color: '#94A3B8', textAlign: 'center', marginTop: 8, lineHeight: 22 },
    retryBtn: {
        marginTop: 16, backgroundColor: Colors.primary,
        paddingHorizontal: 28, paddingVertical: 12, borderRadius: 14,
    },
    retryBtnText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
    // Bottom sheet
    sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    sheetBackdrop: { flex: 1 },
    sheetContainer: {
        backgroundColor: '#FFF', borderTopLeftRadius: 30, borderTopRightRadius: 30,
        paddingHorizontal: 24, paddingTop: 12, paddingBottom: 36,
    },
    sheetHandle: {
        width: 40, height: 4, backgroundColor: '#E2E8F0',
        borderRadius: 2, alignSelf: 'center', marginBottom: 20,
    },
    sheetTitle: { textAlign: 'center', fontSize: 20, fontWeight: '800', color: '#1E293B', marginBottom: 4 },
    sheetSubtitle: { textAlign: 'center', fontSize: 13, color: '#94A3B8', marginBottom: 28 },
    sheetActions: { flexDirection: 'row', justifyContent: 'space-evenly', marginBottom: 28 },
    sheetAction: { alignItems: 'center', gap: 10 },
    sheetIconWrap: {
        width: 88, height: 88, borderRadius: 24,
        justifyContent: 'center', alignItems: 'center',
        shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 }, elevation: 4,
    },
    sheetActionText: { fontSize: 13, fontWeight: '700', color: '#4A647E' },
    sheetCancelBtn: { alignItems: 'center', paddingTop: 4 },
    sheetCancelText: { color: '#EF4444', fontSize: 16, fontWeight: '700' },
});
