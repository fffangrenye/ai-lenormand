const fs=require('node:fs');
const {DatabaseSync}=require('node:sqlite');
const db=new DatabaseSync(':memory:');
for(const file of fs.readdirSync('lib/paid-local/migrations').filter(x=>x.endsWith('.sql')).sort()) db.exec(fs.readFileSync(`lib/paid-local/migrations/${file}`,'utf8'));
const rows=db.prepare("SELECT sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY CASE type WHEN 'table' THEN 0 WHEN 'index' THEN 1 ELSE 2 END,rowid").all();
const ddl=rows.map(r=>r.sql+';').join('\n')+'\nINSERT INTO local_schema_versions SELECT value, strftime(\'%Y-%m-%dT%H:%M:%fZ\',\'now\') FROM json_each(\'[1,2,3,4,5,6,7,8,9]\');';
fs.mkdirSync('workers/flora-api',{recursive:true});
fs.writeFileSync('workers/flora-api/schema.ts','// Fresh cloud database schema, generated from the tested local migrations. Contains no user data.\nexport const schema = '+JSON.stringify(ddl)+';\n');db.close();
