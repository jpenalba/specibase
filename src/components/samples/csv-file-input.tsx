"use client";

// A bare `<input type="file">` renders as just a small native button plus
// "no file chosen" text — easy to miss as the thing you're meant to click,
// especially next to a styled dialog. Wrapping it in its own bordered box
// makes the whole control read as one obvious drop target, the way a file
// picker usually does. Shared by every CSV-based sample loader (the main
// samples Import CSV dialog and the lab/bio workflow Detail table's own
// Import CSV) so they all look and behave the same way.
export function CsvFileInput({ onFile }: { onFile: (file: File) => void }) {
  return (
    <div className="rounded-lg border border-dashed border-input p-4 text-center transition hover:border-foreground/40 hover:bg-accent/50">
      <input
        type="file"
        accept=".csv"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
        }}
        className="mx-auto block w-fit cursor-pointer text-sm text-muted-foreground file:mr-3 file:cursor-pointer file:rounded-md file:border file:border-input file:bg-card file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-foreground hover:file:bg-accent"
      />
    </div>
  );
}
