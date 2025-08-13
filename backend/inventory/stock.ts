import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { inventoryDB } from "./db";
import { companyDB } from "../company/db";
import type { StockLevel, StockMovement } from "./types";

export interface AdjustStockRequest {
  productId: number;
  warehouseId: number;
  quantity: number;
  notes?: string;
}

export interface StockMovementRequest {
  productId: number;
  warehouseId: number;
  movementType: 'in' | 'out' | 'adjustment';
  quantity: number;
  referenceType?: string;
  referenceId?: number;
  notes?: string;
}

export interface ListStockMovementsResponse {
  movements: Array<StockMovement & {
    productName: string;
    productSku: string;
    warehouseName: string;
  }>;
}

// Adjusts stock level for a product in a warehouse.
export const adjustStock = api<AdjustStockRequest, StockLevel>(
  {auth: true, expose: true, method: "POST", path: "/stock/adjust"},
  async (req) => {
    const auth = getAuthData()!;

    // Get user's company
    const companyUser = await companyDB.queryRow`
      SELECT company_id FROM company_users WHERE user_id = ${auth.userID}
    `;

    if (!companyUser) {
      throw APIError.notFound("user not associated with any company");
    }

    // Verify product belongs to company
    const product = await inventoryDB.queryRow`
      SELECT id FROM products WHERE id = ${req.productId} AND company_id = ${companyUser.company_id}
    `;

    if (!product) {
      throw APIError.notFound("product not found");
    }

    // Verify warehouse belongs to company
    const warehouse = await companyDB.queryRow`
      SELECT id FROM warehouses WHERE id = ${req.warehouseId} AND company_id = ${companyUser.company_id}
    `;

    if (!warehouse) {
      throw APIError.notFound("warehouse not found");
    }

    // Begin transaction
    const tx = await inventoryDB.begin();
    
    try {
      // Get current stock level
      const currentStock = await tx.queryRow<{quantity: number}>`
        SELECT quantity FROM stock_levels 
        WHERE product_id = ${req.productId} AND warehouse_id = ${req.warehouseId}
      `;

      const currentQuantity = currentStock?.quantity || 0;
      const newQuantity = Math.max(0, currentQuantity + req.quantity);

      // Upsert stock level
      const stockLevel = await tx.queryRow<StockLevel>`
        INSERT INTO stock_levels (product_id, warehouse_id, quantity, updated_at)
        VALUES (${req.productId}, ${req.warehouseId}, ${newQuantity}, NOW())
        ON CONFLICT (product_id, warehouse_id)
        DO UPDATE SET quantity = ${newQuantity}, updated_at = NOW()
        RETURNING id, product_id as "productId", warehouse_id as "warehouseId",
                  quantity, reserved_quantity as "reservedQuantity",
                  created_at as "createdAt", updated_at as "updatedAt"
      `;

      if (!stockLevel) {
        throw APIError.internal("failed to adjust stock");
      }

      // Record stock movement
      await tx.exec`
        INSERT INTO stock_movements (product_id, warehouse_id, movement_type, quantity, reference_type, notes)
        VALUES (${req.productId}, ${req.warehouseId}, 'adjustment', ${req.quantity}, 'manual', ${req.notes || null})
      `;

      await tx.commit();
      return stockLevel;
    } catch (error) {
      await tx.rollback();
      throw error;
    }
  }
);

// Records a stock movement.
export const recordStockMovement = api<StockMovementRequest, StockMovement>(
  {auth: true, expose: true, method: "POST", path: "/stock/movement"},
  async (req) => {
    const auth = getAuthData()!;

    // Get user's company
    const companyUser = await companyDB.queryRow`
      SELECT company_id FROM company_users WHERE user_id = ${auth.userID}
    `;

    if (!companyUser) {
      throw APIError.notFound("user not associated with any company");
    }

    // Verify product belongs to company
    const product = await inventoryDB.queryRow`
      SELECT id FROM products WHERE id = ${req.productId} AND company_id = ${companyUser.company_id}
    `;

    if (!product) {
      throw APIError.notFound("product not found");
    }

    // Verify warehouse belongs to company
    const warehouse = await companyDB.queryRow`
      SELECT id FROM warehouses WHERE id = ${req.warehouseId} AND company_id = ${companyUser.company_id}
    `;

    if (!warehouse) {
      throw APIError.notFound("warehouse not found");
    }

    // Begin transaction
    const tx = await inventoryDB.begin();
    
    try {
      // Record stock movement
      const movement = await tx.queryRow<StockMovement>`
        INSERT INTO stock_movements (product_id, warehouse_id, movement_type, quantity, reference_type, reference_id, notes)
        VALUES (${req.productId}, ${req.warehouseId}, ${req.movementType}, ${req.quantity}, 
                ${req.referenceType || null}, ${req.referenceId || null}, ${req.notes || null})
        RETURNING id, product_id as "productId", warehouse_id as "warehouseId",
                  movement_type as "movementType", quantity, reference_type as "referenceType",
                  reference_id as "referenceId", notes, created_at as "createdAt"
      `;

      if (!movement) {
        throw APIError.internal("failed to record stock movement");
      }

      // Update stock level
      const quantityChange = req.movementType === 'in' ? req.quantity : -req.quantity;
      
      // Get current stock level
      const currentStock = await tx.queryRow<{quantity: number}>`
        SELECT quantity FROM stock_levels 
        WHERE product_id = ${req.productId} AND warehouse_id = ${req.warehouseId}
      `;

      const currentQuantity = currentStock?.quantity || 0;
      const newQuantity = Math.max(0, currentQuantity + quantityChange);

      // Upsert stock level
      await tx.exec`
        INSERT INTO stock_levels (product_id, warehouse_id, quantity, updated_at)
        VALUES (${req.productId}, ${req.warehouseId}, ${newQuantity}, NOW())
        ON CONFLICT (product_id, warehouse_id)
        DO UPDATE SET quantity = ${newQuantity}, updated_at = NOW()
      `;

      await tx.commit();
      return movement;
    } catch (error) {
      await tx.rollback();
      throw error;
    }
  }
);

// Lists stock movements for the company.
export const listStockMovements = api<void, ListStockMovementsResponse>(
  {auth: true, expose: true, method: "GET", path: "/stock/movements"},
  async () => {
    const auth = getAuthData()!;

    // Get user's company
    const companyUser = await companyDB.queryRow`
      SELECT company_id FROM company_users WHERE user_id = ${auth.userID}
    `;

    if (!companyUser) {
      throw APIError.notFound("user not associated with any company");
    }

    const movements = await inventoryDB.queryAll<StockMovement & {
      productName: string;
      productSku: string;
      warehouseName: string;
    }>`
      SELECT sm.id, sm.product_id as "productId", sm.warehouse_id as "warehouseId",
             sm.movement_type as "movementType", sm.quantity, sm.reference_type as "referenceType",
             sm.reference_id as "referenceId", sm.notes, sm.created_at as "createdAt",
             p.name as "productName", p.sku as "productSku", w.name as "warehouseName"
      FROM stock_movements sm
      JOIN products p ON sm.product_id = p.id
      JOIN warehouses w ON sm.warehouse_id = w.id
      WHERE p.company_id = ${companyUser.company_id}
      ORDER BY sm.created_at DESC
      LIMIT 100
    `;

    return { movements };
  }
);
