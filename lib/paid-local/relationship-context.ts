import { LocalPaidError } from "./guard";

export type RelationshipGender = "woman" | "man" | "unspecified";
export type RelationshipContext = { selfGender: RelationshipGender; otherGender: RelationshipGender };
const genders = new Set<unknown>(["woman", "man", "unspecified"]);

export function normalizeRelationshipContext(spread: string, value: unknown): RelationshipContext | undefined {
  if (value === undefined || value === null) return undefined;
  if (spread !== "h_seven" || typeof value !== "object" || Array.isArray(value)) {
    throw new LocalPaidError("INVALID_RELATIONSHIP_CONTEXT", "请重新选择 H 牌阵双方的性别。");
  }
  const candidate = value as Record<string, unknown>;
  if (!genders.has(candidate.selfGender) || !genders.has(candidate.otherGender)) {
    throw new LocalPaidError("INVALID_RELATIONSHIP_CONTEXT", "请选择双方性别，也可以选择不指定。");
  }
  return { selfGender: candidate.selfGender as RelationshipGender, otherGender: candidate.otherGender as RelationshipGender };
}

export function relationshipPrompt(value: RelationshipContext) {
  const label = { woman: "女", man: "男", unspecified: "不指定" };
  const roles = `本次 H 牌阵人物信息：我方性别为${label[value.selfGender]}，对方性别为${label[value.otherGender]}。`;
  const bindings = (["woman", "man"] as const).flatMap(gender => {
    const card = gender === "woman" ? "女人牌（29）" : "男人牌（28）";
    if (value.selfGender === gender && value.otherGender !== gender && value.otherGender !== "unspecified") return [`${card}作为我方的指示牌`];
    if (value.otherGender === gender && value.selfGender !== gender && value.selfGender !== "unspecified") return [`${card}作为对方的指示牌`];
    return [];
  });
  return [roles, bindings.length ? bindings.join("；") + "；仅在实际抽到时辅助解释。" : "双方同性别或有一方不指定时，不把单张人物牌唯一绑定给某一方，也不补造第三者。",
    "性别只用于称谓和人物指代，不决定性格、动机或关系角色；不影响洗牌和抽牌，不预放或补抽人物牌。左右两列与连接线的固定含义不变，人物牌所在牌位不能直接证明某人的想法或现实行为。"].join("\n");
}
