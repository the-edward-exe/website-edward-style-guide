import { execSync } from 'node:child_process';
import postgres from 'postgres';

// Tests get their own database so they never truncate the app's real profiles.
export default async function setup() {
  const admin = postgres('postgres://style:style@localhost:5433/style', { onnotice: () => {} });
  const [exists] = await admin`select 1 from pg_database where datname = 'style_test'`;
  if (!exists) await admin.unsafe('create database style_test');
  await admin.end();
  execSync('node scripts/migrate.mjs', {
    env: { ...process.env, DATABASE_URL: 'postgres://style:style@localhost:5433/style_test' },
    stdio: 'ignore',
  });
}
