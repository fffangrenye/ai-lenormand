// Only public, build-time HTML shells belong here. Account data is fetched
// through authenticated APIs after hydration and is never copied into assets.
export const staticApplicationPaths=["/","/daily","/yes-no","/knowledge","/oracle","/space"] as const;
export const staticLegalPaths=["/terms","/privacy","/refunds","/contact","/pricing"] as const;
const paths=new Set<string>([...staticApplicationPaths,...staticLegalPaths]);
export function safeSitePath(value:string,fallback="/deep"){
  return value.startsWith("/")&&!value.startsWith("//")&&!/[\\\u0000-\u001f]/.test(value)?value:fallback;
}
export function isStaticPublicHref(href:string){
  if(!href.startsWith("/")||href.startsWith("//"))return false;
  return paths.has(href.split(/[?#]/)[0].replace(/\/$/,"")||"/");
}
export function replaceSiteRoute(router:{replace:(href:string)=>void},href:string){
  href=safeSitePath(href);
  if(typeof window!=="undefined"&&isStaticPublicHref(href))window.location.replace(href);
  else router.replace(href);
}
