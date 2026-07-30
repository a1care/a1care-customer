import { io, Socket } from "socket.io-client";
import { API_BASE_URL } from "@/constants/api";

const SOCKET_URL = API_BASE_URL.replace(/\/api\/?$/, "");

let socket: Socket | null = null;

export const socketService = {
    connect: (token: string, patientId: string) => {
        if (socket?.connected) return socket;

        socket = io(SOCKET_URL, {
            auth: { token },
            transports: ["polling", "websocket"],
            path: "/socket.io/",
            reconnection: true,
            reconnectionAttempts: 10,
            reconnectionDelay: 2000,
        });

        socket.on("connect", () => {
            if (__DEV__) console.log("[Socket] Connected:", socket?.id);
            socket?.emit("join_room", `user_${patientId}`);
        });

        socket.on("disconnect", (reason) => {
            if (__DEV__) console.log("[Socket] Disconnected:", reason);
        });

        socket.on("connect_error", (err) => {
            if (__DEV__) console.log("[Socket] Connection Error:", err.message);
        });

        return socket;
    },

    disconnect: () => {
        socket?.disconnect();
        socket = null;
    },

    getSocket: () => {
        return socket;
    }
};
