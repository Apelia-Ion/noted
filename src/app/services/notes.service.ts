import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Note, NoteType, ChecklistItem } from '../models/note.model';

export type SortOption = 'newest' | 'oldest' | 'modified' | 'title';
export type FilterOption = 'all' | 'text' | 'checklist';

/**
 * NotesService is the single source of truth.
 * It exposes notes$ (BehaviorSubject) so components can react to changes,
 * and persists every mutation to localStorage automatically.
 *
 * localStorage is accessed only when window is available so the service
 * also works safely during SSR (server-side rendering pre-pass).
 */
@Injectable({ providedIn: 'root' })
export class NotesService {
  private readonly STORAGE_KEY = 'noted_notes';

  // BehaviorSubject holds the current list and replays the latest value
  // to any new subscriber — no need for an initial HTTP load.
  private _notes$ = new BehaviorSubject<Note[]>([]);
  readonly notes$ = this._notes$.asObservable();

  constructor() {
    this.loadFromStorage();
  }

  // ── Persistence ───────────────────────────────────────────────────────────

  private loadFromStorage(): void {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (raw) this._notes$.next(JSON.parse(raw));
    } catch {
      this._notes$.next([]);
    }
  }

  private persist(): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this._notes$.value));
  }

  // ── Reads ─────────────────────────────────────────────────────────────────

  getNote(id: string): Note | undefined {
    return this._notes$.value.find(n => n.id === id);
  }

  // ── Factory ───────────────────────────────────────────────────────────────

  /** Returns a new unsaved Note object (caller decides when to persist it). */
  buildNew(type: NoteType): Note {
    const now = new Date().toISOString();
    return {
      id: crypto.randomUUID(),
      title: '',
      type,
      content: '',
      items: [],
      createdAt: now,
      updatedAt: now,
    };
  }

  /** Convenience helper to build a blank checklist item. */
  buildItem(text = ''): ChecklistItem {
    return { id: crypto.randomUUID(), text, checked: false };
  }

  // ── Mutations ─────────────────────────────────────────────────────────────

  /**
   * Upsert: if a note with the same id exists it is replaced; otherwise it is
   * prepended to the list so new notes appear first.
   * updatedAt is always refreshed on every save.
   */
  save(note: Note): void {
    const list = this._notes$.value;
    const idx = list.findIndex(n => n.id === note.id);
    const updated: Note = { ...note, updatedAt: new Date().toISOString() };

    if (idx >= 0) {
      const next = [...list];
      next[idx] = updated;
      this._notes$.next(next);
    } else {
      this._notes$.next([updated, ...list]);
    }
    this.persist();
  }

  delete(id: string): void {
    this._notes$.next(this._notes$.value.filter(n => n.id !== id));
    this.persist();
  }

  // ── Query helpers ─────────────────────────────────────────────────────────

  /**
   * Pure function — takes a snapshot of notes and returns a filtered + sorted
   * copy. Nothing is mutated; the BehaviorSubject stays untouched.
   *
   * Search matches title, content text, and checklist item text.
   */
  applyFilters(
    notes: Note[],
    search: string,
    type: FilterOption,
    sort: SortOption,
  ): Note[] {
    let result = [...notes];

    if (type !== 'all') {
      result = result.filter(n => n.type === type);
    }

    const q = search.trim().toLowerCase();
    if (q) {
      result = result.filter(
        n =>
          n.title.toLowerCase().includes(q) ||
          n.content.toLowerCase().includes(q) ||
          n.items.some(i => i.text.toLowerCase().includes(q)),
      );
    }

    switch (sort) {
      case 'newest':   result.sort((a, b) => b.createdAt.localeCompare(a.createdAt)); break;
      case 'oldest':   result.sort((a, b) => a.createdAt.localeCompare(b.createdAt)); break;
      case 'modified': result.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)); break;
      case 'title':
        result.sort((a, b) =>
          (a.title || '\uFFFF').localeCompare(b.title || '\uFFFF'),
        );
        break;
    }

    return result;
  }
}
