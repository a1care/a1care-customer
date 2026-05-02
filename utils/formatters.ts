/**
 * Shared formatters — date, currency, phone, relative time
 */

export function formatCurrency(amount: number): string {
    return `₹${amount.toLocaleString('en-IN')}`;
}

export function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });
}

export function formatDateTime(iso: string): string {
    return new Date(iso).toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export function formatRelativeTime(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return formatDate(iso);
}

export function formatPhone(mobile: string | number): string {
    const str = String(mobile);
    if (str.length === 10) {
        return `+91 ${str.slice(0, 5)} ${str.slice(5)}`;
    }
    return `+91 ${str}`;
}

export function formatNameInitial(name?: string | null): string {
    if (!name) return '?';
    return name
        .trim()
        .split(' ')
        .map((p) => p.charAt(0).toUpperCase())
        .slice(0, 2)
        .join('');
}

export function greetingText(): string {
    const h = new Date().getHours();
    if (h < 12) return 'Good Morning';
    if (h < 17) return 'Good Afternoon';
    return 'Good Evening';
}
