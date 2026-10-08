import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
  });
}

export function formatDateShort(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

export function elapsedSince(iso?: string): string {
  if (!iso) return '—';
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function priorityColor(code?: string): string {
  switch (code) {
    case 'P1': return 'bg-red-100 text-red-800 border-red-200';
    case 'P2': return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'P3': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'P4': return 'bg-green-100 text-green-800 border-green-200';
    default:   return 'bg-gray-100 text-gray-700 border-gray-200';
  }
}

export function statusColor(status?: string): string {
  switch (status) {
    case 'OPEN':        return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'IN_PROGRESS': return 'bg-indigo-100 text-indigo-800 border-indigo-200';
    case 'PENDING':     return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'RESOLVED':    return 'bg-green-100 text-green-800 border-green-200';
    case 'CLOSED':      return 'bg-gray-100 text-gray-600 border-gray-200';
    case 'CANCELLED':   return 'bg-slate-100 text-slate-500 border-slate-200';
    default:            return 'bg-gray-100 text-gray-600 border-gray-200';
  }
}

export function priorityLabel(code?: string): string {
  return { P1: 'Critical', P2: 'High', P3: 'Medium', P4: 'Low' }[code ?? ''] ?? code ?? '—';
}

export function statusLabel(s?: string): string {
  return s?.replace('_', ' ') ?? '—';
}

export function buildDateRangeParam(from?: string, to?: string): string | undefined {
  if (!from && !to) return undefined;
  return `${from ?? ''},${to ?? ''}`;
}

export function extractAxiosError(err: unknown): string {
  if (typeof err === 'object' && err !== null) {
    const e = err as { response?: { data?: { message?: string; detail?: unknown } }; message?: string };
    if (e.response?.data?.message) return e.response.data.message;
    if (e.message) return e.message;
  }
  return 'An unexpected error occurred.';
}
