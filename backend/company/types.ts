export interface Company {
  id: number;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  taxNumber?: string;
  subscriptionStatus: string;
  subscriptionPlan: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CompanyUser {
  id: number;
  companyId: number;
  userId: string;
  role: 'admin' | 'manager' | 'staff';
  createdAt: Date;
}

export interface Warehouse {
  id: number;
  companyId: number;
  name: string;
  address?: string;
  createdAt: Date;
  updatedAt: Date;
}
