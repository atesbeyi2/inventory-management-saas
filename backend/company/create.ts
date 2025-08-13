import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { companyDB } from "./db";
import type { Company } from "./types";

export interface CreateCompanyRequest {
  name: string;
  email: string;
  phone?: string;
  address?: string;
  taxNumber?: string;
}

// Creates a new company and assigns the current user as admin.
export const create = api<CreateCompanyRequest, Company>(
  {auth: true, expose: true, method: "POST", path: "/companies"},
  async (req) => {
    const auth = getAuthData()!;

    // Check if user is already part of a company
    const existingUser = await companyDB.queryRow`
      SELECT id FROM company_users WHERE user_id = ${auth.userID}
    `;
    
    if (existingUser) {
      throw APIError.alreadyExists("user is already part of a company");
    }

    // Create company
    const company = await companyDB.queryRow<Company>`
      INSERT INTO companies (name, email, phone, address, tax_number)
      VALUES (${req.name}, ${req.email}, ${req.phone || null}, ${req.address || null}, ${req.taxNumber || null})
      RETURNING id, name, email, phone, address, tax_number as "taxNumber", 
                subscription_status as "subscriptionStatus", subscription_plan as "subscriptionPlan",
                created_at as "createdAt", updated_at as "updatedAt"
    `;

    if (!company) {
      throw APIError.internal("failed to create company");
    }

    // Add user as admin
    await companyDB.exec`
      INSERT INTO company_users (company_id, user_id, role)
      VALUES (${company.id}, ${auth.userID}, 'admin')
    `;

    return company;
  }
);
