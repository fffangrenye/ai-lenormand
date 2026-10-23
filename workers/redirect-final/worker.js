const TARGET_ORIGIN="https://floralenormand.site";
const PUBLIC_PAGES=new Set(["/","/daily","/yes-no","/deep","/knowledge","/login","/forgot-password","/reset-password","/profile","/recharge","/redeem","/terms","/privacy","/pricing","/refunds","/contact"]);
export default {
  async fetch(request){
    const url=new URL(request.url),path=url.pathname.replace(/\/$/,"")||"/";
    const headers={"Cache-Control":"public, max-age=86400","X-Robots-Tag":"noindex, follow","X-Content-Type-Options":"nosniff"};
    if(!["GET","HEAD"].includes(request.method))return Response.json({code:"SITE_MOVED",message:"网站已迁移，请在 floralenormand.site 重新打开。",url:TARGET_ORIGIN},{status:410,headers:{...headers,"Cache-Control":"no-store"}});
    if(path==="/robots.txt")return new Response(request.method==="HEAD"?null:"User-agent: *\nDisallow: /\nCrawl-delay: 60\n",{headers:{...headers,"Content-Type":"text/plain; charset=utf-8"}});
    if(/^\/(?:_next\/|api\/|\.well-known\/)/.test(path) || /\.(?:php|env|sql|map|js|css|png|jpe?g|webp|ico)$/.test(path))return new Response(null,{status:410,headers});
    const target=new URL(PUBLIC_PAGES.has(path) ? path : path.startsWith("/deep/") ? "/deep" : "/",TARGET_ORIGIN);
    const auth=["/login","/reset-password","/forgot-password"].includes(path);
    if(auth){target.search=url.search;const back=target.searchParams.get("returnTo");if(back?.startsWith("/deep/project/"))target.searchParams.set("returnTo","/deep");headers["Cache-Control"]="no-store";}
    else for(const key of ["utm_source","utm_medium","utm_campaign"])if(url.searchParams.has(key))target.searchParams.set(key,url.searchParams.get(key));
    // Browsers inherit the original fragment across HTTP redirects when Location
    // has no fragment, preserving recovery links without inline script.
    return new Response(null,{status:auth?307:301,headers:{...headers,Location:target.href}});
  }
};
