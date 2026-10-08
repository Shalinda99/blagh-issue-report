import client from './client';
import type { HealthResponse } from '@/types';

export async function fetchHealth(): Promise<HealthResponse> {
  const { data } = await client.get<HealthResponse>('/health');
  return data;
}
