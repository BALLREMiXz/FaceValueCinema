// Vercel adapter for the booking API (same handler as netlify/functions/cinema.mjs).
// Env: DATABASE_URL (Postgres, e.g. Neon), ADMIN_USERNAME, ADMIN_PASSWORD (>= 12 chars).
import { getPool, ensureSchema } from '../server/vercel-db.mjs';
import { createAPI } from '../server/api.mjs';
let handle;
async function run(req){
 try {
  if(!handle){
   const pool=getPool();
   await ensureSchema();
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
