import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function PaidLocalPage() {
  if (process.env.PAID_LOCAL_MODE !== "1" || process.env.NODE_ENV === "production") notFound();
  redirect("/");
}
