# Auth & per-project permissions — design plan

This started as a design doc and is now fully built. It exists to resolve the open questions below before writing any code, per the request that started it: a per-user activity log, and project sharing with different permission levels (viewing, editing, etc.). **Phases 1–4 are done** (real Supabase Auth login, private per-account Database/Collections/Protocols, project membership/roles, and per-user + per-project activity log attribution). Phase 5 (public read-only share links) remains optional/later, per the note above.

Related: [`PLAN.md`](./PLAN.md)'s open-gaps review calls this out as gap #6 (Auth & roles) and #12 (collaborator invites) — this doc is the detailed version of both. (A public read-only share link, once bundled in with this as gap #13, has since been dropped from the roadmap independently — nothing here depends on it, and phase 5 below still notes where it would slot in if that changes.)

**This revision changes the account model more than the previous draft did.** The earlier version had a "lab member" tier with lab-wide access to Database/Collections/Protocols/Logs, and a lesser "collaborator" tier. That's gone. The model now is: every account is the same kind of account, each account has its **own private** Database/Collections/Protocols/Logs, and **projects are the only shared surface** — a project's owner(s) decide who else can see or edit it, and at what level. This is a real shift in what the app *is*: less "one shared lab notebook," more "everyone runs their own notebook, and shares specific projects with specific people." It's a closer fit to how a mixed lab + external-collaborator situation actually works, at the cost of losing the single unified Database view across everyone's samples.

## What this needs to support

1. **Someone logs in as themselves**, not as an anonymous shared session — the app currently has no identity at all.
2. **A project can be shared with specific people at different permission levels** — someone might be able to edit Project A but only view Project B, and have no access to Project C at all.
3. **The activity log records who did what**, not just what happened.
4. Whatever this becomes, it should still work for a single person using the app alone with zero setup — this shouldn't turn a one-person lab notebook into something that requires provisioning accounts before it's useful.

## Account model: single tier, everything derived from project membership

No account tiers. Every signed-in account gets:

- Its own private **Database** (samples it owns), **Collections**, and **Protocols** — not shared lab-wide, not visible to anyone else by default.
- The ability to create **Projects**, which start out visible only to its creator.

**Projects are the only thing that gets shared.** A project's owner explicitly adds other accounts to it as a **Viewer** or **Editor** (or another **Owner** — see below). Someone with no relationship to a project sees nothing about it at all; someone added to it sees exactly that project's tabs (Samples, Lab/Bio Workflow, Notes, References, etc.), scoped to that project, the same way the Samples tab already scopes to one project's slice of data today.

This drops the earlier two-tier open question entirely — there's no more "does a collaborator get lab-wide Database access" question, because *no one* gets another account's Database access. The only way to see someone else's sample is if it's been linked into a project you're a member of.

**Open question this raises:** samples (and collections, protocols) are many-to-many with projects already (`sample_projects`, `collection_samples` — a sample can be in several projects or none). If Project X is owned by Alice and shared with Bob as an Editor, and Bob adds a brand-new sample while working inside Project X, whose private Database does that sample belong to — Alice's or Bob's? Proposed default: the sample is owned by whoever created it (Bob), shows up in Bob's own Database, and is linked into Project X via `sample_projects` so everyone on that project can see and edit it there — the same pattern as a shared folder in a personal-drive product, not a single pooled database. An editor can also link one of their *own* existing samples into a shared project; they can't browse the owner's full private Database, only what's explicitly in the project. Flagging this as the one piece of the new model that most needs a sanity check before building it.

## Per-project roles

Every project gets a membership list, each person on it holding one of:

- **Viewer** — read-only across all of that project's tabs, including its member list and activity log.
- **Editor** — can add/edit samples, workflow entries, notes, references, marker style settings, etc. within the project. Can also link one of their own existing samples/collections into the project.
- **Owner** — everything Editor can do, plus manage the member list (add/remove people, change roles, promote another member to Owner) and edit/delete the project itself.

Three tiers, not per-tab permissions (e.g. "can edit Lab Workflow but not Bio Notes") — finer granularity is possible later but is real added complexity for a tool where most editors need most tabs. Flagging as a deliberate scope cut, not an oversight.

Resolved: creating a project automatically makes you its Owner. A project can have multiple Owners — the creator can promote any other member to Owner, and (by extension) any existing Owner can do the same. Every project member (any role) can see who else is on the project.

**Open question:** can an Owner demote or remove another Owner (only when at least one Owner would remain, so a project is never orphaned), or is Owner status permanent once granted? And can a Viewer/Editor remove themselves from a project they no longer want to be part of?

## Data model

```sql
-- Supabase Auth's built-in auth.users holds credentials (email, password
-- hash, etc.) — never touched directly; profiles is the public-schema
-- mirror everything else joins against.
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text,
  log_enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table project_members (
  project_id uuid not null references projects (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  role text not null check (role in ('viewer', 'editor', 'owner')),
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);
```

No `account_type` column — every account is the same kind of account now. `log_enabled` is the personal "log my activity" switch (see "Activity log changes" below).

A nullable `owner_id uuid references profiles (id)` gets added to `samples`, `collections`, and `protocols` — this is what scopes each account's private Database/Collections/Protocols view. Nullable because existing rows predate auth and need to land somewhere: at migration time they'd all get backfilled to whichever account is created first (today's sole user), rather than being left ownerless. `projects` doesn't need an `owner_id` column at all — project ownership is fully expressed through `project_members` rows with `role = 'owner'`, which is what allows more than one.

`activity_log` gains `user_id uuid references profiles (id)` (nullable, same backfill reasoning) and `project_id uuid references projects (id)` (nullable — see "Activity log changes" below for why).

## Authorization approach: keep the service-role architecture

The app currently never lets the browser talk to Supabase directly — every read/write goes through a Next.js API route using the service-role key, which bypasses Postgres RLS entirely (RLS is enabled on every table specifically so an accidentally-exposed anon key would still see nothing). Two ways to add authorization on top of that:

1. **Keep it exactly as-is, add authorization checks in the API route layer.** Each route reads the caller's session and decides whether to proceed — personal-data routes (Database/Collections/Protocols outside any project) check the row's `owner_id` against the caller; project-scoped routes check `project_members` for at least the required role — then still uses the existing service-role client to actually do the query. No RLS policies to write, no store-layer rearchitecture, no client-side Supabase access ever introduced.
2. **Move to real RLS-based authorization.** Add policies keyed on `auth.uid()`, `owner_id`, and `project_members`, and let at least some client code query Supabase directly with the user's own session instead of going through an API route. This is the more "native" Supabase pattern and would matter if this ever wants Supabase Realtime or wants to cut down on API route boilerplate — but it's a genuine rearchitecture of how every single store function works, not an add-on.

**Recommendation: option 1.** It's a thin, testable layer ("does this session own this row, or have at least role X on project Y") added to routes that already exist, rather than touching the ~35 store functions and ~70 API routes that already work (both counts have grown since this doc was first written, which only strengthens the case for not rearchitecting them). Revisit option 2 only if a real need for direct-client queries or Realtime shows up later.

Concretely, this means:
- A shared helper, e.g. `getCurrentUser(request)` — reads the session cookie, returns `{ id, email }` or `null`.
- A shared helper, e.g. `requireOwnership(userId, row)` — for personal-data routes, checks `row.owner_id === userId`.
- A shared helper, e.g. `requireProjectRole(userId, projectId, minRole)` — throws/returns 403 if the user isn't at least that role on that project (checking `project_members`).
- Every mutating route (POST/PATCH/DELETE), and every read route for personal or project-scoped data, gets one of these checks added near the top, before doing what it already does.

## Session handling

- `@supabase/ssr` for cookie-based session management (login, logout, session refresh) — this is a second, separate Supabase client from the existing service-role one, used only for identity, never for data.
- A `middleware.ts` that refreshes the session cookie on each request and redirects unauthenticated visitors to `/login` (everything behind auth once this ships — no anonymous access to any page).
- A `/login` page — email + password to start; magic-link and Google OAuth are easy additions later given academic labs often already use Google Workspace, but not needed for a first version.
- No self-service sign-up. Accounts are created by invite only (see below) — this is a small-scale tool, not a public product. (A plain `/signup` page briefly reopened this as a stopgap while Supabase's invite emails weren't reliably reaching people — see git history around its removal. That was a delivery/redirect-configuration problem, not an architectural one: Supabase's default email sending is rate-limited and intended for testing only, and the Site URL was still pointed at localhost. Fixed for real with a custom SMTP provider (Resend) and corrected Site URL/Redirect URLs, at which point `/signup` was removed again.)

## Inviting people

One flow, not two: an "Add member" action on a project (Owners only) — enter an email and pick a role (Viewer/Editor/Owner). If that email already has an account, it just creates the `project_members` row. If not, it sends an invite via Supabase Auth's built-in invite-by-email admin API (using Supabase's built-in low-volume email sending for now, not a custom SMTP provider — fine to revisit if invite volume ever grows), and creates the membership row so it's waiting for them the moment they accept and set a password.

## Activity log changes

Two independent toggles, not one:

- **Personal toggle** (`profiles.log_enabled`) — each account controls whether *their own* actions get recorded at all, anywhere: their private Database/Collections/Protocols work, and anything they do inside any project. Off means nothing about them is logged, full stop. This is the direct answer to "logs should be toggled by the user for their own accounts."
- **Per-project toggle** — each project's Owner(s) control whether that project keeps an activity log at all. This is what "modifications made by an editor should also appear in the logs of the owner, if the owner wants" means structurally: the owner opts a project into logging, and from then on, any member's actions on that project (as long as that member's own personal toggle is also on) get recorded and are visible to everyone on the project via that project's own Logs view.

So an editor's edit only shows up in a project's log when *both* switches are on — their own personal one, and that project's. Every account also keeps its own cross-cutting personal log (everything they've done, across their private data and every project they touch), gated solely by their own personal toggle; that one has no project-visibility angle to it since it's just "what did I do."

- Every `logActivity(...)` call gains the current user's id and, where applicable, the relevant `project_id`, so entries can show "Jane added sample SAMP-042" instead of just "Added sample SAMP-042," and a project's log can be filtered down to just that project.
- **Visibility**: a project's Logs view is visible to every member regardless of role (Viewers included, consistent with them being able to see the rest of the project) — showing only that project's tagged entries, and only for members whose personal toggle was on at the time. An account's personal cross-project log is visible only to that account.
- The existing Undo feature (per-action, from the activity log) keeps working as-is — restoring a deleted sample or import just needs the same authorization check as the delete/import itself would have needed, nothing new to design there.

## Explicitly out of scope

- SSO/SAML enterprise auth — no indication this is needed at this scale.
- Per-tab permissions within a project — Viewer/Editor/Owner is the whole model.
- Fully isolated multi-tenant orgs/billing — this is still one deployment with individually-owned data and shared projects, not separately hosted tenants.
- RLS-based authorization (see above) — deferred, not rejected.

## Suggested build phases

1. **Foundation** — done. Supabase Auth wiring, `profiles` table + creation trigger, `/login`, session middleware, nav bar shows the signed-in user + sign-out. Also grew to cover the account dropdown's Profile section (title/name/institution/department/position/lab group), a profile photo, and username-or-email login.
2. **Personal data scoping** — done. `owner_id` on `samples`/`collections`/`protocols`; Database/Collections/Protocols/Logs views filtered to the signed-in account only, with `requireOwnership`-style checks on their routes.
3. **Project membership + roles** — done. `project_members` table (Viewer/Editor/Owner), auto-Owner-on-create + multi-Owner support, a Members dialog on each project (add by email/username, with a Supabase Auth invite for an unknown email; change roles; remove; leave), `requireProjectRole`/`requireEntityProjectRole` checks on every project-scoped route (the project itself, samples/protocols linking, lab/bio workflows, notes, references, marker styles, activity log), and `requireSampleAccess`/`requireProtocolAccess` so an Editor can work on a colleague's sample or protocol once it's linked into the shared project, not just their own. Project names are no longer globally unique — see the data model note below. Role-based UI hiding is thorough on the Samples/Protocols tabs; the other tabs still rely on the server-side checks as the actual enforcement.
4. **Per-user + per-project activity log** — done. `activity_log.user_id` (a real FK, alongside the pre-existing `performed_by` denormalized snapshot), the personal toggle (`profiles.log_enabled`, surfaced on the Logs page and via `PATCH /api/profile`) and the per-project toggle (`projects.log_enabled`, Owner-only, surfaced on a project's own Logs tab and via `PATCH /api/projects/[id]/activity-log`). The old pre-auth single app-wide switch (`app_settings.activity_logging_enabled`) is gone — dropped in `0038_per_user_project_activity_log.sql` — replaced by these two. The global `/logs` page is now each account's own cross-project activity (`listActivityForUser`), not everyone's; a project's Logs tab keeps showing that project's shared slice to every member regardless of role.
5. **Later, optional**: public read-only share links per project (a single opaque token is enough on its own — doesn't need any of the above — see the note at the top of this doc about where that gap currently stands), RLS as defense-in-depth.

Building incrementally on `main`, same as everything else so far.

## Resolved questions

- **Sample/collection/protocol ownership when an Editor creates new data while working inside a shared project**: went with the proposed default above under "Account model" — owned by whoever created it, linked into the project via `sample_projects`/`protocol_projects`.
- **Can an Owner demote or remove another Owner?**: yes, as long as at least one Owner remains afterward (enforced server-side — see `project-members-store.ts`'s `guardLastOwner`). **Can a Viewer/Editor leave a project on their own?**: yes, anyone can remove themselves from a project at any time (also subject to the last-Owner guard if they happen to be the sole Owner).
- **Are Protocols meant to ever be shared into a project?**: yes — this was already implemented (`protocol_projects`, mirroring `sample_projects`) before this phase; Phase 3 just added the role checks and cross-owner access on top of it.
- **Project name uniqueness**: dropped the global unique constraint on `projects.name` (see `0036_project_members.sql`) — projects are private to their members by default, so two different accounts having a same-named project is normal now, not a conflict. Uniqueness is still enforced app-side, but scoped to the *acting account's own visible projects* (`assertUniqueNameForUser` in `projects-store.ts`), not everyone's.
