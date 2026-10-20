// Vercel adapter for the booking API (same handler as netlify/functions/cinema.mjs).
// Env: DATABASE_URL (Postgres, e.g. Neon), ADMIN_USERNAME, ADMIN_PASSWORD (>= 12 chars).
import pg from 'pg';
import { createAPI } from '../server/api.mjs';
let handle;
async function run(req){
 try {
  if(!handle){
   const connectionString=process.env.DATABASE_URL||process.env.POSTGRES_URL;
   if(!connectionString)throw new Error('DATABASE_URL is not set');
   const pool=new pg.Pool({connectionString,max:3,connectionTimeoutMillis:10000,idleTimeoutMillis:10000});
   handle=createAPI(pool,{local:false,username:process.env.ADMIN_USERNAME||'admin',password:process.env.ADMIN_PASSWORD||''});
  }
  return await handle(req,{});
 }catch(e){
  console.error('Database unavailable:',e.message);
  return Response.json({error:'ยังเชื่อมฐานข้อมูลไม่ได้ ตรวจ DATABASE_URL บน Vercel'},{status:503,headers:{'Cache-Control':'no-store'}});
 }
}
export const GET=run;
export const POST=run;
