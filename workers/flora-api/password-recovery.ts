// Uses the user's verified recovery session, never a service-role/admin key.
export async function recoverPassword(request:Request,env:{SUPABASE_URL:string;SUPABASE_ANON_KEY:string}){
  const respond=(value:unknown,status=200)=>Response.json(value,{status,headers:{"Cache-Control":"no-store"}});
  try{
    const raw=await request.text();if(raw.length>12000)return respond({error:"请求过长。"},413);
    const input=JSON.parse(raw) as Record<string,unknown>;
    if(typeof input.password!=="string" || input.password.length<8 || input.password.length>128)return respond({error:"密码需要 8～128 位。"},400);
    const headers={apikey:env.SUPABASE_ANON_KEY,"Content-Type":"application/json"};
    let accessToken=typeof input.accessToken==="string"?input.accessToken:"",refreshToken=typeof input.refreshToken==="string"?input.refreshToken:"",expiresIn=typeof input.expiresIn==="number"?input.expiresIn:3600;
    if(typeof input.tokenHash==="string" && input.tokenHash){
      const verified=await fetch(`${env.SUPABASE_URL}/auth/v1/verify`,{method:"POST",headers,body:JSON.stringify({token_hash:input.tokenHash,type:"recovery"}),signal:AbortSignal.timeout(10000)});
      if(!verified.ok)return respond({error:"重置链接已失效，请重新申请。"},400);
      const session=await verified.json() as {access_token:string;refresh_token:string;expires_in:number};accessToken=session.access_token;refreshToken=session.refresh_token;expiresIn=session.expires_in;
    }
    if(!accessToken)return respond({error:"重置链接已失效，请重新申请。"},400);
    const response=await fetch(`${env.SUPABASE_URL}/auth/v1/user`,{method:"PUT",headers:{...headers,Authorization:`Bearer ${accessToken}`},body:JSON.stringify({password:input.password}),signal:AbortSignal.timeout(10000)});
    if(!response.ok)return respond({error:"密码未能更新，请重新申请重置邮件后再试。"},400);
    const user=await response.json();
    return respond({session:{access_token:accessToken,refresh_token:refreshToken,expires_in:expiresIn,user}});
  }catch{return respond({error:"暂时无法更新密码，请稍后重试。"},503);}
}
