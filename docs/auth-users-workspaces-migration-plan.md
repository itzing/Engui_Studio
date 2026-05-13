# Auth, Users, and Workspaces Migration Plan

## Status

Draft plan. Do not implement from this document without a separate ticket and approval.

## Context

Engui currently behaves like a single-user application. Many models already carry a `userId`, and workspaces are real database entities, but there is no real authentication layer yet.

The legacy single-user identity is the hardcoded string:

```text
user-with-settings
```

This legacy identity owns existing settings, jobs, workspaces, LoRAs, Studio Session data, and related generated assets. The migration must preserve that data.

## Goals

- Add real local users with login/password.
- Add roles, starting with `ADMIN` and `USER`.
- Let each user own multiple workspaces.
- Add an admin panel for user management.
- Preserve all existing legacy data.
- Keep Engui usable for self-hosted installs, including Raspberry Pi / LAN-only setups.

## Non-goals for the first version

- Email-based login.
- OAuth/social login.
- Magic links.
- External SaaS auth dependency.
- Large one-shot rewrite of every API route.

Email can be added later as an optional field and later login method.

## Recommended auth approach

Start with built-in local auth:

- username/login + password;
- password hashes in the database;
- session cookie;
- roles in the database;
- no external dependency required.

This keeps self-hosted Raspberry Pi installs simple: install Engui, open it locally, log in as admin, change the temporary password.

Potential later additions:

1. Optional reverse-proxy auth support for homelab users.
2. Optional email field.
3. Login by username or email.
4. OAuth/email flows only if needed later.

## Proposed data model

Add a `User` model similar to:

```prisma
model User {
  id                 String   @id @default(uuid())
  login              String   @unique
  email              String?  @unique
  passwordHash       String
  role               String   @default("USER")
  mustChangePassword Boolean  @default(false)
  isActive           Boolean  @default(true)
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt
}
```

Initial roles:

- `ADMIN` — can manage users and inspect all workspaces.
- `USER` — can access only own workspaces/data.

## Initial admin migration

Create the first real user:

```text
login: admin
password: 12345678
role: ADMIN
mustChangePassword: true
```

The temporary password must only be used for the first login. After login, force password change before allowing normal app/admin access.

## Safety requirements before migration

Before any live migration:

1. Create a full SQLite database backup.
2. Backup generated/uploaded assets if they are not already covered by normal backups.
3. Run a dry-run migration report.
4. Do not delete legacy data during the first migration stage.
5. Have a rollback plan: restore database backup and revert to the previous commit.

## Dry-run report should include

Counts for all data currently owned by `user-with-settings`, including at least:

- workspaces;
- jobs;
- settings;
- LoRAs;
- gallery assets;
- prompt documents;
- Studio Session templates/runs/shots/versions;
- Studio portfolios/sessions/collections;
- any other tables with `userId` or `workspaceId` ownership implications.

## Safer migration strategy

Avoid a destructive first step.

Recommended sequence:

1. Add `User` and auth tables/helpers.
2. Create `admin` user.
3. Add compatibility mapping from legacy `user-with-settings` to `admin.id`.
4. Verify the app still sees all old data through the new current-user abstraction.
5. Only later, in a separate stage, physically rewrite old `userId` values if still needed.

This reduces the risk of losing access to existing work.

## Implementation phases

### Phase 1 — Schema and compatibility foundation

- Add `User` model and role fields.
- Add password hashing utilities.
- Add session storage/cookie mechanism.
- Add helpers:
  - `getCurrentUser()`;
  - `requireUser()`;
  - `requireAdmin()`;
  - legacy current-user fallback for controlled compatibility.
- Create `admin` user with temporary password.
- Do not yet remove `user-with-settings` references everywhere.

### Phase 2 — Login and password change

- Add `/login` page.
- Add logout.
- Add forced password-change page for `mustChangePassword = true`.
- Block normal app/admin access until the temporary password is changed.

### Phase 3 — API user resolution

- Replace direct `user-with-settings` usage with current-user helpers.
- Stop trusting `userId` from the browser for normal user routes.
- Keep limited compatibility paths only where generation/runtime flows still require them.

### Phase 4 — Workspace ownership enforcement

- Ensure every workspace-scoped API verifies ownership.
- Ensure jobs, gallery assets, LoRAs, prompt documents, and Studio Session entities are accessed through the current user's workspace ownership.
- Admin routes may bypass ownership intentionally, but only through `requireAdmin()`.

### Phase 5 — Admin panel

Minimum admin panel:

- list users;
- create user;
- activate/deactivate user;
- reset password;
- change role;
- show workspace/job counts;
- optionally inspect user workspaces.

### Phase 6 — Cleanup

- Remove remaining hardcoded `user-with-settings` references.
- Remove compatibility fallback once all runtime paths are migrated.
- Add regression tests for auth and ownership.

## High-risk areas

Pay special attention to:

- `/api/settings` and per-user secrets;
- RunPod settings lookup;
- job creation/status/supervisor flows;
- S3 storage settings;
- LoRA upload/sync/delete flows;
- Studio Session materialization and job recovery;
- Gallery asset ownership;
- routes that currently accept `userId` directly from the browser.

## Post-migration verification checklist

After migration, verify:

- login works with `admin`;
- forced password change works;
- old workspaces are visible;
- old jobs are visible;
- job details open;
- generated media previews still load;
- settings are present;
- RunPod generation still works after settings lookup;
- S3 settings and browser still work;
- LoRA catalog/upload/delete still work;
- Studio Session templates/runs/shots still load;
- Gallery assets still load;
- non-admin users cannot access other users' workspaces;
- admin panel is accessible only to admins.

## Rollback plan

If migration fails:

1. Stop the service.
2. Restore the pre-migration SQLite database backup.
3. Revert code to the pre-migration commit.
4. Restart the service.
5. Verify `/api/settings`, workspaces, jobs, gallery, and Studio Sessions.

## Recommendation

Proceed only in small PR-sized steps:

1. schema + admin user + compatibility helpers;
2. login/session/password change;
3. current-user API migration;
4. ownership enforcement;
5. admin panel;
6. cleanup.

Do not combine all phases into one large change.
