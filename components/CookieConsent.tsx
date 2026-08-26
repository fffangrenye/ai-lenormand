"use client";

import { useEffect, useState } from "react";

const COOKIE_CONSENT_KEY = "ai-lenormand:cookie-consent";

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      setVisible(window.localStorage.getItem(COOKIE_CONSENT_KEY) !== "accepted");
    } catch {
      setVisible(false);
    }
  }, []);

  function acceptConsent() {
    try {
      window.localStorage.setItem(COOKIE_CONSENT_KEY, "accepted");
    } catch {
      // Ignore storage failures; the banner can simply disappear for this session.
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-x-4 bottom-4 z-[80] mx-auto max-w-[430px] rounded-[8px] border border-ink/10 bg-[#FFFDF8]/95 p-4 text-ink shadow-paper backdrop-blur">
      <p className="font-serif text-[18px] leading-6">必要 Cookie 与本地存储</p>
      <p className="mt-2 text-[12px] leading-5 text-ink/54">
        我们会使用必要 Cookie / 本地存储来保存登录状态、免费额度、项目记忆和基础偏好，用于提供连续的解读体验。
      </p>
      <button
        type="button"
        onClick={acceptConsent}
        className="mt-3 h-10 w-full rounded-full bg-[#6E2638] px-4 text-[12px] uppercase tracking-[0.12em] text-[#FFF9F2]"
      >
        知道了
      </button>
    </div>
  );
}
