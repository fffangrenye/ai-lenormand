import { memo } from "react";

/** Shared, unlettered back. The homepage breathing cards retain their original design. */
export const QuietCardBack = memo(function QuietCardBack() {
  return <span aria-hidden="true" className="pointer-events-none block h-full w-full select-none overflow-hidden rounded-[inherit] bg-[#FFFDF8] [background-image:url('/cards/quiet-card-back.svg')] [background-size:100%_100%]" />;
});
