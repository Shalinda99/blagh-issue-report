import client from './client';
import type { UserResource, TeamResource, CategoryResource, ServiceResource } from '@/types';

export async function fetchUsers(startRow = 0, numberOfRows = 50): Promise<UserResource[]> {
  const { data } = await client.get<UserResource[]>('/assystREST/v2/assystUsers', {
    params: { startRow, numberOfRows },
  });
  return data;
}

export async function fetchTeams(startRow = 0, numberOfRows = 50): Promise<TeamResource[]> {
  const { data } = await client.get<TeamResource[]>('/assystREST/v2/supportGroups', {
    params: { startRow, numberOfRows },
  });
  return data;
}

export async function fetchCategories(startRow = 0, numberOfRows = 50): Promise<CategoryResource[]> {
  const { data } = await client.get<CategoryResource[]>('/assystREST/v2/categories', {
    params: { startRow, numberOfRows },
  });
  return data;
}

export async function fetchServices(startRow = 0, numberOfRows = 50): Promise<ServiceResource[]> {
  const { data } = await client.get<ServiceResource[]>('/assystREST/v2/services', {
    params: { startRow, numberOfRows },
  });
  return data;
}
