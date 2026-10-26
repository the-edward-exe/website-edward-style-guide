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
// Jobs run inside the app process, so anything still pending when it starts was cut off by a
// restart. Mark it failed so the person gets a Try again button instead of waiting forever.
const interrupted = 'INTERRUPTED. TRY AGAIN.';
await sql`update tryons set status = 'failed', error = ${interrupted} where status = 'pending'`;
await sql`update look_images set status = 'failed', error = ${interrupted} where status = 'pending'`;
await sql`update profiles set guide_status = 'failed', guide_error = ${interrupted} where guide_status = 'pending'`;
await sql`update profiles set looks_status = 'failed', looks_error = ${interrupted} where looks_status = 'pending'`;
await sql`update profiles set sheet_status = 'failed', sheet_error = ${interrupted} where sheet_status = 'pending'`;
await sql`update profiles set photo_read_status = 'failed' where photo_read_status = 'pending'`;
await sql.end();
