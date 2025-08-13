import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { ordersDB } from "./db";
import { companyDB } from "../company/db";
import { inventory } from "~encore/clients";
import type { SalesOrder, SalesOrderWithItems, SalesOrderItem } from "./types";

export interface CreateSalesOrderRequest {
  customerId?: number;
  orderDate: Date;
  dueDate?: Date;
  notes?: string;
  items: Array<{
    productId: number;
    quantity: number;
    unitPrice: number;
  }>;
}

export interface UpdateSalesOrderRequest {
  customerId?: number;
  status?: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
  orderDate?: Date;
  dueDate?: Date;
  notes?: string;
}

export interface ListSalesOrdersResponse {
  orders: Array<SalesOrder & { customerName?: string }>;
}

// Generates a unique order number.
async function generateOrderNumber(companyId: number): Promise<string> {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  
  const prefix = `SO-${year}${month}${day}`;
  
  // Find the next sequence number for today
  const lastOrder = await ordersDB.queryRow<{orderNumber: string}>`
    SELECT order_number as "orderNumber"
    FROM sales_orders
    WHERE company_id = ${companyId} AND order_number LIKE ${prefix + '%'}
    ORDER BY order_number DESC
    LIMIT 1
  `;
  
  let sequence = 1;
  if (lastOrder) {
    const lastSequence = parseInt(lastOrder.orderNumber.split('-').pop() || '0');
    sequence = lastSequence + 1;
  }
  
  return `${prefix}-${String(sequence).padStart(3, '0')}`;
}

// Creates a new sales order.
export const createSalesOrder = api<CreateSalesOrderRequest, SalesOrderWithItems>(
  {auth: true, expose: true, method: "POST", path: "/sales-orders"},
  async (req) => {
    const auth = getAuthData()!;

    // Get user's company
    const companyUser = await companyDB.queryRow`
      SELECT company_id FROM company_users WHERE user_id = ${auth.userID}
    `;

    if (!companyUser) {
      throw APIError.notFound("user not associated with any company");
    }

    if (req.items.length === 0) {
      throw APIError.invalidArgument("order must have at least one item");
    }

    // Calculate totals
    let subtotal = 0;
    for (const item of req.items) {
      subtotal += item.quantity * item.unitPrice;
    }

    const taxAmount = 0; // TODO: Calculate based on tax rules
    const discountAmount = 0; // TODO: Apply discounts
    const totalAmount = subtotal + taxAmount - discountAmount;

    // Generate order number
    const orderNumber = await generateOrderNumber(companyUser.company_id);

    // Begin transaction
    const tx = await ordersDB.begin();
    
    try {
      // Create sales order
      const order = await tx.queryRow<SalesOrder>`
        INSERT INTO sales_orders (company_id, order_number, customer_id, order_date, due_date, 
                                  subtotal, tax_amount, discount_amount, total_amount, notes)
        VALUES (${companyUser.company_id}, ${orderNumber}, ${req.customerId || null}, ${req.orderDate}, 
                ${req.dueDate || null}, ${subtotal}, ${taxAmount}, ${discountAmount}, ${totalAmount}, ${req.notes || null})
        RETURNING id, company_id as "companyId", order_number as "orderNumber", customer_id as "customerId",
                  status, order_date as "orderDate", due_date as "dueDate", subtotal, tax_amount as "taxAmount",
                  discount_amount as "discountAmount", total_amount as "totalAmount", notes,
                  created_at as "createdAt", updated_at as "updatedAt"
      `;

      if (!order) {
        throw APIError.internal("failed to create sales order");
      }

      // Create order items
      const items: Array<SalesOrderItem & { productName: string; productSku: string }> = [];
      for (const item of req.items) {
        const totalPrice = item.quantity * item.unitPrice;
        
        const orderItem = await tx.queryRow<SalesOrderItem>`
          INSERT INTO sales_order_items (sales_order_id, product_id, quantity, unit_price, total_price)
          VALUES (${order.id}, ${item.productId}, ${item.quantity}, ${item.unitPrice}, ${totalPrice})
          RETURNING id, sales_order_id as "salesOrderId", product_id as "productId",
                    quantity, unit_price as "unitPrice", total_price as "totalPrice", created_at as "createdAt"
        `;

        if (!orderItem) {
          throw APIError.internal("failed to create order item");
        }

        // Get product info
        const product = await tx.queryRow<{name: string; sku: string}>`
          SELECT name, sku FROM products WHERE id = ${item.productId}
        `;

        items.push({
          ...orderItem,
          productName: product?.name || '',
          productSku: product?.sku || ''
        });
      }

      await tx.commit();

      // Get customer name if exists
      let customerName: string | undefined;
      if (order.customerId) {
        const customer = await ordersDB.queryRow<{name: string}>`
          SELECT name FROM customers WHERE id = ${order.customerId}
        `;
        customerName = customer?.name;
      }

      return {
        ...order,
        customerName,
        items
      };
    } catch (error) {
      await tx.rollback();
      throw error;
    }
  }
);

// Lists all sales orders for the company.
export const listSalesOrders = api<void, ListSalesOrdersResponse>(
  {auth: true, expose: true, method: "GET", path: "/sales-orders"},
  async () => {
    const auth = getAuthData()!;

    // Get user's company
    const companyUser = await companyDB.queryRow`
      SELECT company_id FROM company_users WHERE user_id = ${auth.userID}
    `;

    if (!companyUser) {
      throw APIError.notFound("user not associated with any company");
    }

    const orders = await ordersDB.queryAll<SalesOrder & { customerName?: string }>`
      SELECT so.id, so.company_id as "companyId", so.order_number as "orderNumber", 
             so.customer_id as "customerId", so.status, so.order_date as "orderDate", 
             so.due_date as "dueDate", so.subtotal, so.tax_amount as "taxAmount",
             so.discount_amount as "discountAmount", so.total_amount as "totalAmount", 
             so.notes, so.created_at as "createdAt", so.updated_at as "updatedAt",
             c.name as "customerName"
      FROM sales_orders so
      LEFT JOIN customers c ON so.customer_id = c.id
      WHERE so.company_id = ${companyUser.company_id}
      ORDER BY so.created_at DESC
    `;

    return { orders };
  }
);

// Gets a single sales order by ID.
export const getSalesOrder = api<{id: number}, SalesOrderWithItems>(
  {auth: true, expose: true, method: "GET", path: "/sales-orders/:id"},
  async (params) => {
    const auth = getAuthData()!;

    // Get user's company
    const companyUser = await companyDB.queryRow`
      SELECT company_id FROM company_users WHERE user_id = ${auth.userID}
    `;

    if (!companyUser) {
      throw APIError.notFound("user not associated with any company");
    }

    const order = await ordersDB.queryRow<SalesOrder>`
      SELECT id, company_id as "companyId", order_number as "orderNumber", customer_id as "customerId",
             status, order_date as "orderDate", due_date as "dueDate", subtotal, tax_amount as "taxAmount",
             discount_amount as "discountAmount", total_amount as "totalAmount", notes,
             created_at as "createdAt", updated_at as "updatedAt"
      FROM sales_orders
      WHERE id = ${params.id} AND company_id = ${companyUser.company_id}
    `;

    if (!order) {
      throw APIError.notFound("sales order not found");
    }

    // Get order items
    const items = await ordersDB.queryAll<SalesOrderItem & { productName: string; productSku: string }>`
      SELECT soi.id, soi.sales_order_id as "salesOrderId", soi.product_id as "productId",
             soi.quantity, soi.unit_price as "unitPrice", soi.total_price as "totalPrice", 
             soi.created_at as "createdAt", p.name as "productName", p.sku as "productSku"
      FROM sales_order_items soi
      JOIN products p ON soi.product_id = p.id
      WHERE soi.sales_order_id = ${order.id}
      ORDER BY soi.id
    `;

    // Get customer name if exists
    let customerName: string | undefined;
    if (order.customerId) {
      const customer = await ordersDB.queryRow<{name: string}>`
        SELECT name FROM customers WHERE id = ${order.customerId}
      `;
      customerName = customer?.name;
    }

    return {
      ...order,
      customerName,
      items
    };
  }
);

// Updates a sales order.
export const updateSalesOrder = api<{id: number} & UpdateSalesOrderRequest, SalesOrder>(
  {auth: true, expose: true, method: "PUT", path: "/sales-orders/:id"},
  async (params) => {
    const auth = getAuthData()!;

    // Get user's company
    const companyUser = await companyDB.queryRow`
      SELECT company_id FROM company_users WHERE user_id = ${auth.userID}
    `;

    if (!companyUser) {
      throw APIError.notFound("user not associated with any company");
    }

    // Check if order exists and belongs to company
    const existingOrder = await ordersDB.queryRow`
      SELECT id FROM sales_orders WHERE id = ${params.id} AND company_id = ${companyUser.company_id}
    `;

    if (!existingOrder) {
      throw APIError.notFound("sales order not found");
    }

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (params.customerId !== undefined) {
      updates.push(`customer_id = $${paramIndex++}`);
      values.push(params.customerId);
    }
    if (params.status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      values.push(params.status);
    }
    if (params.orderDate !== undefined) {
      updates.push(`order_date = $${paramIndex++}`);
      values.push(params.orderDate);
    }
    if (params.dueDate !== undefined) {
      updates.push(`due_date = $${paramIndex++}`);
      values.push(params.dueDate);
    }
    if (params.notes !== undefined) {
      updates.push(`notes = $${paramIndex++}`);
      values.push(params.notes);
    }

    if (updates.length === 0) {
      throw APIError.invalidArgument("no fields to update");
    }

    updates.push(`updated_at = NOW()`);
    values.push(params.id);

    const query = `
      UPDATE sales_orders 
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, company_id as "companyId", order_number as "orderNumber", customer_id as "customerId",
                status, order_date as "orderDate", due_date as "dueDate", subtotal, tax_amount as "taxAmount",
                discount_amount as "discountAmount", total_amount as "totalAmount", notes,
                created_at as "createdAt", updated_at as "updatedAt"
    `;

    const order = await ordersDB.rawQueryRow<SalesOrder>(query, ...values);

    if (!order) {
      throw APIError.internal("failed to update sales order");
    }

    return order;
  }
);

// Fulfills a sales order by deducting inventory.
export const fulfillSalesOrder = api<{id: number; warehouseId: number}, void>(
  {auth: true, expose: true, method: "POST", path: "/sales-orders/:id/fulfill"},
  async (params) => {
    const auth = getAuthData()!;

    // Get user's company
    const companyUser = await companyDB.queryRow`
      SELECT company_id FROM company_users WHERE user_id = ${auth.userID}
    `;

    if (!companyUser) {
      throw APIError.notFound("user not associated with any company");
    }

    // Get order and verify it belongs to company
    const order = await ordersDB.queryRow<{id: number; status: string}>`
      SELECT id, status FROM sales_orders 
      WHERE id = ${params.id} AND company_id = ${companyUser.company_id}
    `;

    if (!order) {
      throw APIError.notFound("sales order not found");
    }

    if (order.status !== 'confirmed') {
      throw APIError.failedPrecondition("order must be confirmed to fulfill");
    }

    // Get order items
    const items = await ordersDB.queryAll<{productId: number; quantity: number}>`
      SELECT product_id as "productId", quantity
      FROM sales_order_items
      WHERE sales_order_id = ${order.id}
    `;

    // Begin transaction
    const tx = await ordersDB.begin();
    
    try {
      // Record stock movements for each item
      for (const item of items) {
        await inventory.recordStockMovement({
          productId: item.productId,
          warehouseId: params.warehouseId,
          movementType: 'out',
          quantity: item.quantity,
          referenceType: 'sales_order',
          referenceId: order.id,
          notes: `Fulfilled sales order ${order.id}`
        });
      }

      // Update order status
      await tx.exec`
        UPDATE sales_orders 
        SET status = 'shipped', updated_at = NOW()
        WHERE id = ${order.id}
      `;

      await tx.commit();
    } catch (error) {
      await tx.rollback();
      throw error;
    }
  }
);
