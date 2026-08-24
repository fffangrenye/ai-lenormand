import { DeepProjectPageClient } from "../../DeepProjectClient";

export default function DeepProjectPage({ params }: { params: { projectId: string } }) {
  return <DeepProjectPageClient projectId={params.projectId} />;
}
