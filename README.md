# Noted — Notes App

A web application for writing notes, checklists, and media notes, built with **Angular 17** (standalone components).

---

## Setup & run

**Prerequisites:** Node.js ≥ 18, Angular CLI 17

```bash
# install dependencies
npm install

# start dev server (http://localhost:4200)
npm start

# production build
npm run build
```

---

## Features — Task 1: Core Notes

| Feature | Detail |
|---|---|
| **Two note types** | Text notes and Checklist notes |
| **Homepage grid** | Responsive card grid, auto-adjusts columns |
| **Create** | FAB → type picker modal → editor |
| **Edit** | Click any card to open the editor |
| **Delete** | Hover a card to reveal the trash icon; confirm dialog |
| **Checklist UX** | Check/uncheck items, Enter adds a new item below, Backspace on empty item removes it |
| **Search** | Real-time search across title, content, and checklist item text |
| **Filter** | All / Text / Lists / Media tabs |
| **Sort** | Newest first, Oldest first, Last modified, Title A–Z |
| **Persistence** | All notes saved to `localStorage`; survive page refresh |
| **Dates** | Created and modified timestamps shown in editor and on cards |

---

## Features — Task 2: Media Note Types

Four new note types, each with their own attachment component and dedicated editor panel.

### Audio notes
- **Record** directly in the browser via the `MediaRecorder` API and `getUserMedia` — no external libraries.
- Recordings appear in the list immediately when you stop, without needing to click Save.
- The note auto-saves after each recording stops so nothing is lost if you navigate away.
- **Upload** existing audio files from disk as an alternative to recording.
- Each recording shows its filename, file size, and a native `<audio>` player for in-page playback.
- **Download** any recording with one click. **Delete** individual recordings with confirmation.

### Video notes
- **Record** video + audio simultaneously; a live camera preview is shown while recording.
- Same auto-save and immediate-display behaviour as audio.
- **Upload** existing video files from disk.
- Recorded videos are playable inline via a native `<video>` player.
- Download and delete per-clip.

### Photo notes
- **Capture** a photo directly from the device camera (opens a live viewfinder; click Capture to snap).
- **Upload** existing image files from disk.
- Captured and uploaded photos are displayed as thumbnails in a gallery grid.
- Download and delete per-photo.

### Drawing notes
- Full **canvas drawing tool** powered by the Pointer Events API (works with mouse and touch/stylus).
- Colour palette with 8 swatches, adjustable brush size, and an eraser tool.
- Click **Save Drawing** to append the canvas as a PNG to the note; the canvas resets for the next drawing.
- Download and delete per-drawing.

### Attachment storage
Binary blobs (audio, video, photos, drawings) are stored in **IndexedDB** via `AttachmentStoreService` — localStorage is limited to ~5 MB and strings only. Note metadata (title, attachment list) stays in localStorage as before.

### Change detection
All native browser callbacks (`MediaRecorder.onstop`, `canvas.toBlob`) run outside Angular's Zone.js. Every callback is wrapped in `NgZone.run()` so that emitting an attachment event and the subsequent IndexedDB round-trip all run inside the zone and trigger change detection automatically — no manual refresh needed.

---

## Features — Task 3: Export & Import

Export and import all your notes, including media attachments, as a single portable file.

### Export
- Click **Export** in the top-right header (disabled when there are no notes).
- Downloads a `.noted` file — a JSON document containing every note's full metadata plus all attachment blobs encoded as base64 strings.
- The file is self-contained: audio clips, videos, photos, and drawings travel with it, ready to be imported on any device or browser.
- Filename includes the export date: `noted-export-YYYY-MM-DD.noted`.

### Import
- Click **Import** and select a `.noted` file.
- Each note in the file is matched against existing notes by **id**.
- **Deduplication / merge rule — last writer wins:**
  - Note not found locally → imported as new.
  - Note found, incoming `updatedAt` is newer → existing note is replaced (old blobs removed from IndexedDB, new blobs written, metadata updated).
  - Note found, existing `updatedAt` is the same or newer → skipped, no changes made.
- Exporting and immediately importing is always a no-op — all timestamps match so every note is skipped.
- A brief toast confirms the result: e.g. `"3 imported, 1 updated, 2 skipped"`.

---

## Architecture

```
src/app/
  models/
    note.model.ts              ← Note, ChecklistItem, Attachment, NoteType
  services/
    notes.service.ts           ← BehaviorSubject, CRUD, localStorage, filter/sort
    attachment-store.service.ts← IndexedDB wrapper for binary blobs (NgZone-aware)
    export-import.service.ts   ← .noted file serialisation, base64 encode/decode, merge logic
  components/
    type-picker/               ← modal overlay to pick note type (6 types)
    note-card/                 ← card shown in the grid
    home/                      ← page: grid + toolbar + FAB + export/import buttons
    note-editor/               ← create / edit view; manages attachment lifecycle
    attachments/
      audio-attachment/        ← MediaRecorder recording + file upload + player list
      video-attachment/        ← MediaRecorder video recording + live preview + player list
      photo-attachment/        ← camera capture + file upload + thumbnail gallery
      drawing-attachment/      ← canvas drawing tool + saved drawings gallery
```

**Component data flow**
- `NotesService` owns note state via `BehaviorSubject<Note[]>`.
- `HomeComponent` subscribes and re-runs `applyFilters()` on every change.
- `NoteEditorComponent` deep-copies the note on load; tracks `sessionAddedIds` and `pendingRemovalIds` to clean up orphaned blobs whether the user saves or cancels.
- Attachment components emit `attachmentAdded` / `attachmentRemoved` events; the editor manages all IDB writes and metadata updates.
- No external UI library — all styles are hand-written SCSS using CSS custom properties.

---

## Trade-offs & known limitations

- **No undo/redo** — discarding unsaved changes requires navigating back without saving.
- **No drag-to-reorder** for checklist items.
- **localStorage + IndexedDB only** — data is per-browser, not synced across devices. Use Export/Import to move notes between browsers or devices.
- **Export file size** — large video recordings embedded as base64 will produce large `.noted` files. There is no compression applied.
- `window.confirm()` is used for delete confirmation (simple, but not styleable).
