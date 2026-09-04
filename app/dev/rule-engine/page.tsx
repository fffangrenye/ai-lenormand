import { notFound } from "next/navigation";
import { RuleEnginePlayground } from "./RuleEnginePlayground";

export default function RuleEngineDevPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <RuleEnginePlayground />;
}
