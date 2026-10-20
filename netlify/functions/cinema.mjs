import { getConnectionString } from '@netlify/database';
import pg from 'pg';
import { createAPI } from '../../server/api.mjs';
let handle;
export default async function(req,context){
 try {
  if(!handle){const local=process.env.NETLIFY_DEV==='true';const pool=new pg.Pool({connectionString:getConnectionString(),max:local?1:4,connectionTimeoutMillis:10000,idleTimeoutMillis:10000});handle=createAPI(pool,{local,username:process.env.ADMIN_USERNAME||'admin',password:process.env.ADMIN_PASSWORD||(local?'LocalCinema-2026!':'')});}
  return await handle(req,context);
 }catch(e){console.error('Database unavailable:',e.message);return Response.json({error:'ยังเชื่อมฐานข้อมูลไม่ได้ เปิดด้วย npm run dev และตรวจ Terminal'},{status:503,headers:{'Cache-Control':'no-store'}});}
}
