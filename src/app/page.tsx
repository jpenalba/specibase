import Link from "next/link";
import { Database, FolderKanban, Archive, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";

const CAPABILITIES = [
  {
    href: "/projects",
    icon: FolderKanban,
    title: "Projects",
    description:
      "Organize samples by research project, and share one with specific collaborators as a Viewer, Editor, or Owner from its Members dialog. Each project gets its own Info, Samples, Lab Workflow, Bioinformatics, Bio Notes, and References tabs.",
  },
  {
    href: "/database",
    icon: Database,
    title: "Database",
    description:
      "Your own samples, mapped and searchable — private by default, plus whatever's shared into a project you're a member of. Filter, style markers by any field, and overlay GBIF occurrence data.",
  },
  {
    href: "/collections",
    icon: Archive,
    title: "Collections",
    description:
      "Track external field, museum, or collaborator sample sets as their own map layers — one click copies them into your main database.",
  },
  {
    href: "/protocols",
    icon: ClipboardList,
    title: "Protocols",
    description:
      "Keep field, lab, and bioinformatic protocols in one place, either as an uploaded PDF or built directly in Specibase with its own markdown editor.",
  },
];

const QUICK_START = [
  {
    title: "Add your samples",
    body: "In Database (or a project's Samples tab), add samples one at a time or import a CSV. Typing a species name offers GBIF suggestions and auto-fills its higher taxonomy.",
  },
  {
    title: "Organize into projects",
    body: "Group samples under a project. A sample can belong to more than one — Database always shows your own, a project's own Samples tab shows everyone's contributions to it.",
  },
  {
    title: "Invite collaborators",
    body: "A new project starts visible only to you. Add people to it from its Members button and pick their role — Viewer (read-only), Editor (can add and edit), or Owner (can also manage membership).",
  },
  {
    title: "Track lab & bioinformatic work",
    body: "Build a workflow for however your lab actually works — extraction, library prep, sequencing, analysis — in a spreadsheet-style grid with custom columns.",
  },
  {
    title: "Map and explore",
    body: "Every sample with coordinates shows on the map. Color or shape markers by species, genus, or any other field, and toggle a GBIF occurrence overlay to spot sampling gaps.",
  },
  {
    title: "Export your work",
    body: "Download a CSV of any table, a PDF of a single section, or compile a whole project — including the map — into one report.",
  },
  {
    title: "Set up your profile",
    body: "Add your name, title, institution, and a photo from the account menu (top right) — it's what your collaborators see and what shows up in the activity log.",
  },
];

export default function Home() {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-16 p-6 sm:p-10">
      <div className="flex flex-col items-center gap-5 pt-8 text-center sm:pt-16">
        {/* eslint-disable-next-line @next/next/no-img-element -- a small,
            static hero image isn't worth next/image's overhead */}
        <img src="/logo.png" alt="" width={64} height={72} className="theme-invert" />
        <div className="flex flex-col gap-3">
          <h1 className="text-3xl font-semibold sm:text-4xl">Specibase</h1>
          <p className="mx-auto max-w-xl text-balance text-muted-foreground">
            A sample database and interactive map for evolutionary biology
            field collections — samples, lab and bioinformatic workflows,
            collections, and protocols, all in one place. Your own private
            workspace by default; share a project with named collaborators
            when you want a second set of hands on it.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          <Button asChild>
            <Link href="/projects">Browse projects</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/database">Open the database</Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {CAPABILITIES.map(({ href, icon: Icon, title, description }) => (
          <Link
            key={href}
            href={href}
            className="flex flex-col gap-2 rounded-lg border border-border p-5 transition-colors hover:bg-accent"
          >
            <Icon className="size-5 text-muted-foreground" />
            <h2 className="font-medium">{title}</h2>
            <p className="text-sm text-muted-foreground">{description}</p>
          </Link>
        ))}
      </div>

      <div className="flex flex-col gap-5">
        <h2 className="text-xl font-semibold">Getting started</h2>
        <ol className="flex flex-col gap-4">
          {QUICK_START.map((step, i) => (
            <li key={step.title} className="flex gap-4">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-medium text-accent-foreground">
                {i + 1}
              </span>
              <div className="grid gap-0.5 pt-0.5">
                <p className="font-medium">{step.title}</p>
                <p className="text-sm text-muted-foreground">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
