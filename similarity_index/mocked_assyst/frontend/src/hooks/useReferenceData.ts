import { useQuery } from '@tanstack/react-query';
import { fetchUsers, fetchTeams, fetchCategories, fetchServices } from '@/api/reference-data';

export function useUsers() {
  return useQuery({ queryKey: ['users'], queryFn: () => fetchUsers(0, 100), staleTime: 5 * 60 * 1000 });
}

export function useTeams() {
  return useQuery({ queryKey: ['teams'], queryFn: () => fetchTeams(0, 50), staleTime: 5 * 60 * 1000 });
}

export function useCategories() {
  return useQuery({ queryKey: ['categories'], queryFn: () => fetchCategories(0, 100), staleTime: 5 * 60 * 1000 });
}

export function useServices() {
  return useQuery({ queryKey: ['services'], queryFn: () => fetchServices(0, 50), staleTime: 5 * 60 * 1000 });
}
