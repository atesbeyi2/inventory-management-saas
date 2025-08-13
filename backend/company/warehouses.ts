import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { companyDB } from "./db";
import type { Warehouse } from "./types";

export interface CreateWarehouseRequest {
  name: string;
  address?: string;
}

export interface ListWarehousesResponse {
  warehouses: Warehouse[];
}

// Creates a new warehouse for the company.
export const createWarehouse = api<CreateWarehouseRequest, Warehouse>(
  {auth: true, expose: true, method: "POST", path: "/warehouses"},
  async (req) => {
    const auth = getAuthData()!;

    // Get user's company
    const companyUser = await companyDB.queryRow`
      SELECT company_id FROM company_users WHERE user_id = ${auth.userID}
    `;

    if (!companyUser) {
      throw APIError.notFound("user not associated with any company");
    }

    const warehouse = await companyDB.queryRow<Warehouse>`
      INSERT INTO warehouses (company_id, name, address)
      VALUES (${companyUser.company_id}, ${req.name}, ${req.address || null})
      RETURNING id, company_id as "companyId", name, address, 
                created_at as "createdAt", updated_at as "updatedAt"
    `;

    if (!warehouse) {
      throw APIError.internal("failed to create warehouse");
    }

    return warehouse;
  }
);

// Lists all warehouses for the company.
export const listWarehouses = api<void, ListWarehousesResponse>(
  {auth: true, expose: true, method: "GET", path: "/warehouses"},
  async () => {
    const auth = getAuthData()!;

    // Get user's company
    const companyUser = await companyDB.queryRow`
      SELECT company_id FROM company_users WHERE user_id = ${auth.userID}
    `;

    if (!companyUser) {
      throw APIError.notFound("user not associated with any company");
    }

    const warehouses = await companyDB.queryAll<Warehouse>`
      SELECT id, company_id as "companyId", name, address,
             created_at as "createdAt", updated_at as "updatedAt"
      FROM warehouses
      WHERE company_id = ${companyUser.company_id}
      ORDER BY name
    `;

    return { warehouses };
  }
);
