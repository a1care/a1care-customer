import api from "./api";

export interface CreateOrderParams {
    amount: number;
    type: "WALLET_TOPUP" | "BOOKING";
    referenceId?: string;
}

export interface Order {
    _id: string;
    userId: string;
    amount: number;
    status: string;
    txnId: string;
    type: string;
}

export const paymentService = {
    createOrder: async (params: CreateOrderParams) => {
        const res = await api.post("/payments/orders/create", params);
        return res.data.data;
    },

    initiatePayment: async (orderId: string) => {
        const res = await api.post("/payments/initiate", { orderId });
        return res.data.data;
    },

    initiateRazorpay: async (orderId: string) => {
        const res = await api.post("/payments/razorpay/initiate", { orderId });
        return res.data.data;
    },

    verifyRazorpay: async (params: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string; orderId: string }) => {
        const res = await api.post("/payments/razorpay/verify", params);
        return res.data.data;
    },

    verifyPayment: async (orderId: string) => {
        const res = await api.post("/payments/verify", { orderId });
        return res.data.data;
    },

    getOrder: async (orderId: string): Promise<Order> => {
        const res = await api.get(`/payments/orders/${orderId}`);
        return res.data.data;
    }
};
