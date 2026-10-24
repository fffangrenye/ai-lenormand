import { DeepProjectPageClient } from "../../DeepProjectClient";

export default async function DeepProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return <DeepProjectPageClient projectId={projectId} />;
}
