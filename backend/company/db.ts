import { SQLDatabase } from 'encore.dev/storage/sqldb';

export const companyDB = new SQLDatabase("company", {
  migrations: "./migrations",
});
