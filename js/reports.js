window.CinemaReports=(()=>{
  function select(orders,filter){return orders.filter(o=>o.date===filter.date&&o.time===filter.time&&(filter.movie==='all'||o.movie===filter.movie));}
  async function exportPDF(orders,filter,film){
    if(!filter.date||!filter.time)throw Error('เลือกวันและรอบที่ต้องการส่งออก');
    const list=select(orders,filter).sort((a,b)=>a.movie.localeCompare(b.movie)||a.created.localeCompare(b.created));
    const approved=list.filter(o=>o.status==='approved'),pending=list.filter(o=>o.status==='pending'),rejected=list.filter(o=>o.status==='rejected');
    const pdf=await PDFLib.PDFDocument.create();pdf.setTitle('Cinema report '+filter.date+' '+filter.time);pdf.setAuthor('JETASIK CINEMA');
    if(document.fonts){await document.fonts.load('22px "Cinema Thai"');await document.fonts.ready;}
    const W=1684,H=1190,left=60,widths=[200,220,175,265,270,145,289],heads=['รหัสจอง','ชื่อผู้จอง','โทรศัพท์','ภาพยนตร์','ที่นั่ง','ยอด (บาท)','สถานะ'];
    const statuses={pending:'รออนุมัติ',approved:'อนุมัติแล้ว',rejected:'ไม่อนุมัติ / ยกเลิก'};
    let canvas,x,y,page=0;
    const write=(s,px,py,size=23,color='#202020')=>{x.font=`${size}px Cinema Thai, Tahoma, Arial, sans-serif`;x.fillStyle=color;x.fillText(String(s),px,py);};
    async function flush(){if(!canvas)return;write('JETASIK CINEMA',left,H-45,18,'#777');write('หน้า '+page,W-150,H-45,18,'#777');const jpg=await pdf.embedJpg(canvas.toDataURL('image/jpeg',.94));const p=pdf.addPage([841.89,595.28]);p.drawImage(jpg,{x:0,y:0,width:841.89,height:595.28});}
    function next(){page++;canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;x=canvas.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,W,H);write('JETASIK CINEMA',left,65,31,'#75613b');write('รายงานการจองแยกรอบฉาย',left,112,32);write('วันที่ '+filter.date+'   รอบ '+filter.time+' น.   '+(filter.movie==='all'?'ทุกภาพยนตร์':film(filter.movie).thai),left,155,24);write(`อนุมัติ ${approved.length} รายการ / ${approved.reduce((s,o)=>s+o.seats.length,0)} ที่นั่ง / ${approved.reduce((s,o)=>s+o.amount,0)} บาท    รออนุมัติ ${pending.length} รายการ    ไม่อนุมัติ ${rejected.length} รายการ`,left,196,22);x.fillStyle='#282420';x.fillRect(left,225,W-120,48);let px=left;heads.forEach((t,i)=>{write(t,px+10,257,22,'#fff');px+=widths[i];});y=273;}
    function wrap(value,width){x.font='22px Cinema Thai, Tahoma, Arial, sans-serif';const lines=[];let line='';for(const c of String(value)){if(c==='\n'||(line&&x.measureText(line+c).width>width-20)){lines.push(line);line=c==='\n'?'':c;}else line+=c;}if(line||!lines.length)lines.push(line);return lines;}
    next();
    if(!list.length)write('ไม่มีรายการจองในวันและรอบที่เลือก',left+15,330,25);
    for(const o of list){const values=[o.id,o.name,o.phone,o.movieTitle||film(o.movie).thai,o.seats.join(', '),o.amount,statuses[o.status]||o.status];const cells=values.map((v,i)=>wrap(v,widths[i]));const h=Math.max(60,...cells.map(c=>c.length*29+22));if(y+h>H-90){await flush();next();}x.fillStyle=list.indexOf(o)%2?'#f7f4ed':'#fff';x.fillRect(left,y,W-120,h);let px=left;cells.forEach((lines,i)=>{lines.forEach((line,j)=>write(line,px+10,y+31+j*29,22));px+=widths[i];});x.strokeStyle='#ddd7cb';x.beginPath();x.moveTo(left,y+h);x.lineTo(W-left,y+h);x.stroke();y+=h;}
    await flush();
    // Appendix: one page per booking with the transfer slip attached.
    for(const o of list.filter(o=>o.receiptId)){
      let img=null;try{const blob=await CinemaReceipts.get(o.receiptId,o);if(blob)img=await createImageBitmap(blob);}catch{}
      page++;canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;x=canvas.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,W,H);
      write('JETASIK CINEMA',left,65,31,'#75613b');write('หลักฐานการโอนเงิน (สลิป)',left,112,32);
      x.fillStyle='#282420';x.fillRect(left,140,W-120,4);
      const rows=[['รหัสจอง',o.id],['ชื่อผู้จอง',o.name],['โทรศัพท์',o.phone],['ภาพยนตร์',o.movieTitle||film(o.movie).thai],['วันที่ / รอบ',o.date+'  '+o.time+' น.'],['ที่นั่ง',o.seats.join(', ')],['ยอดเงิน',o.amount+' บาท'],['สถานะ',statuses[o.status]||o.status]];
      rows.forEach((r,i)=>{const ry=215+i*95;write(r[0],left,ry,22,'#7a7265');wrap(r[1],620).forEach((l,j)=>write(l,left,ry+36+j*29,28));});
      const bx=800,by=180,bw=W-left-bx,bh=H-by-130;x.fillStyle='#f4f0e6';x.fillRect(bx,by,bw,bh);x.strokeStyle='#ddd7cb';x.lineWidth=2;x.strokeRect(bx,by,bw,bh);
      if(img){const r=Math.min((bw-20)/img.width,(bh-20)/img.height,1.6),w=img.width*r,h=img.height*r;x.drawImage(img,bx+(bw-w)/2,by+(bh-h)/2,w,h);img.close();}
      else write('ไม่พบไฟล์สลิป',bx+40,by+60,26,'#9c2233');
      await flush();
    }
    const bytes=await pdf.save(),blob=new Blob([bytes],{type:'application/pdf'}),url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`cinema-report-${filter.date}-${filter.time.replace(':','')}-${filter.movie}.pdf`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
  }
  async function exportReviews(film,reviews,stat){
    if(!reviews.length)throw Error('ยังไม่มีรีวิวสำหรับภาพยนตร์เรื่องนี้');
    const pdf=await PDFLib.PDFDocument.create();pdf.setTitle('Reviews - '+film.title);pdf.setAuthor('FACE VALUE CINEMA');
    if(document.fonts){await document.fonts.load('22px "Cinema Thai"');await document.fonts.ready;}
    const W=1240,H=1754,M=90,FONT='Cinema Thai, Tahoma, Arial, sans-serif',GOLD='#a9852f',INK='#25211b',MUTED='#7a7265',PINK='#c64a68';
    let canvas,x,y,page=0;
    const text=(s,px,py,size=26,color=INK,weight='',align='left')=>{x.font=`${weight} ${size}px ${FONT}`;x.fillStyle=color;x.textAlign=align;x.fillText(String(s),px,py);x.textAlign='left';};
    const heart=(cx,cy,r,color)=>{x.beginPath();x.moveTo(cx,cy+r*.9);x.bezierCurveTo(cx-r*1.5,cy-r*.1,cx-r*.7,cy-r*1.2,cx,cy-r*.4);x.bezierCurveTo(cx+r*.7,cy-r*1.2,cx+r*1.5,cy-r*.1,cx,cy+r*.9);x.closePath();x.fillStyle=color;x.fill();};
    const hearts=(n,px,cy,r=13)=>{for(let i=0;i<5;i++)heart(px+i*(r*2.5)+r,cy,r,i<n?PINK:'#ddd5c6');};
    const seg=typeof Intl!=='undefined'&&Intl.Segmenter?new Intl.Segmenter('th',{granularity:'word'}):null;
    function wrap(value,width,size){x.font=`${size}px ${FONT}`;const lines=[];let line='';const tokens=seg?[...seg.segment(String(value))].map(t=>t.segment):[...String(value)];
      for(const t of tokens){if(t.includes('\n')){lines.push(line);line='';continue;}
        if(x.measureText(line+t).width<=width){line+=t;continue;}
        if(line){lines.push(line);line='';}
        for(const c of t){if(line&&x.measureText(line+c).width>width){lines.push(line);line='';}line+=c;}}
      if(line||!lines.length)lines.push(line);return lines;}
    async function flush(){if(!canvas)return;x.strokeStyle='#e4dccb';x.lineWidth=2;x.beginPath();x.moveTo(M,H-95);x.lineTo(W-M,H-95);x.stroke();text('FACE VALUE CINEMA · เฉพาะผู้ดูแลระบบ',M,H-52,20,MUTED);text('หน้า '+page,W-M,H-52,20,MUTED,'','right');const jpg=await pdf.embedJpg(canvas.toDataURL('image/jpeg',.94));const p=pdf.addPage([595.28,841.89]);p.drawImage(jpg,{x:0,y:0,width:595.28,height:841.89});}
    function next(){page++;canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;x=canvas.getContext('2d');x.fillStyle='#fbf8f1';x.fillRect(0,0,W,H);
      if(page===1){x.fillStyle='#14120f';x.fillRect(0,0,W,330);x.fillStyle=GOLD;x.fillRect(0,330,W,8);
        text('F A C E   V A L U E   C I N E M A',M,86,22,'#d7b875');text('รีวิวจากผู้ชม',M,168,34,'#b9b1a4');text(film.thai,M,240,64,'#f5f2ec','bold');text(film.title,M,292,28,'#d7b875');
        y=380;
        const tiles=[['ความชอบเฉลี่ย',stat?stat.percent+'%':'—'],['คะแนนเฉลี่ย',stat?stat.average.toFixed(1)+' / 5':'—'],['ผู้ให้คะแนน',(stat?stat.count:0)+' คน'],['รีวิว',reviews.length+' รายการ']],tw=(W-2*M-3*20)/4;
        tiles.forEach((t,i)=>{const tx=M+i*(tw+20);x.fillStyle='#fff';x.fillRect(tx,y,tw,130);x.fillStyle=GOLD;x.fillRect(tx,y,tw,5);text(t[0],tx+22,y+48,21,MUTED);text(t[1],tx+22,y+102,40,INK,'bold');});
        y+=130+30;text('ส่งออกเมื่อ '+new Date().toLocaleString('th-TH'),M,y+10,20,MUTED);y+=50;
      }else{text('FACE VALUE CINEMA · รีวิว '+film.thai,M,70,21,GOLD);x.strokeStyle='#e4dccb';x.lineWidth=2;x.beginPath();x.moveTo(M,92);x.lineTo(W-M,92);x.stroke();y=135;}}
    next();
    for(const r of reviews){const lines=wrap(r.review,W-2*M-64,27),h=34+34+18+lines.length*42+30;
      if(y+h>H-130){await flush();next();}
      x.fillStyle='#fff';x.fillRect(M,y,W-2*M,h);x.fillStyle=GOLD;x.fillRect(M,y,6,h);x.strokeStyle='#ebe4d4';x.lineWidth=2;x.strokeRect(M,y,W-2*M,h);
      hearts(r.hearts,M+32,y+38,13);text(`${r.hearts}/5`,M+32+5*32.5+10,y+47,24,INK,'bold');
      if(r.created)text(new Date(r.created).toLocaleString('th-TH'),W-M-28,y+47,20,MUTED,'','right');
      lines.forEach((l,i)=>text(l,M+32,y+34+34+18+i*42+10,27));y+=h+22;}
    await flush();
    const blob=new Blob([await pdf.save()],{type:'application/pdf'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`face-value-reviews-${film.id}.pdf`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
  }
  return {select,exportPDF,exportReviews};
})();
