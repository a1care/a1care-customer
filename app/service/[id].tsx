import { showToast } from '@/utils/toast';
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
    Dimensions,
    useWindowDimensions,
    Image,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useAuthStore } from '@/stores/auth.store';
import { authService } from '@/services/auth.service';
import { servicesService } from '@/services/services.service';
import { bookingsService } from '@/services/bookings.service';
import { doctorsService } from '@/services/doctors.service';
import { addressService } from '@/services/address.service';
import { walletService } from '@/services/wallet.service';
import { paymentService } from '@/services/payment.service';
import { couponService } from '@/services/referral.service';
import { Colors, Shadows } from '@/constants/colors';
import { FontSize } from '@/constants/spacing';
import { Button } from '@/components/ui/Button';
import { DoctorCard } from '@/components/ui/DoctorCard';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { SkeletonBox } from '@/components/ui/Skeleton';
import { formatCurrency } from '@/utils/formatters';
import type { Address } from '@/types';
import RazorpayCheckout from 'react-native-razorpay';
import { triggerLocalNotification } from '@/utils/notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Step definitions ─────────────────────────────────────────────────────────
type Step = 'info' | 'doctor' | 'address' | 'schedule' | 'payment' | 'confirm';

const ALL_STEPS: Step[] = ['info', 'doctor', 'address', 'schedule', 'payment', 'confirm'];
const ALL_STEP_LABELS = ['Service', 'Expert', 'Location', 'Schedule', 'Payment', 'Review'];
// Steps visible in the stepper (excludes info/doctor which are pre-booking)
const VISIBLE_STEPS: Step[] = ['address', 'schedule', 'payment', 'confirm'];
const VISIBLE_STEP_LABELS: Record<Step, string> = {
    info: 'Service', doctor: 'Expert',
    address: 'Location', schedule: 'Schedule', payment: 'Payment', confirm: 'Review',
};

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
    // Only show stepper after the info step; filter to visible steps that are active
    const visibleActive = activeSteps.filter(s => VISIBLE_STEPS.includes(s));
    const idx = visibleActive.indexOf(current);
    if (idx < 0) return null; // hide on info/doctor steps
    return (
        <View style={styles.stepRow}>
            {visibleActive.map((s, i) => (
                <React.Fragment key={s}>
                    <View style={styles.stepItem}>
                        <View style={[styles.stepDot, i < idx ? styles.stepDotDone : {}, i === idx ? styles.stepDotActive : {}]}>
                            {i < idx ? (
                                <Text style={styles.stepDotCheckmark}>✓</Text>
                            ) : (
                                <Text style={[styles.stepDotNum, i === idx ? styles.stepDotNumActive : {}]}>
                                    {i + 1}
                                </Text>
                            )}
                        </View>
                        <Text style={[styles.stepLabel, i === idx ? styles.stepLabelActive : {}]}>
                            {VISIBLE_STEP_LABELS[s]}
                        </Text>
                    </View>
                    {i < visibleActive.length - 1 && (
                        <View style={[styles.stepLine, i < idx ? styles.stepLineDone : {}]} />
                    )}
                </React.Fragment>
            ))}
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
    const insets = useSafeAreaInsets();
    const window = useWindowDimensions();
    const source = Array.isArray(from) ? from[0] : from;
    const isFromIndex = source === 'home' || source === 'index';
    const screenHeight = Dimensions.get('screen').height;
    const androidNavBarHeight = Platform.OS === 'android'
        ? Math.max(0, screenHeight - window.height)
        : 0;
    const bottomSafeArea = Math.max(insets.bottom, androidNavBarHeight);
    const footerBottomPadding = Math.max(bottomSafeArea, Platform.OS === 'android' ? 40 : 16);
    const scrollBottomPadding = footerBottomPadding + 104;

    const [step, setStep] = useState<Step | null>(null);
    const [selectedAddressId, setSelectedAddressId] = useState<string>('');
    const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');
    const todayYmd = useMemo(() => toLocalYMD(new Date()), []);
    const [scheduledDate, setScheduledDate] = useState(todayYmd);
    const [scheduledTime, setScheduledTime] = useState('');
    const [paymentMethod, setPaymentMethod] = useState<'COD' | 'WALLET' | 'ONLINE' | null>(null);
    const [submittingOnline, setSubmittingOnline] = useState(false);
    const [couponInput, setCouponInput] = useState('');
    const [couponApplied, setCouponApplied] = useState<{ code: string; discount: number; finalAmount: number } | null>(null);
    const [couponChecking, setCouponChecking] = useState(false);
    const [showCouponModal, setShowCouponModal] = useState(false);

    const [submitted, setSubmitted] = useState(false);
    const [submittedBookingId, setSubmittedBookingId] = useState<string | null>(null);
    const submitting = useRef(false);

    const { isAuthenticated, setPostLoginReturn, user } = useAuthStore();
    const [showGuestModal, setShowGuestModal] = useState(false);
    const [guestName, setGuestName] = useState('');
    const [guestPhone, setGuestPhone] = useState('');
    const [guestLoading, setGuestLoading] = useState(false);

    const { data: addresses, isLoading: addrLoading, isError: addrErr, refetch: refetchAddr } = useQuery({
        queryKey: ['addresses', user?.id || user?._id],
        queryFn: addressService.getAll,
        enabled: isAuthenticated, // H8: don't fire 401s for guests
    });

    const { data: availableCoupons, isLoading: couponsLoading } = useQuery({
        queryKey: ['available-coupons'],
        queryFn: () => couponService.getAvailable(),
        enabled: isAuthenticated,
    });

    const { data: wallet } = useQuery({
        queryKey: ['wallet'],
        queryFn: walletService.getWallet,
        enabled: isAuthenticated,
        refetchInterval: 30000, // keep balance fresh every 30s while the user is booking
    });

    const { data: service, isLoading: serviceLoading, isError: serviceError, refetch: refetchService } = useQuery({
        queryKey: ['child-service', id],
        queryFn: () => servicesService.getChildServiceById(id!),
        enabled: !!id && id !== '[id]',
    });

    // Reset stale WALLET selection if balance drops below service price
    React.useEffect(() => {
        if (paymentMethod !== 'WALLET') return;
        const price = priceParam ? parseFloat(priceParam) : 0;
        const payable = couponApplied?.finalAmount ?? price;
        if ((wallet?.balance ?? 0) < payable) {
            setPaymentMethod(null);
        }
    }, [wallet?.balance]);

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
        if (step === 'doctor' && shouldUseDoctorAppointment && !selectedDoctorId) {
            showToast.warn('Selection Required', 'Please select a healthcare expert to proceed.');
            return;
        }
        if (step === 'address' && !selectedAddressId) {
            showToast.warn('Location Required', 'Please select a service location.');
            return;
        }
        if (step === 'schedule') {
            const errors: Record<string, boolean> = {};
            if (!scheduledDate) errors.date = true;
            if (!scheduledTime) errors.time = true;

            if (Object.keys(errors).length > 0) {
                setFormErrors(errors);
                if (!scheduledDate && !scheduledTime) {
                    showToast.warn('Select Schedule', 'Please select a preferred date and time slot.');
                } else if (!scheduledDate) {
                    showToast.warn('Select Date', 'Please choose a valid date for your booking.');
                } else if (!scheduledTime) {
                    showToast.warn('Select Time Slot', 'Please choose an available time slot for your booking.');
                }
                return;
            }
        }
        if (step === 'payment' && !paymentMethod) {
            showToast.warn('Payment Method Required', 'Please choose a payment method.');
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
            showToast.error('Error', message);
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
        onSuccess: (_data: any, deletedId: string) => {
            qc.invalidateQueries({ queryKey: ['addresses'] });
            // H7: if deleted address was selected, clear selection
            if (selectedAddressId === deletedId) {
                setSelectedAddressId('');
            }
            showToast.success('Success', 'Address deleted successfully');
        },
        onError: (err: any) => {
            const errMsg = err?.response?.data?.message || err?.message || 'Could not delete address. Please try again.';
            showToast.error('Error', errMsg);
        }
    });

    const handleAutoDetectAddress = async () => {
        try {
            setIsDetectingLocation(true);
            setIsAutoDetectDone(false);

            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                showToast.warn('Location Permission Needed', 'Please allow location access to auto-fill your address.');
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

            let geo: any = null;

            if (Platform.OS === 'web') {
                // expo-location reverseGeocodeAsync doesn't work on web — use Nominatim instead
                try {
                    const resp = await withTimeout(
                        fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`, {
                            headers: { 'Accept-Language': 'en' }
                        }),
                        10000,
                        'Address lookup timed out'
                    );
                    const data = await resp.json();
                    const addr = data?.address || {};
                    geo = {
                        name: addr.suburb || addr.neighbourhood || addr.quarter || '',
                        street: addr.road || '',
                        district: addr.city || addr.town || addr.village || addr.county || '',
                        subregion: addr.suburb || addr.neighbourhood || '',
                        city: addr.city || addr.town || addr.village || '',
                        region: addr.state || '',
                        postalCode: addr.postcode || ''
                    };
                } catch (_e) { /* keep geo null */ }
            } else {
                const geocoded = await withTimeout(
                    Location.reverseGeocodeAsync({ latitude: lat, longitude: lng }),
                    10000,
                    'Address lookup timed out'
                );
                geo = geocoded?.[0];
            }

            if (!geo) {
                setIsAutoDetectDone(false);
                return;
            }

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
            showToast.error('Auto Detect Failed', error?.message || 'Could not detect your location right now.');
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
            showToast.warn('Required Fields', 'Please fill all mandatory fields with valid data.');
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



    // H5: auto-select first address when addresses load
    React.useEffect(() => {
        if (addresses?.length && !selectedAddressId) {
            const primary = addresses.find((a: any) => a.isPrimary) ?? addresses[0];
            setSelectedAddressId(primary._id);
        }
    }, [addresses]);

    const isDoctorService = React.useMemo(() => {
        const name = `${service?.name ?? ''} ${nameParam ?? ''} ${subName ?? ''}`.toLowerCase();
        return /doctor|consult|specialist|cardiologist|neurologist|orthopedic|physician/.test(name);
    }, [service?.name, nameParam, subName]);
    const shouldUseDoctorAppointment = false;

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
        enabled: !!service && shouldUseDoctorAppointment,
    });

    const activeSteps: Step[] = React.useMemo(() => {
        if (!service) return [];
        const steps: Step[] = ['info'];
        if (shouldUseDoctorAppointment) steps.push('doctor');
        const isHospital = service.fulfillmentMode === 'HOSPITAL_VISIT' || (subName && /hospital/i.test(subName));
        const isVirtual = service.fulfillmentMode === 'VIRTUAL' || (subName && /virtual|online/i.test(subName));
        if (!isHospital && !isVirtual) steps.push('address');
        steps.push('schedule', 'payment', 'confirm');
        return steps;
    }, [service, subName, shouldUseDoctorAppointment]);



    React.useEffect(() => {
        if (service && !step && activeSteps.length > 0) {
            setStep(activeSteps[0]);
            const isHosp = service.fulfillmentMode === 'HOSPITAL_VISIT' || (subName && /hospital/i.test(subName));
            if (isHosp) {
                setScheduledDate(todayYmd); // H9: use local date not UTC
            }
        }
    }, [service, step, activeSteps, subName]);

    const buildScheduledTime = () => {
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
        if (scheduledDate && scheduledTime) return `${scheduledDate} at ${scheduledTime}`;
        return 'Not scheduled';
    };

    const sendBookingNotification = (booking: any) => {
        if (shouldUseDoctorAppointment) {
            const doctorStatus = String(booking?.status || '').toLowerCase();
            if (doctorStatus === 'confirmed' || doctorStatus === 'completed') {
                triggerLocalNotification('Doctor Appointment Confirmed', `Your ${serviceName} appointment is confirmed.`);
            } else {
                triggerLocalNotification('Doctor Appointment Requested', `Your ${serviceName} appointment request has been submitted.`);
            }
            return;
        }
        const serviceStatus = String(booking?.status || '').toUpperCase();
        if (serviceStatus === 'ACCEPTED' || serviceStatus === 'IN_PROGRESS' || serviceStatus === 'COMPLETED' || serviceStatus === 'CONFIRMED') {
            triggerLocalNotification('Service Booking Confirmed', `Your ${serviceName} booking is confirmed.`);
        } else {
            triggerLocalNotification('Service Booking Placed', `Your ${serviceName} request has been submitted. We are finding a provider.`);
        }
    };

    const bookMutation = useMutation({
        mutationFn: (variables?: { overridePaymentMethod?: string }) => {
            if (submitting.current) throw new Error('Already submitting');
            submitting.current = true;
            const addr = addresses?.find((a) => a._id === selectedAddressId);
            const actualPaymentMethod = variables?.overridePaymentMethod || paymentMethod;
            const isHosp = service?.fulfillmentMode === 'HOSPITAL_VISIT' || (subName && /hospital/i.test(subName));

            if (shouldUseDoctorAppointment) {
                if (!selectedDoctorId) {
                    throw new Error('Please select a doctor to continue');
                }
                const now = new Date();
                const fallbackStart = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
                const end = new Date(now.getTime() + 30 * 60 * 1000);
                const fallbackEnd = `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`;
                const startTime = displaySlotTo24Hour(scheduledTime) || fallbackStart;
                const endTime = displaySlotTo24Hour(scheduledTime) || fallbackEnd;

                return bookingsService.bookDoctor(selectedDoctorId, {
                    date: scheduledDate || todayYmd,
                    startingTime: startTime,
                    endingTime: endTime,
                    totalAmount: priceParam ? parseFloat(priceParam) : 0,
                    paymentMode: actualPaymentMethod === 'COD'
                        ? 'OFFLINE'
                        : actualPaymentMethod === 'WALLET'
                            ? 'WALLET'
                            : 'ONLINE',
                    isGatewayPayment: actualPaymentMethod === 'ONLINE', 
                    serviceName: nameParam ?? service?.name ?? 'Doctor Consult',
                    ...(couponApplied ? { couponCode: couponApplied.code, discount: couponApplied.discount } : {}),
                });
            }

            const basePrice = priceParam ? parseFloat(priceParam) : 0;
            const finalPrice = couponApplied?.finalAmount ?? basePrice;
            return bookingsService.createServiceBooking({
                childServiceId: id!,
                addressId: isHosp ? undefined : addr?._id,
                assignedProviderId: undefined,
                scheduledTime: buildScheduledTime(),
                bookingType: 'SCHEDULED',
                fulfillmentMode: (service?.fulfillmentMode) ?? (isHosp ? 'HOSPITAL_VISIT' : 'HOME_VISIT'),
                price: finalPrice,
                paymentMode: actualPaymentMethod === 'COD' ? 'OFFLINE' : actualPaymentMethod === 'WALLET' ? 'WALLET' : 'ONLINE',
                ...(couponApplied ? { couponCode: couponApplied.code, discount: couponApplied.discount } : {}),
            });
        },
        onSuccess: (booking: any) => {
            submitting.current = false;
            qc.invalidateQueries({ queryKey: ['service-bookings'] });
            qc.invalidateQueries({ queryKey: ['service-bookings-all'] });
            if (shouldUseDoctorAppointment) {
                qc.invalidateQueries({ queryKey: ['appointments'] });
                if (booking?._id) {
                    router.replace({ pathname: '/doctor/appointment/[id]', params: { id: booking._id } });
                    return;
                }
            }
            if (paymentMethod !== 'ONLINE' && paymentMethod !== 'WALLET') sendBookingNotification(booking);
            if (paymentMethod !== 'ONLINE' && paymentMethod !== 'WALLET') { setSubmitted(true); setSubmittedBookingId(booking?._id ?? null); }
        },
        onError: (err: any) => {
            submitting.current = false;
            showToast.error('Booking Failed', err?.response?.data?.message || err?.message || 'Booking failed');
        },
    });

    const handleApplyCoupon = async (codeToApply?: string) => {
        const code = (codeToApply || couponInput).trim().toUpperCase();
        if (!code) return;
        setCouponInput(code);
        const baseAmount = priceParam ? parseFloat(priceParam) : 0;
        setCouponChecking(true);
        try {
            const result = await couponService.preview(code, baseAmount);
            setCouponApplied({ code: result.code, discount: result.discount, finalAmount: result.finalAmount });
        } catch (err: any) {
            showToast.warn('Invalid Coupon', err?.response?.data?.message || 'Coupon code is not valid.');
            setCouponApplied(null);
        } finally {
            setCouponChecking(false);
        }
    };

    const handleFinalSubmit = async () => {
        if (!scheduledDate || !scheduledTime) {
            showToast.warn('Incomplete Schedule', 'Please go back and select a valid date and time.');
            return;
        }

        const payableAmount = couponApplied?.finalAmount ?? (priceParam ? parseFloat(priceParam) : 0);
        // If the coupon brings the total to 0, process it internally as a WALLET payment to skip Razorpay
        const effectivePaymentMethod = payableAmount === 0 ? 'WALLET' : paymentMethod;

        if (effectivePaymentMethod === 'WALLET') {
            const walletBalance = wallet?.balance ?? 0;
            if (walletBalance < payableAmount) {
                showToast.warn(
                    'Insufficient Balance', `Your wallet balance (₹${walletBalance}) is not enough for this payment (₹${payableAmount}). Please add funds or choose another payment method.`,
                    [{ text: 'OK', onPress: () => setStep('payment') }]
                );
                return;
            }
            let createdBookingId: string | null = null;
            try {
                setSubmittingOnline(true);
                const booking = await bookMutation.mutateAsync({ overridePaymentMethod: 'WALLET' });
                createdBookingId = booking._id;
                
                // Backend automatically processes wallet deductions and marks payment status correctly.
                // We do NOT need to call paymentService.createOrder or payWithWallet,
                // as that leads to double deduction and errors for 0-amount transactions.

                sendBookingNotification(booking);
                setSubmitted(true);
                setSubmittedBookingId(booking?._id ?? null);
                qc.invalidateQueries({ queryKey: ['service-bookings'] });
                
                if (shouldUseDoctorAppointment) {
                    // For doctor appointment, navigation is handled in onSuccess of bookMutation
                    // We just need to make sure we don't proceed to checkout/status
                    return;
                }
                
                router.replace({
                    pathname: '/checkout/status' as any,
                    params: {
                        status: 'SUCCESS',
                        txnId: booking._id, // Use booking ID as transaction ID for zero-cost / wallet
                        amount: String(payableAmount),
                        type: 'BOOKING',
                        description: `Booking for ${service?.name || nameParam}`,
                        bookingId: booking._id,
                        date: todayYmd,
                        providerName: '',
                        paymentMode: 'WALLET',
                    },
                });
            } catch (err: any) {
                if (createdBookingId) {
                    bookingsService.updateServiceBookingStatus(createdBookingId, 'CANCELLED').catch(() => {});
                }
                const msg =
                    err?.response?.data?.message ||
                    err?.message ||
                    'Wallet payment failed. Please check your balance and try again.';
                showToast.error('Payment Error', msg);
            } finally {
                setSubmittingOnline(false);
            }
        } else if (effectivePaymentMethod === 'ONLINE') {
            let createdBookingId: string | null = null;
            let createdTxnId: string | null = null;
            try {
                setSubmittingOnline(true);
                const booking = await bookMutation.mutateAsync();
                createdBookingId = booking._id;
                const order = await paymentService.createOrder({
                    amount: payableAmount,
                    type: "BOOKING",
                    referenceId: booking._id
                });
                createdTxnId = order.txnId;
                const razorData = await paymentService.initiateRazorpay(order._id);
                const data = await RazorpayCheckout.open({
                    key: razorData.key,
                    amount: razorData.razorOrder.amount,
                    currency: 'INR',
                    name: 'A1Care 24/7',
                    description: `Booking for ${service?.name || nameParam}`,
                    order_id: razorData.razorOrder.id,
                    prefill: {
                        email: razorData.customer.email || '',
                        contact: razorData.customer.contact || '',
                        name: razorData.customer.name || '',
                    },
                    theme: { color: Colors.primary },
                });
                await paymentService.verifyRazorpay({
                    razorpay_order_id: (data as any).razorpay_order_id,
                    razorpay_payment_id: (data as any).razorpay_payment_id,
                    razorpay_signature: (data as any).razorpay_signature,
                    orderId: order._id,
                });
                sendBookingNotification(booking);
                setSubmitted(true);
                setSubmittedBookingId(booking._id);
                qc.invalidateQueries({ queryKey: ['service-bookings'] });
                router.replace({
                    pathname: '/checkout/status' as any,
                    params: {
                        status: 'SUCCESS',
                        txnId: order.txnId,
                        amount: String(payableAmount),
                        type: 'BOOKING',
                        description: `Booking for ${service?.name || nameParam}`,
                        bookingId: booking._id,
                        date: todayYmd,
                        providerName: '',
                    },
                });
            } catch (err: any) {
                if (createdBookingId) {
                    bookingsService.updateServiceBookingStatus(createdBookingId, 'CANCELLED').catch(() => {});
                }
                if (err.code === 2) {
                    showToast.warn('Payment Cancelled', 'You cancelled the payment. Your booking was not confirmed.');
                } else {
                    router.replace({
                        pathname: '/checkout/status' as any,
                        params: {
                            status: 'FAILED',
                            amount: String(payableAmount),
                            type: 'BOOKING',
                            description: `Booking for ${service?.name || nameParam}`,
                            txnId: createdTxnId || '',
                        },
                    });
                }
            } finally {
                setSubmittingOnline(false);
            }
        } else {
            bookMutation.mutate();
        }
    };

    const handleGuestContinue = async () => {
        const name = guestName.trim();
        const phone = guestPhone.replace(/\D/g, '');
        if (!name) {
            showToast.warn('Name Required', 'Please enter your name to continue.');
            return;
        }
        if (phone.length < 10) {
            showToast.warn('Invalid Number', 'Please enter a valid 10-digit mobile number.');
            return;
        }
        setGuestLoading(true);
        try {
            await authService.sendOtp(phone);
            // Save guest name so profile-setup can pre-fill it after OTP verification
            await AsyncStorage.setItem('guest_prefill_name', name);
            setShowGuestModal(false);
            setPostLoginReturn({
                pathname: '/service/[id]',
                params: {
                    id: id ?? '',
                    name: nameParam ?? '',
                    price: priceParam ?? '',
                    subName: subName ?? '',
                    source: source ?? '',
                    entryMode: entryMode ?? '',
                    originServiceId: originServiceId ?? '',
                    originSubServiceId: originSubServiceId ?? '',
                    originCategory: originCategory ?? '',
                },
            });
            router.push({ pathname: '/(auth)/otp', params: { mobile: phone } });
        } catch (err: any) {
            showToast.error('Failed to Send OTP', err?.response?.data?.message || err?.message || 'Please try again.');
        } finally {
            setGuestLoading(false);
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
                    {submittedBookingId && (
                        <Text style={{ fontSize: 12, color: Colors.muted, marginBottom: 8 }}>
                            Booking ID: #{submittedBookingId.slice(-8).toUpperCase()}
                        </Text>
                    )}
                    <View style={styles.codConfirmBox}>
                        <View>
                            <Text style={styles.codConfirmTitle}>{paymentMethod === 'WALLET' ? 'Paid via Wallet' : paymentMethod === 'ONLINE' ? 'Paid Online' : 'Pay by Cash'}</Text>
                            <Text style={styles.codConfirmSub}>Thank you for choosing A1Care</Text>
                        </View>
                    </View>
                    <Button label="Track My Booking" onPress={() => router.push('/(tabs)/bookings')} variant="primary" style={{ marginBottom: 12 }} fullWidth />
                    <Button label="Book Again" onPress={() => router.replace({ pathname: '/service/[id]', params: { id: id ?? '', name: nameParam ?? '', price: priceParam ?? '', subName: subName ?? '', source: 'home', entryMode: 'direct' } } as any)} variant="outline" style={{ marginBottom: 12 }} fullWidth />
                    <Button label="Back to Home" onPress={() => router.push('/(tabs)')} variant="outline" fullWidth />
                </View>
            </SafeAreaView>
        );
    }

    // H12: show error state if service fails to load
    if (serviceError) {
        return (
            <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
                <ErrorState message="Failed to load service details" onRetry={refetchService} />
            </SafeAreaView>
        );
    }

    if (serviceLoading || !step) {
        return (
            <SafeAreaView style={styles.root} edges={['top']}>
                <View style={styles.header}>
                    <SkeletonBox width={36} height={36} borderRadius={10} />
                    <View style={{ flex: 1, alignItems: 'center' }}>
                        <SkeletonBox width={120} height={20} borderRadius={6} />
                    </View>
                    <View style={{ width: 36 }} />
                </View>

                <View style={styles.stepWrap}>
                    <View style={[styles.stepRow, { paddingVertical: 8, justifyContent: 'center' }]}>
                        <SkeletonBox width="80%" height={28} borderRadius={14} />
                    </View>
                </View>

                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
                    <View style={styles.stepContent}>
                        {/* Premium Card Header Skeleton */}
                        <View style={[styles.card, { marginBottom: 20 }]}>
                            <View style={{ alignItems: 'center' }}>
                                <SkeletonBox width="100%" height={220} borderRadius={16} style={{ marginBottom: 16 }} />
                                <SkeletonBox width="60%" height={26} borderRadius={8} style={{ marginBottom: 10 }} />
                                <SkeletonBox width="90%" height={14} borderRadius={6} style={{ marginBottom: 6 }} />
                                <SkeletonBox width="70%" height={14} borderRadius={6} />
                            </View>

                            <View style={[styles.cardDivider, { marginVertical: 18 }]} />

                            {/* Service Details Grid Skeleton */}
                            <View style={{ flexDirection: 'row', gap: 12 }}>
                                <View style={[styles.infoItem, { flex: 1 }]}>
                                    <SkeletonBox width={60} height={12} borderRadius={4} style={{ marginBottom: 8 }} />
                                    <SkeletonBox width={100} height={18} borderRadius={6} />
                                </View>
                                <View style={[styles.infoItem, { flex: 1 }]}>
                                    <SkeletonBox width={90} height={12} borderRadius={4} style={{ marginBottom: 8 }} />
                                    <SkeletonBox width={80} height={22} borderRadius={6} />
                                </View>
                            </View>
                        </View>

                        {/* Why Choose Us / Service Perks Skeleton */}
                        <View style={[styles.card, { marginBottom: 20 }]}>
                            <SkeletonBox width={140} height={20} borderRadius={6} style={{ marginBottom: 16 }} />
                            <View style={{ gap: 14 }}>
                                {[1, 2, 3].map(i => (
                                    <View key={i} style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
                                        <SkeletonBox width={36} height={36} borderRadius={10} style={{ marginTop: 2 }} />
                                        <View style={{ flex: 1 }}>
                                            <SkeletonBox width="60%" height={16} borderRadius={6} style={{ marginBottom: 8 }} />
                                            <SkeletonBox width="90%" height={12} borderRadius={4} />
                                        </View>
                                    </View>
                                ))}
                            </View>
                        </View>

                        {/* Trust Badge Skeleton */}
                        <View style={{ alignItems: 'center', marginTop: 4 }}>
                            <SkeletonBox width={180} height={16} borderRadius={6} />
                        </View>
                    </View>
                </ScrollView>
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

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={[styles.scroll, { paddingBottom: scrollBottomPadding }]}
            >
                {step === 'info' && service && (
                    <View style={styles.stepContent}>
                        {/* Hero Section */}
                        <View style={{ marginBottom: 24, backgroundColor: '#fff', borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: '#F1F5F9', elevation: 3, shadowColor: '#94A3B8', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 16 }}>
                            <Image 
                                source={{ uri: service?.imageUrl || 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=800&q=80' }}
                                style={{ width: '100%', height: 220, backgroundColor: '#EFF6FF' }} 
                                resizeMode="cover" 
                            />
                            
                            <View style={{ padding: 24, backgroundColor: '#fff' }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                                    <View style={{ backgroundColor: '#EEF2FF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 }}>
                                        <Text style={{ color: '#4338CA', fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 }}>{isDoctorService ? 'Expert Care' : 'Premium Service'}</Text>
                                    </View>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF3C7', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16 }}>
                                        <Ionicons name="star" size={14} color="#D97706" />
                                        <Text style={{ fontSize: 12, fontWeight: '700', color: '#92400E', marginLeft: 4 }}>4.9</Text>
                                    </View>
                                </View>
                                
                                <Text style={{ fontSize: 24, fontWeight: '800', color: '#0F172A', marginBottom: 8 }}>{service.name}</Text>
                                <Text style={{ fontSize: 14, color: '#475569', lineHeight: 22, marginBottom: 24 }}>{service.description || 'Professional healthcare service delivered safely and securely in the comfort of your home.'}</Text>
                                
                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F8FAFC', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#F1F5F9' }}>
                                    <View>
                                        <Text style={{ fontSize: 11, fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Category</Text>
                                        <Text style={{ fontSize: 15, fontWeight: '800', color: '#1E293B' }} numberOfLines={1}>{subName || 'General Health'}</Text>
                                    </View>
                                    <View style={{ width: 1, height: 40, backgroundColor: '#E2E8F0' }} />
                                    <View style={{ alignItems: 'flex-end' }}>
                                        <Text style={{ fontSize: 11, fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Consultation Fee</Text>
                                        <Text style={{ fontSize: 22, fontWeight: '900', color: Colors.primary }}>{formatCurrency(priceParam ? parseFloat(priceParam) : 0)}</Text>
                                    </View>
                                </View>
                            </View>
                        </View>

                        {/* What's Included */}
                        <View style={{ marginBottom: 24, paddingHorizontal: 4 }}>
                            <Text style={{ fontSize: 18, fontWeight: '800', color: '#0F172A', marginBottom: 16 }}>What's Included</Text>
                            <View style={{ gap: 12 }}>
                                {[
                                    { title: 'Verified Medical Experts', desc: 'Consultations by certified & registered professionals only.', icon: 'shield-checkmark', color: '#059669', bg: '#D1FAE5' },
                                    { title: 'At-Home Comfort', desc: 'Avoid long hospital queues. Receive complete care at your doorstep.', icon: 'home', color: '#2563EB', bg: '#DBEAFE' },
                                    { title: '24/7 Clinical Support', desc: 'Post-service follow-up queries and constant support.', icon: 'chatbubbles', color: '#D97706', bg: '#FEF3C7' },
                                ].map((perk, index) => (
                                    <View key={index} style={{ flexDirection: 'row', gap: 16, alignItems: 'center', backgroundColor: '#fff', padding: 16, borderRadius: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 8, elevation: 1 }}>
                                        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: perk.bg, justifyContent: 'center', alignItems: 'center' }}>
                                            <Ionicons name={perk.icon as any} size={20} color={perk.color} />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ fontSize: 15, fontWeight: '700', color: '#1E293B', marginBottom: 2 }}>{perk.title}</Text>
                                            <Text style={{ fontSize: 13, color: '#64748B', lineHeight: 18 }}>{perk.desc}</Text>
                                        </View>
                                    </View>
                                ))}
                            </View>
                        </View>

                        {/* Trust Badge */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 4, paddingBottom: 16 }}>
                            <Ionicons name="shield-checkmark" size={16} color="#94A3B8" />
                            <Text style={{ fontSize: 12, color: '#94A3B8', fontWeight: '600', letterSpacing: 0.2 }}>Safe & Secure Healthcare Bookings</Text>
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
                        {/* H11: empty address guidance */}
                        {!addrLoading && (!addresses || addresses.length === 0) && (
                            <View style={{ alignItems: 'center', paddingVertical: 24, gap: 8 }}>
                                <Ionicons name="location-outline" size={40} color={Colors.muted} />
                                <Text style={{ fontWeight: '700', color: Colors.textPrimary }}>No saved addresses</Text>
                                <Text style={{ color: Colors.muted, textAlign: 'center', fontSize: 13 }}>Add your home address to get services delivered to your doorstep.</Text>
                            </View>
                        )}
                        {addresses?.map(a => {
                            const config = getAddressIcon(a.label || 'Home');
                            const isActive = selectedAddressId === a._id;
                            return (
                                <View
                                    key={a._id}
                                    style={[styles.addressCard, isActive && styles.addressCardActive, { flexDirection: 'column', gap: 0, padding: 0 }]}
                                >
                                    <TouchableOpacity
                                        onPress={() => setSelectedAddressId(a._id)}
                                        style={{ flexDirection: 'row', alignItems: 'flex-start', padding: 16, width: '100%', backgroundColor: isActive ? '#F8FAFC' : '#FFF', borderTopLeftRadius: 16, borderTopRightRadius: 16 }}
                                    >
                                        <View style={[styles.iconBox, { backgroundColor: config.bg }]}>
                                            <MaterialCommunityIcons name={config.icon as any} size={24} color={config.color} />
                                        </View>
                                        <View style={{ flex: 1, marginLeft: 14 }}>
                                            <Text style={styles.addrLabel}>{a.label}</Text>
                                            <Text style={styles.addrStreet} numberOfLines={2}>{getStreetValue(a)}</Text>
                                            <Text style={styles.addrCity}>{a.city}, {a.pincode}</Text>
                                        </View>
                                        <View style={[styles.radioOuter, isActive && styles.radioActive, { marginTop: 4 }]}>
                                            {isActive && <View style={styles.radioInner} />}
                                        </View>
                                    </TouchableOpacity>

                                    {/* Action bar is physically outside card selector touch hit box */}
                                    <View style={{
                                        flexDirection: 'row',
                                        justifyContent: 'flex-end',
                                        alignItems: 'center',
                                        paddingHorizontal: 16,
                                        paddingVertical: 10,
                                        borderTopWidth: 1,
                                        borderTopColor: '#E2E8F0',
                                        width: '100%',
                                        gap: 16
                                    }}>
                                        <TouchableOpacity onPress={() => handleEditAddress(a)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                            <Ionicons name="pencil" size={15} color="#0B3370" />
                                            <Text style={{ fontSize: 13, color: '#0B3370', fontWeight: '800' }}>Edit</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity onPress={() => {
                                            if (a._id) {
                                                if (Platform.OS === 'web') {
                                                    // Alert.alert callbacks don't fire on web — use window.confirm
                                                    if ((window as any).confirm('Are you sure you want to delete this address?')) {
                                                        deleteAddressMutation.mutate(a._id!);
                                                    }
                                                } else {
                                                    Alert.alert('Delete Address', 'Are you sure you want to delete this address?', [
                                                        { text: 'Cancel', style: 'cancel' },
                                                        { text: 'Delete', style: 'destructive', onPress: () => deleteAddressMutation.mutate(a._id!) }
                                                    ]);
                                                }
                                            }
                                        }} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                            <Ionicons name="trash" size={15} color="#EF4444" />
                                            <Text style={{ fontSize: 13, color: '#EF4444', fontWeight: '800' }}>Delete</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
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
                        <Text style={styles.fieldLabel}>Choose Date <Text style={{ color: '#EF4444' }}>*</Text></Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dateScroll}>
                            {dates.map(d => (
                                <TouchableOpacity key={d.full} onPress={() => { setScheduledDate(d.full); }} style={[styles.dateChip, scheduledDate === d.full && styles.dateChipActive]}>
                                    <Text style={[styles.dateChipDay, scheduledDate === d.full && { color: '#fff' }]}>{d.dayName}</Text>
                                    <Text style={[styles.dateChipNum, scheduledDate === d.full && { color: '#fff' }]}>{d.dayNum}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                        <Text style={styles.fieldLabel}>Select Time Slot <Text style={{ color: '#EF4444' }}>*</Text></Text>
                        <View style={styles.timeGrid}>
                            {timeSlots.map(t => (
                                <TouchableOpacity key={t} onPress={() => setScheduledTime(t)} style={[styles.timeChip, scheduledTime === t && styles.timeChipActive]}>
                                    <Text style={[styles.timeChipText, scheduledTime === t && { color: '#0B3370', fontWeight: '900' }]}>{t}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                        {timeSlots.length === 0 && (
                                    <View style={styles.noSlotsCard}>
                                        <Text style={styles.noSlotsIcon}>⚠️</Text>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.noSlotsTitle}>No Slots Available</Text>
                                            <Text style={styles.noSlotsSub}>No time slots available for this date. Please choose another date.</Text>
                                        </View>
                                    </View>
                                )}
                    </View>
                )}

                {step === 'payment' && (
                    <View style={styles.stepContent}>
                        <Text style={styles.stepTitle}>Choose Payment Method</Text>
                        <View style={{ gap: 12 }}>
                            {(() => {
                                const price = priceParam ? parseFloat(priceParam) : 0;
                                const walletBalance = wallet?.balance ?? 0;
                                const walletInsufficient = walletBalance < price;
                                return [
                                    { id: 'WALLET', label: 'A1 Wallet', sub: walletInsufficient ? `Insufficient Balance (₹${walletBalance}) — Add Money →` : `Balance: ${formatCurrency(walletBalance)}`, icon: 'wallet-outline', color: Colors.health, disabled: walletInsufficient },
                                    { id: 'ONLINE', label: 'Online Payment', sub: 'UPI, Cards, Netbanking', icon: 'card-outline', color: Colors.primary, disabled: false },
                                ].map(opt => (
                                    <TouchableOpacity
                                        key={opt.id}
                                        onPress={() => {
                                            if (opt.disabled) {
                                                router.push('/wallet' as any);
                                                return;
                                            }
                                            setPaymentMethod(opt.id as any);
                                        }}
                                        style={[
                                            styles.payMethodCard, 
                                            paymentMethod === opt.id && { borderColor: '#0B3370', borderWidth: 2, backgroundColor: '#F8FAFC' }, 
                                            opt.disabled && { opacity: 0.6 }
                                        ]}
                                    >
                                        <View style={[styles.payMethodIconBox, { backgroundColor: paymentMethod === opt.id ? '#EEF4FF' : '#F1F5F9' }]}>
                                            <Ionicons name={opt.icon as any} size={24} color={paymentMethod === opt.id ? '#0B3370' : '#64748B'} />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.payMethodTitle}>{opt.label}</Text>
                                            <Text style={[styles.payMethodSub, opt.disabled && { color: '#EF4444' }]}>{opt.sub}</Text>
                                        </View>
                                        {!opt.disabled && (
                                            <View style={[styles.radioOuter, paymentMethod === opt.id && styles.radioActive]}>
                                                {paymentMethod === opt.id && <View style={styles.radioInner} />}
                                            </View>
                                        )}
                                    </TouchableOpacity>
                                ));
                            })()}
                        </View>
                    </View>
                )}

                {step === 'confirm' && (() => {
                    const selectedAddr = addresses?.find(a => a._id === selectedAddressId);
                    const addrText = selectedAddr
                        ? [getStreetValue(selectedAddr), selectedAddr.city, selectedAddr.state, selectedAddr.pincode].filter(Boolean).join(', ')
                        : null;
                    const amount = priceParam ? parseFloat(priceParam) : 0;
                    return (
                        <View style={styles.stepContent}>
                            <Text style={styles.stepTitle}>Review Booking</Text>
                            <Text style={{ fontSize: 14, color: '#475569', marginBottom: 20, marginTop: -4, fontWeight: '500' }}>Please review your booking details before confirming</Text>

                            {/* Unified Booking Summary Card */}
                            <View style={styles.reviewSection}>
                                <View style={[styles.reviewRow, { borderBottomWidth: 1, borderBottomColor: '#F1F5F9', borderStyle: 'dashed' }]}>
                                    <View style={styles.reviewIconBox}>
                                        <Ionicons name="medical" size={18} color="#0B3370" />
                                    </View>
                                    <View style={{ flex: 1, paddingLeft: 12 }}>
                                        <Text style={styles.reviewLabelAlt}>Service</Text>
                                        <Text style={styles.reviewValueAlt}>{service?.name || serviceName}</Text>
                                        <Text style={{ fontSize: 13, color: '#64748B', marginTop: 2, fontWeight: '600' }}>
                                            {isDoctorService ? 'Doctor consultation' : 'Service'} • {service?.fulfillmentMode === 'HOSPITAL_VISIT' ? 'Hospital' : service?.fulfillmentMode === 'VIRTUAL' ? 'Online' : 'Home'}
                                        </Text>
                                    </View>
                                </View>
                                
                                {addrText && (
                                    <View style={[styles.reviewRow, { borderBottomWidth: 1, borderBottomColor: '#F1F5F9', borderStyle: 'dashed' }]}>
                                        <View style={styles.reviewIconBox}>
                                            <Ionicons name="location" size={18} color="#0B3370" />
                                        </View>
                                        <View style={{ flex: 1, paddingLeft: 12 }}>
                                            <Text style={styles.reviewLabelAlt}>Service Location</Text>
                                            <Text style={styles.reviewValueAlt}>{addrText}</Text>
                                        </View>
                                    </View>
                                )}

                                <View style={[styles.reviewRow, { borderBottomWidth: 0 }]}>
                                    <View style={styles.reviewIconBox}>
                                        <Ionicons name="calendar" size={18} color="#0B3370" />
                                    </View>
                                    <View style={{ flex: 1, paddingLeft: 12 }}>
                                        <Text style={styles.reviewLabelAlt}>Date & Time</Text>
                                        <Text style={styles.reviewValueAlt}>{getDisplaySchedule()}</Text>
                                    </View>
                                </View>
                            </View>

                            {/* Coupon Code */}
                            <View style={styles.reviewSection}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                        <Ionicons name="pricetag" size={18} color="#D97706" />
                                        <Text style={{ fontSize: 16, fontWeight: '800', color: '#0F172A' }}>Apply Coupon</Text>
                                    </View>
                                    <TouchableOpacity onPress={() => setShowCouponModal(true)}>
                                        <Text style={{ fontSize: 13, color: '#0B3370', fontWeight: '800' }}>View Offers</Text>
                                    </TouchableOpacity>
                                </View>
                                <View style={{ flexDirection: 'row', gap: 10 }}>
                                    <TextInput
                                        style={{ flex: 1, height: 48, borderRadius: 12, backgroundColor: '#F8FAFC', borderWidth: 1.5, borderColor: couponApplied ? '#16A34A' : '#E2E8F0', paddingHorizontal: 16, fontSize: 15, fontWeight: '800', color: '#0F172A', letterSpacing: 1 }}
                                        placeholder="Enter code"
                                        placeholderTextColor="#94A3B8"
                                        value={couponInput}
                                        onChangeText={t => { setCouponInput(t.toUpperCase()); setCouponApplied(null); }}
                                        autoCapitalize="characters"
                                        editable={!couponApplied}
                                    />
                                    {couponApplied ? (
                                        <TouchableOpacity onPress={() => { setCouponApplied(null); setCouponInput(''); }} style={{ height: 48, paddingHorizontal: 18, borderRadius: 12, backgroundColor: '#FEE2E2', justifyContent: 'center', borderWidth: 1, borderColor: '#FECACA' }}>
                                            <Text style={{ fontSize: 14, fontWeight: '900', color: '#EF4444' }}>Remove</Text>
                                        </TouchableOpacity>
                                    ) : (
                                        <TouchableOpacity onPress={() => handleApplyCoupon()} disabled={couponChecking} style={{ height: 48, paddingHorizontal: 24, borderRadius: 12, backgroundColor: '#0B3370', justifyContent: 'center' }}>
                                            {couponChecking ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={{ fontSize: 14, fontWeight: '900', color: '#FFF' }}>Apply</Text>}
                                        </TouchableOpacity>
                                    )}
                                </View>
                                {couponApplied && (
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, backgroundColor: '#F0FDF4', borderRadius: 8, padding: 10 }}>
                                        <Ionicons name="checkmark-circle" size={16} color="#16A34A" />
                                        <Text style={{ fontSize: 13, color: '#16A34A', fontWeight: '600' }}>"{couponApplied.code}" applied — ₹{couponApplied.discount} off!</Text>
                                    </View>
                                )}
                            </View>

                            {/* Payment Summary */}
                            <View style={[styles.reviewSection, { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }]}>
                                <Text style={{ fontSize: 16, fontWeight: '800', color: '#0F172A', marginBottom: 16 }}>Bill Details</Text>
                                
                                <View style={[styles.reviewRow, { paddingVertical: 4 }]}>
                                    <Text style={styles.billLabel}>Item Total</Text>
                                    <Text style={styles.billValue}>{formatCurrency(amount)}</Text>
                                </View>
                                
                                {couponApplied && (
                                    <View style={[styles.reviewRow, { paddingVertical: 4 }]}>
                                        <Text style={[styles.billLabel, { color: '#16A34A' }]}>Coupon Discount</Text>
                                        <Text style={[styles.billValue, { color: '#16A34A' }]}>-{formatCurrency(couponApplied.discount)}</Text>
                                    </View>
                                )}
                                
                                <View style={[styles.reviewRow, { paddingVertical: 4 }]}>
                                    <Text style={styles.billLabel}>Payment Method</Text>
                                    <Text style={[styles.billValue, { color: paymentMethod === 'ONLINE' ? '#059669' : '#D97706' }]}>{paymentMethod}</Text>
                                </View>

                                <View style={{ height: 1, backgroundColor: '#CBD5E1', borderStyle: 'dashed', marginVertical: 14 }} />

                                <View style={[styles.reviewRow, { paddingVertical: 0, alignItems: 'center' }]}>
                                    <Text style={{ flex: 1, fontSize: 18, fontWeight: '900', color: '#0F172A' }}>To Pay</Text>
                                    <Text style={{ fontSize: 24, fontWeight: '900', color: '#0B3370', letterSpacing: -0.5 }}>{formatCurrency(couponApplied ? couponApplied.finalAmount : amount)}</Text>
                                </View>
                            </View>
                        </View>
                    );
                })()}
            </ScrollView>

            <View style={[styles.footer, { paddingBottom: footerBottomPadding }]}>
                <Button
                    label={step === 'confirm' ? 'Confirm Booking' : 'Continue →'}
                    onPress={() => {
                        if (step === 'confirm') handleFinalSubmit();
                        else if (step === 'info' && !isAuthenticated) router.push('/(auth)/login');
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
                                                isActive && { backgroundColor: '#EEF4FF', borderColor: '#0B3370', borderWidth: 2 }
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
                                                    color={isActive ? '#0B3370' : '#64748B'}
                                                    style={styles.chipIcon}
                                                />
                                            </View>
                                            <Text style={[
                                                styles.chipText,
                                                isActive && { color: '#0B3370' }
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
            {/* Coupon Modal */}
            <Modal visible={showCouponModal} transparent animationType="slide" onRequestClose={() => setShowCouponModal(false)}>
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
                    <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '80%' }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <Text style={{ fontSize: 18, fontWeight: '700', color: Colors.textPrimary }}>Available Coupons</Text>
                            <TouchableOpacity onPress={() => setShowCouponModal(false)}>
                                <Ionicons name="close-circle" size={28} color="#94A3B8" />
                            </TouchableOpacity>
                        </View>
                        {couponsLoading ? (
                            <ActivityIndicator size="large" color={Colors.primary} style={{ marginVertical: 40 }} />
                        ) : availableCoupons?.length ? (
                            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40, gap: 12 }}>
                                {availableCoupons.map((coupon) => (
                                    <View key={coupon.code} style={{ borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, padding: 16, backgroundColor: '#F8FAFC' }}>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                                            <View>
                                                <Text style={{ fontSize: 16, fontWeight: '800', color: Colors.primary }}>{coupon.code}</Text>
                                                <Text style={{ fontSize: 13, color: '#0F172A', fontWeight: '600', marginTop: 2 }}>{coupon.discountValue}{coupon.discountType === 'PERCENTAGE' ? '%' : '₹'} OFF</Text>
                                            </View>
                                            <TouchableOpacity 
                                                onPress={() => {
                                                    setShowCouponModal(false);
                                                    handleApplyCoupon(coupon.code);
                                                }}
                                                style={{ backgroundColor: Colors.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }}
                                            >
                                                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>Apply</Text>
                                            </TouchableOpacity>
                                        </View>
                                        <Text style={{ fontSize: 12, color: Colors.textSecondary, lineHeight: 18 }}>{coupon.description}</Text>
                                        {(coupon.minOrderAmount > 0 || coupon.maxDiscountAmount > 0) && (
                                            <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#E2E8F0', flexDirection: 'row', gap: 16 }}>
                                                {coupon.minOrderAmount > 0 && <Text style={{ fontSize: 11, color: '#64748B' }}>Min Order: ₹{coupon.minOrderAmount}</Text>}
                                                {coupon.maxDiscountAmount > 0 && <Text style={{ fontSize: 11, color: '#64748B' }}>Max Discount: ₹{coupon.maxDiscountAmount}</Text>}
                                            </View>
                                        )}
                                    </View>
                                ))}
                            </ScrollView>
                        ) : (
                            <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                                <Ionicons name="ticket-outline" size={48} color="#CBD5E1" />
                                <Text style={{ fontSize: 15, color: Colors.textSecondary, marginTop: 12 }}>No coupons available right now</Text>
                            </View>
                        )}
                    </View>
                </View>
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

    scroll: { paddingBottom: 0 },
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
        borderRadius: 16,
        padding: 0,
        flexDirection: 'column',
        gap: 0,
        marginBottom: 14,
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
        elevation: 2,
        shadowColor: '#0F172A',
        shadowOpacity: 0.04,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        overflow: 'hidden',
    },
    addressCardActive: { borderColor: '#0B3370', borderWidth: 2 },
    iconBox: {
        width: 48,
        height: 48,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
    radioOuter: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#CBD5E1',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 2,
    },
    radioActive: { borderColor: '#0B3370', backgroundColor: '#0B3370' },
    radioInner: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#FFF',
    },
    addrLabel: { fontSize: 15, fontWeight: '800', color: '#0F172A', marginBottom: 2, letterSpacing: -0.2 },
    addrStreet: { fontSize: 14, color: '#475569', fontWeight: '600', lineHeight: 20 },
    addrCity: { fontSize: 13, color: '#64748B', marginTop: 2, fontWeight: '500' },
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
        paddingVertical: 16,
        alignItems: 'center',
        backgroundColor: '#EEF4FF',
        borderRadius: 16,
        marginTop: 8,
        borderWidth: 1,
        borderColor: '#BFDBFE',
    },
    addAddrMiniText: {
        fontSize: 15,
        color: '#0B3370',
        fontWeight: '900',
        letterSpacing: -0.2,
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
        fontSize: 15,
        fontWeight: '800',
        color: '#0F172A',
        marginBottom: 8,
        marginTop: 12,
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
        marginBottom: 24,
    },
    dateChip: {
        width: 68,
        height: 88,
        backgroundColor: '#FFF',
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
    },
    dateChipActive: {
        backgroundColor: '#0B3370',
        borderColor: '#0B3370',
        shadowColor: '#0B3370',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
        elevation: 6,
    },
    dateChipDay: {
        fontSize: 12,
        fontWeight: '800',
        color: '#64748B',
        textTransform: 'uppercase',
    },
    dateChipNum: {
        fontSize: 24,
        fontWeight: '900',
        color: '#0F172A',
        marginVertical: 4,
        letterSpacing: -0.5,
    },
    dateChipMonth: {
        fontSize: 10,
        fontWeight: '600',
        color: '#64748B',
    },
    timeGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginTop: 14,
    },
    timeChip: {
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderRadius: 14,
        backgroundColor: '#F8FAFC',
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
        minWidth: '28%',
        alignItems: 'center',
    },
    timeChipActive: {
        backgroundColor: '#EEF4FF',
        borderColor: '#0B3370',
        borderWidth: 2,
    },
    timeChipText: {
        fontSize: 12,
        fontWeight: '800',
        color: '#475569',
    },
    asapIcon: { fontSize: 18 },
    asapText: { flex: 1, fontSize: FontSize.xs, color: Colors.textSecondary, lineHeight: 18 },
    noSlotsCard: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
        backgroundColor: '#FFF8E1',
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: '#F59E0B',
        padding: 14,
        marginTop: 8,
    },
    noSlotsIcon: { fontSize: 22 },
    noSlotsTitle: { fontSize: 14, fontWeight: '700', color: '#92400E', marginBottom: 4 },
    noSlotsSub: { fontSize: 12, color: '#B45309', lineHeight: 18 },

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
        gap: 14,
        backgroundColor: '#FFF',
        borderRadius: 20,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
        elevation: 2,
        shadowColor: '#0F172A',
        shadowOpacity: 0.04,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
    },
    payMethodIconBox: {
        width: 48,
        height: 48,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
    payMethodTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A', marginBottom: 2, letterSpacing: -0.2 },
    payMethodSub: { fontSize: 13, color: '#64748B', fontWeight: '600' },
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
    reviewSection: {
        backgroundColor: '#FFF',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
        elevation: 2,
        shadowColor: '#0F172A',
        shadowOpacity: 0.04,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
    },
    reviewRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingVertical: 14,
    },
    reviewIconBox: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: '#EEF4FF',
        justifyContent: 'center',
        alignItems: 'center',
    },
    reviewLabelAlt: { fontSize: 13, color: '#64748B', fontWeight: '700', marginBottom: 2 },
    reviewValueAlt: { fontSize: 15, fontWeight: '800', color: '#0F172A', lineHeight: 22 },
    
    billLabel: { fontSize: 14, color: '#475569', fontWeight: '600', flex: 1 },
    billValue: { fontSize: 15, fontWeight: '800', color: '#0F172A' },

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
        paddingBottom: 16,
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
        marginBottom: 28,
    },
    modalTitle: { fontSize: 22, fontWeight: '900', color: '#0F172A', letterSpacing: -0.5 },
    modalInputLabel: { fontSize: 13, fontWeight: '800', color: '#475569', marginBottom: 8, marginTop: 20 },
    modalInput: {
        backgroundColor: '#FFF',
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
        borderRadius: 16,
        paddingHorizontal: 16,
        paddingVertical: 16,
        fontSize: 15,
        fontWeight: '600',
        color: '#0F172A',
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
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 24,
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
        backgroundColor: '#FFF',
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
    chipText: { fontSize: 14, lineHeight: 18, fontWeight: '800', color: '#475569' },
    saveAddrBtn: {
        backgroundColor: '#0B3370',
        borderRadius: 16,
        paddingVertical: 18,
        alignItems: 'center',
        marginTop: 36,
        marginBottom: 24,
        elevation: 8,
        shadowColor: '#0B3370',
        shadowOpacity: 0.25,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 },
    },
    saveAddrBtnText: { color: '#FFF', fontSize: 16, fontWeight: '900', letterSpacing: 0.5 },
});

