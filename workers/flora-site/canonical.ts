// Only noncanonical entry URLs invoke this Worker. HTTPS on the canonical
// domain goes directly to the site's assets router, with no database binding.
export default {
  fetch(request:Request){
    const url=new URL(request.url);
    if(!["www.floralenormand.site","floralenormand.site"].includes(url.hostname))return new Response("Not found",{status:404});
    url.hostname="floralenormand.site";url.protocol="https:";
    return new Response(null,{status:308,headers:{Location:url.href,"Cache-Control":"public, max-age=300","X-Content-Type-Options":"nosniff"}});
  }
};
