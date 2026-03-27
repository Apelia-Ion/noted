import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { Note, ChecklistItem, Attachment, isMediaNote } from '../../models/note.model';
import { NotesService } from '../../services/notes.service';
import { AttachmentStoreService } from '../../services/attachment-store.service';
import { AudioAttachmentComponent }   from '../attachments/audio-attachment/audio-attachment.component';
import { VideoAttachmentComponent }   from '../attachments/video-attachment/video-attachment.component';
import { PhotoAttachmentComponent }   from '../attachments/photo-attachment/photo-attachment.component';
import { DrawingAttachmentComponent } from '../attachments/drawing-attachment/drawing-attachment.component';

/**
 * NoteEditorComponent handles create and edit for all six note types.
 *
 * Attachment lifecycle
 * ─────────────────────
 * When the user adds an attachment the blob is saved to IndexedDB immediately
 * (so the attachment component can display it). Its ID is tracked in
 * `sessionAddedIds`.
 *
 * When the user removes an attachment the metadata is removed from the
 * in-memory note and the ID is moved to `pendingRemovalIds` — the blob is NOT
 * deleted yet, so a "back without save" leaves IDB untouched.
 *
 * Special case: if the user removes an attachment that was added in the same
 * session (never saved), it is deleted from IDB immediately and removed from
 * `sessionAddedIds`.
 *
 * On Save
 *   → delete `pendingRemovalIds` blobs from IDB, persist note to localStorage.
 *
 * On Back / Destroy without Save
 *   → delete `sessionAddedIds` blobs from IDB (they were never saved to a note).
 *     `pendingRemovalIds` are left alone (the original note still references them).
 */
@Component({
  selector: 'app-note-editor',
  standalone: true,
  imports: [
    CommonModule, FormsModule, DatePipe,
    AudioAttachmentComponent, VideoAttachmentComponent,
    PhotoAttachmentComponent, DrawingAttachmentComponent,
  ],
  templateUrl: './note-editor.component.html',
  styleUrl: './note-editor.component.scss',
})
export class NoteEditorComponent implements OnInit, OnDestroy {
  note!: Note;
  isNew = false;
  readonly isMediaNote = isMediaNote;

  private savedSuccessfully = false;
  private sessionAddedIds:  string[] = [];
  private pendingRemovalIds: string[] = [];

  constructor(
    private route:  ActivatedRoute,
    private router: Router,
    private notesService:    NotesService,
    private attachmentStore: AttachmentStoreService,
  ) {}

  ngOnInit(): void {
    const id   = this.route.snapshot.paramMap.get('id');
    const type = this.route.snapshot.queryParamMap.get('type') as 'text' | 'checklist' | 'audio' | 'video' | 'photo' | 'drawing' | null;

    if (id) {
      const existing = this.notesService.getNote(id);
      if (!existing) { this.router.navigate(['/']); return; }
      this.note = { ...existing, items: existing.items.map(i => ({ ...i })), attachments: [...existing.attachments] };
    } else {
      this.isNew = true;
      this.note  = this.notesService.buildNew(type ?? 'text');
      if (this.note.type === 'checklist') {
        this.note.items.push(this.notesService.buildItem());
      }
    }
  }

  ngOnDestroy(): void {
    if (!this.savedSuccessfully) {
      // Blobs added in this session were never tied to a persisted note — clean them up.
      this.attachmentStore.deleteMany(this.sessionAddedIds);
    }
  }

  // ── Persist ───────────────────────────────────────────────────────────────

  async save(): Promise<void> {
    // First delete blobs the user removed during this session
    await this.attachmentStore.deleteMany(this.pendingRemovalIds);
    this.savedSuccessfully = true;
    this.notesService.save(this.note);
    this.router.navigate(['/']);
  }

  goBack(): void { this.router.navigate(['/']); }

  // ── Checklist helpers ─────────────────────────────────────────────────────

  addItemAfter(index?: number): void {
    const item = this.notesService.buildItem();
    index === undefined ? this.note.items.push(item) : this.note.items.splice(index + 1, 0, item);
    const target = index === undefined ? this.note.items.length - 1 : index + 1;
    setTimeout(() => {
      const inputs = document.querySelectorAll<HTMLInputElement>('.item-input');
      inputs[target]?.focus();
    }, 0);
  }

  removeItem(index: number): void { this.note.items.splice(index, 1); }

  onItemKeydown(event: KeyboardEvent, index: number): void {
    if (event.key === 'Enter') { event.preventDefault(); this.addItemAfter(index); }
    else if (event.key === 'Backspace' && this.note.items[index].text === '' && this.note.items.length > 1) {
      event.preventDefault();
      this.removeItem(index);
      setTimeout(() => {
        const inputs = document.querySelectorAll<HTMLInputElement>('.item-input');
        inputs[Math.max(0, index - 1)]?.focus();
      }, 0);
    }
  }

  get checkedCount(): number { return this.note.items.filter(i => i.checked).length; }

  trackItem(_: number, item: ChecklistItem): string { return item.id; }

  // ── Attachment events (emitted by child components) ───────────────────────

  async onAttachmentAdded(data: { blob: Blob; name: string; mimeType: string }): Promise<void> {
    const id = crypto.randomUUID();
    await this.attachmentStore.save(id, data.blob);

    const meta: Attachment = {
      id,
      name:      data.name,
      mimeType:  data.mimeType,
      size:      data.blob.size,
      createdAt: new Date().toISOString(),
    };
    // Push a new array reference so child @Input setter fires
    this.note.attachments = [...this.note.attachments, meta];
    this.sessionAddedIds.push(id);
  }

  onAttachmentRemoved(id: string): void {
    if (this.sessionAddedIds.includes(id)) {
      // Added and removed in the same session — delete immediately
      this.sessionAddedIds = this.sessionAddedIds.filter(s => s !== id);
      this.attachmentStore.delete(id);
    } else {
      // Previously persisted — mark for deletion on Save
      this.pendingRemovalIds.push(id);
    }
    this.note.attachments = this.note.attachments.filter(a => a.id !== id);
  }
}
