export interface Customer {
  id: number;
  companyId: number;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Supplier {
  id: number;
  companyId: number;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SalesOrder {
  id: number;
  companyId: number;
  orderNumber: string;
  customerId?: number;
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
  orderDate: Date;
  dueDate?: Date;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PurchaseOrder {
  id: number;
  companyId: number;
  orderNumber: string;
  supplierId?: number;
  status: 'pending' | 'confirmed' | 'received' | 'cancelled';
  orderDate: Date;
  expectedDate?: Date;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SalesOrderItem {
  id: number;
  salesOrderId: number;
  productId: number;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  createdAt: Date;
}

export interface PurchaseOrderItem {
  id: number;
  purchaseOrderId: number;
  productId: number;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  createdAt: Date;
}

export interface SalesOrderWithItems extends SalesOrder {
  customerName?: string;
  items: Array<SalesOrderItem & {
    productName: string;
    productSku: string;
  }>;
}

export interface PurchaseOrderWithItems extends PurchaseOrder {
  supplierName?: string;
  items: Array<PurchaseOrderItem & {
    productName: string;
    productSku: string;
  }>;
}
