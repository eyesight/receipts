import { defineConfig } from 'drizzle-kit';
// eslint-disable-next-line @typescript-eslint/no-require-imports
import * as dotenv from 'dotenv';

dotenv.config();

export default defineConfig({
  schema: './src/lib/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
});
