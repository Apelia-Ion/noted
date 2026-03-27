import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Note, NoteType, ChecklistItem, MEDIA_NOTE_TYPES } from '../models/note.model';
import { AttachmentStoreService } from './attachment-store.service';

export type SortOption = 'newest' | 'oldest' | 'modified' | 'title';
/** 'media' matches all four media types (audio / video / photo / drawing). */
export type FilterOption = 'all' | 'text' | 'checklist' | 'media';

@Injectable({ providedIn: 'root' })
export class NotesService {
  private readonly STORAGE_KEY = 'noted_notes';
  private _notes$ = new BehaviorSubject<Note[]>([]);
  readonly notes$ = this._notes$.asObservable();

  constructor(private attachmentStore: AttachmentStoreService) {
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

  buildNew(type: NoteType): Note {
    const now = new Date().toISOString();
    return { id: crypto.randomUUID(), title: '', type, content: '', items: [], attachments: [], createdAt: now, updatedAt: now };
  }

  buildItem(text = ''): ChecklistItem {
    return { id: crypto.randomUUID(), text, checked: false };
  }

  // ── Mutations ─────────────────────────────────────────────────────────────

  save(note: Note): void {
    const list = this._notes$.value;
    const idx  = list.findIndex(n => n.id === note.id);
    const updated: Note = { ...note, updatedAt: new Date().toISOString() };
    if (idx >= 0) {
      const next = [...list]; next[idx] = updated; this._notes$.next(next);
    } else {
      this._notes$.next([updated, ...list]);
    }
    this.persist();
  }

  /**
   * Deletes a note and asynchronously removes any associated blobs from IndexedDB.
   * The note is removed from the BehaviorSubject and localStorage synchronously;
   * blob cleanup happens in the background without blocking the UI.
   */
  delete(id: string): void {
    const note = this.getNote(id);
    if (note?.attachments?.length) {
      this.attachmentStore.deleteMany(note.attachments.map(a => a.id));
    }
    this._notes$.next(this._notes$.value.filter(n => n.id !== id));
    this.persist();
  }

  // ── Query helpers ─────────────────────────────────────────────────────────

  applyFilters(notes: Note[], search: string, type: FilterOption, sort: SortOption): Note[] {
    let result = [...notes];

    if (type === 'media') {
      result = result.filter(n => (MEDIA_NOTE_TYPES as readonly string[]).includes(n.type));
    } else if (type !== 'all') {
      result = result.filter(n => n.type === type);
    }

    const q = search.trim().toLowerCase();
    if (q) {
      result = result.filter(n =>
        n.title.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q) ||
        n.items.some(i => i.text.toLowerCase().includes(q)),
      );
    }

    switch (sort) {
      case 'newest':   result.sort((a, b) => b.createdAt.localeCompare(a.createdAt)); break;
      case 'oldest':   result.sort((a, b) => a.createdAt.localeCompare(b.createdAt)); break;
      case 'modified': result.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)); break;
      case 'title':    result.sort((a, b) => (a.title || '\uFFFF').localeCompare(b.title || '\uFFFF')); break;
    }

    return result;
  }
}
