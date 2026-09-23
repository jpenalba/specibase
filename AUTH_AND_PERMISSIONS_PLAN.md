# Auth & per-project permissions — design plan

This is a design doc, not a build in progress — nothing here is implemented yet. It exists to resolve the open questions below before writing any code, per the request that started it: a per-user activity log, and project sharing with different permission levels (viewing, editing, etc.).

Related: [`PLAN.md`](./PLAN.md)'s open-gaps review calls this out as gap #6 (Auth & roles), #12 (collaborator invites), and #13 (public share links) — this doc is the detailed version of all three.

## What this needs to support

1. **Someone logs in as themselves**, not as an anonymous shared session — the app currently has no identity at all.
2. **A project can be shared with specific people at different permission levels** — someone might be able to edit Project A but only view Project B, and have no access to Project C at all.
3. **The activity log records who did what**, not just what happened.
4. Whatever this becomes, it should still work for a single person using the app alone with zero setup — this shouldn't turn a one-person lab notebook into something that requires provisioning accounts before it's useful.

## Two-tier account model

Not every account needs the same reach. Two tiers:

- **Lab member** — full access to Database, Collections, Protocols, and Logs (the shared, cross-project resources), plus whatever project-level role they hold on each individual project (see below). This is the "everyone on my team" tier.
- **Collaborator** — no access to Database/Collections/Protocols/Logs at all. They only see the specific project(s) they've been added to, through that project's own tabs (the Samples tab already shows just that project's slice of samples — this is the same idea extended to permissions). This is the "an outside collaborator on one project" tier.

This maps onto the original `PLAN.md` sketch (Owner/Lab member/Collaborator) but simplifies it: "Owner" isn't a separate account tier, it's a per-project role (below) — a lab member can own their own projects and still be just a viewer on someone else's.

**Open question:** does this two-tier split make sense, or should there be a single account tier where reach is entirely determined by project membership (i.e., no one automatically sees the shared Database/Collections/Protocols unless explicitly granted)? The two-tier version is recommended because Database/Collections/Protocols are shared lab-wide resources by design (a sample can belong to several projects or none) — trying to derive per-sample visibility from project membership gets complicated fast once a sample belongs to multiple projects with different viewers. The tradeoff: a "collaborator" literally cannot browse the shared database even if their one project's samples are also visible there to lab members.

## Per-project roles

Every project gets a membership list, each person on it holding one of:

- **Viewer** — read-only across all of that project's tabs.
- **Editor** — can add/edit samples, workflow entries, notes, references, etc. within the project.
- **Owner** — everything Editor can do, plus manage the member list (invite/remove people, change roles) and edit/delete the project itself.

Three tiers, not per-tab permissions (e.g. "can edit Lab Workflow but not Bio Notes") — finer granularity is possible later but is real added complexity for a single-lab tool where most editors need most tabs. Flagging as a deliberate scope cut, not an oversight.

**Open question:** should a brand-new project automatically make its creator the Owner (recommended — matches "you made it, you run it"), and can a project have more than one Owner (recommended yes, so one person leaving doesn't strand it)?

## Data model

```sql
-- Supabase Auth's built-in auth.users holds credentials (email, password
-- hash, etc.) — never touched directly; profiles is the public-schema
-- mirror everything else joins against.
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text,
  account_type text not null default 'collaborator'
    check (account_type in ('lab_member', 'collaborator')),
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

Plus a nullable `created_by uuid references profiles (id)` added to `samples`, `projects`, `collections`, `protocols`, and `collection_samples` — nullable because existing rows predate auth and have no real creator to backfill; they'd just show blank/"—" for that field rather than a guess.

`activity_log` gains `user_id uuid references profiles (id)` (nullable, same reasoning — existing entries stay unattributed) and `project_id uuid references projects (id)` (nullable — see "Activity log" below for why).

## Authorization approach: keep the service-role architecture

The app currently never lets the browser talk to Supabase directly — every read/write goes through a Next.js API route using the service-role key, which bypasses Postgres RLS entirely (RLS is enabled on every table specifically so an accidentally-exposed anon key would still see nothing). Two ways to add authorization on top of that:

1. **Keep it exactly as-is, add authorization checks in the API route layer.** Each route reads the caller's session (who are they, what's their account_type, what's their role on the relevant project) and decides whether to proceed, then still uses the existing service-role client to actually do the query. No RLS policies to write, no store-layer code changes, no client-side Supabase access ever introduced.
2. **Move to real RLS-based authorization.** Add policies keyed on `auth.uid()` and `project_members`, and let at least some client code query Supabase directly with the user's own session instead of going through an API route. This is the more "native" Supabase pattern and would matter if this ever wants Supabase Realtime or wants to cut down on API route boilerplate — but it's a genuine rearchitecture of how every single store function works, not an add-on.

**Recommendation: option 1.** It's a thin, testable layer ("does this session have at least role X on project Y") added to routes that already exist, rather than touching the ~30 store functions and ~60 API routes that already work. Revisit option 2 only if a real need for direct-client queries or Realtime shows up later.

Concretely, this means:
- A shared helper, e.g. `getCurrentUser(request)` — reads the session cookie, returns `{ id, email, account_type }` or `null`.
- A shared helper, e.g. `requireProjectRole(userId, projectId, minRole)` — throws/returns 403 if the user isn't at least that role on that project (checking `project_members`, with `account_type = 'lab_member'` short-circuiting to at-least-viewer on every project, or however the open question above gets resolved).
- Every mutating route (POST/PATCH/DELETE) gets one of these checks added near the top, before doing what it already does.

## Session handling

- `@supabase/ssr` for cookie-based session management (login, logout, session refresh) — this is a second, separate Supabase client from the existing service-role one, used only for identity, never for data.
- A `middleware.ts` that refreshes the session cookie on each request and redirects unauthenticated visitors to `/login` (everything behind auth once this ships — no anonymous access to any page).
- A `/login` page — email + password to start; magic-link and Google OAuth are easy additions later given academic labs often already use Google Workspace, but not needed for a first version.
- No self-service sign-up. Accounts are created by invite only (see below) — this is a small-lab tool, not a public product.

## Inviting people

- **Inviting a new lab member** (full account, app-wide): an admin/lab-member-only "Invite" action that uses Supabase Auth's invite-by-email admin API, which sends the person a signup link. Requires either Supabase's built-in low-volume email sending or a configured SMTP provider for anything beyond occasional use.
- **Adding someone to a project**: an "Add member" action on the project (Owners only) — enter an email and pick a role. If that email already has an account (lab member or an existing collaborator elsewhere), it just creates the `project_members` row. If not, it sends the same kind of invite, tagged as `account_type = 'collaborator'`, and creates the membership row so it's waiting for them the moment they accept.

## Activity log changes

- Every `logActivity(...)` call gains the current user's id, so entries can show "Jane added sample SAMP-042" instead of just "Added sample SAMP-042."
- **Visibility**: a lab member sees everything, same as today. A collaborator should only see log entries for the project(s) they belong to — which means an entry needs to know which project it's about. That's easy for anything done *through* a project's own tabs (Lab Workflow, Bio Notes, References, a project's Samples tab), and genuinely ambiguous for something edited from the cross-project Database view when the sample belongs to more than one project. Proposed resolution: tag `project_id` when the action clearly happened within one project's context; leave it null for Database/Collections/Protocols-level actions, and collaborators simply don't see null-project entries at all (consistent with them not having Database access in the first place).
- The on/off toggle stays a single app-wide switch (it's an operational/privacy control — "is anything being recorded at all" — not a personal notification preference), but only a lab member (or a project Owner, for their own project's visibility) should be able to flip it. Exact permission for the toggle itself is an open question below.

## Explicitly out of scope

- SSO/SAML enterprise auth — no indication this is needed for a single lab.
- Per-tab permissions within a project — Viewer/Editor/Owner is the whole model.
- Multi-tenancy (several independent labs on one deployment) — this is still one lab's instance.
- RLS-based authorization (see above) — deferred, not rejected.

## Suggested build phases

1. **Foundation**: Supabase Auth wiring, `profiles` table + creation trigger, `/login`, session middleware, nav bar shows the signed-in user + sign-out. Every existing account is treated as a full lab member — behavior is otherwise unchanged from today. This is the phase that "turns on" requiring login at all.
2. **Project membership + roles**: `project_members` table, an "Add member" dialog on each project, role-based UI (hide edit affordances from viewers) and the `requireProjectRole` checks on every project-scoped route.
3. **Collaborator tier**: `account_type`, gating Database/Collections/Protocols/Logs to lab members only, collaborator invite flow.
4. **Per-user activity log**: `user_id`/`project_id` columns, attribution in the UI, project-scoped visibility for collaborators.
5. **Later, optional**: public read-only share links per project (doesn't need any of the above — a single opaque token is enough on its own, see `PLAN.md` gap #13), RLS as defense-in-depth.

## Open questions to resolve before starting

- Two-tier account model (lab member / collaborator) vs. everything derived from project membership — see above.
- Does creating a project auto-assign Owner to its creator? Can a project have multiple Owners?
- Who can flip the activity-logging on/off switch — any lab member, or only... someone more senior? (There's no "admin" concept yet in this plan — worth deciding if one's needed, e.g. for inviting new lab members at all.)
- Email sending: use Supabase's built-in sender for invites, or configure a custom SMTP provider now?
- Should collaborators be able to see each other on a shared project (member list visible to Viewers), or only Owners see who else has access?
- Timing: build this incrementally on `main` like everything else so far, or in a branch until Phase 1+2 are both usable (since Phase 1 alone means everyone needs an account before the app works at all)?
