import { drizzle } from 'drizzle-orm/d1';
import { openDatabase } from '../server/database.mjs';
import * as schema from './schema';
let database: ReturnType<typeof drizzle<typeof schema>> | undefined;
export function getDb() {
  if (!database) database = drizzle(openDatabase().client as unknown as D1Database, { schema });
  return database;
}
