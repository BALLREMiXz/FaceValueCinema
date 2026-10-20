/* Server API adapter. No bookings, passwords or receipts are stored in browser databases. */
window.cinemaLocalRequest=async function(url,data){
 const source=new URL(url,location.origin),action=source.pathname.replace(/^\/api\//,'');
 const query=new URLSearchParams(source.search);query.set('action',action);
 let r;try{r=await fetch('/.netlify/functions/cinema?'+query,{method:data===undefined?'GET':'POST',credentials:'same-origin',cache:'no-store',headers:data===undefined?{}:{'Content-Type':'application/json'},body:data===undefined?undefined:JSON.stringify(data)});}catch{throw Error('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาเปิดด้วย npm run dev');}
 let result;try{result=await r.json();}catch{throw Error('หน้านี้ต้องเปิดผ่าน npm run dev ที่ http://localhost:8888 ไม่ใช่ Live Server');}
 if(!r.ok)throw Error(result.error||'ทำรายการไม่สำเร็จ');
 if(action==='config')result.films=window.CINEMA_MOVIES.map(m=>({...m,now:['m01','m02','m03','m04'].includes(m.id)}));
 return result;
};
