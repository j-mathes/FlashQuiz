# Contributing to FlashQuiz

## Versioning

Format: `MAJOR.MINOR.PATCH` (semver)

| Level | When to use |
|---|---|
| **Major** (`X.0.0`) | Breaking changes to persisted data or file formats — IndexedDB schema changes that corrupt existing data, renaming localStorage keys so sessions/users/settings are lost, PWA manifest changes that break existing installs |
| **Minor** (`x.X.0`) | New user-visible features that don't break anything existing — new modes, views, or tools; substantial new capability inside an existing feature; new settings that add behaviour |
| **Patch** (`x.x.X`) | Bug fixes, UI/layout corrections, copy tweaks, performance improvements, documentation-only changes |

**Rule:** when a release mixes a new feature and fixes, the feature determines the level (e.g. a minor feature + a bug fix = minor bump, not patch).

### Files to update on every release

- `APP_VERSION` constant in `app.js`
- `CACHE_VERSION` in `sw.js` (increment `v1`, `v2`, … for any change to `app.js`, `styles.css`, or `index.html`)
- Version history table in `README.md`

---

## IndexedDB Schema (`DB_VERSION`)

`DB_VERSION` in `app.js` is independent of `APP_VERSION`. Increment it **only** when the IndexedDB structure changes:

- Adding or removing an object store
- Adding, removing, or changing an index on a store
- Changing a store's `keyPath` or `autoIncrement` setting

**Do not** increment for new fields on records (IndexedDB is schema-less for record contents) or for any `localStorage`-only changes.

### Current schema (`DB_VERSION = 2`)

| Store | Key | Indexes |
|---|---|---|
| `datasets` | `id` | — |
| `images` | `name` | — |

All other data (users, sessions, settings, progress snapshots) lives in `localStorage`.
