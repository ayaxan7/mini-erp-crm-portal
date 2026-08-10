export type Role = 'ADMIN' | 'SALES' | 'WAREHOUSE' | 'ACCOUNTS';

export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
}

export interface AppUser {
  id: number;
  name: string;
  email: string;
  role: Role;
  created_at: string;
}

export const ROLE_OPTIONS: Role[] = ['ADMIN', 'SALES', 'WAREHOUSE', 'ACCOUNTS'];

export type CustomerType = 'RETAIL' | 'WHOLESALE' | 'DISTRIBUTOR';
export type CustomerStatus = 'LEAD' | 'ACTIVE' | 'INACTIVE';

export interface Customer {
  id: number;
  name: string;
  mobile: string;
  email: string | null;
  business_name: string | null;
  gst_number: string | null;
  type: CustomerType;
  address: string | null;
  status: CustomerStatus;
  follow_up_date: string | null;
  notes: string | null;
  created_by: number | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface Followup {
  id: number;
  customer_id: number;
  notes: string;
  follow_up_date: string | null;
  created_by: number | null;
  created_by_name: string | null;
  created_at: string;
}

export interface Product {
  id: number;
  name: string;
  sku: string;
  category: string;
  unit_price: string;
  current_stock: number;
  min_stock: number;
  location: string | null;
  is_low_stock: boolean;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
}

export type MovementType = 'IN' | 'OUT';

export interface StockMovement {
  id: number;
  product_id: number;
  quantity_changed: number;
  movement_type: MovementType;
  reason: string;
  reference_type: string | null;
  reference_id: number | null;
  created_by: number | null;
  created_by_name: string | null;
  created_at: string;
}

export type ChallanStatus = 'DRAFT' | 'CONFIRMED' | 'CANCELLED';

export interface Challan {
  id: number;
  challan_number: string;
  customer_id: number;
  customer_name: string | null;
  customer_business_name: string | null;
  total_quantity: number;
  status: ChallanStatus;
  remarks: string | null;
  confirmed_at: string | null;
  cancelled_at: string | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChallanItem {
  id: number;
  challan_id: number;
  product_id: number;
  product_name: string;
  product_sku: string;
  unit_price: string;
  quantity: number;
}

export interface DashboardSummary {
  customers: { total: number; active: number; leads: number; overdueFollowups: number };
  products: { total: number; lowStock: number; stockValue: number };
  challans: { total: number; drafts: number; confirmed: number; cancelled: number };
  monthlyChallans: { label: string; count: number }[];
  recentChallans: (Pick<Challan, 'id' | 'challan_number' | 'status' | 'total_quantity' | 'created_at'> & { customer_name: string | null })[];
  lowStockProducts: { id: number; name: string; sku: string; current_stock: number; min_stock: number }[];
}

export interface CustomerFormValues {
  name: string;
  mobile: string;
  email: string;
  businessName: string;
  gstNumber: string;
  type: CustomerType;
  address: string;
  status: CustomerStatus;
  followUpDate: string;
  notes: string;
}

export interface ProductFormValues {
  name: string;
  sku: string;
  category: string;
  unitPrice: string;
  currentStock: string;
  minStock: string;
  location: string;
}

export interface ChallanLine {
  productId: number;
  productName: string;
  sku: string;
  unitPrice: string;
  availableStock: number;
  quantity: number;
}