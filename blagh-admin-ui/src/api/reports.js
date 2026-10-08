import { api } from './client.js';

export function getReports({ projectId, status, page = 1, pageSize = 20, days = 14 } = {}) {
  const params = new URLSearchParams();
  if (projectId) params.set('project_id', projectId);
  if (status)    params.set('status', status);
  params.set('page', page);
  params.set('page_size', pageSize);
  params.set('days', days);
  return api.get(`/api/reports?${params}`);
}

export function getReport(refId) {
  return api.get(`/api/reports/${refId}`);
}

export function updateReportStatus(refId, value) {
  return api.patch(`/api/reports/${refId}/status?value=${encodeURIComponent(value)}`);
}
