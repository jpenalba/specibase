"use client";

import { useParams } from "next/navigation";
import { BioNotesSection } from "@/components/projects/bio-notes-section";

export default function ProjectBioNotesPage() {
  const { id: projectId } = useParams<{ id: string }>();

  return (
    <div className="mx-auto w-full max-w-6xl">
      <BioNotesSection projectId={projectId} />
    </div>
  );
}
