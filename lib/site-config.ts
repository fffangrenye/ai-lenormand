const PRODUCTION_SITE_URL = "https://flora.soul-ai-frontend.workers.dev";

function normalizeSiteUrl(value: string) {
  return value.replace(/\/+$/, "");
}

function isLocalhostUrl(value: string) {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?($|\/)/i.test(value);
}

export function getPublicSiteUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configuredUrl && !(process.env.NODE_ENV === "production" && isLocalhostUrl(configuredUrl))) {
    return normalizeSiteUrl(configuredUrl);
  }

  return PRODUCTION_SITE_URL;
}

export function getPasswordResetRedirectUrl(origin?: string) {
  const normalizedOrigin = origin?.replace(/\/+$/, "");
  if (normalizedOrigin && /^https?:\/\/[^/\s]+$/i.test(normalizedOrigin)) {
    return `${normalizedOrigin}/reset-password`;
  }

  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const siteUrl = configuredUrl ? getPublicSiteUrl() : normalizedOrigin || getPublicSiteUrl();
  return `${siteUrl}/reset-password`;
}
