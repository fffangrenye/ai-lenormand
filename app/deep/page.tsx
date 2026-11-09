import { Suspense } from "react";
import { DeepLandingClient } from "./DeepProjectClient";

export default function DeepPage() {
  return <Suspense fallback={<main className="min-h-dvh bg-paper" />}><DeepLandingClient /></Suspense>;
}
