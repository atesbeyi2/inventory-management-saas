import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { companyDB } from "./db";
import type { Company } from "./types";

// Gets the current user's company information.
export const get = api<void, Company>(
  {auth: true, expose: true, method: "GET", path: "/companies/me"},
  async () => {
    const auth = getAuthData()!;

    const company = await companyDB.queryRow<Company>`
      SELECT c.id, c.name, c.email, c.phone, c.address, c.tax_number as "taxNumber",
             c.subscription_status as "subscriptionStatus", c.subscription_plan as "subscriptionPlan",
             c.created_at as "createdAt", c.updated_at as "updatedAt"
      FROM companies c
      JOIN company_users cu ON c.id = cu.company_id
      WHERE cu.user_id = ${auth.userID}
    `;

    if (!company) {
      throw APIError.notFound("company not found");
    }

    return company;
  }
);
