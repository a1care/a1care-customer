import api from './api';

export const referralService = {
    getMyCode: async () => {
        const res = await api.get('/referral/my-code');
        return res.data.data as { referralCode: string; shareMessage: string };
    },

    validate: async (code: string) => {
        const res = await api.post('/referral/validate', { code });
        return res.data.data as { referrerId: string; referrerName: string; rewardAmount: number };
    },
};

export const couponService = {
    preview: async (code: string, orderAmount: number, bookingType = 'SERVICE') => {
        const res = await api.post('/coupons/preview', { code, orderAmount, bookingType });
        return res.data.data as {
            code: string;
            discountType: string;
            discountValue: number;
            discount: number;
            finalAmount: number;
        };
    },
};
