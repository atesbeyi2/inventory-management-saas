import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { ordersDB } from "./db";
import { companyDB } from "../company/db";
import type { Customer } from "./types";

export interface CreateCustomerRequest {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
}

export interface UpdateCustomerRequest {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
}

export interface ListCustomersResponse {
  customers: Customer[];
}

// Creates a new customer.
export const createCustomer = api<CreateCustomerRequest, Customer>(
  {auth: true, expose: true, method: "POST", path: "/customers"},
  async (req) => {
    const auth = getAuthData()!;

    // Get user's company
    const companyUser = await companyDB.queryRow`
      SELECT company_id FROM company_users WHERE user_id = ${auth.userID}
    `;

    if (!companyUser) {
      throw APIError.notFound("user not associated with any company");
    }

    const customer = await ordersDB.queryRow<Customer>`
      INSERT INTO customers (company_id, name, email, phone, address)
      VALUES (${companyUser.company_id}, ${req.name}, ${req.email || null}, ${req.phone || null}, ${req.address || null})
      RETURNING id, company_id as "companyId", name, email, phone, address,
                created_at as "createdAt", updated_at as "updatedAt"
    `;

    if (!customer) {
      throw APIError.internal("failed to create customer");
    }

    return customer;
  }
);

// Lists all customers for the company.
export const listCustomers = api<void, ListCustomersResponse>(
  {auth: true, expose: true, method: "GET", path: "/customers"},
  async () => {
    const auth = getAuthData()!;

    // Get user's company
    const companyUser = await companyDB.queryRow`
      SELECT company_id FROM company_users WHERE user_id = ${auth.userID}
    `;

    if (!companyUser) {
      throw APIError.notFound("user not associated with any company");
    }

    const customers = await ordersDB.queryAll<Customer>`
      SELECT id, company_id as "companyId", name, email, phone, address,
             created_at as "createdAt", updated_at as "updatedAt"
      FROM customers
      WHERE company_id = ${companyUser.company_id}
      ORDER BY name
    `;

    return { customers };
  }
);

// Gets a single customer by ID.
export const getCustomer = api<{id: number}, Customer>(
  {auth: true, expose: true, method: "GET", path: "/customers/:id"},
  async (params) => {
    const auth = getAuthData()!;

    // Get user's company
    const companyUser = await companyDB.queryRow`
      SELECT company_id FROM company_users WHERE user_id = ${auth.userID}
    `;

    if (!companyUser) {
      throw APIError.notFound("user not associated with any company");
    }

    const customer = await ordersDB.queryRow<Customer>`
      SELECT id, company_id as "companyId", name, email, phone, address,
             created_at as "createdAt", updated_at as "updatedAt"
      FROM customers
      WHERE id = ${params.id} AND company_id = ${companyUser.company_id}
    `;

    if (!customer) {
      throw APIError.notFound("customer not found");
    }

    return customer;
  }
);

// Updates a customer.
export const updateCustomer = api<{id: number} & UpdateCustomerRequest, Customer>(
  {auth: true, expose: true, method: "PUT", path: "/customers/:id"},
  async (params) => {
    const auth = getAuthData()!;

    // Get user's company
    const companyUser = await companyDB.queryRow`
      SELECT company_id FROM company_users WHERE user_id = ${auth.userID}
    `;

    if (!companyUser) {
      throw APIError.notFound("user not associated with any company");
    }

    // Check if customer exists and belongs to company
    const existingCustomer = await ordersDB.queryRow`
      SELECT id FROM customers WHERE id = ${params.id} AND company_id = ${companyUser.company_id}
    `;

    if (!existingCustomer) {
      throw APIError.notFound("customer not found");
    }

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (params.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(params.name);
    }
    if (params.email !== undefined) {
      updates.push(`email = $${paramIndex++}`);
      values.push(params.email);
    }
    if (params.phone !== undefined) {
      updates.push(`phone = $${paramIndex++}`);
      values.push(params.phone);
    }
    if (params.address !== undefined) {
      updates.push(`address = $${paramIndex++}`);
      values.push(params.address);
    }

    if (updates.length === 0) {
      throw APIError.invalidArgument("no fields to update");
    }

    updates.push(`updated_at = NOW()`);
    values.push(params.id);

    const query = `
      UPDATE customers 
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, company_id as "companyId", name, email, phone, address,
                created_at as "createdAt", updated_at as "updatedAt"
    `;

    const customer = await ordersDB.rawQueryRow<Customer>(query, ...values);

    if (!customer) {
      throw APIError.internal("failed to update customer");
    }

    return customer;
  }
);

// Deletes a customer.
export const deleteCustomer = api<{id: number}, void>(
  {auth: true, expose: true, method: "DELETE", path: "/customers/:id"},
  async (params) => {
    const auth = getAuthData()!;

    // Get user's company
    const companyUser = await companyDB.queryRow`
      SELECT company_id FROM company_users WHERE user_id = ${auth.userID}
    `;

    if (!companyUser) {
      throw APIError.notFound("user not associated with any company");
    }

    // Check if customer exists and belongs to company
    const existingCustomer = await ordersDB.queryRow`
      SELECT id FROM customers WHERE id = ${params.id} AND company_id = ${companyUser.company_id}
    `;

    if (!existingCustomer) {
      throw APIError.notFound("customer not found");
    }

    await ordersDB.exec`
      DELETE FROM customers WHERE id = ${params.id}
    `;
  }
);
