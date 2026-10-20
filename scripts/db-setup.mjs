// One-time (idempotent) schema setup for a hosted Postgres: DATABASE_URL=... npm run db:setup
import pg from 'pg';
import { schema } from '../server/schema.mjs';
const connectionString=process.env.DATABASE_URL||process.env.POSTGRES_URL;
if(!connectionString){console.error('Set DATABASE_URL first.');process.exit(1);}
const pool=new pg.Pool({connectionString,max:1});
try{await pool.query(schema);console.log('Database schema is ready.');}finally{await pool.end();}
