const TARGET_ORIGIN = "https://flora.soul-ai-frontend.workers.dev";

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const target = new URL(url.pathname + url.search, TARGET_ORIGIN);

    return Response.redirect(target.toString(), 301);
  }
};
