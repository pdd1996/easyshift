import 'dotenv/config';
import { migrate } from 'drizzle-orm/mysql2/migrator';
import { db } from './index.js';

async function main() {
  await migrate(db, { migrationsFolder: './drizzle' });
  console.log('Migrations applied.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
