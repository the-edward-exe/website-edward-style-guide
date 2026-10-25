import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';

const dir = fileURLToPath(new URL('../db/migrations/', import.meta.url));
const sql = postgres(process.env.DATABASE_URL ?? 'postgres://style:style@localhost:5433/style', { onnotice: () => {} });

await sql`create table if not exists migrations (name text primary key, applied_at timestamptz not null default now())`;
const done = new Set((await sql`select name from migrations`).map((r) => r.name));
for (const name of (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort()) {
  if (done.has(name)) continue;
  const text = await readFile(dir + name, 'utf8');
  await sql.begin(async (tx) => {
    await tx.unsafe(text);
    await tx`insert into migrations (name) values (${name})`;
  });
  console.log(`applied ${name}`);
}
await sql.end();
