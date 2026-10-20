/* Receipts are uploaded to the shared database, visible only to their owner and admin. */
window.CinemaReceipts=(()=>{
  async function put(id,blob,order){
    const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(Error('อ่านภาพไม่ได้'));reader.readAsDataURL(blob);});
    return window.cinemaLocalRequest('/api/receipt/upload',{id:order.id,token:order.token,data});
  }
  async function get(receiptId,order){
    const r=await fetch('/.netlify/functions/cinema?action=receipt',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({receiptId,token:order?.token})});
    if(!r.ok){const e=await r.json();throw Error(e.error||'อ่านสลิปไม่ได้');}return r.blob();
  }
  async function prepare(file){
    if(!file||!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('เลือกไฟล์ JPG, PNG หรือ WEBP');
    if(file.size>10*1024*1024)throw Error('ภาพสลิปต้องไม่เกิน 10 MB');
    const image=await createImageBitmap(file).catch(()=>{throw Error('ไฟล์ภาพเปิดไม่ได้ กรุณาเลือกภาพใหม่');});
    const scale=Math.min(1,1800/Math.max(image.width,image.height));
    const canvas=document.createElement('canvas');canvas.width=Math.round(image.width*scale);canvas.height=Math.round(image.height*scale);const x=canvas.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,canvas.width,canvas.height);x.drawImage(image,0,0,canvas.width,canvas.height);image.close();
    const blob=await new Promise(r=>canvas.toBlob(r,'image/jpeg',.93));if(!blob)throw Error('เตรียมภาพสลิปไม่สำเร็จ');if(blob.size>2*1024*1024)throw Error('ภาพหลังย่อยังเกิน 2 MB กรุณาใช้ภาพขนาดเล็กลง');return blob;
  }
  return {put,get,prepare};
})();
