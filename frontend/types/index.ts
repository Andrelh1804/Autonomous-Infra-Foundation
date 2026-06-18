export interface Organization {
  id: number;
  uuid: string;
  name: string;
  company_name?: string;
  document?: string;
  status: string;
  created_at: string;
  updated_at?: string;
}

export interface User {
  id: number;
  uuid: string;
  organization_id?: number;
  first_name: string;
  last_name: string;
  email: string;
  active: boolean;
  is_super_admin: boolean;
  mfa_enabled: boolean;
  last_login?: string;
  created_at: string;
  roles: string[];
}

export interface Role {
  id: number;
  name: string;
  description?: string;
  permissions: string[];
}

export interface Permission {
  id: number;
  name: string;
  module: string;
  description?: string;
}

export interface Site {
  id: number;
  organization_id: number;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  created_at: string;
}

export interface AuditLog {
  id: number;
  user_id?: number;
  user_email?: string;
  action: string;
  module: string;
  ip_address?: string;
  payload?: string;
  created_at: string;
}

export interface DashboardStats {
  total_organizations: number;
  total_users: number;
  active_sessions: number;
  active_organizations: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export interface AuthUser {
  id: number;
  uuid: string;
  organization_id?: number;
  first_name: string;
  last_name: string;
  email: string;
  is_super_admin: boolean;
  roles: string[];
}

// ── Phase 2: CMDB / Discovery Types ───────────────────────────────────────────

export interface AssetType {
  id: number;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
}

export interface Manufacturer {
  id: number;
  name: string;
  website?: string;
  support_url?: string;
}

export interface Tag {
  id: number;
  name: string;
  color: string;
}

export interface Asset {
  id: number;
  uuid: string;
  organization_id: number;
  site_id?: number;
  asset_type_id?: number;
  manufacturer_id?: number;
  model_id?: number;
  hostname?: string;
  fqdn?: string;
  ip_address?: string;
  mac_address?: string;
  serial_number?: string;
  operating_system?: string;
  os_version?: string;
  firmware_version?: string;
  description?: string;
  location?: string;
  responsible?: string;
  status: string;
  criticality: string;
  approval_status: string;
  last_seen?: string;
  created_at: string;
  updated_at?: string;
  asset_type?: AssetType;
  manufacturer?: Manufacturer;
  tags: Tag[];
}

export interface AssetHistory {
  id: number;
  asset_id: number;
  changed_by?: number;
  change_source: string;
  changes?: string;
  created_at: string;
}

export interface AssetRelationship {
  id: number;
  source_asset_id: number;
  target_asset_id: number;
  relationship_type: string;
  description?: string;
  created_at: string;
}

export interface DiscoveryJob {
  id: number;
  uuid: string;
  organization_id: number;
  site_id?: number;
  name?: string;
  targets?: string;
  methods?: string;
  status: string;
  hosts_scanned: number;
  hosts_found: number;
  error_message?: string;
  started_at?: string;
  finished_at?: string;
  created_at: string;
}

export interface DiscoveryResult {
  id: number;
  discovery_job_id: number;
  asset_id?: number;
  ip_address?: string;
  hostname?: string;
  status: string;
  created_at: string;
}

export interface AssetStats {
  total: number;
  by_type: Record<string, { name: string; count: number }>;
  by_status: Record<string, number>;
}

export interface DiscoveryStats {
  total_jobs: number;
  completed: number;
  running: number;
  failed: number;
  pending: number;
  total_hosts_found: number;
}

export interface AlertRule {
  id: number;
  organization_id: number;
  name: string;
  is_enabled: boolean;
  trigger: string;
  min_hosts_found: number;
  channel: string;
  email_recipients?: string;
  webhook_url?: string;
  created_at: string;
  updated_at?: string;
}

export interface AlertEvent {
  id: number;
  rule_id: number;
  discovery_job_id?: number;
  trigger: string;
  channel: string;
  status: string;
  error_message?: string;
  sent_at: string;
}

export interface AlertStats {
  total_rules: number;
  enabled_rules: number;
  total_events: number;
  sent_events: number;
  failed_events: number;
}

export interface DiscoverySchedule {
  id: number;
  organization_id: number;
  site_id?: number;
  name: string;
  targets: string;
  methods?: string;
  interval_minutes: number;
  is_enabled: boolean;
  last_run_at?: string;
  next_run_at?: string;
  last_job_id?: number;
  created_at: string;
  updated_at?: string;
}
