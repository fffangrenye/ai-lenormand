import test from "node:test";
import assert from "node:assert/strict";
import { getXianyuPurchaseLinks } from "../xianyu-purchase";
import { cardCatalog } from "../paid-local/card-catalog";

test("each enabled package opens only its own approved item and public sharing link",()=>{
  const packages=cardCatalog(false,true).packages;
  for(const item of packages){
    const links=getXianyuPurchaseLinks(item.purchaseUrl);
    assert.ok(links);
    assert.equal(new URL(links.appUrl).searchParams.get("id"),new URL(item.purchaseUrl).searchParams.get("id"));
    assert.equal(links.webUrl,item.purchaseUrl);
    assert.equal(new URL(links.shareUrl).hostname,"m.tb.cn");
  }
  assert.equal(new Set(packages.map(item=>getXianyuPurchaseLinks(item.purchaseUrl)!.appUrl)).size,3);
});

test("external app URLs cannot inherit an account, session, code or unapproved destination",()=>{
  const plain=getXianyuPurchaseLinks("https://www.goofish.com/item?id=1095201652221");
  assert.deepEqual(getXianyuPurchaseLinks("https://www.goofish.com/item?id=1095201652221&session=secret&code=FLORA-PRIVATE&readingId=private#account"),plain);
  for(const url of ["javascript:alert(1)","https://evil.invalid/item?id=1095201652221","https://www.goofish.com.evil.invalid/item?id=1095201652221","https://www.goofish.com/item?id=999","http://www.goofish.com/item?id=1095201652221","https://www.goofish.com/other?id=1095201652221"]){assert.equal(getXianyuPurchaseLinks(url),null);}
});
