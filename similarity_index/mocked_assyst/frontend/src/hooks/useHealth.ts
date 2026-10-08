import { useQuery } from '@tanstack/react-query';
import { fetchHealth } from '@/api/health';
import { fetchAdminStats, fetchAdminConfig } from '@/api/admin';

export function useHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: fetchHealth,
    refetchInterval: 30000,
  });
}

export function useAdminStats() {
  return useQuery({
    queryKey: ['admin-stats'],
    queryFn: fetchAdminStats,
    refetchInterval: 60000,
  });
}

export function useAdminConfig() {
  return useQuery({
    queryKey: ['admin-config'],
    queryFn: fetchAdminConfig,
    staleTime: 5 * 60 * 1000,
  });
}
