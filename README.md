# Noted — Notes App (Hackathon Task 1)

A web application for writing notes and shopping lists, built with **Angular 17** (standalone components).

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

## Features (Task 1)

| Feature | Detail |
|---|---|
| **Two note types** | Text notes and Checklist notes |
| **Homepage grid** | Responsive card grid, auto-adjusts columns |
| **Create** | FAB → type picker modal → editor |
| **Edit** | Click any card to open the editor |
| **Delete** | Hover a card to reveal the trash icon; confirm dialog |
| **Checklist UX** | Check/uncheck items, Enter adds a new item below, Backspace on empty item removes it |
| **Search** | Real-time search across title, content, and checklist item text |
| **Filter** | All / Text / Lists tabs |
| **Sort** | Newest first, Oldest first, Last modified, Title A–Z |
| **Persistence** | All notes saved to `localStorage`; survive page refresh |
| **Dates** | Created and modified timestamps shown in editor and on cards |

---

## Architecture

```
src/app/
  models/
    note.model.ts            ← Note, ChecklistItem, NoteType
  services/
    notes.service.ts         ← BehaviorSubject, CRUD, localStorage, filter/sort
  components/
    type-picker/             ← modal overlay to pick note type
    note-card/               ← card shown in the grid
    home/                    ← page: grid + toolbar + FAB
    note-editor/             ← create / edit view
```

**Component data flow**
- `NotesService` owns state via `BehaviorSubject<Note[]>`.
- `HomeComponent` subscribes and re-runs `applyFilters()` on every change.
- `NoteEditorComponent` deep-copies the note on load; only writes back on explicit Save.
- No external UI library — all styles are hand-written SCSS using CSS custom properties.

---

## Trade-offs & known limitations

- **No undo/redo** — discarding unsaved changes requires navigating back without saving.
- **No drag-to-reorder** for checklist items (out of scope for Task 1).
- **localStorage only** — data is per-browser, not synced across devices.
- **No SSR hydration for localStorage** — the service guards against `window` being undefined, but the app is designed to run client-side.
- `window.confirm()` is used for delete confirmation (simple, but not styleable).
