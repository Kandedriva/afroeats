// TypeScript type definitions for Afro Restaurant backend

export interface User {
  id: number;
  name: string;
  email: string;
  address?: string;
  phone?: string;
  created_at: Date;
  last_login_at?: Date;
  last_login_ip?: string;
  email_verified: boolean;
}

export interface RestaurantOwner {
  id: number;
  name: string;
  email: string;
  created_at: Date;
  last_login_at?: Date;
  last_login_ip?: string;
  email_verified: boolean;
}

export interface Restaurant {
  id: number;
  name: string;
  address?: string;
  phone_number?: string;
  image_url?: string;
  owner_id: number;
  stripe_account_id?: string;
  created_at: Date;
  owner_name?: string; // Joined from restaurant_owners table
}

export interface Dish {
  id: number;
  name: string;
  description?: string;
  price: number;
  image_url?: string;
  restaurant_id: number;
  is_available: boolean;
  created_at: Date;
  restaurant_name?: string; // Joined from restaurants table
}

export interface Order {
  id: number;
  user_id: number;
  total: number;
  status: OrderStatus;
  order_details?: string;
  delivery_address?: string;
  delivery_phone?: string;
  delivery_type: DeliveryType;
  restaurant_instructions?: Record<number, string>; // JSONB
  stripe_session_id?: string;
  paid_at?: Date;
  platform_fee: number;
  ip_address?: string;
  user_agent?: string;
  created_at: Date;
}

export interface OrderItem {
  id: number;
  order_id: number;
  dish_id: number;
  name: string;
  price: number;
  quantity: number;
  restaurant_id: number;
}

export interface CartItem {
  id: number;
  user_id: number;
  dish_id: number;
  quantity: number;
  created_at: Date;
  // Joined fields
  name?: string;
  price?: number;
  image_url?: string;
  restaurant_name?: string;
  restaurant_id?: number;
}

export interface Notification {
  id: number;
  owner_id?: number;
  user_id?: number; // For customer notifications
  order_id?: number;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, any>; // JSONB
  read: boolean;
  created_at: Date;
}

export interface PerformanceMetric {
  id: number;
  metric_type: string;
  metric_name: string;
  value: number;
  unit: string;
  metadata: Record<string, any>; // JSONB
  recorded_at: Date;
}

export interface ErrorLog {
  id: number;
  error_id: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  message: string;
  stack_trace?: string;
  metadata: Record<string, any>; // JSONB
  user_id?: number;
  session_id?: string;
  ip_address?: string;
  user_agent?: string;
  url?: string;
  method?: string;
  occurred_at: Date;
  resolved: boolean;
  resolution_notes?: string;
  first_seen: Date;
  last_seen: Date;
  occurrence_count: number;
}

// Enums
export type OrderStatus = 
  | 'pending' 
  | 'confirmed' 
  | 'preparing' 
  | 'ready' 
  | 'out_for_delivery' 
  | 'delivered' 
  | 'completed' 
  | 'cancelled'
  | 'paid';

export type DeliveryType = 'delivery' | 'pickup';

export type NotificationType = 
  | 'order_created'
  | 'order_cancelled' 
  | 'order_completed'
  | 'payment_received'
  | 'refund_request'
  | 'partial_cancellation'
  | 'system_alert';

export type ErrorCategory = 
  | 'authentication'
  | 'authorization'
  | 'validation'
  | 'database'
  | 'payment'
  | 'external_api'
  | 'network'
  | 'system'
  | 'business_logic'
  | 'unknown';

export type ErrorSeverity = 'critical' | 'high' | 'medium' | 'low';

export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

export type LogCategory = 
  | 'auth'
  | 'order'
  | 'payment'
  | 'database'
  | 'security'
  | 'performance'
  | 'api'
  | 'general';

// Request/Response types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  secret_word?: string;
  address?: string;
  phone?: string;
}

export interface AuthResponse {
  user: User;
  sessionInfo?: {
    sessionId: string;
    loginTime: string;
  };
}

export interface OrderRequest {
  delivery_address: string;
  delivery_phone: string;
  delivery_type?: DeliveryType;
  order_details?: string;
  restaurant_instructions?: Record<number, string>;
}

export interface OrderResponse {
  order: Order;
  items: OrderItem[];
}

export interface CartAddRequest {
  dish_id: number;
  quantity: number;
}

export interface CartUpdateRequest {
  dish_id: number;
  quantity: number;
}

export interface PasswordUpdateRequest {
  email: string;
  secret_word: string;
  new_password: string;
}

export interface ProfileUpdateRequest {
  name: string;
  email: string;
  phone?: string;
  address?: string;
}

// Analytics types
export interface RestaurantAnalytics {
  restaurant_id: number;
  restaurant_name: string;
  owner_id: number;
  total_orders: number;
  unique_customers: number;
  total_revenue: number;
  avg_order_value: number;
  total_dishes: number;
  available_dishes: number;
  last_order_date?: Date;
  first_order_date?: Date;
}

export interface PerformanceStats {
  metric_type: string;
  metric_name: string;
  count: number;
  avg_value: number;
  min_value: number;
  max_value: number;
  median: number;
  p95: number;
  p99: number;
}

export interface DatabaseHealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy' | 'error';
  timestamp: string;
  checks: {
    connectionPool: HealthCheckResult;
    cacheHitRatio: HealthCheckResult;
    lockWaits: HealthCheckResult;
    tableSizes: HealthCheckResult;
    slowQueries: HealthCheckResult;
    indexUsage: HealthCheckResult;
  };
  error?: string;
}

export interface HealthCheckResult {
  status: 'healthy' | 'warning' | 'error' | 'info';
  message: string;
  data?: any;
  error?: string;
}

// Express session extension
declare module 'express-session' {
  interface SessionData {
    userId?: number;
    userName?: string;
    userEmail?: string;
    loginTime?: string;
    isMobile?: boolean;
    recoveredSession?: boolean;
  }
}

// Express request extension
declare global {
  namespace Express {
    interface Request {
      isMobile?: boolean;
      isChrome?: boolean;
      loginAttempts?: {
        remaining: number;
      };
    }
  }
}

// Database query result types
export interface QueryResult<T = any> {
  rows: T[];
  rowCount: number;
  command: string;
  oid: number;
  fields: Array<{
    name: string;
    tableID: number;
    columnID: number;
    dataTypeID: number;
    dataTypeSize: number;
    dataTypeModifier: number;
    format: string;
  }>;
}

// Utility types
export type Partial<T> = {
  [P in keyof T]?: T[P];
};

export type Pick<T, K extends keyof T> = {
  [P in K]: T[P];
};

export type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;

// API response wrapper
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
    hasNext?: boolean;
    hasPrev?: boolean;
  };
}

// Pagination types
export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}