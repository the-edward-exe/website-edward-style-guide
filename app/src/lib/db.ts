import postgres from 'postgres';

export const sql = postgres(process.env.DATABASE_URL ?? 'postgres://style:style@localhost:5433/style', {
  onnotice: () => {},
});
