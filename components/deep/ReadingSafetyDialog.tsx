"use client";

import { readingSafetyMessage, readingSafetyNotices, type ReadingSafetyCode } from "@/lib/paid-local/reading-safety";
import { Modal } from "./ConversationManagement";

export function ReadingSafetyDialog({ code, followUp = false, onClose }: { code: ReadingSafetyCode; followUp?: boolean; onClose: () => void }) {
  return (
    <Modal title={readingSafetyNotices[code].title} busy={false} onClose={onClose}>
      <p className="mt-4 text-sm leading-7 text-ink/75">{readingSafetyMessage(code, followUp)}</p>
      <button type="button" autoFocus onClick={onClose} className="mt-5 min-h-11 rounded-full bg-[#6E2638] px-5 text-sm text-[#FFF9F2]">
        我知道了
      </button>
    </Modal>
  );
}
