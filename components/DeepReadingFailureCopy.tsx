"use client";

import { useEffect } from "react";

const OLD_FAILED_CORE = "这次解读暂时没有生成成功，但你的问题和抽到的牌已经保留。";
const OLD_QUOTA_CORE = "已为你抽出牌面。今天的免费 AI 解读次数已经休息了，但牌面仍然完整保留。";
const OLD_FAILED_HEADING = "这次 AI 没有成功回复";
const OLD_QUOTA_HEADING = "你还可以这样继续";

const FAILED_CORE = "解读服务暂时不可用，请复制prompt后移步其他AI";
const QUOTA_CORE = "今日免费额度已用完，请复制prompt后移步其他AI";
const FAILED_DETAIL = "本次不会消耗免费 AI 解读次数。请复制 Prompt 后移步其他 AI。";
const QUOTA_DETAIL = "明天北京时间 00:00 后会获得新的免费 AI 解读次数";

function replaceExactText(root: Element, from: string, to: string) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();

  while (node) {
    if (node.textContent?.trim() === from) {
      node.textContent = to;
    }
    node = walker.nextNode();
  }
}

function patchArticle(article: HTMLElement) {
  const text = article.textContent ?? "";
  const isFailed = text.includes(OLD_FAILED_CORE) || text.includes(FAILED_CORE);
  const isQuota = text.includes(OLD_QUOTA_CORE) || text.includes(QUOTA_CORE);

  if (isFailed) {
    replaceExactText(article, OLD_FAILED_CORE, FAILED_CORE);
    replaceExactText(article, OLD_FAILED_HEADING, "AI 服务暂时不可用");

    article.querySelectorAll("p").forEach((paragraph) => {
      if (paragraph.textContent?.includes("明天北京时间 00:00 后会获得新的免费 AI 解读次数")) {
        paragraph.textContent = FAILED_DETAIL;
      }
    });
  }

  if (isQuota) {
    replaceExactText(article, OLD_QUOTA_CORE, QUOTA_CORE);
    replaceExactText(article, OLD_QUOTA_HEADING, "今日免费额度已用完");

    article.querySelectorAll("p").forEach((paragraph) => {
      if (paragraph.textContent?.includes("明天北京时间 00:00 后会获得新的免费 AI 解读次数")) {
        paragraph.textContent = QUOTA_DETAIL;
      }
    });
  }
}

function patchDeepReadingCopy() {
  document.querySelectorAll<HTMLElement>("article").forEach(patchArticle);
}

export function DeepReadingFailureCopy() {
  useEffect(() => {
    patchDeepReadingCopy();

    const observer = new MutationObserver(() => patchDeepReadingCopy());
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    return () => observer.disconnect();
  }, []);

  return null;
}
