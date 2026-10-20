import http from 'node:http';
import {readFile,stat,mkdir} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {NetlifyDB} from '@netlify/database-dev';
import pg from 'pg';
import {createAPI} from '../server/api.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
if(existsSync(path.join(root,'.env')))process.loadEnvFile(path.join(root,'.env'));
const directory=path.join(root,'.cinema-data');await mkdir(directory,{recursive:true});
const db=new NetlifyDB({directory,logger:()=>{}});
const connectionString=await db.start();
const pool=new pg.Pool({connectionString,max:1});
const api=createAPI(pool,{local:true,username:process.env.ADMIN_USERNAME||'admin',password:process.env.ADMIN_PASSWORD||'LocalCinema-2026!'});
const port=Number(process.env.PORT||8888),origin=`http://localhost:${port}`;
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.ttf':'font/ttf','.woff2':'font/woff2'};
const server=http.createServer(async(req,res)=>{
 try{
  if(![`localhost:${port}`,`127.0.0.1:${port}`].includes(req.headers.host)){res.writeHead(403);res.end();return;}
  const url=new URL(req.url,`http://${req.headers.host}`);
  if(url.pathname==='/.netlify/functions/cinema'){
   const chunks=[];let size=0;for await(const b of req){size+=b.length;if(size>3000000){res.writeHead(413);res.end();return;}chunks.push(b);}
   const request=new Request(url,{method:req.method,headers:req.headers,...(['GET','HEAD'].includes(req.method)?{}:{body:Buffer.concat(chunks)})});
   const response=await api(request,{ip:req.socket.remoteAddress});res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));return;
  }
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
  const name=decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname);
  if(!/^\/(?:index\.html|movies\.html|cinema\.html|tickets\.html|admin\.html|(?:assets|css|js)\/[^\0]+)$/.test(name)){res.writeHead(404);res.end('Not found');return;}
  const file=path.resolve(root,'.'+name);
  if(!file.startsWith(root)||!(await stat(file)).isFile()){res.writeHead(404);res.end();return;}
  // Refuse traversal from a permitted public folder into private server/data files.
  const relative=path.relative(root,file).replaceAll('\\','/');
  if(!/^(?:index\.html|movies\.html|cinema\.html|tickets\.html|admin\.html|(?:assets|css|js)\/)/.test(relative)){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:await readFile(file));
 }catch(e){res.writeHead(500);res.end('Local server error: '+e.message);}
});
server.listen(port,'127.0.0.1',()=>console.log(`JETASIK local server ready: ${origin}\nKeep this terminal open. Stop with Ctrl+C. Data is saved in .cinema-data (local only).`));
let stopping=false;async function stop(){if(stopping)return;stopping=true;server.closeAllConnections();server.close();await pool.end();await db.stop();process.exit();}
process.on('SIGINT',stop);process.on('SIGTERM',stop);
server.on('error',async e=>{console.error(e.code==='EADDRINUSE'?'Port 8888 is busy. Close the other local server first.':e.message);await stop();});
