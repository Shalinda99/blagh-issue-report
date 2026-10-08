import client from './client';
import type { AdminStats, AdminConfig } from '@/types';

export async function fetchAdminStats(): Promise<AdminStats> {
  const { data } = await client.get<AdminStats>('/mock/admin/stats');
  return data;
}

export async function fetchAdminConfig(): Promise<AdminConfig> {
  const { data } = await client.get<AdminConfig>('/mock/admin/config');
  return data;
}

export async function seedData(count = 100): Promise<{ seeded: number }> {
  const { data } = await client.post<{ seeded: number }>(`/mock/admin/seed?count=${count}`);
  return data;
}

export async function resetDatabase(count = 100): Promise<{ reset: boolean; seeded: number }> {
  const { data } = await client.post<{ reset: boolean; seeded: number }>(`/mock/admin/reset?count=${count}`);
  return data;
}
