// Remove generated copies only. The original .local-paid and environment files
// are never targets. Next's standalone packager explicitly copies environment
// files even when tracing exclusions are configured.
const fs=require('node:fs'),path=require('node:path');
const workspace=fs.realpathSync(process.cwd());
function walk(dir,root){
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    const target=path.join(dir,entry.name);
    if(entry.isSymbolicLink())continue;
    if(entry.name==='.local-paid' || entry.name.startsWith('.env')){
      const resolved=fs.realpathSync(target);
      if(!resolved.startsWith(root+path.sep) || !root.startsWith(workspace+path.sep))throw new Error('Refusing to prune outside generated directory');
      fs.rmSync(target,{recursive:entry.isDirectory(),force:true});
    }else if(entry.isDirectory())walk(target,root);
  }
}
for(const name of ['.next','.open-next']){const root=path.join(workspace,name);if(fs.existsSync(root))walk(root,root);}
console.log('Generated private-file copies removed; original local data preserved.');
