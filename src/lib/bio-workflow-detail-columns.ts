import { DetailColumnPreset } from "./lab-workflow-detail-columns";

// Offered when adding a column to a Bioinformatic workflow's Detailed view
// (see ManageDetailColumnsDialog, shared with Lab Workflow via a `presets`
// prop). All plain text — these are read off a pipeline's own report
// rather than typed against a fixed unit, so there's no numeric input to
// enforce.
export const BIO_DETAIL_COLUMN_PRESETS: DetailColumnPreset[] = [
  { label: "# of raw reads", kind: "text" },
  { label: "# of filtered reads", kind: "text" },
  { label: "# of mapped reads", kind: "text" },
  { label: "% reads mapped", kind: "text" },
  { label: "% Genome coverage", kind: "text" },
  { label: "Avg. depth (x)", kind: "text" },
];
