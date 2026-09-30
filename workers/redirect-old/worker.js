const TARGET_ORIGIN = "https://flora.soul-ai-frontend.workers.dev";
const REDIRECT_CACHE_CONTROL = "public, max-age=86400, s-maxage=86400";
const OLD_HOST_ROBOTS = `User-agent: *
Disallow: /
Crawl-delay: 60
`;

function isCommonProbePath(pathname) {
  return (
    pathname === "/favicon.ico" ||
    pathname === "/apple-touch-icon.png" ||
    pathname === "/apple-touch-icon-precomposed.png" ||
    pathname.startsWith("/.well-known/")
  );
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const target = new URL(url.pathname + url.search, TARGET_ORIGIN);

    if (url.pathname === "/robots.txt") {
      return new Response(OLD_HOST_ROBOTS, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": REDIRECT_CACHE_CONTROL
        }
      });
    }

    if (isCommonProbePath(url.pathname)) {
      return new Response(null, {
        status: 204,
        headers: {
          "Cache-Control": REDIRECT_CACHE_CONTROL
        }
      });
    }

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

    return new Response(null, {
      status: 301,
      headers: {
        Location: target.toString(),
        "Cache-Control": REDIRECT_CACHE_CONTROL
      }
    });
  }
};
