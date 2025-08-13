export interface Product {
  id: number;
  companyId: number;
  sku: string;
  name: string;
  description?: string;
  category?: string;
  unitPrice: number;
  costPrice: number;
  barcode?: string;
  qrCode?: string;
  reorderLevel: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface StockLevel {
  id: number;
  productId: number;
  warehouseId: number;
  quantity: number;
  reservedQuantity: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface StockMovement {
  id: number;
  productId: number;
  warehouseId: number;
  movementType: 'in' | 'out' | 'adjustment';
  quantity: number;
  referenceType?: string;
  referenceId?: number;
  notes?: string;
  createdAt: Date;
}

export interface ProductWithStock extends Product {
  totalStock: number;
  stockByWarehouse: Array<{
    warehouseId: number;
    warehouseName: string;
    quantity: number;
    reservedQuantity: number;
  }>;
}
