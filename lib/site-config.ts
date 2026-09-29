const DEFAULT_SITE_URL = "https://flora.floralenormand.workers.dev";

export function getPublicSiteUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const siteUrl = configuredUrl || DEFAULT_SITE_URL;
  return siteUrl.replace(/\/+$/, "");
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
