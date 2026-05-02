import React, { useMemo, useRef, useState } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    TextInput,
    StyleSheet,
    Platform,
    Modal,
    KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { servicesService } from '@/services/services.service';
import { bookingsService } from '@/services/bookings.service';
import { doctorsService } from '@/services/doctors.service';
import { addressService } from '@/services/address.service';
import { walletService } from '@/services/wallet.service';
import { paymentService } from '@/services/payment.service';
import { Colors, Shadows } from '@/constants/colors';
import { FontSize } from '@/constants/spacing';
import { Button } from '@/components/ui/Button';
import { DoctorCard } from '@/components/ui/DoctorCard';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { formatCurrency } from '@/utils/formatters';
import type { Address } from '@/types';
import RazorpayCheckout from 'react-native-razorpay';
import { triggerLocalNotification } from '@/utils/notifications';

// ─── Step definitions ─────────────────────────────────────────────────────────
type Step = 'info' | 'doctor' | 'address' | 'schedule' | 'payment' | 'confirm';

const ALL_STEPS: Step[] = ['info', 'doctor', 'address', 'schedule', 'payment', 'confirm'];
const ALL_STEP_LABELS = ['Service', 'Expert', 'Location', 'Schedule', 'Payment', 'Review'];

const SLOT_OPTIONS = [
    '09:00 AM', '10:00 AM', '11:00 AM', '12:00 PM',
    '02:00 PM', '03:00 PM', '04:00 PM', '05:00 PM', '06:00 PM'
];

const toLocalYMD = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

const slotToMinutes = (slot: string) => {
    const [time, meridiem] = slot.split(' ');
    let [hh, mm] = time.split(':').map(Number);
    if (meridiem === 'PM' && hh !== 12) hh += 12;
    if (meridiem === 'AM' && hh === 12) hh = 0;
    return hh * 60 + mm;
};

const displaySlotTo24Hour = (slot: string) => {
    const [time, meridiem] = (slot || '').trim().split(' ');
    if (!time || !meridiem) return '';
    let [hh, mm] = time.split(':').map(Number);
    if (Number.isNaN(hh) || Number.isNaN(mm)) return '';
    if (meridiem.toUpperCase() === 'PM' && hh !== 12) hh += 12;
    if (meridiem.toUpperCase() === 'AM' && hh === 12) hh = 0;
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
};

const withTimeout = async <T,>(promise: Promise<T>, ms: number, message = 'Request timed out') => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const timeoutPromise = new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), ms);
    });
    try {
        return await Promise.race([promise, timeoutPromise]);
    } finally {
        if (timer) clearTimeout(timer);
    }
};

// ─── Step indicator ───────────────────────────────────────────────────────────
function StepIndicator({ current, activeSteps }: { current: Step, activeSteps: Step[] }) {
    const idx = activeSteps.indexOf(current);
    return (
        <View style={styles.stepRow}>
            {activeSteps.map((s, i) => {
                const globalIdx = ALL_STEPS.indexOf(s);
                return (
                    <React.Fragment key={s}>
                        <View style={styles.stepItem}>
                            <View
                                style={[
                                    styles.stepDot,
                                    i < idx ? styles.stepDotDone : {},
                                    i === idx ? styles.stepDotActive : {},
                                ]}
                            >
                                {i < idx ? (
                                    <Text style={styles.stepDotCheckmark}>✓</Text>
                                ) : (
                                    <Text
                                        style={[
                                            styles.stepDotNum,
                                            i === idx ? styles.stepDotNumActive : {},
                                        ]}
                                    >
                                        {i + 1}
                                    </Text>
                                )}
                            </View>
                            <Text
                                style={[styles.stepLabel, i === idx ? styles.stepLabelActive : {}]}
                            >
                                {ALL_STEP_LABELS[globalIdx]}
                            </Text>
                        </View>
                        {i < activeSteps.length - 1 && (
                            <View style={[styles.stepLine, i < idx ? styles.stepLineDone : {}]} />
                        )}
                    </React.Fragment>
                );
            })}
        </View>
    );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function ServiceDetailScreen() {
    const { id, name: nameParam, price: priceParam, subName, from, entryMode, originServiceId, originSubServiceId, originCategory } =
        useLocalSearchParams<{
            id: string;
            name?: string;
            price?: string;
            subName?: string;
            from?: string;
            entryMode?: string;
            originServiceId?: string;
            originSubServiceId?: string;
            originCategory?: string;
        }>();
    const router = useRouter();
    const qc = useQueryClient();
    const source = Array.isArray(from) ? from[0] : from;
    const isFromIndex = source === 'home' || source === 'index';

    const [step, setStep] = useState<Step | null>(null);
    const [selectedAddressId, setSelectedAddressId] = useState<string>('');
    const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');
    const todayYmd = useMemo(() => toLocalYMD(new Date()), []);
    const [scheduledDate, setScheduledDate] = useState(todayYmd);
    const [scheduledTime, setScheduledTime] = useState('');
    const [notes, setNotes] = useState('');
    const [paymentMethod, setPaymentMethod] = useState<'COD' | 'WALLET' | 'ONLINE' | null>(null);
    const [submittingOnline, setSubmittingOnline] = useState(false);
    const [isAsap, setIsAsap] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const submitting = useRef(false);

    // ── Back Handler (Android) ──
    React.useEffect(() => {
        if (Platform.OS === 'android') {
            const subscription = require('react-native').BackHandler.addEventListener(
                'hardwareBackPress',
                () => {
                    handleBack();
                    return true;
                }
            );
            return () => subscription.remove();
        }
    }, [step, source, originServiceId, originSubServiceId, entryMode]);

    const handleBack = () => {
        const idx = activeSteps.indexOf(step || 'info');
        if (idx > 0) {
            // Still inside the booking wizard — go to previous step
            setStep(activeSteps[idx - 1]);
            return;
        }

        // ── We are on the first step (info) — navigate back to origin ──

        // Priority 1: Restore full category drill-down context.
        // This handles: Home/Services → Category → Subcategory → Child → Detail
        // Back should return to the child-services list (level='child') inside the
        // services tab by passing originServiceId + originSubServiceId as params.
        if (originServiceId && originSubServiceId) {
            router.replace({
                pathname: '/services',
                params: {
                    serviceId: originServiceId,
                    subServiceId: originSubServiceId,
                    category: originCategory || '',
                    subCategory: subName || '',
                    from: isFromIndex ? source : 'services',
                },
            });
            return;
        }

        // Priority 2: Direct fast-track entries (ambulance, featured cards, emergency).
        // entryMode='direct' means we bypassed the category drill entirely.
        if (entryMode === 'direct') {
            if (isFromIndex) {
                // Direct from Home — go back to Home tab
                if (router.canGoBack()) {
                    router.back();
                } else {
                    router.replace('/');
                }
            } else {
                // Direct from Services tab root — go back to services list
                router.replace('/services');
            }
            return;
        }

        // Priority 3: Generic stack pop (handles most cases where stack is intact).
        if (router.canGoBack()) {
            router.back();
            return;
        }

        // Priority 4: Source-based fallback (no stack history available)
        if (isFromIndex) {
            router.replace('/');
        } else {
            router.replace('/services');
        }
    };

    const goToNextStep = () => {
        // Step Validation
        if (step === 'doctor' && !selectedDoctorId) {
            Alert.alert('Selection Required', 'Please select a healthcare expert to proceed.');
            return;
        }
        if (step === 'address' && !selectedAddressId) {
            Alert.alert('Location Required', 'Please select a service location.');
            return;
        }
        if (step === 'schedule') {
            if (!isAsap) {
                const errors: Record<string, boolean> = {};
                if (!scheduledDate) errors.date = true;
                if (!scheduledTime) errors.time = true;

                if (Object.keys(errors).length > 0) {
                    setFormErrors(errors);
                    Alert.alert('Schedule Required', 'Please choose both a date and a time slot.');
                    return;
                }
            }
        }
        if (step === 'payment' && !paymentMethod) {
            Alert.alert('Payment Method Required', 'Please choose a payment method.');
            return;
        }

        const idx = activeSteps.indexOf(step as any);
        if (idx < activeSteps.length - 1) setStep(activeSteps[idx + 1]);
    };

    const isScheduleReady = !!scheduledDate && !!scheduledTime;

    // Date generation for next 7 days (local timezone-safe)
    const dates = useMemo(() => Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() + i);
        return {
            full: toLocalYMD(d),
            dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
            dayNum: d.getDate(),
            month: d.toLocaleDateString('en-US', { month: 'short' })
        };
    }), []);

    // For today's date, hide elapsed slots based on current time
    const timeSlots = useMemo(() => {
        if (scheduledDate !== todayYmd) return SLOT_OPTIONS;
        const now = new Date();
        const nowMinutes = now.getHours() * 60 + now.getMinutes();
        return SLOT_OPTIONS.filter(slot => slotToMinutes(slot) > nowMinutes);
    }, [scheduledDate, todayYmd]);

    React.useEffect(() => {
        if (scheduledTime && !timeSlots.includes(scheduledTime)) {
            setScheduledTime('');
        }
    }, [scheduledDate, scheduledTime, timeSlots]);

    // New Address States (Matching Profile/Addresses)
    const [isAddingAddress, setIsAddingAddress] = useState(false);
    const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
    const [label, setLabel] = useState('Home');
    const [street, setStreet] = useState('');
    const [city, setCity] = useState('');
    const [state, setState] = useState('Telangana');
    const [pincode, setPincode] = useState('');
    const [landmark, setLandmark] = useState('');
    const [moreInfo, setMoreInfo] = useState('');
    const [formErrors, setFormErrors] = useState<Record<string, boolean>>({});
    const [isDetectingLocation, setIsDetectingLocation] = useState(false);
    const [isAutoDetectDone, setIsAutoDetectDone] = useState(false);
    const [locationCoords, setLocationCoords] = useState<{ lat: number; lng: number } | null>(null);

    const [addrDrafts, setAddrDrafts] = useState<Record<string, any>>({
        'Home': { street: '', city: '', state: 'Telangana', pincode: '', landmark: '', moreInfo: '' },
        'Work': { street: '', city: '', state: 'Telangana', pincode: '', landmark: '', moreInfo: '' },
        'Other': { street: '', city: '', state: 'Telangana', pincode: '', landmark: '', moreInfo: '' },
    });

    const sanitizeAddressText = (value: string) =>
        value.replace(/[^a-zA-Z0-9\s,./#()-]/g, '').replace(/\s{2,}/g, ' ').trimStart();

    const sanitizeAlphaText = (value: string) =>
        value.replace(/[^a-zA-Z\s]/g, '').replace(/\s{2,}/g, ' ').trimStart();

    const sanitizePincode = (value: string) => value.replace(/\D/g, '').slice(0, 6);
    const parseMoreInfo = (value: string) => {
        const raw = String(value || '').trim();
        if (!raw) return { landmark: '', moreInfo: '' };
        const [left, ...rest] = raw.split('|');
        const leftTrimmed = left?.trim() || '';
        const landmarkMatch = leftTrimmed.match(/^Landmark:\s*(.+)$/i);
        const landmark = landmarkMatch ? landmarkMatch[1].trim() : '';
        const moreInfo = (landmarkMatch ? rest.join('|') : raw).trim();
        return { landmark, moreInfo };
    };

    const getStreetValue = (addr: any) => {
        const direct = String(addr?.street || addr?.houseNo || addr?.address || addr?.addressLine1 || '').trim();
        if (direct) return direct;
        const parsed = parseMoreInfo(String(addr?.moreInfo || ''));
        return String(addr?.landmark || parsed.landmark || '').trim();
    };
    const getHouseNoFromStreet = (value: string) => {
        const firstChunk = String(value || '').split(',')[0]?.trim() || '';
        return firstChunk || undefined;
    };

    const getAddressIcon = (label: string) => {
        const l = label?.toUpperCase();
        if (l === 'HOME') return { icon: 'home-variant', color: '#1D4ED8', bg: '#DBEAFE' };
        if (l === 'WORK') return { icon: 'briefcase', color: '#047857', bg: '#D1FAE5' };
        return { icon: 'map-marker', color: '#B45309', bg: '#FEF3C7' };
    };

    const addAddressMutation = useMutation({
        mutationFn: async (data: any) => {
            const run = () => (editingAddressId ? addressService.update(editingAddressId, data) : addressService.add(data));
            if (editingAddressId) {
                // fall through to run()
            }
            try {
                return await run();
            } catch (err: any) {
                const isNetworkErr = !err?.response && (err?.message === 'Network Error' || err?.code === 'ECONNABORTED');
                if (isNetworkErr) {
                    // one quick retry for flaky mobile network
                    return await run();
                }
                throw err;
            }
        },
        onSuccess: (data) => {
            qc.invalidateQueries({ queryKey: ['addresses'] });
            setSelectedAddressId(data._id);
            setIsAddingAddress(false);
            setEditingAddressId(null);
            resetAddrForm();
        },
        onError: (error: any) => {
            const message =
                error?.response?.data?.message ||
                (error?.message === 'Network Error'
                    ? 'Unable to reach server. Please check internet and try again.'
                    : error?.message) ||
                'Failed to save address';
            Alert.alert('Error', message);
        }
    });

    const resetAddrForm = () => {
        setEditingAddressId(null);
        setLabel('Home');
        setStreet('');
        setCity('');
        setState('Telangana');
        setPincode('');
        setLandmark('');
        setMoreInfo('');
        setFormErrors({});
        setIsDetectingLocation(false);
        setIsAutoDetectDone(false);
        setLocationCoords(null);
        setAddrDrafts({
            'Home': { street: '', city: '', state: 'Telangana', pincode: '', landmark: '', moreInfo: '' },
            'Work': { street: '', city: '', state: 'Telangana', pincode: '', landmark: '', moreInfo: '' },
            'Other': { street: '', city: '', state: 'Telangana', pincode: '', landmark: '', moreInfo: '' },
        });
    };

    const deleteAddressMutation = useMutation({
        mutationFn: addressService.delete,
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['addresses'] });
            Alert.alert('Success', 'Address deleted successfully');
        },
    });

    const handleAutoDetectAddress = async () => {
        try {
            setIsDetectingLocation(true);
            setIsAutoDetectDone(false);

            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Location Permission Needed', 'Please allow location access to auto-fill your address.');
                return;
            }

            let position = await Location.getLastKnownPositionAsync({
                maxAge: 5 * 60 * 1000,
                requiredAccuracy: 500,
            });
            if (!position) {
                position = await withTimeout(
                    Location.getCurrentPositionAsync({
                        accuracy: Location.Accuracy.Balanced,
                        mayShowUserSettingsDialog: true,
                    }),
                    12000,
                    'Location detection timed out'
                );
            }

            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            setLocationCoords({ lat, lng });

            const geocoded = await withTimeout(
                Location.reverseGeocodeAsync({ latitude: lat, longitude: lng }),
                10000,
                'Address lookup timed out'
            );
            const geo = geocoded?.[0];
            if (!geo) return;

            const streetLine = [geo.name, geo.street].filter(Boolean).join(', ');
            const autoStreet = streetLine || geo.district || geo.subregion || '';
            const autoCity = geo.city || geo.subregion || geo.district || '';
            const autoState = geo.region || '';
            const autoPincode = sanitizePincode(geo.postalCode || '');
            const autoLandmark = geo.name || geo.district || '';

            if (autoStreet) setStreet(sanitizeAddressText(autoStreet));
            if (autoCity) setCity(sanitizeAlphaText(autoCity));
            if (autoState) setState(sanitizeAlphaText(autoState));
            if (autoPincode) setPincode(autoPincode);
            if (autoLandmark) setLandmark(sanitizeAddressText(autoLandmark));
            setIsAutoDetectDone(true);
        } catch (error: any) {
            setIsAutoDetectDone(false);
            Alert.alert('Auto Detect Failed', error?.message || 'Could not detect your location right now.');
        } finally {
            setIsDetectingLocation(false);
        }
    };

    const handleAddAddress = () => {
        const trimmedStreet = street.trim();
        const trimmedCity = city.trim();
        const trimmedState = state.trim();
        const trimmedPincode = pincode.trim();
        const trimmedLandmark = landmark.trim();
        const trimmedMoreInfo = moreInfo.trim();

        const errors: Record<string, boolean> = {};
        if (!trimmedStreet) errors.street = true;
        if (!trimmedCity) errors.city = true;
        if (!trimmedState) errors.state = true;
        if (!trimmedPincode || trimmedPincode.length !== 6) errors.pincode = true;

        if (Object.keys(errors).length > 0) {
            setFormErrors(errors);
            Alert.alert('Required Fields', 'Please fill all mandatory fields with valid data.');
            return;
        }

        setFormErrors({});

        const backendLabel = label === 'Other' ? 'OTHERS' : label.toUpperCase();

        const resolvedHouseNo = getHouseNoFromStreet(trimmedStreet);
        addAddressMutation.mutate({
            label: backendLabel,
            state: trimmedState,
            city: trimmedCity,
            pincode: trimmedPincode,
            street: trimmedStreet,
            address: trimmedStreet,
            addressLine1: trimmedStreet,
            houseNo: resolvedHouseNo,
            landmark: trimmedLandmark,
            moreInfo: `${trimmedLandmark ? `Landmark: ${trimmedLandmark} | ` : ''}${trimmedMoreInfo}`,
            location: {
                lat: locationCoords?.lat ?? 17.3850,
                lng: locationCoords?.lng ?? 78.4867
            }
        });
    };

    const handleEditAddress = (addr: any) => {
        setEditingAddressId(addr._id);
        const l = addr.label === 'OTHERS' ? 'Other' : (addr.label.charAt(0) + addr.label.slice(1).toLowerCase());
        setLabel(l);
        const resolvedStreet = getStreetValue(addr);
        setStreet(resolvedStreet);
        setCity(addr.city || '');
        setState(addr.state || 'Telangana');
        setPincode(addr.pincode || '');
        const parsed = parseMoreInfo(String(addr.moreInfo || ''));
        setLandmark(addr.landmark || parsed.landmark || '');
        setMoreInfo(parsed.moreInfo);
        if (addr.location?.lat && addr.location?.lng) {
            setLocationCoords({ lat: Number(addr.location.lat), lng: Number(addr.location.lng) });
        } else {
            setLocationCoords(null);
        }
        setIsAutoDetectDone(false);
        setIsAddingAddress(true);
    };


    const { data: addresses, isLoading: addrLoading, isError: addrErr, refetch: refetchAddr } = useQuery({
        queryKey: ['addresses'],
        queryFn: addressService.getAll,
    });

    const { data: wallet } = useQuery({
        queryKey: ['wallet'],
        queryFn: walletService.getWallet,
    });

    const { data: service, isLoading: serviceLoading } = useQuery({
        queryKey: ['child-service', id],
        queryFn: () => servicesService.getChildServiceById(id!),
        enabled: !!id,
    });

    const isDoctorService = React.useMemo(() => {
        const name = `${service?.name ?? ''} ${nameParam ?? ''} ${subName ?? ''}`.toLowerCase();
        return /doctor|consult|specialist|cardiologist|neurologist|orthopedic|physician/.test(name);
    }, [service?.name, nameParam, subName]);

    const { data: staff } = useQuery({
        queryKey: ['staff-for-service', id, nameParam, subName, service?.name],
        queryFn: async () => {
            let rolesToFetch = Array.isArray(service?.allowedRoleIds)
                ? service.allowedRoleIds.filter((rid: any) => typeof rid === 'string' && /^[a-f\d]{24}$/i.test(rid))
                : [];

            if (!rolesToFetch.length) {
                const roles = await doctorsService.getRoles();
                const doctorRoleIds = (roles || [])
                    .filter((role: any) => /doctor|expert|physician/i.test(`${role?.name ?? ''} ${role?.slug ?? ''}`))
                    .map((role: any) => role?._id)
                    .filter((rid: any) => typeof rid === 'string' && /^[a-f\d]{24}$/i.test(rid));
                rolesToFetch = doctorRoleIds;
            }

            if (!rolesToFetch.length) return [];

            const rawCandidates = [subName, service?.name, nameParam]
                .map(v => String(v || '').trim())
                .filter(Boolean);

            const genericTerms = [
                'doctor',
                'doctors',
                'consult',
                'consultation',
                'doctor consult',
                'expert',
                'service',
                'services',
                'healthcare',
                'medical',
            ];

            const specializationCandidates = Array.from(
                new Set(
                    rawCandidates.filter((value) => {
                        const low = value.toLowerCase();
                        return !genericTerms.some((term) => low === term || low.includes(term));
                    })
                )
            );

            const shouldFilterBySpecialization = isDoctorService && specializationCandidates.length > 0;

            const allStaff = await Promise.all(
                rolesToFetch.map(async (rid: string) => {
                    // Always try to filter by specialization if we have candidates
                    if (specializationCandidates.length > 0) {
                        const variantLists = await Promise.all(
                            specializationCandidates.map((candidate) => doctorsService.getByRole(rid, candidate))
                        );
                        return variantLists.flat();
                    }
                    // Fallback only if no specialization is specified
                    return doctorsService.getByRole(rid);
                })
            );

            const merged = allStaff.flat();
            const deduped = Array.from(
                new Map(merged.map((doc: any) => [String(doc?._id || ''), doc])).values()
            ).filter((doc: any) => !!doc?._id);

            // If we have specific specialties we're looking for, apply a strict final filter
            if (specializationCandidates.length > 0) {
                const normalize = (v: string) =>
                    v.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

                const tokenAliases: Record<string, string[]> = {
                    cardiologist: ['cardiologist', 'cardiology', 'cardiac', 'heart specialist'],
                    pulmonologist: ['pulmonologist', 'pulmonology', 'chest specialist'],
                    neurologist: ['neurologist', 'neurology'],
                    dermatologist: ['dermatologist', 'dermatology', 'skin specialist'],
                    orthopedist: ['orthopedist', 'orthopedic', 'orthopaedic', 'ortho'],
                    'general physician': ['general physician', 'physician', 'general medicine'],
                };

                const tokens = specializationCandidates.flatMap((v) => {
                    const n = normalize(v);
                    const alias = tokenAliases[n];
                    return alias ? alias.map(normalize) : [n];
                });

                return deduped.filter((doc: any) => {
                    const specs = Array.isArray(doc?.specialization)
                        ? doc.specialization.map((s: any) => normalize(String(s || '')))
                        : [];
                    return specs.some((sp: string) =>
                        tokens.some((token: string) => sp === token || sp.includes(token) || token.includes(sp))
                    );
                });
            }

            return deduped;
        },
        enabled: !!service && (service.selectionType !== 'ASSIGN' || isDoctorService),
    });

    const activeSteps: Step[] = React.useMemo(() => {
        if (!service) return [];
        const steps: Step[] = ['info'];
        if (service.selectionType !== 'ASSIGN' || isDoctorService) steps.push('doctor');
        const isHospital = service.fulfillmentMode === 'HOSPITAL_VISIT' || (subName && /hospital/i.test(subName));
        const isVirtual = service.fulfillmentMode === 'VIRTUAL' || (subName && /virtual|online/i.test(subName));
        if (!isHospital && !isVirtual) steps.push('address');
        steps.push('schedule', 'payment', 'confirm');
        return steps;
    }, [service, subName, isDoctorService]);



    React.useEffect(() => {
        if (service && !step && activeSteps.length > 0) {
            setStep(activeSteps[0]);
            const isHosp = service.fulfillmentMode === 'HOSPITAL_VISIT' || (subName && /hospital/i.test(subName));
            if (isHosp) {
                setIsAsap(false);
                setScheduledDate(new Date().toISOString().split('T')[0]);
            }
        }
    }, [service, step, activeSteps, subName]);

    const buildScheduledTime = () => {
        if (isAsap) return new Date().toISOString();
        if (scheduledDate && scheduledTime) {
            try {
                const [time, modifier] = scheduledTime.split(' ');
                let [hours, minutes] = time.split(':').map(Number);
                if (Number.isNaN(hours) || Number.isNaN(minutes)) return undefined;
                if (modifier === 'PM' && hours !== 12) hours += 12;
                if (modifier === 'AM' && hours === 12) hours = 0;

                const [year, month, day] = scheduledDate.split('-').map(Number);
                if ([year, month, day].some(Number.isNaN)) return undefined;

                // Build from local wall-clock time, then serialize to ISO UTC.
                // This prevents timezone shifts like showing 09:00 slot as 14:30 in details.
                const localDate = new Date(year, month - 1, day, hours, minutes, 0, 0);
                return localDate.toISOString();
            } catch (e) { return undefined; }
        }
        return undefined;
    };

    const getDisplaySchedule = () => {
        if (isAsap) return '⚡ ASAP (Fastest)';
        if (scheduledDate && scheduledTime) return `${scheduledDate} at ${scheduledTime}`;
        return 'Not scheduled';
    };

    const bookMutation = useMutation({
        mutationFn: () => {
            if (submitting.current) throw new Error('Already submitting');
            submitting.current = true;
            const addr = addresses?.find((a) => a._id === selectedAddressId);
            const isHosp = service?.fulfillmentMode === 'HOSPITAL_VISIT' || (subName && /hospital/i.test(subName));

            if (isDoctorService) {
                if (!selectedDoctorId) {
                    throw new Error('Please select a doctor to continue');
                }
                const now = new Date();
                const fallbackStart = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
                const end = new Date(now.getTime() + 30 * 60 * 1000);
                const fallbackEnd = `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`;
                const startTime = isAsap ? fallbackStart : (displaySlotTo24Hour(scheduledTime) || fallbackStart);
                const endTime = isAsap ? fallbackEnd : (displaySlotTo24Hour(scheduledTime) || fallbackEnd);

                return bookingsService.bookDoctor(selectedDoctorId, {
                    date: scheduledDate || todayYmd,
                    startingTime: startTime,
                    endingTime: endTime,
                    totalAmount: priceParam ? parseFloat(priceParam) : 0,
                    paymentMode: paymentMethod === 'COD'
                        ? 'OFFLINE'
                        : paymentMethod === 'WALLET'
                            ? 'WALLET'
                            : 'ONLINE',
                    isGatewayPayment: paymentMethod === 'ONLINE',
                });
            }

            return bookingsService.createServiceBooking({
                childServiceId: id!,
                addressId: isHosp ? undefined : addr?._id,
                assignedProviderId: selectedDoctorId || undefined,
                scheduledTime: buildScheduledTime(),
                bookingType: isAsap ? 'ON_DEMAND' : 'SCHEDULED',
                fulfillmentMode: (service?.fulfillmentMode) ?? (isHosp ? 'HOSPITAL_VISIT' : 'HOME_VISIT'),
                price: priceParam ? parseFloat(priceParam) : 0,
                paymentMode: paymentMethod === 'COD' ? 'OFFLINE' : paymentMethod === 'WALLET' ? 'WALLET' : 'ONLINE',
            });
        },
        onSuccess: (booking: any) => {
            submitting.current = false;
            qc.invalidateQueries({ queryKey: ['service-bookings'] });
            qc.invalidateQueries({ queryKey: ['service-bookings-all'] });
            if (isDoctorService) {
                qc.invalidateQueries({ queryKey: ['appointments'] });
                const doctorStatus = String(booking?.status || '').toLowerCase();
                if (doctorStatus === 'confirmed' || doctorStatus === 'completed') {
                    triggerLocalNotification('Doctor Appointment Confirmed', `Your ${serviceName} appointment is confirmed.`);
                } else {
                    triggerLocalNotification('Doctor Appointment Requested', `Your ${serviceName} appointment request has been submitted.`);
                }
                if (booking?._id) {
                    router.replace({ pathname: '/doctor/appointment/[id]', params: { id: booking._id } });
                    return;
                }
            } else {
                const serviceStatus = String(booking?.status || '').toUpperCase();
                if (serviceStatus === 'ACCEPTED' || serviceStatus === 'IN_PROGRESS' || serviceStatus === 'COMPLETED' || serviceStatus === 'CONFIRMED') {
                    triggerLocalNotification('Service Booking Confirmed', `Your ${serviceName} booking is confirmed.`);
                } else {
                    triggerLocalNotification('Service Booking Placed', `Your ${serviceName} request has been submitted. We are finding a provider.`);
                }
            }
            if (paymentMethod !== 'ONLINE') setSubmitted(true);
        },
        onError: (err: any) => {
            submitting.current = false;
            Alert.alert('Booking Failed', err?.response?.data?.message || err?.message || 'Booking failed');
        },
    });

    const handleFinalSubmit = async () => {
        if (!isAsap && (!scheduledDate || !scheduledTime)) {
            Alert.alert('Incomplete Schedule', 'Please go back and select a valid date and time.');
            return;
        }

        if (paymentMethod === 'ONLINE') {
            try {
                setSubmittingOnline(true);
                const booking = await bookMutation.mutateAsync();
                const order = await paymentService.createOrder({
                    amount: priceParam ? parseFloat(priceParam) : 0,
                    type: "BOOKING",
                    referenceId: booking._id
                });
                const razorData = await paymentService.initiateRazorpay(order._id);
                const options = {
                    key: razorData.key,
                    amount: razorData.razorOrder.amount,
                    currency: 'INR',
                    name: 'A1Care 24/7',
                    description: `Payment for Order #${order.txnId}`,
                    order_id: razorData.razorOrder.id,
                    prefill: {
                        email: razorData.customer.email || '',
                        contact: razorData.customer.contact || '',
                        name: razorData.customer.name || ''
                    },
                    theme: { color: Colors.primary }
                };
                const data = await RazorpayCheckout.open(options);
                await paymentService.verifyRazorpay({
                    razorpay_order_id: data.razorpay_order_id,
                    razorpay_payment_id: data.razorpay_payment_id,
                    razorpay_signature: data.razorpay_signature,
                    orderId: order._id
                });
                if (isDoctorService && booking?._id) {
                    router.replace({ pathname: '/doctor/appointment/[id]', params: { id: booking._id } });
                    return;
                }
                setSubmitted(true);
            } catch (err: any) {
                if (err.code !== 2) Alert.alert("Payment Error", err?.description || "Payment failed.");
            } finally {
                setSubmittingOnline(false);
            }
        } else {
            bookMutation.mutate();
        }
    };

    const serviceName = nameParam ?? `Service`;

    if (submitted) {
        return (
            <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
                <View style={styles.successContainer}>
                    <View style={styles.successIconBg}><Text style={{ fontSize: 52 }}>✅</Text></View>
                    <Text style={styles.successTitle}>Booking Confirmed!</Text>
                    <Text style={styles.successSub}>
                        {service?.fulfillmentMode === 'HOSPITAL_VISIT' ? 'Your appointment at A1care Hospital has been scheduled.' : 'Your home-care request has been placed.'}
                    </Text>
                    <View style={styles.codConfirmBox}>
                        {/* <Text style={styles.codConfirmIcon}>{paymentMethod === 'WALLET' ? '👛' : paymentMethod === 'ONLINE' ? '💳' : '💵'}</Text> */}
                        <View>
                            <Text style={styles.codConfirmTitle}>{paymentMethod === 'WALLET' ? 'Paid via Wallet' : paymentMethod === 'ONLINE' ? 'Online Paid' : 'Cash on Pay'}</Text>
                            <Text style={styles.codConfirmSub}>Thank you for choosing A1Care</Text>
                        </View>
                    </View>
                    <Button label="Track My Booking" onPress={() => router.push('/(tabs)/bookings')} variant="primary" style={{ marginBottom: 12 }} fullWidth />
                    <Button label="Back to Home" onPress={() => router.push('/(tabs)')} variant="outline" fullWidth />
                </View>
            </SafeAreaView>
        );
    }

    if (serviceLoading || addrLoading || !step) {
        return (
            <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                    <Text style={{ marginTop: 12, color: Colors.muted }}>Preparing Booking Desk...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.root} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle} numberOfLines={1}>{serviceName}</Text>
                <View style={{ width: 36 }} />
            </View>

            <View style={styles.stepWrap}><StepIndicator current={step} activeSteps={activeSteps} /></View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
                {step === 'info' && service && (
                    <View style={styles.stepContent}>
                        <View style={styles.heroSection}>
                            <View style={styles.heroIconBg}><Text style={{ fontSize: 42 }}>⚕️</Text></View>
                            <Text style={styles.heroTitle}>{service.name}</Text>
                            <Text style={styles.heroDesc}>{service.description || 'Professional health services.'}</Text>
                        </View>
                        <View style={styles.infoGrid}>
                            <View style={styles.infoItem}><Text style={styles.infoLabel}>CATEGORY</Text><Text style={styles.infoValue}>{subName || 'Health'}</Text></View>
                            <View style={styles.infoItem}><Text style={styles.infoLabel}>PRICE</Text><Text style={styles.infoValue}>{formatCurrency(priceParam ? parseFloat(priceParam) : 0)}</Text></View>
                        </View>
                    </View>
                )}

                {step === 'doctor' && (
                    <View style={styles.stepContent}>
                        <Text style={styles.stepTitle}>👨‍⚕️ Choose Expert</Text>
                        <View style={{ gap: 12 }}>
                            {(staff ?? []).map((doc: any) => (
                                <TouchableOpacity key={doc._id} onPress={() => setSelectedDoctorId(doc._id)} style={[styles.addressCard, selectedDoctorId === doc._id && styles.addressCardActive]}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ fontWeight: '700', fontSize: 16 }}>{doc.name}</Text>
                                        <Text style={{ color: Colors.textSecondary }}>
                                            {(() => {
                                                const searchTerms = [subName, service?.name, nameParam].map(v => String(v || '').toLowerCase());
                                                const matched = (doc.specialization || []).find((s: string) => 
                                                    searchTerms.some(term => s.toLowerCase().includes(term) || term.includes(s.toLowerCase()))
                                                );
                                                return matched || doc.specialization?.[0] || 'Medical Expert';
                                            })()}
                                        </Text>
                                    </View>
                                    {selectedDoctorId === doc._id && <Ionicons name="checkmark-circle" size={24} color={Colors.health} />}
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                )}

                {step === 'address' && (
                    <View style={styles.stepContent}>
                        <Text style={styles.stepTitle}>📍 Service Location</Text>
                        {addresses?.map(a => {
                            const config = getAddressIcon(a.label || 'Home');
                            const isActive = selectedAddressId === a._id;
                            return (
                                <TouchableOpacity
                                    key={a._id}
                                    onPress={() => setSelectedAddressId(a._id)}
                                    style={[styles.addressCard, isActive && styles.addressCardActive]}
                                >
                                    <View style={[styles.iconBox, { backgroundColor: config.bg }]}>
                                        <MaterialCommunityIcons name={config.icon as any} size={24} color={config.color} />
                                    </View>
                                    <View style={{ flex: 1, marginLeft: 12 }}>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <Text style={styles.addrLabel}>{a.label}</Text>
                                            <View style={{ flexDirection: 'row', gap: 12 }}>
                                                <TouchableOpacity onPress={() => handleEditAddress(a)}>
                                                    <Ionicons name="pencil" size={16} color={Colors.primary} />
                                                </TouchableOpacity>
                                                <TouchableOpacity onPress={() => {
                                                    if (a._id) {
                                                        Alert.alert('Delete Address', 'Are you sure?', [
                                                            { text: 'Cancel', style: 'cancel' },
                                                            { text: 'Delete', style: 'destructive', onPress: () => deleteAddressMutation.mutate(a._id!) }
                                                        ]);
                                                    }
                                                }}>
                                                    <Ionicons name="trash" size={16} color="#EF4444" />
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                        <Text style={styles.addrStreet} numberOfLines={2}>{getStreetValue(a)}</Text>
                                        <Text style={styles.addrCity}>{a.city}, {a.pincode}</Text>
                                    </View>
                                    <View style={[styles.radioOuter, isActive && styles.radioActive, { marginTop: 4 }]}>
                                        {isActive && <View style={styles.radioInner} />}
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                        <TouchableOpacity
                            style={styles.addAddrMiniBtn}
                            onPress={() => {
                                resetAddrForm();
                                setIsAddingAddress(true);
                            }}
                        >
                            <Text style={styles.addAddrMiniText}>+ Add New Address</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {step === 'schedule' && (
                    <View style={styles.stepContent}>
                        <Text style={styles.stepTitle}>⏰ Select Schedule</Text>
                        <TouchableOpacity
                            style={[styles.asapToggle, isAsap && styles.asapToggleActive]}
                            onPress={() => {
                                setIsAsap(true);
                                setFormErrors({});
                                // Avoid relying on async state update in goToNextStep validation.
                                const idx = activeSteps.indexOf('schedule');
                                if (idx >= 0 && idx < activeSteps.length - 1) {
                                    setStep(activeSteps[idx + 1]);
                                }
                            }}
                        >
                            <Text style={[styles.asapToggleTitle, isAsap && { color: '#fff' }]}>⚡ ASAP (Fastest)</Text>
                        </TouchableOpacity>
                        <Text style={styles.fieldLabel}>Or Choose Date <Text style={{ color: '#EF4444' }}>*</Text></Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dateScroll}>
                            {dates.map(d => (
                                <TouchableOpacity key={d.full} onPress={() => { setIsAsap(false); setScheduledDate(d.full); }} style={[styles.dateChip, !isAsap && scheduledDate === d.full && styles.dateChipActive]}>
                                    <Text style={[styles.dateChipDay, !isAsap && scheduledDate === d.full && { color: '#fff' }]}>{d.dayName}</Text>
                                    <Text style={[styles.dateChipNum, !isAsap && scheduledDate === d.full && { color: '#fff' }]}>{d.dayNum}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                        {!isAsap && (
                            <>
                                <Text style={styles.fieldLabel}>Select Time Slot <Text style={{ color: '#EF4444' }}>*</Text></Text>
                                <View style={styles.timeGrid}>
                                    {timeSlots.map(t => (
                                        <TouchableOpacity key={t} onPress={() => setScheduledTime(t)} style={[styles.timeChip, scheduledTime === t && styles.timeChipActive]}>
                                            <Text style={[styles.timeChipText, scheduledTime === t && { color: '#fff' }]}>{t}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                                {timeSlots.length === 0 && (
                                    <Text style={styles.asapText}>No slots remaining today. Please pick another date.</Text>
                                )}
                            </>
                        )}
                    </View>
                )}

                {step === 'payment' && (
                    <View style={styles.stepContent}>
                        <Text style={styles.stepTitle}>Choose Payment Method</Text>
                        <View style={{ gap: 12 }}>
                            {[
                                { id: 'WALLET', label: 'A1 Wallet', sub: `Balance: ${formatCurrency(wallet?.balance ?? 0)}`, icon: 'wallet-outline', color: Colors.health },
                                { id: 'ONLINE', label: 'Online Payment', sub: 'UPI, Cards, Netbanking', icon: 'card-outline', color: Colors.primary },
                                { id: 'COD', label: 'Cash on Pay', sub: 'Pay after service', icon: 'cash-outline', color: '#166534' },
                            ].map(opt => (
                                <TouchableOpacity key={opt.id} onPress={() => setPaymentMethod(opt.id as any)} style={[styles.payMethodCard, paymentMethod === opt.id && { borderColor: opt.color, borderWidth: 2.5 }]}>
                                    <Ionicons name={opt.icon as any} size={24} color={paymentMethod === opt.id ? opt.color : Colors.textSecondary} />
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.payMethodTitle}>{opt.label}</Text>
                                        <Text style={styles.payMethodSub}>{opt.sub}</Text>
                                    </View>
                                    <View style={[styles.radioOuter, paymentMethod === opt.id && { borderColor: opt.color }]}>{paymentMethod === opt.id && <View style={[styles.radioInner, { backgroundColor: opt.color }]} />}</View>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                )}

                {step === 'confirm' && (
                    <View style={styles.stepContent}>
                        <Text style={styles.stepTitle}> Review Booking</Text>
                        <View style={styles.reviewCard}>
                            {[
                                { label: 'Service', value: serviceName },
                                { label: 'Schedule', value: getDisplaySchedule() },
                                { label: 'Payment', value: paymentMethod },
                                { label: 'Price', value: formatCurrency(priceParam ? parseFloat(priceParam) : 0) },
                            ].map(r => (
                                <View key={r.label} style={styles.reviewRow}><Text style={styles.reviewLabel}>{r.label}</Text><Text style={styles.reviewValue}>{r.value}</Text></View>
                            ))}
                        </View>
                    </View>
                )}
                <View style={{ height: 120 }} />
            </ScrollView>

            <View style={styles.footer}>
                <Button
                    label={step === 'confirm' ? 'Confirm Booking' : 'Continue →'}
                    onPress={() => {
                        if (step === 'confirm') handleFinalSubmit();
                        else goToNextStep();
                    }}
                    loading={bookMutation.isPending || submittingOnline}
                    fullWidth
                    size="lg"
                />
            </View>

            {/* ── Add/Edit Address Modal ── */}
            <Modal
                visible={isAddingAddress}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setIsAddingAddress(false)}
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.modalOverlay}
                >
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{editingAddressId ? 'Update Address' : 'Add New Address'}</Text>
                            <TouchableOpacity onPress={() => setIsAddingAddress(false)}>
                                <Ionicons name="close" size={24} color="#64748B" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            <Text style={styles.modalInputLabel}>Address Label</Text>
                            <View style={styles.labelChips}>
                                {['Home', 'Work', 'Other'].map((l) => {
                                    const config = getAddressIcon(l);
                                    const isActive = label === l;
                                    return (
                                        <TouchableOpacity
                                            key={l}
                                            style={[
                                                styles.chip,
                                                isActive && { backgroundColor: config.bg, borderColor: config.color }
                                            ]}
                                            onPress={() => {
                                                if (editingAddressId) {
                                                    setLabel(l);
                                                } else {
                                                    // Save current inputs to draft of the OLD label
                                                    setAddrDrafts(prev => ({
                                                        ...prev,
                                                        [label]: { street, city, state, pincode, landmark, moreInfo }
                                                    }));
                                                    // Load inputs from draft of the NEW label
                                                    const d = addrDrafts[l] || { street: '', city: '', state: 'Telangana', pincode: '', landmark: '', moreInfo: '' };
                                                    setLabel(l);
                                                    setStreet(d.street);
                                                    setCity(d.city);
                                                    setState(d.state);
                                                    setPincode(d.pincode);
                                                    setLandmark(d.landmark);
                                                    setMoreInfo(d.moreInfo);
                                                }
                                            }}
                                        >
                                            <View style={styles.chipIconWrap}>
                                                <MaterialCommunityIcons
                                                    name={config.icon as any}
                                                    size={16}
                                                    color={isActive ? config.color : '#64748B'}
                                                    style={styles.chipIcon}
                                                />
                                            </View>
                                            <Text style={[
                                                styles.chipText,
                                                isActive && { color: config.color }
                                            ]}>{l}</Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            <Text style={styles.modalInputLabel}>House No / Street / Area <Text style={{ color: '#EF4444' }}>* Required</Text></Text>
                            <View style={styles.modalInputWrap}>
                                <TextInput
                                    style={[styles.modalInput, styles.modalInputWithAction, formErrors.street && styles.modalInputError]}
                                    value={street}
                                    onChangeText={(v) => {
                                        setStreet(sanitizeAddressText(v));
                                        if (formErrors.street) setFormErrors(prev => ({ ...prev, street: false }));
                                    }}
                                    placeholder="e.g. Flat 101, Sunny Enclave"
                                />
                                <TouchableOpacity
                                    style={styles.detectInlineBtn}
                                    onPress={handleAutoDetectAddress}
                                    disabled={isDetectingLocation}
                                >
                                    {isDetectingLocation ? (
                                        <ActivityIndicator size="small" color={Colors.primary} />
                                    ) : isAutoDetectDone ? (
                                        <Ionicons name="checkmark-circle" size={20} color="#16A34A" />
                                    ) : (
                                        <Ionicons name="locate-outline" size={20} color={Colors.primary} />
                                    )}
                                </TouchableOpacity>
                            </View>

                            <View style={{ flexDirection: 'row', gap: 12 }}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.modalInputLabel}>City <Text style={{ color: '#EF4444' }}>*</Text></Text>
                                    <TextInput
                                        style={[styles.modalInput, formErrors.city && styles.modalInputError]}
                                        value={city}
                                        onChangeText={(v) => {
                                            setCity(sanitizeAlphaText(v));
                                            if (formErrors.city) setFormErrors(prev => ({ ...prev, city: false }));
                                        }}
                                        placeholder="Enter City"
                                    />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.modalInputLabel}>State <Text style={{ color: '#EF4444' }}>*</Text></Text>
                                    <TextInput
                                        style={[styles.modalInput, formErrors.state && styles.modalInputError]}
                                        value={state}
                                        onChangeText={(v) => {
                                            setState(sanitizeAlphaText(v));
                                            if (formErrors.state) setFormErrors(prev => ({ ...prev, state: false }));
                                        }}
                                        placeholder="Enter State"
                                    />
                                </View>
                            </View>

                            <View style={{ flexDirection: 'row', gap: 12 }}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.modalInputLabel}>Pincode <Text style={{ color: '#EF4444' }}>*</Text></Text>
                                    <TextInput
                                        style={[styles.modalInput, formErrors.pincode && styles.modalInputError]}
                                        value={pincode}
                                        onChangeText={(v) => {
                                            setPincode(sanitizePincode(v));
                                            if (formErrors.pincode) setFormErrors(prev => ({ ...prev, pincode: false }));
                                        }}
                                        placeholder="6-digit ZIP"
                                        keyboardType="numeric"
                                        maxLength={6}
                                    />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.modalInputLabel}>Landmark</Text>
                                    <TextInput
                                        style={styles.modalInput}
                                        value={landmark}
                                        onChangeText={(v) => setLandmark(sanitizeAddressText(v))}
                                        placeholder="Near..."
                                    />
                                </View>
                            </View>

                            <Text style={styles.modalInputLabel}>Other Info (Floor/Building/etc)</Text>
                            <TextInput
                                style={styles.modalInput}
                                value={moreInfo}
                                onChangeText={(v) => setMoreInfo(sanitizeAddressText(v))}
                                placeholder="Optional details"
                            />

                            <TouchableOpacity
                                style={styles.saveAddrBtn}
                                onPress={handleAddAddress}
                                disabled={addAddressMutation.isPending}
                            >
                                {addAddressMutation.isPending ? (
                                    <ActivityIndicator color="#FFF" />
                                ) : (
                                    <Text style={styles.saveAddrBtnText}>
                                        {editingAddressId ? 'Update Changes' : 'Save Address'}
                                    </Text>
                                )}
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </SafeAreaView>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: Colors.background },

    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 14,
        backgroundColor: Colors.card,
        ...Shadows.card,
    },
    backBtn: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: Colors.background,
        justifyContent: 'center',
        alignItems: 'center',
    },
    backText: { fontSize: 20, color: Colors.textPrimary },
    headerTitle: {
        flex: 1,
        fontSize: FontSize.lg,
        fontWeight: '700',
        color: Colors.textPrimary,
        textAlign: 'center',
    },

    // Step indicator
    stepWrap: {
        backgroundColor: Colors.card,
        paddingHorizontal: 16,
        paddingBottom: 16,
        paddingTop: 8,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    stepRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    stepItem: { alignItems: 'center', gap: 4 },
    stepDot: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: Colors.border,
        justifyContent: 'center',
        alignItems: 'center',
    },
    stepDotActive: { backgroundColor: Colors.primary },
    stepDotDone: { backgroundColor: Colors.health },
    stepDotNum: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary },
    stepDotNumActive: { color: '#fff' },
    stepDotCheckmark: { fontSize: 12, fontWeight: '700', color: '#fff' },
    stepLabel: { fontSize: 9, color: Colors.textSecondary, fontWeight: '600' },
    stepLabelActive: { color: Colors.primary },
    stepLine: { flex: 1, height: 2, backgroundColor: Colors.border, marginTop: -14 },
    stepLineDone: { backgroundColor: Colors.health },

    scroll: { paddingBottom: 120 },
    stepContent: { padding: 16, paddingTop: 20 },
    stepTitle: {
        fontSize: FontSize['2xl'],
        fontWeight: '700',
        color: Colors.textPrimary,
        marginBottom: 6,
    },
    stepSubtitle: {
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
        lineHeight: 20,
        marginBottom: 20,
    },
    backHomeBtn: {
        backgroundColor: '#FFFFFF',
        borderColor: '#D9E5F3',
        borderWidth: 1.5,
        borderRadius: 18,
        minHeight: 56,
        ...Shadows.card,
        shadowOpacity: 0.05,
    },
    backHomeBtnText: {
        color: Colors.textPrimary,
        fontWeight: '800',
        fontSize: FontSize.base,
    },

    // Address
    addressCard: {
        backgroundColor: Colors.card,
        borderRadius: 14,
        padding: 14,
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
        marginBottom: 10,
        borderWidth: 1.5,
        borderColor: Colors.border,
        ...Shadows.card,
    },
    addressCardActive: { borderColor: Colors.primary, borderWidth: 2.5 },
    iconBox: {
        width: 52,
        height: 52,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
    },
    radioOuter: {
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 2,
        borderColor: Colors.border,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 1,
    },
    radioActive: { borderColor: Colors.primary },
    radioInner: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: Colors.primary,
    },
    addrLabel: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.primary, marginBottom: 2 },
    addrStreet: { fontSize: FontSize.base, color: Colors.textPrimary, fontWeight: '500', lineHeight: 22 },
    addrCity: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
    primaryBadge: {
        backgroundColor: Colors.primaryLight,
        borderRadius: 20,
        paddingHorizontal: 8,
        paddingVertical: 4,
        alignSelf: 'flex-start',
    },
    primaryBadgeText: { fontSize: 10, fontWeight: '700', color: Colors.primary },

    addrActions: {
        flexDirection: 'row',
        gap: 8,
        marginLeft: 10,
    },
    addrActionBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#F8FAFC',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },

    addAddrMiniBtn: {
        paddingVertical: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: Colors.primary,
        borderStyle: 'dashed',
        borderRadius: 12,
        marginTop: 8,
    },
    addAddrMiniText: {
        fontSize: FontSize.sm,
        color: Colors.primary,
        fontWeight: '700',
    },
    addAddrForm: {
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 16,
        marginTop: 10,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    formTitle: {
        fontSize: FontSize.base,
        fontWeight: '800',
        color: Colors.textPrimary,
        marginBottom: 16,
    },
    errorText: {
        fontSize: 10,
        color: '#EF4444',
        marginTop: 4,
        fontWeight: '700',
    },
    labelChips: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 8,
        marginBottom: 16,
    },
    labelChip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#F1F5F9',
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
    },
    labelChipActive: {
        backgroundColor: Colors.primaryLight,
        borderColor: Colors.primary,
    },
    labelChipText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#64748B',
    },
    labelChipTextActive: {
        color: Colors.primary,
    },

    noAddrBox: {
        alignItems: 'center',
        paddingVertical: 32,
        gap: 8,
    },
    noAddrIcon: { fontSize: 44 },
    noAddrTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary },
    noAddrSub: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },

    // Fields
    fieldLabel: {
        fontSize: FontSize.sm,
        fontWeight: '700',
        color: Colors.textPrimary,
        marginBottom: 8,
        marginTop: 4,
    },
    input: {
        backgroundColor: Colors.card,
        borderRadius: 14,
        paddingHorizontal: 16,
        paddingVertical: 13,
        fontSize: FontSize.base,
        color: Colors.textPrimary,
        borderWidth: 1.5,
        borderColor: Colors.border,
        marginBottom: 14,
        ...Shadows.card,
    },
    inputMultiline: { height: 90, textAlignVertical: 'top', paddingTop: 13 },

    asapInfo: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
        backgroundColor: '#F0F7FF',
        borderRadius: 12,
        padding: 12,
        marginTop: 4,
    },
    asapToggle: {
        backgroundColor: '#F8FAFC',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
        marginTop: 12,
    },
    asapToggleActive: {
        backgroundColor: Colors.primary,
        borderColor: Colors.primary,
    },
    asapToggleHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 4,
    },
    asapToggleTitle: {
        fontSize: FontSize.base,
        fontWeight: '700',
        color: Colors.textPrimary,
    },
    asapToggleSub: {
        fontSize: 11,
        color: Colors.textSecondary,
        lineHeight: 16,
    },
    dateScroll: {
        marginTop: 12,
        marginBottom: 20,
    },
    dateChip: {
        width: 65,
        height: 85,
        backgroundColor: '#fff',
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
    },
    dateChipActive: {
        backgroundColor: Colors.primary,
        borderColor: Colors.primary,
    },
    dateChipDay: {
        fontSize: 10,
        fontWeight: '600',
        color: '#64748B',
        textTransform: 'uppercase',
    },
    dateChipNum: {
        fontSize: 20,
        fontWeight: '800',
        color: Colors.textPrimary,
        marginVertical: 2,
    },
    dateChipMonth: {
        fontSize: 10,
        fontWeight: '600',
        color: '#64748B',
    },
    timeGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 12,
    },
    timeChip: {
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 10,
        backgroundColor: '#fff',
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
        minWidth: '22%',
        alignItems: 'center',
    },
    timeChipActive: {
        backgroundColor: Colors.primary,
        borderColor: Colors.primary,
    },
    timeChipText: {
        fontSize: 10,
        fontWeight: '700',
        color: Colors.textPrimary,
    },
    asapIcon: { fontSize: 18 },
    asapText: { flex: 1, fontSize: FontSize.xs, color: Colors.textSecondary, lineHeight: 18 },

    topUpBadge: {
        backgroundColor: Colors.primary,
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 20,
    },
    topUpBadgeText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: '700',
    },

    // Payment
    payMethodCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: Colors.card,
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1.5,
        borderColor: Colors.border,
        ...Shadows.card,
    },
    payMethodActive: { borderColor: Colors.health, borderWidth: 2.5 },
    payMethodDisabled: { opacity: 0.6 },
    payMethodTitle: { fontSize: FontSize.base, fontWeight: '700', color: Colors.textPrimary, marginBottom: 3 },
    payMethodSub: { fontSize: FontSize.xs, color: Colors.textSecondary },
    comingSoonBadge: {
        backgroundColor: '#D1D5DB',
        borderRadius: 20,
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    comingSoonBadgeText: { fontSize: 10, fontWeight: '700', color: '#4B5563' },

    codInfoBox: {
        backgroundColor: '#F0FDF4',
        borderRadius: 14,
        padding: 14,
        borderWidth: 1,
        borderColor: '#BBEAD1',
        gap: 6,
    },
    codInfoTitle: { fontSize: FontSize.sm, fontWeight: '700', color: '#166534', marginBottom: 6 },
    codInfoLine: { fontSize: FontSize.sm, color: Colors.textPrimary, lineHeight: 22 },

    // Review
    reviewCard: {
        backgroundColor: Colors.card,
        borderRadius: 16,
        overflow: 'hidden',
        ...Shadows.card,
        marginBottom: 14,
    },
    reviewRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
        gap: 12,
    },
    reviewLabel: { fontSize: FontSize.sm, color: Colors.textSecondary, flexShrink: 0, width: 75 },
    reviewValue: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textPrimary, textAlign: 'right', flex: 1 },

    disclaimerBox: { padding: 12 },
    disclaimerText: { fontSize: FontSize.xs, color: Colors.muted, textAlign: 'center', lineHeight: 18 },

    // Footer
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: Colors.card,
        paddingHorizontal: 16,
        paddingTop: 14,
        paddingBottom: 32,
        ...Shadows.float,
        gap: 8,
    },
    footerNote: {
        textAlign: 'center',
        fontSize: FontSize.xs,
        color: Colors.textSecondary,
    },

    // Success screen
    successContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 24,
        backgroundColor: Colors.background,
    },
    successIconBg: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: '#F0FDF4',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    successTitle: {
        fontSize: FontSize['3xl'],
        fontWeight: '700',
        color: Colors.textPrimary,
        marginBottom: 10,
        textAlign: 'center',
    },
    successSub: {
        fontSize: FontSize.base,
        color: Colors.textSecondary,
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 24,
    },
    codConfirmBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: '#F0FDF4',
        borderRadius: 14,
        padding: 14,
        marginBottom: 28,
        borderWidth: 1,
        borderColor: '#BBEAD1',
        alignSelf: 'stretch',
    },
    codConfirmIcon: { fontSize: 28 },
    codConfirmTitle: { fontSize: FontSize.base, fontWeight: '700', color: '#166534' },
    codConfirmSub: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },

    // OP Ticket
    opTicketCard: {
        backgroundColor: Colors.card,
        borderRadius: 20,
        borderWidth: 2,
        borderColor: Colors.border,
        width: '100%',
        marginTop: 24,
        marginBottom: 24,
        overflow: 'hidden',
        borderStyle: 'dashed',
    },
    opTicketHeader: {
        backgroundColor: '#F8FAFC',
        padding: 16,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    opTicketLabel: {
        fontSize: 10,
        fontWeight: '800',
        color: Colors.muted,
        letterSpacing: 1,
    },
    opTicketHospital: {
        fontSize: FontSize.base,
        fontWeight: '700',
        color: Colors.textPrimary,
    },
    opTicketDivider: {
        height: 1,
        backgroundColor: Colors.border,
        marginHorizontal: 16,
    },
    opTicketBody: {
        padding: 20,
    },
    opTicketRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    opInfoLabel: {
        fontSize: 10,
        fontWeight: '700',
        color: Colors.textSecondary,
        marginBottom: 4,
    },
    opInfoValue: {
        fontSize: FontSize.sm,
        fontWeight: '700',
        color: Colors.textPrimary,
    },
    opTicketFooter: {
        padding: 12,
        backgroundColor: '#F0F9FF',
        alignItems: 'center',
    },
    opFooterText: {
        fontSize: FontSize.xs,
        color: Colors.primary,
        fontWeight: '600',
    },

    // Info step styles
    card: {
        backgroundColor: Colors.card,
        borderRadius: 24,
        padding: 24,
        ...Shadows.card,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    heroSection: {
        alignItems: 'center',
        marginBottom: 32,
    },
    heroIconBg: {
        width: 100,
        height: 100,
        borderRadius: 35,
        backgroundColor: '#F0F7FF',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
        ...Shadows.float,
    },
    heroTitle: {
        fontSize: 26,
        fontWeight: '900',
        color: Colors.textPrimary,
        textAlign: 'center',
        marginBottom: 12,
        letterSpacing: -0.5,
    },
    heroDesc: {
        fontSize: 15,
        color: Colors.textSecondary,
        textAlign: 'center',
        lineHeight: 22,
        fontWeight: '500',
    },
    infoGrid: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 12,
    },
    infoItem: {
        flex: 1,
        backgroundColor: '#F8FAFC',
        padding: 16,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    infoLabel: {
        fontSize: 10,
        fontWeight: '800',
        color: Colors.muted,
        marginBottom: 6,
        letterSpacing: 0.5,
    },
    infoValue: {
        fontSize: 15,
        fontWeight: '700',
        color: Colors.textPrimary,
    },

    // Doctor Selection styles
    selectedDoctorWrapper: {
        marginBottom: 12,
        borderRadius: 24,
        borderWidth: 2,
        borderColor: Colors.primary,
        backgroundColor: '#F0F7FF',
        overflow: 'hidden',
    },
    selectionIndicator: {
        backgroundColor: Colors.primary,
        paddingVertical: 4,
        alignItems: 'center',
    },
    selectionCheck: {
        color: '#fff',
        fontSize: 11,
        fontWeight: '800',
    },

    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        padding: 24,
        maxHeight: '90%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    modalTitle: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary },
    modalInputLabel: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary, marginBottom: 8, marginTop: 16 },
    modalInput: {
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 16,
        paddingHorizontal: 16,
        paddingVertical: 14,
        fontSize: 16,
        color: Colors.textPrimary,
    },
    modalInputWrap: {
        position: 'relative',
    },
    modalInputWithAction: {
        paddingRight: 48,
    },
    detectInlineBtn: {
        position: 'absolute',
        right: 14,
        top: 12,
        width: 24,
        height: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalInputError: { borderColor: '#EF4444' },
    modalErrorText: { color: '#EF4444', fontSize: 12, marginTop: 4 },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        backgroundColor: '#fff',
        gap: 8,
    },
    chipIconWrap: {
        width: 18,
        height: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    chipIcon: {
        textAlignVertical: 'center',
    },
    chipText: { fontSize: 14, lineHeight: 18, fontWeight: '700', color: Colors.textPrimary },
    saveAddrBtn: {
        backgroundColor: Colors.primary,
        borderRadius: 16,
        paddingVertical: 18,
        alignItems: 'center',
        marginTop: 32,
        marginBottom: 20,
        ...Shadows.card,
    },
    saveAddrBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});
