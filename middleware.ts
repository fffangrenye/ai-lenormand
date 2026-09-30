import type { NextRequest } from "next/server";

const SITE_URL = "https://flora.soul-ai-frontend.workers.dev";
const SITE_TITLE = "花语雷诺曼 · Flora Lenormand · 深度占卜";
const SITE_DESCRIPTION = "每日运势 · 是与否 · 深度占卜";
const OG_IMAGE_URL = `${SITE_URL}/og-image-live-20260930.jpg`;

const SOCIAL_BOT_PATTERN =
  /facebookexternalhit|facebot|meta-externalagent|meta-externalfetcher|twitterbot|slackbot|discordbot|whatsapp|telegrambot|linkedinbot|pinterest|embedly|quora link preview|redditbot/i;

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function createSocialPreviewHtml() {
  const title = escapeHtml(SITE_TITLE);
  const description = escapeHtml(SITE_DESCRIPTION);
  const image = escapeHtml(OG_IMAGE_URL);
  const url = escapeHtml(SITE_URL);

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>${title}</title>
<meta name="title" content="${title}">
<meta name="description" content="${description}">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:url" content="${url}">
<meta property="og:site_name" content="Flora Lenormand">
<meta property="og:locale" content="zh_CN">
<meta property="og:type" content="website">
<meta property="og:image" content="${image}">
<meta property="og:image:url" content="${image}">
<meta property="og:image:secure_url" content="${image}">
<meta property="og:image:type" content="image/jpeg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Flora Lenormand 花语雷诺曼">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${description}">
<meta name="twitter:image" content="${image}">
<link rel="canonical" href="${url}">
<link rel="image_src" href="${image}">
</head>
<body>
<a href="${url}">${title}</a>
</body>
</html>`;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname !== "/") return;

  const userAgent = request.headers.get("user-agent") ?? "";
  if (!SOCIAL_BOT_PATTERN.test(userAgent)) return;

  return new Response(createSocialPreviewHtml(), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=30"
    }
  });
}

export const config = {
  matcher: "/"
};
