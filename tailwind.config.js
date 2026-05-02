/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        './app/**/*.{js,jsx,ts,tsx}',
        './components/**/*.{js,jsx,ts,tsx}',
    ],
    presets: [require('nativewind/preset')],
    theme: {
        extend: {
            colors: {
                primary: {
                    DEFAULT: '#2F80ED',
                    50: '#EBF3FD',
                    100: '#D0E5FB',
                    200: '#A1CBF7',
                    400: '#5F9FEF',
                    600: '#1A6FDB',
                    700: '#1459B0',
                },
                health: {
                    DEFAULT: '#27AE60',
                    50: '#E9F7EF',
                    100: '#D1EFE0',
                },
                emergency: {
                    DEFAULT: '#EB5757',
                    50: '#FEF0F0',
                    100: '#FDD8D8',
                },
                background: '#F8FAFC',
                card: '#FFFFFF',
                textPrimary: '#1F2937',
                textSecondary: '#6B7280',
                border: '#E5E7EB',
                muted: '#9CA3AF',
            },
            fontFamily: {
                'inter': ['Inter_400Regular'],
                'inter-medium': ['Inter_500Medium'],
                'inter-semibold': ['Inter_600SemiBold'],
                'inter-bold': ['Inter_700Bold'],
            },
            borderRadius: {
                'xl': '16px',
                '2xl': '24px',
            },
        },
    },
    plugins: [],
};
