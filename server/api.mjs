import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { event, filmIds } from './config.mjs';
import { schema } from './schema.mjs';
const hash=s=>createHash('sha256').update(String(s)).digest('hex');
const equal=(a,b)=>timingSafeEqual(Buffer.from(hash(a)),Buffer.from(hash(b)));
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const clean=o=>({...o.payload,status:o.status});
const cookie=(req,key)=>(req.headers.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(key+'='))?.slice(key.length+1)||'';
export function createAPI(pool,{local=false,username='admin',password='',clock=()=>Date.now()}={}) {
 let ready;
 async function initialize(){if(!ready)ready=(local?pool.query(schema):Promise.resolve()).catch(e=>{ready=null;throw e;});await ready;}
 async function tx(fn){const c=await pool.connect();try{await c.query('BEGIN');const v=await fn(c);await c.query('COMMIT');return v;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}
 async function expire(c){const rows=(await c.query("SELECT id,payload FROM cinema_orders WHERE status='pending' AND payload->>'paymentStatus'='awaiting_slip' AND expires<$1 AND NOT EXISTS(SELECT 1 FROM cinema_receipts r WHERE r.order_id=cinema_orders.id) ORDER BY id FOR UPDATE",[clock()])).rows;for(const r of rows){await c.query("UPDATE cinema_orders SET status='rejected',payload=$2 WHERE id=$1",[r.id,{...r.payload,paymentStatus:'expired'}]);await c.query('DELETE FROM cinema_seats WHERE order_id=$1',[r.id]);}}
 async function limit(key,max){const now=clock(),until=now+15*60000;const r=await pool.query('INSERT INTO cinema_limits(key,attempts,until_ms) VALUES($1,1,$2) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN cinema_limits.until_ms<$3 THEN 1 ELSE cinema_limits.attempts+1 END,until_ms=CASE WHEN cinema_limits.until_ms<$3 THEN $2 ELSE cinema_limits.until_ms END RETURNING attempts',[key,until,now]);if(r.rows[0].attempts>max)fail('ทำรายการบ่อยเกินไป กรุณารอ 15 นาที',429);}
 const isAdmin=async req=>{try{await admin(req);return true;}catch{return false;}};
 async function admin(req){const t=cookie(req,'jetasik_admin');if(!/^[a-f0-9]{64}$/.test(t))fail('กรุณาเข้าสู่ระบบแอดมิน',401);const r=await pool.query('SELECT expires,password_tag FROM cinema_sessions WHERE token_hash=$1',[hash(t)]);if(!r.rows[0]||Number(r.rows[0].expires)<clock()||r.rows[0].password_tag!==hash(username+':'+password))fail('กรุณาเข้าสู่ระบบแอดมิน',401);return hash(t);}
 function owner(row,b){if(!row||typeof b.token!=='string'||!equal(hash(b.token),row.token_hash))fail('ไม่พบรายการหรือรหัสรับตั๋วไม่ถูกต้อง',404);}
 async function order(c,b,lock=false){const r=(await c.query('SELECT * FROM cinema_orders WHERE id=$1'+(lock?' FOR UPDATE':''),[String(b.id||'')])).rows[0];owner(r,b);return r;}
 return async function handle(req,context={}) {
 const url=new URL(req.url),action=url.searchParams.get('action')||'config';
 const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
 const reply=(v,status=200)=>new Response(JSON.stringify(v),{status,headers});
 const setCookie=(name,value,seconds)=>{headers['Set-Cookie']=`${name}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${seconds}${url.protocol==='https:'?'; Secure':''}`;};
 try {
 if(!['GET','POST'].includes(req.method))fail('Method not allowed',405);
 if(req.method==='POST'&&req.headers.get('origin')!==url.origin)fail('กรุณาทำรายการจากหน้าเว็บไซต์นี้',403);
 const readOnly=['config','seats','admin/orders','admin/loves','admin/reviews','loves/mine','loves/stats'];
 if(readOnly.includes(action)&&req.method!=='GET')fail('Method not allowed',405);
 if(!readOnly.includes(action)&&req.method!=='POST')fail('Method not allowed',405);
 let b={};if(req.method==='POST'){const text=await req.text();if(text.length>(action==='receipt/upload'?2900000:12000))fail('ข้อมูลใหญ่เกินกำหนด',413);try{b=JSON.parse(text);}catch{fail('ข้อมูลไม่ถูกต้อง');}if(!b||Array.isArray(b)||typeof b!=='object')fail('ข้อมูลไม่ถูกต้อง');}
 if(action==='config')return reply({dates:[event.date],times:event.times,price:event.price,holdMinutes:event.holdMinutes,bookable:event.movies,server:true,local});
 await initialize();
 if(action==='login'){
  if(!password||(!local&&password.length<12))fail('ยังไม่ได้ตั้ง ADMIN_PASSWORD บนเซิร์ฟเวอร์ (อย่างน้อย 12 ตัวอักษร)',503);
  await limit('login:'+hash(context.ip||'local'),10);
  if(!equal(b.username,username)||!equal(b.password,password))fail('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง',401);
  const token=randomBytes(32).toString('hex');await pool.query('INSERT INTO cinema_sessions VALUES($1,$2,$3)',[hash(token),clock()+8*3600000,hash(username+':'+password)]);setCookie('jetasik_admin',token,8*3600);return reply({ok:true});
 }
 if(action.startsWith('admin/')){
  const session=await admin(req);
  if(action==='admin/logout'){await pool.query('DELETE FROM cinema_sessions WHERE token_hash=$1',[session]);setCookie('jetasik_admin','',0);return reply({ok:true});}
  if(action==='admin/orders'){await tx(expire);return reply((await pool.query('SELECT * FROM cinema_orders ORDER BY created,id')).rows.map(clean));}
  if(action==='admin/reviews'){return reply((await pool.query("SELECT movie,hearts,review,created FROM cinema_loves WHERE review IS NOT NULL AND review<>'' ORDER BY created DESC")).rows.map(r=>({...r,created:Number(r.created)})));}
  if(action==='admin/loves'){return reply((await pool.query('SELECT movie,COUNT(*)::int AS count,AVG(hearts)::float AS average,SUM(hearts)::int AS total FROM cinema_loves GROUP BY movie')).rows.map(r=>({...r,percent:Math.round(r.average/5*100)})));}
  if(action==='admin/reset'){
   if(b.confirm!=='RESET')fail('ต้องยืนยันการล้างข้อมูลก่อน');
   await tx(async c=>{await c.query('DELETE FROM cinema_receipts');await c.query('DELETE FROM cinema_seats');await c.query('DELETE FROM cinema_orders');});
   return reply({ok:true});
  }
  if(action==='admin/refund'){
   await tx(async c=>{const o=(await c.query('SELECT * FROM cinema_orders WHERE id=$1 FOR UPDATE',[b.id])).rows[0];if(!o||o.status!=='approved')fail('คืนตั๋วได้เฉพาะรายการที่อนุมัติแล้ว',409);
    await c.query("UPDATE cinema_orders SET status='rejected',payload=$2 WHERE id=$1",[o.id,{...o.payload,paymentStatus:'refunded',refunded:new Date(clock()).toISOString()}]);await c.query('DELETE FROM cinema_seats WHERE order_id=$1',[o.id]);
   });return reply({ok:true});
  }
  if(action==='admin/status'){
   if(!['approved','rejected'].includes(b.status))fail('สถานะไม่ถูกต้อง');
   await tx(async c=>{const o=(await c.query('SELECT * FROM cinema_orders WHERE id=$1 FOR UPDATE',[b.id])).rows[0];if(!o||o.status!=='pending')fail('รายการนี้ไม่อยู่ในสถานะรออนุมัติ',409);
    if(b.status==='approved'&&!(await c.query('SELECT order_id FROM cinema_receipts WHERE order_id=$1',[b.id])).rows.length)fail('ต้องได้รับสลิปก่อนอนุมัติ');
    const payload={...o.payload,reviewed:new Date(clock()).toISOString()};await c.query('UPDATE cinema_orders SET status=$2,payload=$3 WHERE id=$1',[b.id,b.status,payload]);if(b.status==='rejected')await c.query('DELETE FROM cinema_seats WHERE order_id=$1',[b.id]);
   });return reply({ok:true});
  }
 }
 if(action==='seats'){
  await tx(expire);const r=await pool.query('SELECT seat FROM cinema_seats WHERE movie=$1 AND show_date=$2 AND show_time=$3',[url.searchParams.get('movie'),url.searchParams.get('date'),url.searchParams.get('time')]);return reply({occupied:r.rows.map(x=>x.seat),admin:await isAdmin(req)});
 }
 if(action==='book'){
  if(!local&&password.length<12)fail('ยังไม่เปิดรับจอง: ผู้ดูแลต้องตั้งรหัสแอดมินบนเซิร์ฟเวอร์ก่อน',503);
  if(!event.movies.includes(b.movie)||b.date!==event.date||!event.times.includes(b.time)||Date.parse(b.date+'T'+b.time+':00+07:00')<=clock())fail('กรุณาเลือกรอบฉายที่ยังไม่ผ่านไป');
  if(typeof b.name!=='string'||b.name.trim().length<2||b.name.length>80||typeof b.phone!=='string'||!/^0\d{8,9}$/.test(b.phone))fail('กรุณากรอกชื่อและเบอร์โทรให้ถูกต้อง');
  if(!Array.isArray(b.seats)||!b.seats.length||b.seats.length>40||new Set(b.seats).size!==b.seats.length||b.seats.some(s=>typeof s!=='string'||! /^[A-DS][0-7]$/.test(s)))fail('ที่นั่งไม่ถูกต้อง');
  if(!/^[a-f0-9]{64}$/.test(b.token||'')||! /^[a-f0-9-]{36}$/.test(b.requestId||''))fail('รหัสคำขอไม่ถูกต้อง กรุณาลองใหม่');
  await limit('book:'+hash(context.ip||'local'),60);
  // Spare seats (row S) open only when every red seat is taken; a signed-in admin may book anywhere.
  const wantsSpare=b.seats.some(s=>s[0]==='S'),adminBooking=wantsSpare&&await isAdmin(req);
  const result=await tx(async c=>{
   await expire(c);
   // Serializes retries of the SAME request only; seat PK handles different customers.
   await c.query('SELECT pg_advisory_xact_lock(hashtext($1))',[b.requestId]);
   const old=(await c.query('SELECT * FROM cinema_orders WHERE request_id=$1',[b.requestId])).rows[0];
   if(old){owner(old,b);return {...clean(old),token:b.token};}
   if(wantsSpare&&!adminBooking){const red=(await c.query("SELECT COUNT(*)::int AS n FROM cinema_seats WHERE movie=$1 AND show_date=$2 AND show_time=$3 AND seat ~ '^[A-D]'",[b.movie,b.date,b.time])).rows[0].n;if(red<32)fail('ที่นั่งสำรองเปิดให้จองเมื่อที่นั่งสีแดงเต็มแล้วเท่านั้น',409);}
   const id='JC-'+randomBytes(8).toString('hex').toUpperCase(),now=clock();
   const o={id,movie:b.movie,date:b.date,time:b.time,seats:[...b.seats].sort(),name:b.name.trim(),phone:b.phone,amount:b.seats.length*event.price,unitPrice:event.price,requireSlip:true,paymentStatus:'awaiting_slip',created:new Date(now).toISOString(),expiresAt:new Date(now+event.holdMinutes*60000).toISOString()};
   await c.query("INSERT INTO cinema_orders VALUES($1,$2,$3,'pending',$4,$5,$6)",[id,hash(b.token),b.requestId,o,now,now+event.holdMinutes*60000]);
   for(const seat of o.seats)await c.query('INSERT INTO cinema_seats VALUES($1,$2,$3,$4,$5)',[b.movie,b.date,b.time,seat,id]);
   return {...o,status:'pending',token:b.token};
  });return reply(result);
 }
 if(action==='order'){await tx(expire);const o=await order(pool,b);return reply({...clean(o),token:b.token});}
 if(action==='payment'){
  if(b.action!=='cancel')fail('กรุณาใช้ปุ่มส่งสลิป');
  await tx(async c=>{const o=await order(c,b,true);if(o.status!=='pending'||o.payload.paymentStatus==='submitted')fail('ยกเลิกไม่ได้ กรุณาติดต่อแอดมิน',409);await c.query("UPDATE cinema_orders SET status='rejected',payload=$2 WHERE id=$1",[o.id,{...o.payload,paymentStatus:'cancelled'}]);await c.query('DELETE FROM cinema_seats WHERE order_id=$1',[o.id]);});return reply({ok:true});
 }
 if(action==='receipt/upload'){
  if(typeof b.data!=='string'||b.data.length>2800000||! /^[A-Za-z0-9+/]*={0,2}$/.test(b.data))fail('ภาพสลิปไม่ถูกต้อง');
  const image=Buffer.from(b.data,'base64');if(image.length<4||image.length>2097152||image[0]!==255||image[1]!==216||image[image.length-2]!==255||image[image.length-1]!==217)fail('สลิปต้องเป็นภาพ JPG ขนาดไม่เกิน 2 MB');
  return reply(await tx(async c=>{const o=await order(c,b,true);if(o.status!=='pending'||(o.payload.paymentStatus!=='submitted'&&Number(o.expires)<clock()))fail('รายการหมดเวลาหรือถูกตรวจสอบแล้ว กรุณาตรวจสถานะก่อนโอนเงิน',409);
   const receiptId=o.id+'-'+randomBytes(8).toString('hex');await c.query('INSERT INTO cinema_receipts VALUES($1,$2,$3) ON CONFLICT(order_id) DO UPDATE SET receipt_id=$2,image=$3',[o.id,receiptId,image]);
   const payload={...o.payload,receiptId,receiptName:'receipt.jpg',paymentStatus:'submitted',submitted:new Date(clock()).toISOString()};await c.query('UPDATE cinema_orders SET payload=$2 WHERE id=$1',[o.id,payload]);return {...payload,status:o.status,token:b.token};
  }));
 }
 if(action==='receipt'){
  const r=(await pool.query('SELECT r.image,o.token_hash FROM cinema_receipts r JOIN cinema_orders o ON o.id=r.order_id WHERE r.receipt_id=$1',[String(b.receiptId||'')])).rows[0];if(!r)fail('ไม่พบสลิป',404);
  if(!b.token||!equal(hash(b.token),r.token_hash))await admin(req);
  return new Response(r.image,{headers:{...headers,'Content-Type':'image/jpeg','Content-Disposition':'inline; filename="receipt.jpg"'}});
 }
 if(action==='loves/stats'){const r=await pool.query('SELECT movie,COUNT(*)::int AS count,AVG(hearts)::float AS average FROM cinema_loves GROUP BY movie');return reply(Object.fromEntries(r.rows.map(r=>[r.movie,{count:r.count,percent:Math.round(r.average/5*100)}])));}
 if(action==='loves/mine'||action==='loves/set'){
  let browser=cookie(req,'jetasik_love');if(!/^[a-f0-9]{64}$/.test(browser)){if(action==='loves/set')fail('กรุณาเปิดหน้าหนังใหม่ก่อนให้หัวใจ');browser=randomBytes(32).toString('hex');setCookie('jetasik_love',browser,31536000);}
  if(action==='loves/mine'){const r=await pool.query('SELECT movie,hearts FROM cinema_loves WHERE browser_hash=$1',[hash(browser)]);return reply(Object.fromEntries(r.rows.map(r=>[r.movie,r.hearts])));}
  if(!filmIds.includes(b.movie)||!Number.isInteger(b.hearts)||b.hearts<0||b.hearts>5)fail('เลือกหัวใจ 1–5 ดวง หรือ 0 เพื่อยกเลิก');
  const review=typeof b.review==='string'?b.review.trim().slice(0,1000):'';
  await limit('love:'+hash(browser),120);
  // Explicit desired value makes repeated network requests idempotent.
  if(b.hearts===0)await pool.query('DELETE FROM cinema_loves WHERE movie=$1 AND browser_hash=$2',[b.movie,hash(browser)]);
  else await pool.query(`INSERT INTO cinema_loves(movie,browser_hash,hearts,review,created) VALUES($1,$2,$3,NULLIF($4,''),$5) ON CONFLICT(movie,browser_hash) DO UPDATE SET hearts=$3,review=COALESCE(NULLIF($4,''),cinema_loves.review),created=CASE WHEN NULLIF($4,'') IS NULL THEN cinema_loves.created ELSE $5 END`,[b.movie,hash(browser),b.hearts,review,clock()]);
  return reply({movie:b.movie,hearts:b.hearts});
 }
 fail('ไม่พบคำสั่ง',404);
 }catch(e){if(e.code==='23505')return reply({error:'ที่นั่งถูกจองแล้ว กรุณาเลือกใหม่'},409);if(e.status)return reply({error:e.message},e.status);console.error('Cinema API:',e.code||e.message);return reply({error:'ระบบฐานข้อมูลยังไม่พร้อม กรุณาตรวจ Terminal หรือ Function logs'},503);}
 };
}
