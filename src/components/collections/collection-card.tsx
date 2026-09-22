import Link from "next/link";
import { Pencil, ListChecks } from "lucide-react";
import { Collection } from "@/lib/collections-store";
import { parseCollaborators } from "@/lib/collaborators";
import { formatToDDMMYYYY } from "@/lib/dates";
import { CollectionIcon } from "./collection-icon";
import { CollectionDialog } from "./collection-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card";

function Field({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="text-sm">{value}</dd>
    </div>
  );
}

export function CollectionCard({
  collection,
  sampleCount,
  onSaved,
}: {
  collection: Collection;
  sampleCount: number;
  onSaved: () => void;
}) {
  const contacts = parseCollaborators(collection.contacts);
  return (
    <Card>
      <CardHeader className="flex-row items-start gap-3 space-y-0">
        <CollectionIcon />
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold">{collection.name}</h3>
          {collection.description && (
            <p className="text-sm text-muted-foreground">{collection.description}</p>
          )}
        </div>
        <CollectionDialog
          collection={collection}
          onSaved={onSaved}
          trigger={
            <button
              type="button"
              className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              aria-label={`Edit ${collection.name}`}
            >
              <Pencil className="size-4" />
            </button>
          }
        />
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
          <Field label="Date added" value={formatToDDMMYYYY(collection.date_added)} />
          <Field label="Focal species/group" value={collection.focal_group} />
          <Field label="Collection location" value={collection.location} />
          {contacts.length > 0 && (
            <div className="col-span-2">
              <dt className="text-xs font-medium text-muted-foreground">Relevant contact(s)</dt>
              <dd className="flex flex-wrap gap-1 pt-1">
                {contacts.map((name) => (
                  <span
                    key={name}
                    className="rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground"
                  >
                    {name}
                  </span>
                ))}
              </dd>
            </div>
          )}
        </dl>
      </CardContent>
      <CardFooter className="justify-between">
        <p className="text-xs text-muted-foreground">
          {sampleCount} sample{sampleCount === 1 ? "" : "s"}
        </p>
        <Button asChild variant="outline" size="sm">
          <Link href={`/collections/${collection.id}/samples`}>
            <ListChecks className="size-4" />
            Sample list
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
