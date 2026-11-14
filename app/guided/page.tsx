import { notFound } from "next/navigation";
import { GuidedReading } from "@/components/guided/GuidedReading";
import { guidedReadingTitle } from "@/lib/guided-reading/details";

export const metadata = { title: guidedReadingTitle, robots: { index: false, follow: false } };

export default function GuidedPage() {
  if (process.env.NEXT_PUBLIC_FLORA_GUIDED_PREVIEW !== "1" && process.env.NEXT_PUBLIC_PAID_ONLINE_MODE !== "1") notFound();
  return <GuidedReading />;
}
