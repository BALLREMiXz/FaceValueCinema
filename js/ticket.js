/* Ticket renderer: local assets, bounded image loading, JPEG export. */
window.CinemaTicket = (() => {
  function loadPoster(src) {
    return new Promise(resolve => {
      const img = new Image(); let done = false;
      const finish = value => { if(done)return; done=true; clearTimeout(timer); img.onload=null; img.onerror=null; resolve(value); };
      const timer = setTimeout(()=>finish(null),5000);
      img.onload = ()=>finish(img.naturalWidth ? img : null);
      img.onerror = ()=>finish(null);
      // Set handlers BEFORE src, including already-cached images in Chrome.
      img.crossOrigin = 'anonymous'; img.src = src;
      if(img.complete && img.naturalWidth)finish(img);
    });
  }
  function paint(order,film,poster,background,logo) {
    // Layout ported from PosterTicker/ticket.html (dark theme), 1769 x 924.
    const W=1769,H=924,canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;
    const x=canvas.getContext('2d');if(!x)throw Error('เบราว์เซอร์ไม่รองรับการสร้างภาพตั๋ว');
    const gold='#e0c075',goldDim='#b89a58',text='#f3ede0',muted='#a9a49a',white='#fff';
    const THAI='"Cinema Thai", Sarabun, Tahoma, sans-serif',SERIF='"Playfair Display", Georgia, serif',MONO='"JetBrains Mono", Consolas, monospace';
    x.textBaseline='top';
    x.fillStyle='#121212';x.fillRect(0,0,W,H);
    if(background){const r=Math.max(W/background.naturalWidth,H/background.naturalHeight),w=background.naturalWidth*r,h=background.naturalHeight*r;x.drawImage(background,(W-w)/2,(H-h)/2,w,h);}
    const v=x.createLinearGradient(0,0,0,H);v.addColorStop(0,'rgba(6,6,6,.82)');v.addColorStop(.18,'rgba(6,6,6,.82)');v.addColorStop(.5,'rgba(6,6,6,.6)');v.addColorStop(.74,'rgba(6,6,6,0)');v.addColorStop(1,'rgba(6,6,6,0)');x.fillStyle=v;x.fillRect(0,0,W,H);
    const hz=x.createLinearGradient(0,0,W,0);hz.addColorStop(0,'rgba(6,6,6,.45)');hz.addColorStop(.26,'rgba(6,6,6,0)');hz.addColorStop(.66,'rgba(6,6,6,0)');hz.addColorStop(.78,'rgba(6,6,6,.45)');hz.addColorStop(1,'rgba(6,6,6,.45)');x.fillStyle=hz;x.fillRect(0,0,W,H);
    const hr=y=>{x.fillStyle='rgba(224,192,117,.28)';x.fillRect(64,y,W-128,1);};
    // line-height 1.4: box top = y, glyphs centred in the box like the HTML original.
    function label(t,px,py,size,color,{font=THAI,weight='',align='left',max}={}){
      x.font=`${weight} ${size}px ${font}`.trim();x.fillStyle=color;x.textAlign=align;
      x.shadowColor='rgba(0,0,0,.8)';x.shadowBlur=8;x.shadowOffsetY=1;
      x.fillText(String(t),px,py+(font===THAI?size*.2:size*.1),max);x.shadowColor='transparent';x.shadowBlur=0;x.shadowOffsetY=0;x.textAlign='left';
    }
    label('E-TICKET  /  APPROVED',W-262,70,20,gold,{align:'right'});
    label('อนุมัติแล้ว • พร้อมเข้าชม',W-262,102,20,white,{weight:'bold',align:'right'});
    if(logo){const h=112,w=logo.naturalWidth/logo.naturalHeight*h;x.drawImage(logo,64,34,w,h);}
    hr(150);
    x.save();x.fillStyle='#2a1a10';x.fillRect(64,172,440,590);
    if(poster){const ratio=440/590,sr=poster.naturalWidth/poster.naturalHeight;let sw=poster.naturalWidth,sh=poster.naturalHeight;if(sr>ratio)sw=sh*ratio;else sh=sw/ratio;x.drawImage(poster,(poster.naturalWidth-sw)/2,(poster.naturalHeight-sh)/2,sw,sh,64,172,440,590);}
    x.strokeStyle='rgba(224,192,117,.18)';x.lineWidth=1;x.strokeRect(64.5,172.5,439,589);x.restore();
    label('ADMIT '+order.seats.length+'  /  DIGITAL 2D',64,774,20,gold);
    label(film.title,584,190,56,text,{font:SERIF,max:1150});label(film.thai,584,265,30,gold,{weight:'600',max:1150});
    const d=new Date(order.date+'T00:00:00+07:00').toLocaleDateString('th-TH',{day:'numeric',month:'long',year:'numeric',timeZone:'Asia/Bangkok'});
    label('วันฉาย / DATE',584,344,18,muted);label(d,584,376,30,text,{weight:'500',max:300});
    label('รอบฉาย / SHOWTIME',900,344,18,muted);label(order.time+' น.',900,376,30,text,{weight:'500',max:300});
    label('ที่นั่ง / SEATS',584,453,18,muted);
    let sx=0,sy=0;
    order.seats.forEach(seat=>{x.font='28px '+THAI;const w=Math.max(96,Math.ceil(x.measureText(seat).width)+28);if(sx&&sx+w>640){sx=0;sy+=58;}
      const px=584+sx,py=490+sy;x.fillStyle='rgba(224,192,117,.08)';x.fillRect(px,py,w,48);x.strokeStyle=goldDim;x.lineWidth=1.5;x.strokeRect(px,py,w,48);
      x.shadowColor='transparent';x.font='28px '+THAI;x.fillStyle=text;x.textAlign='center';x.fillText(seat,px+w/2,py+10);x.textAlign='left';sx+=w+10;});
    label('ผู้จอง / GUEST',584,704,18,muted);label(order.name,584,733,30,white,{weight:'500',max:640});
    x.strokeStyle='rgba(224,192,117,.5)';x.lineWidth=2;x.setLineDash([8,6]);x.beginPath();x.moveTo(545,165);x.lineTo(545,783);x.stroke();x.setLineDash([]);
    label('CINEMA',1320,196,18,muted);label(String(Number(order.movie.slice(1))).padStart(2,'0'),1320,236,190,gold,{font:SERIF});
    label('TOTAL / ยอดรวม',1320,457,18,muted);label(order.amount+' THB',1320,490,44,text,{font:SERIF,max:420});
    label(order.seats.length+' ที่นั่ง × '+(order.unitPrice||order.amount/order.seats.length)+' บาท',1320,556,20,muted,{max:420});
    label('BOOKING NO.',1320,621,17,gold);label(order.id,1320,655,25,text,{font:MONO,max:420});
    label('แสดงตั๋วหนังก่อนเข้าชม',1320,738,19,muted,{max:420});
    hr(806);
    label('โปรดแสดงตั๋วนี้ให้เจ้าหน้าที่ตรวจสอบก่อนเข้าชม',64,831,24,text,{weight:'500',max:1100});
    label('Please present this ticket to the staff for inspection before entry.',64,867,24,text,{weight:'500',max:1100});
    label('เฉพาะวัน รอบ และที่นั่งที่ระบุ',W-265,838,18,muted,{align:'right'});
    // Film grain, like the original's overlay layer.
    const g=document.createElement('canvas');g.width=g.height=240;const gx=g.getContext('2d'),id=gx.createImageData(240,240);for(let i=0;i<id.data.length;i+=4){const n=Math.random()*255;id.data[i]=id.data[i+1]=id.data[i+2]=n;id.data[i+3]=255;}gx.putImageData(id,0,0);
    x.save();x.globalCompositeOperation='overlay';x.globalAlpha=.18;x.fillStyle=x.createPattern(g,'repeat');x.fillRect(0,0,W,H);x.restore();
    return canvas;
  }
  async function create(order,film){
    if(order.status!=='approved')throw Error('ยังไม่ได้รับอนุมัติ ไม่สามารถออกตั๋วได้');
    if(document.fonts)await Promise.race([Promise.all([document.fonts.load('28px "Cinema Thai"'),document.fonts.load('bold 20px "Cinema Thai"')]).then(()=>document.fonts.ready),new Promise(r=>setTimeout(r,2500))]);
    const [poster,background,logo]=await Promise.all([loadPoster(film.poster),loadPoster('assets/ticket-hall.jpg'),loadPoster('assets/ticket-logo.png')]);
    let canvas=paint(order,film,poster,background,logo),dataUrl;
    try{dataUrl=canvas.toDataURL('image/jpeg',.95);}catch(e){canvas=paint(order,film,null,null,null);dataUrl=canvas.toDataURL('image/jpeg',.95);}
    if(!dataUrl.startsWith('data:image/jpeg'))throw Error('สร้างไฟล์ JPG ไม่สำเร็จ กรุณาลองใหม่');
    return {dataUrl,filename:order.id+'.jpg'};
  }
  return {create};
})();
