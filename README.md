# ⚡ FlashQuiz

A browser-based flashcard and quiz app. No server, no build step, no frameworks — just open `index.html` or host on GitHub Pages.

**Live demo:** [j-mathes.github.io/FlashQuiz](https://j-mathes.github.io/FlashQuiz)

---

## Quick Start

**Local:** Clone the repo and open `index.html` in any modern browser.

**GitHub Pages:** In repo Settings → Pages, set source to the `main` branch root.

---

## Data Format

Import a **CSV**, **Excel** (`.xlsx` / `.xls`), or **Bundle ZIP** file. Use **⬇ Sample CSV** or **⬇ Sample Excel** on the Data page to download a working example.

### Without levels (legacy / simple format)

| Column | Contents |
|---|---|
| A | Question (text or image) |
| B | Correct answer |
| C, D, E… | Wrong answers (at least one required for Quiz mode) |

### With levels (recommended format)

| Column | Contents |
|---|---|
| A (`Level`) | Level name (e.g. Easy / Medium / Hard) — leave blank to leave unassigned |
| B (`Reference`) | Optional reference text shown after answering |
| C (`Question`) | Question text or image |
| D (`Correct Answer`) | Correct answer |
| E, F, G… | Wrong answers (at least one required for Quiz mode) |

The first row must be a header row beginning with `Level` for the app to use this format. Decks exported from the builder always use this format. Importing a file without a `Reference` column is handled automatically — all rows are given an empty reference.

### Images

| Format | Example |
|---|---|
| Bare URL | `https://example.com/image.jpg` |
| Explicit tag | `[IMG:https://example.com/image.jpg]` |
| Base64 data URI | `data:image/png;base64,…` |
| Local Library reference | `[LOCAL:filename.jpg]` |
| Mixed (text + image) | Image tag on first line = image above text; text on first line = image below |

---

## Features

### Flashcard Mode
- Click card or press **Space** to flip; navigate with **Arrow keys** or Prev/Next buttons
- Shuffled each session; restart anytime with **↺ Restart**
- **Level filter** — when a deck has levels, choose which to study before starting
- **Reference text** — if the question has reference text, it appears at the bottom of the card back, below the answer, separated by a subtle divider
- **Image zoom** — any image on the front or back of a card has a small expand button (⛶) in its corner; tap or click it to open a full-screen lightbox; tap the background, press ✕, or press **Escape** to close

### Quiz Mode
- Multiple-choice with answers listed vertically; all wrong answers defined for a question are shown (no cap). Keyboard shortcuts **1–9** select the corresponding choice; **Enter / →** advances after answering
- **Live score chip** shows `Correct / Total (%)` in the top bar, updated after every answer
- **Per-level score badges** appear below the top bar once you start answering; each badge uses the level's colour and shows `LevelName: correct/total (%)`; badges appear in defined level order and are hidden until a question for that level has been answered
- **Reference text** — if the question has reference text, it always appears in the feedback box on a correct answer; on a wrong answer it only appears when **Show correct answer** is enabled — visually distinguished with a left border
- Score grid shows ⬜ unanswered / 🟩 correct / 🟥 incorrect per question
- **↺ Retry Incorrect** re-runs only missed questions in a new round; per-level scores accumulate across all rounds
- **Round summary** — the quiz complete screen shows each round's score (`X / Y correct`) followed by a row of coloured level-badge chips (e.g. `Easy: 3/4 (75%)`) so you can see which levels needed the most work at a glance
- **Level filter** — when a deck has levels, choose which to include before starting
- **Save progress** — signed-in users see a **💾 Save** button in the toolbar; navigating away or using the back arrow prompts to save or discard. Anonymous users are warned progress cannot be saved.
- **Resume** — returning to Quiz mode with saved progress shows a resume card above the deck list; the deck name is displayed as a header at the top of the card, followed by the round number, progress, and save time; click **Resume** to pick up where you left off (score grid restored) or **Discard** to start fresh.
- **Image zoom** — any image in a question or answer choice has a small expand button (⛶) in its corner; tap or click it to open a full-screen lightbox without selecting that answer choice; tap the background, press ✕, or press **Escape** to close

### Quiz Builder

Build or edit decks in the app. Each field supports text, an image, or both. On desktop the toolbar, deck name, and search bar stay **frozen at the top** as you scroll through questions. On mobile, the deck name and action buttons scroll away and only the **search bar and filter buttons stay pinned** at the top.

#### Search
A search bar below the toolbar lets you filter questions in real time by typing any text that appears in the question, correct answer, or wrong answers. A result count (e.g. `3 of 45`) is shown while a search is active. The search works alongside the Missing Images and Missing Levels filters simultaneously.

#### Adding an image — three ways

**1. Upload a file**
Click the **image icon** (landscape in a frame) next to any field → choose a file (max 2 MB). Embedded as base64 in the deck.

**2. Pick from the Image Library**
Upload images once on the **Data** page (up to 5 MB each), then click the **grid icon** in the builder to pick by name. Stored as a `[LOCAL:name]` reference.

**3. Mixed — text + image**
Enter text *and* add an image. A position toggle appears:

| Toggle | Result |
|---|---|
| **Above** | Image on top, text below |
| **Inline** | Image and text side by side |
| **Below** | Text on top, image below |

In CSV/Excel, put text and the image tag on separate lines in the same cell — image tag first = image above, text first = image below.

#### Removing an image
When an image is set, a **✕ Remove** button appears below the preview. Click it to clear the image while keeping any text.

#### Missing Images filter
Click the **Missing Images** button in the search bar to show only questions with a broken image reference (`[LOCAL:name]` not in the library, or an external URL that fails to load). The button highlights when the filter is active; click again to clear.

#### Missing Levels filter
Click **🏷 Missing Levels** to show only questions with no level assigned, or whose level no longer exists in the deck (e.g. after a rename or delete). The button highlights when active. Both filters can be active at the same time.

#### 🏷 Levels
Tag each question with a difficulty or category badge (e.g. Easy / Medium / Hard, Chapter 1 / Chapter 2).

- Click **🏷 Levels** in the toolbar to open the Levels manager; add levels with a name and colour
- Once defined, every question card shows a **`+ Level`** badge; click to assign from a popover or clear the assignment
- The badge appears on flashcard fronts and alongside the question counter in quiz; text colour auto-adjusts for readability

**Bulk assignment** — three ways:

1. **Checkboxes + action bar** — check questions (Shift+click for a range); a sticky bar offers **Assign Level ▾**, **Clear Levels**, **Select All / Deselect All**
2. **Picker shortcuts** — inside each question's level popover, **`all`** and **`untagged`** buttons tag the whole deck or only untagged questions
3. **Levels manager shortcuts** — same **`All Qs`** / **`Untagged`** buttons on each level row

**Data format** — levels export as a `Level` column before `Reference` and `Question` in CSV/Excel and are restored on re-import (colours assigned from the default palette, re-customisable in the builder).

#### Reference text
Each question has an optional **Reference** field in the builder. It is a plain-text annotation shown in two places:
- **Flashcard back** — pinned to the bottom of the answer face, below the answer content, separated by a subtle divider
- **Quiz feedback box** — always shown on a correct answer; on a wrong answer, only shown when **Show correct answer** is enabled. Appears below the ✅/❌ verdict and, when visible on a wrong guess, below the correct-answer reveal. Visually distinguished with a left border.

Leave it blank and it is hidden in both modes.

In CSV/Excel, Reference is the second column (column B when levels are present).

#### Saving & exporting
- **💾 Save Deck** — overwrites the deck in place (rename here updates the name, no copy made)
- **📋 Save as Copy** — saves a new deck named `"Copy of …"`
- **⬇ Export** — choose from three formats:
  - **CSV (.csv)** — plain text, UTF-8 with BOM so Excel opens special characters correctly
  - **Excel (.xlsx)** — preserves multi-line cells (text + image) correctly when opened in Excel
  - **Bundle ZIP (deck + images)** — packages the deck file and all referenced Image Library pictures into a single `.zip` for easy transfer; choose CSV or Excel as the deck format inside the ZIP

#### ✂ Split a Deck
Click **✂ Split** on any deck in the Builder list to open the split panel.

- Every question is listed with a checkbox (all pre-selected by default)
- The **level badge** for each question appears between the checkbox and the question text for quick identification
- **Level filter badges** at the top toggle whole levels on or off — turning a level off hides its questions *and* deselects them, so the export always contains exactly what is visibly checked; turning it back on shows those questions unchecked
- **Select All / Deselect All** operate only on the currently visible (non-hidden) questions
- **Shift+click** any row to range-select from the last-clicked row to the current one
- **🔍 Filter** narrows the list by question or answer text; Select All/None respects the filter
- The count reads e.g. `12 of 45 selected · 20 shown` when a level or text filter is active
- Enter a **New deck name**, then **💾 Save as New Deck** (saves to IndexedDB) or **⬇ Export** (same CSV / Excel / Bundle ZIP options as the main builder export)
- Only levels that are actually used by the selected questions are carried into the new deck

#### ⊕ Combine Decks
Click **⊕ Combine** in the Builder header to merge two or more decks into one new deck. The flow has up to four steps (some are skipped when not needed):

**Select Decks:** Check two or more decks from the list; Next → is disabled until at least two are selected.

**Level Conflicts** *(skipped if none)*: If the same level name exists in multiple decks with different colours, each conflict is listed with a radio button per deck so you can choose which colour to keep.

**Duplicate Questions** *(skipped if none)*: Questions with matching text are detected across all selected decks and grouped by type:

| Type | Default | Options |
|---|---|---|
| **🔁 Exact Duplicate** — same question, answers, and level | Keep one copy (auto-deduplicated) | Keep one · Keep all · Exclude all |
| **⚠ Same Question – Different Levels** — matching question, levels differ | Treated as **separate questions** (both kept) | Toggle "Treat as duplicate" → choose which deck's version to keep, or exclude both |
| **⚠ Same Question – Different Answers** — same question and level, answers differ | Keep all versions | Per-entry checkboxes to include or exclude each deck's version |

**Save:** Shows the decks being merged, the final question count after duplicate resolutions, a "N duplicate group(s) resolved" note (if any), and the merged level badges. Enter a **New deck name** (pre-filled as `"Deck A + Deck B"`), then **💾 Save as New Deck** or **⬇ Export**.

### Image Library
- Upload images once (up to 5 MB each) from the **Data** page; stored in IndexedDB
- Upload multiple images at once to a group using its **📤 Upload** button
- **Drop a ZIP** onto the image upload area to bulk-import an entire image group at once
- Reference in the builder via the grid icon or in CSV/Excel with `[LOCAL:filename]`
- Export a group as a ZIP using its **⬇ Export** button
- Delete individual images at any time

### Importing

Drop or browse for any of the following on the **Data** page upload area:

| File type | What happens |
|---|---|
| `.csv` | Parsed and saved as a new deck |
| `.xlsx` / `.xls` | Parsed and saved as a new deck |
| **Bundle ZIP** | Images restored to the library, then deck imported |
| **Image-only ZIP** | All images imported as a library group named after the ZIP file |

**Manifest checking** — Bundle ZIPs created by FlashQuiz include a `manifest.txt` listing every file that should be present. On import, the manifest is read and two checks are performed:
- Files listed in the manifest but **missing from the ZIP** → ⚠ persistent warning (stays until dismissed)
- Files present in the ZIP but **not listed in the manifest** → ℹ persistent info notice

Both notices include a **📋 copy** button and a **✕ dismiss** button so the full list can be captured before closing.

### Settings

Persistent preferences saved in `localStorage` and applied immediately on every change.

| Setting | Options |
|---|---|
| **Theme** | Light / Dark |
| **Question font size** | S / M / L / XL |
| **Question font family** | System / Serif / Mono |
| **Question font weight** | Regular / Bold |
| **Question font style** | Normal / Italic |
| **Answer font size** | S / M / L / XL |
| **Answer font family** | System / Serif / Mono |
| **Answer font weight** | Regular / Bold |
| **Answer font style** | Normal / Italic |
| **Verdict font size** | S / M / L / XL |
| **Verdict font family** | System / Serif / Mono |
| **Verdict font weight** | Regular / Bold |
| **Verdict font style** | Normal / Italic |
| **Feedback reference font size** | S / M / L / XL |
| **Feedback reference font family** | System / Serif / Mono |
| **Feedback reference font weight** | Regular / Bold |
| **Feedback reference font style** | Normal / Italic |
| **Flip animation speed** | Fast / Normal / Slow / Off |

Question text settings apply to the flashcard front face and the quiz question card. Answer text settings apply to the flashcard back face and the quiz answer choices. **Verdict** settings control the ✅ Correct! / ❌ Incorrect message. **Feedback reference** settings control the reference text shown below the verdict. A **↺ Reset to Defaults** button restores all settings at once.

### Users & Reports
- Add named profiles to track sessions separately; switch users from the nav
- Reports show every session; filter by user, deck, or mode
- Each session can be expanded to see a per-round breakdown: round headers show `X/Y (%)` and list every question answered in that round; if the deck has levels, coloured level-badge chips appear beneath each round header (e.g. `Easy: 8/10 (80%)`)
- The quiz complete screen shown at the end of each round also displays these per-level chips under each round row

### Data Backup
Located at the bottom of the **User Profiles** page.

- **⬇ Export** (per user row) — downloads a JSON backup of that user's profile, all their sessions, and their in-progress quiz snapshot (if one exists); filename includes the user's name and date
- **⬇ Export All** (backup card) — downloads a JSON backup of every user, all sessions, and current app settings. If any users have a saved in-progress quiz, a prompt asks whether to include those snapshots in the export; if included, a warning notes that the matching deck must already exist on the target device (deck data is not bundled)
- **⬆ Import Backup** — accepts any FlashQuiz backup file (single-user or all-users); a confirmation modal shows how many users, sessions, and in-progress quiz snapshots are in the file and how many are new before merging. If the file includes quiz progress, a reminder is shown that the matching deck must be present. Records already present (matched by ID) are skipped — nothing is deleted.

---

## Storage

All data is browser-local — nothing leaves your device.

| Data | Where |
|---|---|
| Decks + embedded images | IndexedDB |
| Image Library | IndexedDB |
| Users, sessions, metadata | localStorage |
| Quiz progress snapshots | localStorage (named users only) |
| User settings | localStorage |

---

## License

[Creative Commons Attribution-NonCommercial-ShareAlike 4.0](http://creativecommons.org/licenses/by-nc-sa/4.0/) — © 2026 Jared Mathes. See [LICENSE](LICENSE).
