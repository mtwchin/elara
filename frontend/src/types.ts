// Shared TypeScript types used across multiple components.
// View-specific shapes (e.g. the full Property/Tenant records, which differ
// per screen) stay local to their components; only genuinely-shared,
// identical shapes live here to avoid duplication drifting out of sync.

/** A property reduced to dropdown/selector fields. */
export interface PropertyOption {
  id: number;
  address: string;
}

/** A tenant reduced to dropdown/selector fields. */
export interface TenantOption {
  id: number;
  name: string;
}

export type MaintenanceStatus = 'Open' | 'In Progress' | 'Resolved' | 'Closed';
export type MaintenancePriority = 'Low' | 'Normal' | 'High' | 'Urgent';

/** Canonical maintenance request as serialized by the backend. */
export interface MaintenanceRequest {
  id: number;
  propertyId: number;
  tenantId: number | null;
  title: string;
  description: string;
  status: MaintenanceStatus;
  priority: MaintenancePriority;
  createdAt: string;
}
