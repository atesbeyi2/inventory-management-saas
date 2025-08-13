import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { inventoryDB } from "./db";
import { companyDB } from "../company/db";
import type { Product, ProductWithStock } from "./types";

export interface CreateProductRequest {
  sku: string;
  name: string;
  description?: string;
  category?: string;
  unitPrice: number;
  costPrice: number;
  barcode?: string;
  qrCode?: string;
  reorderLevel: number;
}

export interface UpdateProductRequest {
  name?: string;
  description?: string;
  category?: string;
  unitPrice?: number;
  costPrice?: number;
  barcode?: string;
  qrCode?: string;
  reorderLevel?: number;
}

export interface ListProductsResponse {
  products: ProductWithStock[];
}

// Creates a new product.
export const createProduct = api<CreateProductRequest, Product>(
  {auth: true, expose: true, method: "POST", path: "/products"},
  async (req) => {
    const auth = getAuthData()!;

    // Get user's company
    const companyUser = await companyDB.queryRow`
      SELECT company_id FROM company_users WHERE user_id = ${auth.userID}
    `;

    if (!companyUser) {
      throw APIError.notFound("user not associated with any company");
    }

    const product = await inventoryDB.queryRow<Product>`
      INSERT INTO products (company_id, sku, name, description, category, unit_price, cost_price, barcode, qr_code, reorder_level)
      VALUES (${companyUser.company_id}, ${req.sku}, ${req.name}, ${req.description || null}, ${req.category || null}, 
              ${req.unitPrice}, ${req.costPrice}, ${req.barcode || null}, ${req.qrCode || null}, ${req.reorderLevel})
      RETURNING id, company_id as "companyId", sku, name, description, category,
                unit_price as "unitPrice", cost_price as "costPrice", barcode, qr_code as "qrCode",
                reorder_level as "reorderLevel", created_at as "createdAt", updated_at as "updatedAt"
    `;

    if (!product) {
      throw APIError.internal("failed to create product");
    }

    return product;
  }
);

// Lists all products for the company with stock information.
export const listProducts = api<void, ListProductsResponse>(
  {auth: true, expose: true, method: "GET", path: "/products"},
  async () => {
    const auth = getAuthData()!;

    // Get user's company
    const companyUser = await companyDB.queryRow`
      SELECT company_id FROM company_users WHERE user_id = ${auth.userID}
    `;

    if (!companyUser) {
      throw APIError.notFound("user not associated with any company");
    }

    const products = await inventoryDB.queryAll<ProductWithStock>`
      SELECT p.id, p.company_id as "companyId", p.sku, p.name, p.description, p.category,
             p.unit_price as "unitPrice", p.cost_price as "costPrice", p.barcode, p.qr_code as "qrCode",
             p.reorder_level as "reorderLevel", p.created_at as "createdAt", p.updated_at as "updatedAt",
             COALESCE(SUM(sl.quantity), 0) as "totalStock"
      FROM products p
      LEFT JOIN stock_levels sl ON p.id = sl.product_id
      WHERE p.company_id = ${companyUser.company_id}
      GROUP BY p.id, p.company_id, p.sku, p.name, p.description, p.category,
               p.unit_price, p.cost_price, p.barcode, p.qr_code, p.reorder_level,
               p.created_at, p.updated_at
      ORDER BY p.name
    `;

    // Get stock by warehouse for each product
    for (const product of products) {
      const stockByWarehouse = await inventoryDB.queryAll<{
        warehouseId: number;
        warehouseName: string;
        quantity: number;
        reservedQuantity: number;
      }>`
        SELECT sl.warehouse_id as "warehouseId", w.name as "warehouseName",
               sl.quantity, sl.reserved_quantity as "reservedQuantity"
        FROM stock_levels sl
        JOIN warehouses w ON sl.warehouse_id = w.id
        WHERE sl.product_id = ${product.id}
      `;
      
      product.stockByWarehouse = stockByWarehouse;
    }

    return { products };
  }
);

// Gets a single product by ID.
export const getProduct = api<{id: number}, ProductWithStock>(
  {auth: true, expose: true, method: "GET", path: "/products/:id"},
  async (params) => {
    const auth = getAuthData()!;

    // Get user's company
    const companyUser = await companyDB.queryRow`
      SELECT company_id FROM company_users WHERE user_id = ${auth.userID}
    `;

    if (!companyUser) {
      throw APIError.notFound("user not associated with any company");
    }

    const product = await inventoryDB.queryRow<ProductWithStock>`
      SELECT p.id, p.company_id as "companyId", p.sku, p.name, p.description, p.category,
             p.unit_price as "unitPrice", p.cost_price as "costPrice", p.barcode, p.qr_code as "qrCode",
             p.reorder_level as "reorderLevel", p.created_at as "createdAt", p.updated_at as "updatedAt",
             COALESCE(SUM(sl.quantity), 0) as "totalStock"
      FROM products p
      LEFT JOIN stock_levels sl ON p.id = sl.product_id
      WHERE p.id = ${params.id} AND p.company_id = ${companyUser.company_id}
      GROUP BY p.id, p.company_id, p.sku, p.name, p.description, p.category,
               p.unit_price, p.cost_price, p.barcode, p.qr_code, p.reorder_level,
               p.created_at, p.updated_at
    `;

    if (!product) {
      throw APIError.notFound("product not found");
    }

    // Get stock by warehouse
    const stockByWarehouse = await inventoryDB.queryAll<{
      warehouseId: number;
      warehouseName: string;
      quantity: number;
      reservedQuantity: number;
    }>`
      SELECT sl.warehouse_id as "warehouseId", w.name as "warehouseName",
             sl.quantity, sl.reserved_quantity as "reservedQuantity"
      FROM stock_levels sl
      JOIN warehouses w ON sl.warehouse_id = w.id
      WHERE sl.product_id = ${product.id}
    `;
    
    product.stockByWarehouse = stockByWarehouse;

    return product;
  }
);

// Updates a product.
export const updateProduct = api<{id: number} & UpdateProductRequest, Product>(
  {auth: true, expose: true, method: "PUT", path: "/products/:id"},
  async (params) => {
    const auth = getAuthData()!;

    // Get user's company
    const companyUser = await companyDB.queryRow`
      SELECT company_id FROM company_users WHERE user_id = ${auth.userID}
    `;

    if (!companyUser) {
      throw APIError.notFound("user not associated with any company");
    }

    // Check if product exists and belongs to company
    const existingProduct = await inventoryDB.queryRow`
      SELECT id FROM products WHERE id = ${params.id} AND company_id = ${companyUser.company_id}
    `;

    if (!existingProduct) {
      throw APIError.notFound("product not found");
    }

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (params.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(params.name);
    }
    if (params.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(params.description);
    }
    if (params.category !== undefined) {
      updates.push(`category = $${paramIndex++}`);
      values.push(params.category);
    }
    if (params.unitPrice !== undefined) {
      updates.push(`unit_price = $${paramIndex++}`);
      values.push(params.unitPrice);
    }
    if (params.costPrice !== undefined) {
      updates.push(`cost_price = $${paramIndex++}`);
      values.push(params.costPrice);
    }
    if (params.barcode !== undefined) {
      updates.push(`barcode = $${paramIndex++}`);
      values.push(params.barcode);
    }
    if (params.qrCode !== undefined) {
      updates.push(`qr_code = $${paramIndex++}`);
      values.push(params.qrCode);
    }
    if (params.reorderLevel !== undefined) {
      updates.push(`reorder_level = $${paramIndex++}`);
      values.push(params.reorderLevel);
    }

    if (updates.length === 0) {
      throw APIError.invalidArgument("no fields to update");
    }

    updates.push(`updated_at = NOW()`);
    values.push(params.id);

    const query = `
      UPDATE products 
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, company_id as "companyId", sku, name, description, category,
                unit_price as "unitPrice", cost_price as "costPrice", barcode, qr_code as "qrCode",
                reorder_level as "reorderLevel", created_at as "createdAt", updated_at as "updatedAt"
    `;

    const product = await inventoryDB.rawQueryRow<Product>(query, ...values);

    if (!product) {
      throw APIError.internal("failed to update product");
    }

    return product;
  }
);

// Deletes a product.
export const deleteProduct = api<{id: number}, void>(
  {auth: true, expose: true, method: "DELETE", path: "/products/:id"},
  async (params) => {
    const auth = getAuthData()!;

    // Get user's company
    const companyUser = await companyDB.queryRow`
      SELECT company_id FROM company_users WHERE user_id = ${auth.userID}
    `;

    if (!companyUser) {
      throw APIError.notFound("user not associated with any company");
    }

    // Check if product exists and belongs to company
    const existingProduct = await inventoryDB.queryRow`
      SELECT id FROM products WHERE id = ${params.id} AND company_id = ${companyUser.company_id}
    `;

    if (!existingProduct) {
      throw APIError.notFound("product not found");
    }

    await inventoryDB.exec`
      DELETE FROM products WHERE id = ${params.id}
    `;
  }
);
