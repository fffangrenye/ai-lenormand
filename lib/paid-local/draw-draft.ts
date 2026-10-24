import type { PaidDrawSession } from "./types";
import { getDeepSpread } from "../deep-spreads";

type Draft = {version:1;owner:string;projectId:string;sessionId:string;baseTokens:string[];tokens:string[]};
const key = (owner:string,project:string) => `flora:draw-draft:v1:${owner}:${project}`;
export function readDrawDraft(owner:string,projectId:string):Draft|null {
  if (!owner || typeof window === "undefined") return null;
  try {
    const value=JSON.parse(window.localStorage.getItem(key(owner,projectId))||"null");
    if (!value || value.version!==1 || value.owner!==owner || value.projectId!==projectId || typeof value.sessionId!=="string" || value.sessionId.length>100 || !Array.isArray(value.baseTokens) || !Array.isArray(value.tokens) || value.tokens.length+value.baseTokens.length>9 || [...value.tokens,...value.baseTokens].some(token=>typeof token!=="string"||token.length>80) || new Set([...value.baseTokens,...value.tokens]).size!==value.baseTokens.length+value.tokens.length) return null;
    return value;
  } catch { return null; }
}
export function saveDrawDraft(owner:string,session:PaidDrawSession,tokens:string[]) {
  if (!owner || typeof window === "undefined") return false;
  try {
    const value:Draft={version:1,owner,projectId:session.projectId,sessionId:session.id,baseTokens:session.selectedTokens||[],tokens};
    window.localStorage.setItem(key(owner,session.projectId),JSON.stringify(value));
    return true;
  } catch { return false; }
}
export function clearDrawDraft(owner:string,projectId:string,sessionId:string) {
  try {if(readDrawDraft(owner,projectId)?.sessionId===sessionId)window.localStorage.removeItem(key(owner,projectId));} catch { /* Server progress is already authoritative. */ }
}
export function recoverDrawTokens(session:PaidDrawSession,draft:Draft|null):string[] {
  if (!draft || draft.sessionId!==session.id || draft.projectId!==session.projectId || session.state!=="picking") return [];
  const saved=session.selectedTokens||[];
  if (draft.baseTokens.some((token,index)=>saved[index]!==token) || saved.length<draft.baseTokens.length) return [];
  const acknowledged=saved.slice(draft.baseTokens.length);
  if(acknowledged.some((token,index)=>draft.tokens[index]!==token))return [];
  const tokens=draft.tokens.slice(acknowledged.length);
  if(tokens.length+session.selected.length>getDeepSpread(session.spread).positions.length || tokens.some(token=>!session.deck.some(card=>card.token===token&&!card.picked)))return [];
  return tokens;
}
