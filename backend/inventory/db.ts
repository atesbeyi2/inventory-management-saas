import { SQLDatabase } from 'encore.dev/storage/sqldb';

export const inventoryDB = new SQLDatabase("inventory", {
  migrations: "./migrations",
});
