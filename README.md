# ⚡ FlashQuiz

A browser-based flashcard and quiz app. No server, no build step, no frameworks — just open `index.html` or host on GitHub Pages.

**Live demo:** [j-mathes.github.io/FlashQuiz](https://j-mathes.github.io/FlashQuiz)

---

## Quick Start

**Local:** Clone the repo and open `index.html` in any modern browser.

**GitHub Pages:** In repo Settings → Pages, set source to the `main` branch root.

---

## Installing as an App (PWA)

FlashQuiz is a Progressive Web App — install it for a full-screen, offline-capable experience with no browser chrome.

### iOS (iPhone / iPad)

**Safari** is the primary method. Chrome and Edge on iOS 17+ also support installation via their Share button.

1. Open **Safari** and navigate to the hosted link
2. Tap the **Share** button (⎙) → **"Add to Home Screen"** → **Add**
3. **iOS 17.4+:** when prompted, choose **"As Web App"** (not "In Safari")

### Android

1. Open **Chrome** and navigate to the hosted link
2. Tap **⋮** → **"Add to Home Screen"** (or tap the install banner) → **Add**

### Desktop (Chrome / Edge)

1. Navigate to the hosted link
2. Click the **install icon** (⊕) in the address bar → **Install**

### App Version & Updates

The installed cache version is shown at the bottom of the **Settings** page (`Version x.x.x · cache: flashquiz-vN`). When a new version is deployed, an **"Update available — tap to refresh"** toast appears at the bottom of the screen; click or tap it to reload instantly.

---

## Data Format

Import a **CSV**, **Excel** (`.xlsx` / `.xls`), or **Bundle ZIP** file. Download a working example from the **Data** page.

### Simple format (no levels)

| Column | Contents |
|---|---|
| A | Question |
| B | Correct answer |
| C, D, E… | Wrong answers (at least one required for Quiz mode) |

### Recommended format (with levels)

| Column | Contents |
|---|---|
| A (`Level`) | Level name — leave blank to leave unassigned |
| B (`Reference`) | Optional reference shown after answering — supports the same image syntax as any other cell |
| C (`Question`) | Question |
| D (`Correct Answer`) | Correct answer |
| E, F, G… | Wrong answers |

The first row must be a header beginning with `Level`. Decks exported from the builder always use this format.

### Images

| Format | Example |
|---|---|
| Bare URL | `https://example.com/image.jpg` |
| Explicit tag | `[IMG:https://example.com/image.jpg]` |
| Base64 data URI | `data:image/png;base64,…` |
| Local Library reference | `[LOCAL:filename.jpg]` |
| Mixed (text + image) | Image tag on first line = image above; text on first line = image below |

### Inline text formatting

Supported in any text field (question, answer, wrong answer, reference) — in the builder and in CSV/Excel cells:

| Syntax | Result |
|---|---|
| `**bold**` | **bold** |
| `*italic*` | *italic* |
| `***bold and italic***` | ***bold and italic*** |
| `` `code` `` | `code` |
| `~~strikethrough~~` | ~~strikethrough~~ |
| newline in cell | line break |

Formatting is applied when the card is displayed, not in the editor. Example CSV cell:

```
The heart has **four chambers**:
*right atrium*, *left atrium*
*right ventricle*, *left ventricle*
```

---

## Features

### Flashcard Mode
- Click card or press **Space** to flip; navigate with **Arrow keys** or Prev/Next buttons
- Shuffled each session; restart anytime with **↺ Restart**
- **Level filter** — choose which levels to study before starting
- **Save & Resume** — signed-in users can save their position mid-session and resume later from the same card
- **Reference** — if a question has reference content, it appears at the bottom of the card back, below the answer
- **Image zoom** — tap ⛶ on any image to open a full-screen lightbox; pinch or scroll to zoom (up to 5×); drag or swipe to pan; tap the background, ✕, or **Escape** to close

### Quiz Mode
- Multiple-choice; all defined wrong answers are shown. Keyboard shortcuts **1–9** select choices; **Enter / →** advances after answering
- **Live score chip** — `Correct / Total (%)` in the top bar, updated after every answer
- **Per-level score badges** — appear below the top bar as levels are encountered, showing `LevelName: correct/total (%)`
- **Reference** — always shown on a correct answer; on a wrong answer, only shown when **Show correct answer** is enabled
- **Score grid** — ⬜ unanswered / 🟩 correct / 🟥 incorrect per question
- **↺ Retry Incorrect** — re-runs only missed questions in a new round; per-level scores accumulate across rounds
- **Level filter** — choose which levels to include before starting
- **Save & Resume** — signed-in users can save mid-quiz progress (including settings) and resume later from exactly where they left off
- **Image zoom** — same lightbox as Flashcard mode; opening it does not select the answer choice

### Quiz Builder

Build or edit decks in the app. Each field — question, correct answer, wrong answers, and reference — supports text, an image, or both. On desktop the toolbar stays frozen at the top while scrolling.

#### Search & Filters
- **Search bar** — filters questions in real time; a result count is shown while active
- **Level filter** — coloured level badges appear when the deck has levels; all active by default. Click any badge to toggle it; click **All** to reset. An **Unlabeled** button appears when any questions have no level. Stacks with all other filters.
- **Missing Images** — shows only questions with broken image references
- **Missing Levels** — shows only questions with no level or a deleted level

#### Adding an image — three ways

1. **Upload** — click the image icon next to any field → choose a file (max 2 MB, embedded as base64)
2. **Library** — click the grid icon to pick an image stored in the Image Library (`[LOCAL:name]` reference)
3. **Mixed** — enter text *and* add an image; a position toggle appears:

| Toggle | Result |
|---|---|
| **Above** | Image on top, text below |
| **Inline** | Image and text side by side |
| **Below** | Text on top, image below |

A **✕ Remove** button clears the image while keeping any text.

#### 🏷 Levels
Tag each question with a difficulty or category badge (e.g. Easy / Medium / Hard).

- **🏷 Levels** in the toolbar opens the Levels manager; add levels with a name and colour
- Every question card shows a **`+ Level`** badge; click to assign or clear
- Badges appear on flashcard fronts and alongside the quiz question counter

**Bulk assignment** — three ways:
1. **Checkboxes + action bar** — check questions (Shift+click for a range); sticky bar offers **Assign Level ▾**, **Clear Levels**, **Select All / Deselect All**
2. **Picker shortcuts** — `all` and `untagged` buttons inside the question's level popover
3. **Levels manager shortcuts** — same **All Qs** / **Untagged** buttons on each level row

#### Reference
Each question has an optional **Reference** field (plain text, image, or mixed) shown on the flashcard back and in the quiz feedback box.

#### Saving & Exporting
- **💾 Save Deck** — overwrites in place
- **📋 Save as Copy** — saves a new deck named `"Copy of …"`
- **⬇ Export** — three formats:
  - **CSV** — UTF-8 with BOM
  - **Excel (.xlsx)** — preserves multi-line cells correctly
  - **Bundle ZIP** — deck + all referenced library images in one file; choose CSV or Excel inside the ZIP

#### ✂ Split a Deck
Opens a panel listing every question with checkboxes (all pre-selected). Use level-filter badges, text search, or Shift+click range selection to refine. The count shows `X of Y selected · Z shown` when filters are active. Save the selection as a new deck or export it directly.

#### ⊕ Combine Decks
Merges two or more decks. The wizard handles:
- **Level colour conflicts** — if the same level name appears with different colours, pick which colour to keep
- **Duplicate detection** — exact duplicates, same-question-different-level, and same-question-different-answers are each handled with per-group controls

### Image Library
- Upload images (up to 5 MB each) from the **Data** page; stored in IndexedDB
- Upload multiple at once or **drop a ZIP** to bulk-import an entire group
- Reference in the builder via the grid icon or in CSV/Excel with `[LOCAL:filename]`
- Export a group as a ZIP; delete individual images at any time

### Importing

Drop or browse for files on the **Data** page:

| File type | What happens |
|---|---|
| `.csv` | Parsed as a new deck |
| `.xlsx` / `.xls` | Parsed as a new deck |
| **Bundle ZIP** | Images restored to the library, then deck imported |
| **Image-only ZIP** | All images imported as a library group |

Bundle ZIPs include a `manifest.txt`; on import, missing or extra files are reported with a persistent notice and a **📋 copy** button.

### Reports

Reports log every flashcard and quiz session, filterable by user, deck, and mode.

#### Flashcard sessions
Expand a session to see total cards viewed and, for decks with levels, a **per-level progress bar** showing how many cards in each level were seen (`viewed / total`).

#### Quiz sessions
Expand a session to see two tabs:

**Attempts tab**
- Level score summary — coloured badges showing `LevelName: correct/total (%)`
- **Level filter** — toggle level badges to include any combination of levels; all active by default; click **All** to reset
- **Show missed only** toggle — instantly filters to wrong answers only
- Each row shows: `Q #N` (builder question number) or `#N` (presentation order for older sessions), level badge, ✅/❌ icon, question text, and — for wrong answers — the selected answer and correct answer stacked below
- Image-only questions and answers display as thumbnails

**Chart tab**
- **By Round / By Level** — toggle the primary axis (separator visually distinguishes this from the next toggle)
- **% / Count** — toggle the Y axis between percentage correct and raw count
- Stacked bars show each level's (or round's) contribution; hover a segment for its exact score
- A colour legend appears below the chart when there are multiple groups

### Settings

All preferences are saved in `localStorage` and applied immediately.

| Setting | Options |
|---|---|
| **Theme** | Light / Dark |
| **Question font** size / family / weight / style | S–XL · System/Serif/Mono · Regular/Bold · Normal/Italic |
| **Answer font** size / family / weight / style | S–XL · System/Serif/Mono · Regular/Bold · Normal/Italic |
| **Verdict font** size / family / weight / style | S–XL · System/Serif/Mono · Regular/Bold · Normal/Italic |
| **Feedback reference font** size / family / weight / style | S–XL · System/Serif/Mono · Regular/Bold · Normal/Italic |
| **Flip animation speed** | Fast / Normal / Slow / Off |
| **Report row colours** | Separate colour pickers for even and odd attempt rows |

**↺ Reset to Defaults** restores all settings at once.

### Users & Data Backup

Add named profiles to track sessions separately; switch users from the nav bar. Anonymous play is supported — progress cannot be saved anonymously.

**Backup (bottom of User Profiles page):**
- **⬇ Export** (per user) — JSON backup of that user's profile, sessions, and any saved progress snapshot
- **⬇ Export All** — JSON backup of all users, all sessions, and app settings; optionally includes saved progress snapshots
- **⬆ Import Backup** — merges any FlashQuiz backup file; shows a preview of how many records are new before merging; records already present (matched by ID) are skipped

---

## Storage

All data is browser-local — nothing leaves your device.

| Data | Where |
|---|---|
| Decks + embedded images | IndexedDB |
| Image Library | IndexedDB |
| Users, sessions, metadata | localStorage |
| Flashcard & quiz progress snapshots | localStorage (named users only) |
| Settings | localStorage |

---

## Version History

| Version | Highlights |
|---|---|
| **4.5.4** | Flashcard question and answer text is now left-justified, consistent with quiz mode |
| **4.5.3** | Builder search now includes reference field text; Split deck search likewise |
| **4.5.2** | Fix: reference text with an image (mixed cell) now inherits the correct colour on the flashcard back face instead of rendering in the global paragraph colour |
| **4.5.1** | Builder preview fixes: card now flips correctly; Space/Enter works immediately on open and after tab switch; digit keys 1–9 select quiz choices; switching tabs resets both panes; on portrait mobile the card header reflows to two rows (identity top, actions bottom) |
| **4.5.0** | Builder question preview: a 👁 button beside each question number opens a full-fidelity modal preview in Flashcard mode (flip animation, reference) or Quiz mode (shuffled choices, answer feedback, reference reveal) — no session data is recorded |
| **4.4.0** | Inline text formatting in questions, answers, and references: `**bold**`, `*italic*`, `` `code` ``, `~~strikethrough~~`; line breaks (`\n`) now render visually |
| **4.3.3** | Dark mode fixes: home-screen tile icons brightened for visibility; builder level-filter “All” button now uses primary colour theming in both light and dark mode; report user chip styled as a bordered pill |
| **4.3.2** | Date/time format changed to `YYYY-MM-DD HH:mm` throughout; report session rows reordered to Name → Deck → Mode → Date → Time → Score |
| **4.3.1** | Resume cards appear below the deck list; FlashQuiz logo navigates to home screen; crash fix (stray brace in object literal) |
| **4.3.0** | Flashcard Save & Resume — signed-in users can save mid-session progress and resume later from the same card (mirrors quiz behaviour) |
| **4.2.3** | PWA update toast uses `controllerchange` for reliable detection on iOS Safari; zoom button hidden on the non-visible flashcard face |
| **4.2.2** | Bug fixes: report session rows stack vertically on portrait mobile; level-select badges restored to independent multi-select; nav bar and home-screen tile order unified to Home → Flashcards → Quiz → Data → Builder → Reports → Settings → Users |
| **4.2.1** | Update-available toast: fires at correct SW `installed` state, centered bottom-of-screen, full-toast click-to-reload, keyboard accessible |
| **4.2.0** | Reports revamp: combined Attempts + Missed view with level filter and missed-only toggle; `Q #N` builder question numbering; image thumbnails in reports; stacked bar chart with By Round/Level and %/Count toggles; flashcard per-level viewing progress; configurable report row colours in Settings; builder level filter badges |
| **4.1.0** | Reference field supports rich content (images, mixed text+image) in the builder, flashcard back, and quiz feedback; lightbox pan support (mouse drag, scroll-to-zoom, single-finger swipe) |
| **4.0.0** | Initial release: Flashcard and Quiz modes, Quiz Builder, Image Library, level tags, Split/Combine decks, Bundle ZIP import/export, PWA support, user profiles, session reports, backup/restore |

---

## License

[MIT](LICENSE)
