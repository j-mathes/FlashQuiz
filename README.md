# ⚡ FlashQuiz

A browser-based flashcard and quiz app. No server, no build step, no frameworks — just open `index.html` or host on GitHub Pages.

**Live demo:** [j-mathes.github.io/FlashQuiz](https://j-mathes.github.io/FlashQuiz)

---

## Quick Start

**Local:** Clone the repo and open `index.html` in any modern browser.

**GitHub Pages:** In repo Settings → Pages, set source to the `main` branch root.

---

## Data Format

Import a **CSV** or **Excel** (`.xlsx` / `.xls`) file. Use **⬇ Sample CSV** or **⬇ Sample Excel** on the Data page to download a working example.

| Column | Contents |
|---|---|
| A | Question (text or image) |
| B | Correct answer |
| C, D, E… | Wrong answers (at least one required for Quiz mode) |

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

### Quiz Mode
- Multiple-choice with shuffled answers; keyboard shortcuts **1–4**, **Enter / →**
- Score grid shows ⬜ unanswered / 🟩 correct / 🟥 incorrect per question
- **↺ Retry Incorrect** re-runs only missed questions in a new round; continues until all correct
- **Level filter** — when a deck has levels, choose which to include before starting
- **Save progress** — signed-in users see a **💾 Save** button in the toolbar; navigating away or using the back arrow prompts to save or discard. Anonymous users are warned progress cannot be saved.
- **Resume** — returning to Quiz mode with saved progress shows a resume card above the deck list; click **Resume** to pick up where you left off (score grid restored) or **Discard** to start fresh.

### Quiz Builder

Build or edit decks in the app. Each field supports text, an image, or both. The toolbar and deck name stay **frozen at the top** as you scroll through questions.

#### Adding an image — three ways

**1. Upload a file (🖼)**
Click **🖼** next to any field → choose a file (max 2 MB). Embedded as base64 in the deck.

**2. Pick from the Image Library (📚)**
Upload images once on the **Data** page (up to 5 MB each), then click **📚** in the builder to pick by name. Stored as a `[LOCAL:name]` reference.

**3. Mixed — text + image**
Enter text *and* add an image via **🖼** or **📚**. A position toggle appears:

| Toggle | Result |
|---|---|
| **Above** | Image on top, text below |
| **Inline** | Image and text side by side |
| **Below** | Text on top, image below |

In CSV/Excel, put text and the image tag on separate lines in the same cell — image tag first = image above, text first = image below.

#### Removing an image
When an image is set, a **✕ Remove** button appears below the preview. Click it to clear the image while keeping any text.

#### 🖼 Missing Images filter
Click **🖼 Missing Images** in the toolbar to show only questions with a broken image reference (`[LOCAL:name]` not in the library, or an external URL that fails to load). The button shows **🔍 Checking…** while scanning, then highlights active. Click again to clear.

#### 🏷 Missing Levels filter
Click **🏷 Missing Levels** to show only questions with no level assigned, or whose level no longer exists in the deck (e.g. after a rename or delete). Both filters can be active at the same time.

#### 🏷 Levels
Tag each question with a difficulty or category badge (e.g. Easy / Medium / Hard, Chapter 1 / Chapter 2).

- Click **🏷 Levels** in the toolbar to open the Levels manager; add levels with a name and colour
- Once defined, every question card shows a **`+ Level`** badge; click to assign from a popover or clear the assignment
- The badge appears on flashcard fronts and alongside the question counter in quiz; text colour auto-adjusts for readability

**Bulk assignment** — three ways:

1. **Checkboxes + action bar** — check questions (Shift+click for a range); a sticky bar offers **Assign Level ▾**, **Clear Levels**, **Select All / Deselect All**
2. **Picker shortcuts** — inside each question's level popover, **`all`** and **`untagged`** buttons tag the whole deck or only untagged questions
3. **Levels manager shortcuts** — same **`All Qs`** / **`Untagged`** buttons on each level row

**Data format** — levels export as a `Level` column before Question in CSV/Excel and are restored on re-import (colours assigned from the default palette, re-customisable in the builder).

#### Saving & exporting
- **💾 Save Deck** — overwrites the deck in place (rename here updates the name, no copy made)
- **📋 Save as Copy** — saves a new deck named `"Copy of …"`
- **⬇ Export** — choose **CSV** or **Excel (.xlsx)**; both can be re-imported into FlashQuiz

### Image Library
- Upload images once (up to 5 MB each) from the **Data** page; stored in IndexedDB
- Upload multiple images at once to a group using its **📤 Upload** button
- Reference in the builder via 📚 or in CSV/Excel with `[LOCAL:filename]`
- Delete individual images at any time

### Users & Reports
- Add named profiles to track sessions separately; switch users from the nav
- Reports show every session with per-round breakdown; filter by user, deck, or mode

---

## Storage

All data is browser-local — nothing leaves your device.

| Data | Where |
|---|---|
| Decks + embedded images | IndexedDB |
| Image Library | IndexedDB |
| Users, sessions, metadata | localStorage |
| Quiz progress snapshots | localStorage (named users only) |

---

## License

[Creative Commons Attribution-NonCommercial-ShareAlike 4.0](http://creativecommons.org/licenses/by-nc-sa/4.0/) — © 2026 Jared Mathes. See [LICENSE](LICENSE).
