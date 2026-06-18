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
