import { paidConfig, packagePrice } from "./config";

// User-supplied product links. Never append a website session, account or code.
const links: Record<string,string> = {
  single:"https://www.goofish.com/item?id=1095201652221",
  five:"https://www.goofish.com/item?id=1094134809748",
  ten:"https://www.goofish.com/item?id=1094135329274"
};
export function cardCatalog(localOnly = true, salesEnabled = true) {
  return {localOnly,packages:paidConfig.packages.map(p=>({...packagePrice(p.id),purchaseUrl:links[p.id],ready:salesEnabled && Boolean(links[p.id])}))};
}
export type CardCatalog = ReturnType<typeof cardCatalog>;
