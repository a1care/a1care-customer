/**
 * Global toast utility for the A1Care customer app.
 * All success / error / info / warning messages should use these helpers
 * instead of calling Toast.show() or Alert.alert() directly.
 *
 * Usage:
 *   import { showToast } from '@/utils/toast';
 *   showToast.success('Saved!', 'Your changes have been saved.');
 *   showToast.error('Oops!', 'Something went wrong.');
 *   showToast.info('FYI', 'Your session will expire soon.');
 *   showToast.warn('Heads up', 'Please fill all required fields.');
 */

import Toast from 'react-native-toast-message';

const DEFAULT_DURATION = 3500;
const LONG_DURATION = 5000;

export const showToast = {
    success: (title: string, message?: string, duration = DEFAULT_DURATION) => {
        Toast.show({
            type: 'success',
            text1: title,
            text2: message,
            position: 'top',
            visibilityTime: duration,
            autoHide: true,
            topOffset: 50,
        });
    },

    error: (title: string, message?: string, duration = LONG_DURATION) => {
        Toast.show({
            type: 'error',
            text1: title,
            text2: message,
            position: 'top',
            visibilityTime: duration,
            autoHide: true,
            topOffset: 50,
        });
    },

    info: (title: string, message?: string, duration = DEFAULT_DURATION) => {
        Toast.show({
            type: 'info',
            text1: title,
            text2: message,
            position: 'top',
            visibilityTime: duration,
            autoHide: true,
            topOffset: 50,
        });
    },

    warn: (title: string, message?: string, duration = LONG_DURATION) => {
        Toast.show({
            type: 'warning',
            text1: title,
            text2: message,
            position: 'top',
            visibilityTime: duration,
            autoHide: true,
            topOffset: 50,
        });
    },

    hide: () => Toast.hide(),
};
