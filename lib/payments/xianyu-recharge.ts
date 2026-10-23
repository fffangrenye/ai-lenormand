import { GoofishError, GoofishOrderClient, verifyVirtualRequest, type VirtualCredentials, type VerifiedOrder } from "./goofish";

export type XianyuSettlement = (body: Record<string, unknown>, order: VerifiedOrder) => { state: string; duplicate: boolean };

/** No HTTP route is enabled until private configuration and public test access are approved. */
export async function receiveXianyuRecharge(input: {
  rawBody: string; query: URLSearchParams; credentials: VirtualCredentials;
  client: GoofishOrderClient; settle: XianyuSettlement; now?: number;
}) {
  const body = verifyVirtualRequest(input.rawBody, input.query, input.credentials, input.now);
  if (typeof body.biz_order_no !== "string" || !/^[1-9]\d{9,29}$/.test(body.biz_order_no)) throw new GoofishError("INVALID_ORDER_NUMBER");
  // Even a correctly signed notification cannot substitute for querying the
  // seller's actual order. A timeout leaves the account unchanged for retry.
  const order = await input.client.order(body.biz_order_no);
  return input.settle(body, order);
}
