// Postgres connection for Vercel (Neon / Vercel Postgres / Supabase).
// Reads DATABASE_URL (or POSTGRES_URL, which Vercel's Storage integrations add automatically).
import pg from 'pg';
import { schema } from './schema.mjs';
let pool, ready;
export function getPool(){
 if(pool)return pool;
 const connectionString=process.env.DATABASE_URL||process.env.POSTGRES_URL||process.env.POSTGRES_PRISMA_URL;
 if(!connectionString)throw new Error('DATABASE_URL is not set');
 pool=new pg.Pool({connectionString,max:3,connectionTimeoutMillis:10000,idleTimeoutMillis:10000,ssl:/localhost|127\.0\.0\.1/.test(connectionString)?undefined:{rejectUnauthorized:false}});
 return pool;
}
// Idempotent: creates tables on first request of each cold start.
export function ensureSchema(){
 if(!ready)ready=getPool().query(schema).catch(e=>{ready=null;throw e;});
 return ready;
}
