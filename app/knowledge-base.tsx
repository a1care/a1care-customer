import React, { useState, useMemo, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { 
    Search, 
    X, 
    ChevronLeft, 
    Activity, 
    FlaskConical, 
    HeartPulse, 
    ShieldCheck, 
    BookOpen,
    User as UserIcon,
    Clock
} from 'lucide-react-native';
import { useConfigStore } from '@/stores/config.store';
import { Colors, Shadows } from '@/constants/colors';
import { FontSize } from '@/constants/spacing';

const KNOWLEDGE_THEMES: Record<string, { icon: any; color: string; bgColor: string }> = {
    'Activity':    { icon: Activity,     color: '#FF6B6B', bgColor: '#FFF5F5' },
    'Flask':       { icon: FlaskConical, color: '#4DABF7', bgColor: '#E7F5FF' },
    'Heart':       { icon: HeartPulse,   color: '#51CF66', bgColor: '#EBFBEE' },
    'Mental':      { icon: ShieldCheck,  color: '#FCC419', bgColor: '#FFF9DB' },
    'default':     { icon: BookOpen,     color: '#64748B', bgColor: '#F1F5F9' },
};

export default function KnowledgeBaseScreen() {
    const router = useRouter();
    const { config, fetchConfig } = useConfigStore();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedKB, setSelectedKB] = useState<any>(null);
    const [isKBModalOpen, setIsKBModalOpen] = useState(false);

    useEffect(() => {
        fetchConfig();
    }, [fetchConfig]);

    const allArticles = useMemo(() => {
        const cloudKB = Array.isArray(config?.knowledgeBase) ? config.knowledgeBase : [];
        return cloudKB
            .filter((item: any) => item && (item.title || item.name))
            .map((item: any, idx: number) => ({
                ...item,
                id: item.id || item._id || `kb-${idx}`,
                title: item.title || item.name || 'Untitled',
                author: item.author || 'A1Care Team',
                readTime: item.readTime || '5 min',
                description: item.description || 'Health information from A1Care experts.',
                icon: KNOWLEDGE_THEMES[item.refType]?.icon || Activity,
                color: KNOWLEDGE_THEMES[item.refType]?.color || '#FF6B6B',
                bgColor: KNOWLEDGE_THEMES[item.refType]?.bgColor || '#FFF5F5',
            }));
    }, [config?.knowledgeBase]);

    const articles = useMemo(() => {
        if (!searchQuery.trim()) return allArticles;
        const q = searchQuery.toLowerCase();
        return allArticles.filter((a: any) => 
            String(a.title || '').toLowerCase().includes(q) ||
            String(a.author || '').toLowerCase().includes(q)
        );
    }, [allArticles, searchQuery]);

    const handleBack = () => {
        if (router.canGoBack()) {
            router.back();
            return;
        }
        router.replace('/');
    };

    return (
        <SafeAreaView style={styles.root} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
                    <ChevronLeft size={24} color={Colors.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Knowledge Space</Text>
                <View style={{ width: 44 }} />
            </View>

            {/* Search */}
            <View style={styles.searchWrapper}>
                <View style={styles.searchBar}>
                    <Search size={18} color={Colors.muted} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search articles, topics..."
                        placeholderTextColor={Colors.muted}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <X size={18} color={Colors.muted} />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
                <View style={styles.sectionHeader}>
                    <Text style={styles.countText}>{articles.length} Articles Available</Text>
                </View>

                {articles.length > 0 ? (
                    articles.map((item) => (
                        <TouchableOpacity
                            key={item.id}
                            style={[styles.kbCard, { backgroundColor: item.bgColor }]}
                            onPress={() => {
                                setSelectedKB(item);
                                setIsKBModalOpen(true);
                            }}
                            activeOpacity={0.8}
                        >
                            <View style={[styles.iconBox, { backgroundColor: '#fff' }]}>
                                <item.icon size={24} color={item.color} />
                            </View>
                            <View style={styles.cardContent}>
                                <Text style={styles.kbTitle}>{item.title}</Text>
                                <View style={styles.metaRow}>
                                    <Text style={styles.authorText}>{item.author}</Text>
                                    <View style={styles.dot} />
                                    <Text style={styles.timeText}>{item.readTime} read</Text>
                                </View>
                            </View>
                        </TouchableOpacity>
                    ))
                ) : (
                    <View style={styles.emptyState}>
                        <BookOpen size={64} color={Colors.border} />
                        <Text style={styles.emptyTitle}>No matching articles</Text>
                        <Text style={styles.emptySub}>Try searching for a different topic</Text>
                    </View>
                )}
                <View style={{ height: 40 }} />
            </ScrollView>

            {/* Article Detail Modal (Shared Logic) */}
            <Modal
                visible={isKBModalOpen}
                transparent
                animationType="slide"
                onRequestClose={() => setIsKBModalOpen(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        {selectedKB && (
                            <>
                                <View style={styles.modalHeader}>
                                    <View style={[styles.kbIconBoxLarge, { backgroundColor: selectedKB.bgColor }]}>
                                        <selectedKB.icon size={32} color={selectedKB.color} />
                                    </View>
                                    <TouchableOpacity
                                        onPress={() => setIsKBModalOpen(false)}
                                        style={styles.modalCloseBtn}
                                    >
                                        <X size={24} color={Colors.textPrimary} />
                                    </TouchableOpacity>
                                </View>

                                <Text style={styles.modalTitle}>{selectedKB.title}</Text>

                                <View style={styles.modalMeta}>
                                    <UserIcon size={14} color={Colors.primary} />
                                    <Text style={styles.modalAuthor}>{selectedKB.author}</Text>
                                    <View style={styles.dot} />
                                    <Clock size={14} color={Colors.muted} />
                                    <Text style={styles.modalReadTime}>{selectedKB.readTime} read</Text>
                                </View>

                                <ScrollView style={styles.modalScroll}>
                                    <Text style={styles.modalDesc}>{selectedKB.description}</Text>
                                    <Text style={styles.modalNote}>
                                        Disclaimer: This information is for educational purposes only. Always consult a qualified medical professional for personal health advice.
                                    </Text>
                                </ScrollView>

                                <TouchableOpacity
                                    style={styles.modalCta}
                                    onPress={() => setIsKBModalOpen(false)}
                                >
                                    <Text style={styles.modalCtaText}>I Understand</Text>
                                </TouchableOpacity>
                            </>
                        )}
                    </View>
                </View>
            </Modal>
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
        backgroundColor: Colors.white,
    },
    backBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#F8FAFC',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#EDF2F7',
    },
    headerTitle: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.textPrimary },
    
    searchWrapper: {
        paddingHorizontal: 20,
        paddingVertical: 16,
        backgroundColor: Colors.white,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F1F5F9',
        borderRadius: 16,
        paddingHorizontal: 16,
        height: 52,
        gap: 12,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        color: Colors.textPrimary,
        fontWeight: '500',
    },

    scroll: { padding: 20 },
    sectionHeader: { marginBottom: 20 },
    countText: { fontSize: 13, color: Colors.muted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },

    kbCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 24,
        marginBottom: 16,
        gap: 16,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.03)',
        ...Shadows.card,
    },
    iconBox: {
        width: 56,
        height: 56,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        ...Shadows.card,
        shadowOpacity: 0.1,
    },
    cardContent: { flex: 1 },
    kbTitle: { fontSize: 17, fontWeight: '800', color: Colors.textPrimary, marginBottom: 6 },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    authorText: { fontSize: 13, color: Colors.textSecondary, fontWeight: '600' },
    dot: { width: 3, height: 3, borderRadius: 2, backgroundColor: Colors.muted },
    timeText: { fontSize: 12, color: Colors.muted, fontWeight: '500' },

    emptyState: { alignItems: 'center', paddingVertical: 80, opacity: 0.5 },
    emptyTitle: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary, marginTop: 16 },
    emptySub: { fontSize: 14, color: Colors.textSecondary, marginTop: 4 },

    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: Colors.white,
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        padding: 24,
        maxHeight: '85%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 20,
    },
    kbIconBoxLarge: { width: 64, height: 64, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
    modalCloseBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
    modalTitle: { fontSize: 24, fontWeight: '900', color: Colors.textPrimary, marginBottom: 12, lineHeight: 32 },
    modalMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 24, paddingBottom: 24, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    modalAuthor: { fontSize: 14, fontWeight: '700', color: Colors.textSecondary },
    modalReadTime: { fontSize: 14, fontWeight: '600', color: Colors.muted },
    modalScroll: { marginBottom: 24 },
    modalDesc: { fontSize: 16, color: Colors.textPrimary, lineHeight: 26, fontWeight: '500' },
    modalNote: { marginTop: 24, fontSize: 12, color: Colors.muted, fontStyle: 'italic', lineHeight: 18 },
    modalCta: { backgroundColor: Colors.primary, paddingVertical: 18, borderRadius: 16, alignItems: 'center' },
    modalCtaText: { color: Colors.white, fontSize: 16, fontWeight: '800' },
});
