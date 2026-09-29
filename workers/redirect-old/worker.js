const TARGET_ORIGIN = "https://flora.floralenormand.workers.dev";

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const target = new URL(url.pathname + url.search, TARGET_ORIGIN);

    if (url.pathname === "/reset-password" || url.pathname === "/login") {
      const targetWithoutHash = target.toString();

      return new Response(
        `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Flora Lenormand</title>
    <meta name="robots" content="noindex" />
    <script>
      location.replace(${JSON.stringify(targetWithoutHash)} + location.hash);
    </script>
  </head>
  <body>
    <p>正在前往 Flora Lenormand...</p>
    <p><a href="${targetWithoutHash}">继续</a></p>
  </body>
</html>`,
        {
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-store"
          }
        }
      );
    }

    return Response.redirect(target.toString(), 301);
  }
};
