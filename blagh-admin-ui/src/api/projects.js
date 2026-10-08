import { api } from './client.js';

export function getProjects() {
  return api.get('/api/projects');
}

export function createProject(data) {
  return api.post('/api/projects', data);
}

export function updateProject(appId, data) {
  return api.patch(`/api/projects/${appId}`, data);
}
