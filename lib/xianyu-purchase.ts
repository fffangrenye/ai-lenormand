// Public product identifiers only. Never forward a Flora account, session,
// reading, or redemption code to the external app or sharing page.
const shareLinks: Record<string, string> = {
  "1095201652221": "https://m.tb.cn/h.jWFy1zI?tk=drnXTEMGROz",
  "1094134809748": "https://m.tb.cn/h.je8OTEm?tk=QDEPTEMGxU7",
  "1094135329274": "https://m.tb.cn/h.jWFBlnU?tk=3jOTTEMFM3V",
};

export function getXianyuPurchaseLinks(purchaseUrl: string) {
  try {
    const url = new URL(purchaseUrl);
    const id = url.searchParams.get("id") || "";
    if (url.origin !== "https://www.goofish.com" || url.pathname !== "/item" || !shareLinks[id]) return null;
    return {
      appUrl: `fleamarket://item?id=${id}`,
      webUrl: `https://www.goofish.com/item?id=${id}`,
      shareUrl: shareLinks[id],
    };
  } catch { return null; }
}
