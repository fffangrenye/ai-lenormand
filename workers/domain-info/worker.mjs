import { renderPage } from "./content.mjs";

// Independent informational Worker. No application imports, secrets, database or payment bindings.
export default {
  async fetch(request) {
    if (!["GET", "HEAD"].includes(request.method)) return new Response("Method not allowed", { status: 405, headers: { Allow: "GET, HEAD" } });
    const url = new URL(request.url);
    if (url.pathname === "/favicon.ico") return new Response(null, { status: 204 });
    if (url.pathname === "/robots.txt") return new Response(request.method === "HEAD" ? null : "User-agent: *\nAllow: /\n", { headers: { "Content-Type": "text/plain; charset=utf-8" } });
    const route = url.pathname.replace(/\/$/, "") || "/";
    const html = renderPage(route);
    const headers = {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=300",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; img-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"
    };
    return new Response(request.method === "HEAD" ? null : html || "<!doctype html><html lang=\"zh-CN\"><meta charset=\"utf-8\"><title>页面未找到</title><h1>页面未找到</h1><a href=\"/\">返回首页</a></html>", { status: html ? 200 : 404, headers });
  }
};
