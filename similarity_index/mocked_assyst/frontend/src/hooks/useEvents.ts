import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchEvents, fetchEvent, createEvent, updateEvent, deleteEvent,
  fetchEventAttachments,
} from '@/api/events';
import type { EventListParams, AssystEvent } from '@/types';

export const EVENTS_KEY = 'events';
export const ATTACHMENTS_KEY = 'event-attachments';

export function useEvents(params: EventListParams = {}) {
  return useQuery({
    queryKey: [EVENTS_KEY, params],
    queryFn: () => fetchEvents(params),
    placeholderData: (prev) => prev,
  });
}

export function useEvent(id: number, fields?: string) {
  return useQuery({
    queryKey: [EVENTS_KEY, id, fields],
    queryFn: () => fetchEvent(id, fields),
    enabled: !!id,
  });
}

export function useEventAttachments(id: number) {
  return useQuery({
    queryKey: [ATTACHMENTS_KEY, id],
    queryFn: () => fetchEventAttachments(id),
    enabled: !!id,
  });
}

export function useCreateEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<AssystEvent>) => createEvent(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: [EVENTS_KEY] }),
  });
}

export function useUpdateEvent(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<AssystEvent>) => updateEvent(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [EVENTS_KEY, id] });
      qc.invalidateQueries({ queryKey: [EVENTS_KEY] });
    },
  });
}

export function useDeleteEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteEvent(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: [EVENTS_KEY] }),
  });
}
