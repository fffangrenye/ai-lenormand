"use client";

import NextLink from "next/link";
import {forwardRef,type ComponentPropsWithoutRef} from "react";
import {isStaticPublicHref} from "@/lib/public-routes";

// Public assets serve HTML directly. Native links avoid asking those URLs for
// Next RSC payloads; private app routes retain their existing client navigation.
const SiteLink=forwardRef<HTMLAnchorElement,ComponentPropsWithoutRef<typeof NextLink>>(function SiteLink(props,ref){
  if(typeof props.href==="string"&&isStaticPublicHref(props.href)){
    const anchor={...props} as Record<string,unknown>;
    for(const key of ["as","prefetch","replace","scroll","shallow","locale","legacyBehavior","passHref"])delete anchor[key];
    return <a {...anchor as ComponentPropsWithoutRef<"a">} ref={ref} href={props.href}/>;
  }
  return <NextLink {...props} ref={ref} prefetch={false}/>;
});
export default SiteLink;
