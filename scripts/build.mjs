import {mkdir,cp,rm,access} from 'node:fs/promises';
// Only public assets are published. Passwords, server code and local DB never enter dist.
await rm('dist',{recursive:true,force:true});await mkdir('dist');
for(const p of ['index.html','movies.html','cinema.html','tickets.html','admin.html','css','js','assets']){await access(p);await cp(p,'dist/'+p,{recursive:true});}
await rm('dist/js/reviews.js',{force:true});
console.log('Public website prepared in dist/');
