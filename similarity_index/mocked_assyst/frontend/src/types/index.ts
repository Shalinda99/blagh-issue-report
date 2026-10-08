export type EventType = 'INCIDENT' | 'PROBLEM' | 'CHANGE' | 'SERVICE_REQUEST' | 'ORDER' | 'TASK' | 'DECISION';
export type EventStatus = 'OPEN' | 'IN_PROGRESS' | 'PENDING' | 'RESOLVED' | 'CLOSED' | 'CANCELLED';
export type PriorityCode = 'P1' | 'P2' | 'P3' | 'P4';

export interface UserDto {
  id: number;
  shortCode?: string;
  name?: string;
  email?: string;
}

export interface GroupDto {
  id: number;
  shortCode?: string;
  name?: string;
}

export interface TechnicianDto {
  id: number;
  shortCode?: string;
  name?: string;
  email?: string;
}

export interface ServiceDto {
  id: number;
  shortCode?: string;
  name?: string;
}

export interface CategoryDto {
  id: number;
  shortCode?: string;
  name?: string;
}

export interface SubCategoryDto {
  id: number;
  shortCode?: string;
  name?: string;
}

export interface EventRefDto {
  id: number;
  eventRef?: string;
  shortDescription?: string;
}

export interface AssystEvent {
  id: number;
  version: number;
  eventRef?: string;
  eventType?: EventType;
  eventStatus?: EventStatus;
  shortDescription?: string;
  remarks?: string;
  priorityCode?: string;
  priorityDescription?: string;
  impact?: number;
  urgency?: number;
  creationDate?: string;
  lastModifiedDate?: string;
  resolvedDate?: string;
  closedDate?: string;
  requiredDate?: string;
  resolutionCode?: string;
  resolutionRemarks?: string;
  affectedUserId?: number;
  assignedGroupId?: number;
  assignedTechId?: number;
  serviceId?: number;
  categoryId?: number;
  subCategoryId?: number;
  affectedUser?: UserDto;
  assignedGroup?: GroupDto;
  assignedTech?: TechnicianDto;
  service?: ServiceDto;
  category?: CategoryDto;
  subCategory?: SubCategoryDto;
  parentEvent?: EventRefDto;
  linkedEvents?: EventRefDto[];
}

export interface AssystAttachment {
  id: number;
  eventId: number;
  fileName: string;
  contentType?: string;
  size: number;
  createdDate?: string;
}

export interface UserResource {
  id: number;
  shortCode: string;
  name: string;
  email?: string;
  version: number;
}

export interface TeamResource {
  id: number;
  shortCode: string;
  name: string;
  version: number;
}

export interface CategoryResource {
  id: number;
  shortCode: string;
  name: string;
  version: number;
  subCategories?: SubCategoryDto[];
}

export interface ServiceResource {
  id: number;
  shortCode: string;
  name: string;
  version: number;
}

export interface AssystError {
  type: string;
  message: string;
  diagnostic?: string;
}

export interface HealthResponse {
  status: string;
  timestamp: string;
  service: string;
  environment: string;
  database: string;
  apiVersion: string;
  mockMode: boolean;
}

export interface AdminStats {
  eventCount: number;
  userCount: number;
  teamCount: number;
  mockOnly: boolean;
}

export interface AdminConfig {
  appName: string;
  environment: string;
  apiVersion: string;
  basePath: string;
  auth: { authEnabled: boolean; username: string; bypassEnabled: boolean };
  faultInjection: { enabled: boolean; errorRate: number; delayMs: number };
  pagination: { defaultSize: number; maxSize: number };
  mockOnly: boolean;
}

export interface EventListParams {
  eventType?: string;
  eventStatus?: string;
  priorityCode?: string;
  creationDate?: string;
  lastModifiedDate?: string;
  assignedGroupId?: number;
  serviceId?: number;
  categoryId?: number;
  startRow?: number;
  numberOfRows?: number;
  sortField?: string;
  sortOrder?: 'asc' | 'desc';
  fields?: string;
}
