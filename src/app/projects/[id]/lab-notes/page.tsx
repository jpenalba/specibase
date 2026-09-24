"use client";

import { useParams } from "next/navigation";
import { LabNotesSection } from "@/components/projects/lab-notes-section";

export default function ProjectLabNotesPage() {
  const { id: projectId } = useParams<{ id: string }>();

  return (
    <div className="mx-auto w-full max-w-6xl">
      <LabNotesSection projectId={projectId} />
    </div>
  );
}
