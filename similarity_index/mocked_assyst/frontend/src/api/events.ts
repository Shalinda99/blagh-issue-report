import client from './client';
import type { AssystEvent, AssystAttachment, EventListParams } from '@/types';

export async function fetchEvents(params: EventListParams = {}): Promise<AssystEvent[]> {
  const { data } = await client.get<AssystEvent[]>('/assystREST/v2/events', { params });
  return data;
}

export async function fetchEvent(id: number, fields?: string): Promise<AssystEvent> {
  const { data } = await client.get<AssystEvent>(`/assystREST/v2/events/${id}`, {
    params: fields ? { fields } : undefined,
  });
  return data;
}

export async function createEvent(body: Partial<AssystEvent>): Promise<AssystEvent> {
  const { data } = await client.post<AssystEvent>('/assystREST/v2/events', body);
  return data;
}

export async function updateEvent(id: number, body: Partial<AssystEvent>): Promise<AssystEvent> {
  const { data } = await client.post<AssystEvent>(`/assystREST/v2/events/${id}`, body);
  return data;
}

export async function deleteEvent(id: number): Promise<void> {
  await client.delete(`/assystREST/v2/events/${id}`);
}

export async function fetchEventAttachments(id: number): Promise<AssystAttachment[]> {
  const { data } = await client.get<AssystAttachment[]>(
    `/assystREST/v2/events/${id}/attachments`,
  );
  return data;
}

export async function fetchAttachmentBlob(
  eventId: number,
  attachmentId: number,
): Promise<Blob> {
  const { data } = await client.get<Blob>(
    `/assystREST/v2/events/${eventId}/attachments/${attachmentId}`,
    { responseType: 'blob' },
  );
  return data;
}
