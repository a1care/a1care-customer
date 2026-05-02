import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/**
 * A platform-agnostic storage utility for auth tokens.
 * Uses SecureStore on Native for encryption, and localStorage on Web.
 */
export const tokenStorage = {
    async setItem(key: string, value: string) {
        if (Platform.OS === 'web') {
            localStorage.setItem(key, value);
        } else {
            await SecureStore.setItemAsync(key, value);
        }
    },

    async getItem(key: string): Promise<string | null> {
        if (Platform.OS === 'web') {
            return localStorage.getItem(key);
        } else {
            return await SecureStore.getItemAsync(key);
        }
    },

    async removeItem(key: string) {
        if (Platform.OS === 'web') {
            localStorage.removeItem(key);
        } else {
            await SecureStore.deleteItemAsync(key);
        }
    }
};
