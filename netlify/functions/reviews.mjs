// The previous public review endpoint is intentionally disabled.
export default async function(){return Response.json({error:'ระบบรีวิวถูกยกเลิก ใช้หัวใจบนหน้าปกหนังแทน'},{status:410,headers:{'Cache-Control':'no-store'}});}
