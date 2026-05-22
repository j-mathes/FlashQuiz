# ⚡ FlashQuiz

A browser-based flashcard and quiz app that runs as a fully static web page — no server, no build step, no frameworks. Just open `index.html` in any modern browser, or host it on GitHub Pages.

## Quick Start

1. Download or clone this repo
2. Open `index.html` in your browser
3. Go to **Data** and import a CSV or Excel file (or export the built-in sample first to see the format)
4. Choose **Flashcards** or **Quiz** and pick your deck

> **GitHub Pages:** Push to a repo, enable Pages from the `main` branch root, and your app is live.

---

## Files

| File | Description |
|---|---|
| `index.html` | App shell — all views, nav, modal, and toast markup |
| `styles.css` | All styles — responsive, CSS custom properties, card-flip animation |
| `app.js` | All application logic (~1,650 lines, ES6+, `"use strict"`) |

No build step. No package.json. No dependencies to install.

---

## Data Format

Import a **CSV** or **Excel** (`.xlsx` / `.xls`) file. SheetJS is loaded from CDN for Excel support; CSV always works offline.

| Column | Contents |
|---|---|
| A | Question or statement (text or image — see below) |
| B | **Correct** answer |
| C, D, E… | Wrong answers (at least one required for Quiz mode) |

### Images

Any cell can contain an image instead of text. Supported formats:

| Format | Example |
|---|---|
| Bare URL | `https://example.com/image.jpg` |
| Explicit tag | `[IMG:https://example.com/image.jpg]` |
| Base64 data URI | `data:image/png;base64,…` |
| Local Library reference | `[LOCAL:filename.jpg]` |
| Mixed (text + image) | `[IMG:url]` on first line, text on remaining lines (image before); or text first, `[IMG:url]` last (image after) |
> A bare `http://…` or `https://…` URL that occupies an entire cell is automatically treated as an image. This matches the sample volleyball quiz format (which used TinyPic URLs — those images are now dead, but the app handles broken images gracefully).

### Sample File

Click **⬇ Sample CSV** or **⬇ Sample Excel** on the Data page to download a working example with text questions and one image question.

---

## Features

### Flashcard Mode
- Questions appear one at a time; click the card (or press **Space**) to flip and reveal the answer
- Navigate with **← Prev** / **Next →** buttons or **Arrow keys**
- Questions are shuffled each session
- Restart the deck at any time with **↺ Restart**

### Quiz Mode
- Multiple-choice with shuffled answer order each time
- Keyboard shortcuts: **1–4** to select an answer, **Enter / →** to advance
- **Score grid** on the right (or bottom on mobile) shows a colored square per question:
  - ⬜ Gray — not yet answered
  - 🟩 Green — correct
  - 🟥 Red — incorrect
- After each round, choose **↺ Retry Incorrect** to attempt only wrong questions again
- Keeps retrying in new rounds until all are correct or you stop
- All rounds are tracked separately in Reports

### Quiz Builder
- Create and edit decks directly in the app
- Each question/answer field supports **text**, an **uploaded image** (≤ 2 MB → stored as base64), or a **library pick** (📚) that references the Image Library
- Type text **and** pick an image in the same field to create a mixed cell; a **Before text / After text** toggle controls which comes first
- Add multiple wrong answers per question
- **💾 Save Deck** — overwrites the existing deck in place
- **📋 Save as Copy** — saves a new independent copy named `"Copy of …"` without touching the original
- **⬇ Export CSV** — downloads the deck as a `.csv` (library picks are serialised as `[LOCAL:name]` tags so they re-import correctly)

### Image Library
- Upload images once to a persistent local library (up to 5 MB each) from the **Data** page
- Images are stored in IndexedDB by filename
- Reference them in the builder with the 📚 **Pick from Library** button, or in raw CSV/Excel with a `[LOCAL:filename]` cell
- Delete individual images from the library at any time
- Useful for decks that share the same images, or for replacing broken online URLs with local copies

### Users
- Add named profiles to track sessions separately
- Switch users at any time from the **Users** page or the top-right nav button
- Continue anonymously if preferred

### Reports
- View every quiz and flashcard session
- Filter by user, dataset, or mode
- Expandable rows show per-round breakdown: ✅/❌ for each question with the correct answer for misses
- Multi-round retries appear as Round 1, Round 2, etc.

---

## Storage

| Data | Storage |
|---|---|
| Datasets (questions + any embedded images) | **IndexedDB** |
| Image Library (uploaded local images) | **IndexedDB** |
| Users, sessions, dataset metadata | **localStorage** |

Both are browser-local. No data leaves the device. IndexedDB is used for datasets and the image library because base-64 images can be large; everything else fits comfortably in localStorage.

---

## Browser Compatibility

Works in all modern browsers (Chrome, Edge, Firefox, Safari). Requires ES6+ support and IndexedDB (available in all browsers since 2015).

---

## License

This project is licensed under the [Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License](http://creativecommons.org/licenses/by-nc-sa/4.0/).

© 2026 Jared Mathes — see [LICENSE](LICENSE) for full terms.
