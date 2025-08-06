// TypeScript type definitions for Afro Restaurant frontend

export interface User {
  id: number;
  name: string;
  email: string;
  address?: string;
  phone?: string;
}

export interface RestaurantOwner {
  id: number;
  name: string;
  email: string;
}

export interface Restaurant {
  id: number;
  name: string;
  address?: string;
  phone_number?: string;
  image_url?: string;
  owner_id: number;
  created_at: string;
  owner_name?: string;
  dish_count?: number;
  available_dishes?: number;
}

export interface Dish {
  id: number;
  name: string;
  description?: string;
  price: string | number;
  image_url?: string;
  restaurant_id: number;
  is_available: boolean;
  created_at: string;
  restaurant_name?: string;
}

export interface CartItem {
  id: number;
  user_id: number;
  dish_id: number;
  quantity: number;
  created_at: string;
  // Joined fields from dishes/restaurants
  name: string;
  price: string | number;
  image_url?: string;
  restaurant_name: string;
  restaurant_id: number;
  is_available: boolean;
}

export interface Order {
  id: number;
  user_id: number;
  total: string;
  status: OrderStatus;
  order_details?: string;
  delivery_address?: string;
  delivery_phone?: string;
  platform_fee: string;
  created_at: string;
  paid_at?: string;
  items: OrderItem[];
  restaurants?: Record<number, RestaurantOrderInfo>;
}

export interface OrderItem {
  id: number;
  order_id: number;
  dish_id: number;
  name: string;
  price: string;
  quantity: number;
  restaurant_id: number;
  restaurant_name: string;
  restaurant_status?: RestaurantOrderStatus;
}

export interface RestaurantOrderInfo {
  restaurant_id: number;
  restaurant_name: string;
  restaurant_status: RestaurantOrderStatus;
  restaurant_cancelled_at?: string;
  restaurant_cancelled_reason?: string;
  items: OrderItem[];
  subtotal: number;
}

export interface Notification {
  id: number;
  user_id?: number;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, any>;
  read: boolean;
  created_at: string;
}

// Enums as union types
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

export type RestaurantOrderStatus = 'active' | 'cancelled' | 'completed' | 'removed';

export type DeliveryType = 'delivery' | 'pickup';

export type NotificationType = 
  | 'order_created'
  | 'order_cancelled' 
  | 'order_completed'
  | 'order_status_update'
  | 'payment_received'
  | 'refund_processed'
  | 'system_alert';

// API Request/Response types
export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
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

export interface ApiResponse<T = any> {
  success?: boolean;
  data?: T;
  error?: string;
  message?: string;
  // Specific response fields
  user?: User;
  users?: User[];
  restaurant?: Restaurant;
  restaurants?: Restaurant[];
  dishes?: Dish[];
  cart?: CartItem[];
  total?: string;
  order?: Order;
  orders?: Order[];
  notifications?: Notification[];
  unreadCount?: number;
}

export interface AddToCartRequest {
  dish_id: number;
  quantity: number;
}

export interface UpdateCartRequest {
  dish_id: number;
  quantity: number;
}

export interface CreateOrderRequest {
  delivery_address: string;
  delivery_phone: string;
  delivery_type?: DeliveryType;
  order_details?: string;
  restaurant_instructions?: Record<number, string>;
}

export interface CancelOrderRequest {
  reason?: string;
  requestRefund?: boolean;
}

export interface CancelRestaurantOrderRequest {
  restaurantId: number;
  reason?: string;
  requestRefund?: boolean;
}

export interface UpdatePasswordRequest {
  email: string;
  secret_word: string;
  new_password: string;
}

export interface UpdateProfileRequest {
  name: string;
  email: string;
  phone?: string;
  address?: string;
}

// Context types
export interface AuthContextType {
  user: User | null;
  setUser: (user: User | null) => void;
  logout: () => Promise<void>;
  loading: boolean;
  error: string | null;
}

export interface OwnerAuthContextType {
  owner: RestaurantOwner | null;
  setOwner: (owner: RestaurantOwner | null) => void;
  logout: () => Promise<void>;
  loading: boolean;
  error: string | null;
}

export interface CartContextType {
  cart: CartItem[];
  setCart: (cart: CartItem[]) => void;
  addToCart: (dishId: number, quantity: number) => Promise<boolean>;
  updateCartItem: (dishId: number, quantity: number) => Promise<boolean>;
  removeFromCart: (dishId: number) => Promise<boolean>;
  clearCart: () => void;
  getTotalPrice: () => number;
  getTotalItems: () => number;
  refreshCart: () => Promise<void>;
  loading: boolean;
}

// Component Props types
export interface DishCardProps {
  dish: Dish;
  onAddToCart?: (dish: Dish, quantity: number) => void;
  showAddButton?: boolean;
  className?: string;
}

export interface RestaurantCardProps {
  restaurant: Restaurant;
  onClick?: (restaurant: Restaurant) => void;
  className?: string;
}

export interface NavbarProps {
  className?: string;
}

export interface ProtectedRouteProps {
  children: React.ReactNode;
  redirectTo?: string;
}

export interface OrderDetailsProps {
  order: Order;
  onCancel?: (orderId: number) => void;
  onCancelRestaurant?: (orderId: number, restaurantId: number) => void;
  className?: string;
}

// Form types
export interface LoginFormData {
  email: string;
  password: string;
}

export interface RegisterFormData {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  secret_word?: string;
  address?: string;
  phone?: string;
}

export interface CheckoutFormData {
  delivery_address: string;
  delivery_phone: string;
  delivery_type: DeliveryType;
  order_details?: string;
}

// Utility types
export type LoadingState = 'idle' | 'loading' | 'success' | 'error';

export interface LoadingAction<T = any> {
  type: LoadingState;
  payload?: T;
  error?: string;
}

// Error types
export interface ApiError {
  message: string;
  status?: number;
  code?: string;
  details?: any;
}

export interface FormError {
  field: string;
  message: string;
}

export interface ValidationErrors {
  [field: string]: string;
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

// Search/Filter types
export interface RestaurantFilters {
  search?: string;
  sortBy?: 'name' | 'created_at' | 'rating';
  sortOrder?: 'asc' | 'desc';
}

export interface DishFilters {
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  available?: boolean;
  sortBy?: 'name' | 'price' | 'created_at';
  sortOrder?: 'asc' | 'desc';
}

// React component types
export type FC<P = {}> = React.FunctionComponent<P>;
export type PropsWithChildren<P = {}> = P & { children?: React.ReactNode };

// Event handler types
export type ClickHandler = (event: React.MouseEvent<HTMLElement>) => void;
export type SubmitHandler = (event: React.FormEvent<HTMLFormElement>) => void;
export type ChangeHandler = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;

// CSS/Style types
export interface StyleProps {
  className?: string;
  style?: React.CSSProperties;
}

// Animation/Transition types
export interface TransitionProps {
  duration?: number;
  delay?: number;
  easing?: string;
}

// Modal/Dialog types
export interface ModalProps extends PropsWithChildren {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  closeOnOverlayClick?: boolean;
  showCloseButton?: boolean;
}

// Toast/Notification types
export interface ToastOptions {
  type?: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';
  autoClose?: boolean;
}