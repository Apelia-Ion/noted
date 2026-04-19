import { Component, OnInit, OnDestroy, NgZone } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { Note, ChecklistItem, Attachment } from '../../models/note.model';
import { NotesService } from '../../services/notes.service';
import { AttachmentStoreService } from '../../services/attachment-store.service';
import { AudioAttachmentComponent }   from '../attachments/audio-attachment/audio-attachment.component';
import { VideoAttachmentComponent }   from '../attachments/video-attachment/video-attachment.component';
import { PhotoAttachmentComponent }   from '../attachments/photo-attachment/photo-attachment.component';
import { DrawingAttachmentComponent } from '../attachments/drawing-attachment/drawing-attachment.component';

/**
 * NoteEditorComponent — universal layout.
 *
 * Every note shows all sections (title, text, checklist, audio, video,
 * photo, drawing).  For old typed notes only sections that have content
 * OR match the original type are shown, so backward compatibility is
 * preserved without any data migration.
 *
 * Attachment lifecycle
 * ─────────────────────
 * sessionAddedIds  — blobs added this session; deleted on cancel.
 * pendingRemovalIds — blobs marked for removal; deleted on Save.
 * Auto-save fires after every attachment add/update so the note is
 * persisted even if the user navigates away without clicking Save.
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

  private savedSuccessfully = false;
  private sessionAddedIds:   string[] = [];
  private pendingRemovalIds: string[] = [];

  constructor(
    private route:  ActivatedRoute,
    private router: Router,
    private notesService:    NotesService,
    private attachmentStore: AttachmentStoreService,
    private ngZone: NgZone,
  ) {}

  ngOnInit(): void {
    const id   = this.route.snapshot.paramMap.get('id');
    const type = this.route.snapshot.queryParamMap.get('type') as Note['type'] | null;

    if (id) {
      const existing = this.notesService.getNote(id);
      if (!existing) { this.router.navigate(['/']); return; }
      this.note = { ...existing, items: (existing.items ?? []).map(i => ({ ...i })), attachments: [...(existing.attachments ?? [])] };
    } else {
      this.isNew = true;
      this.note  = this.notesService.buildNew(type ?? 'universal');
    }
  }

  ngOnDestroy(): void {
    if (!this.savedSuccessfully) {
      this.attachmentStore.deleteMany(this.sessionAddedIds);
    }
  }

  // ── Section visibility ────────────────────────────────────────────────────

  /**
   * Returns true if a section should be rendered.
   *   • Universal notes: always show all sections.
   *   • Old typed notes: show if the section matches the original type
   *     OR the section has content in it.
   */
  showSection(section: 'text' | 'checklist' | 'audio' | 'video' | 'photo' | 'drawing'): boolean {
    if (this.note.type === 'universal') return true;
    if ((this.note.type as string) === section) return true;

    switch (section) {
      case 'text':      return !!this.note.content?.trim();
      case 'checklist': return (this.note.items?.length ?? 0) > 0;
      case 'audio':     return this.audioAttachments.length > 0;
      case 'video':     return this.videoAttachments.length > 0;
      case 'photo':     return this.photoAttachments.length > 0;
      case 'drawing':   return this.drawingAttachments.length > 0;
    }
  }

  // ── Filtered attachment arrays (each component gets only its own type) ────

  get audioAttachments(): Attachment[] {
    return this.note.attachments.filter(a => a.mimeType?.startsWith('audio/'));
  }
  get videoAttachments(): Attachment[] {
    return this.note.attachments.filter(a => a.mimeType?.startsWith('video/'));
  }
  get photoAttachments(): Attachment[] {
    return this.note.attachments.filter(
      a => a.mimeType?.startsWith('image/') && !a.name?.startsWith('drawing-'),
    );
  }
  get drawingAttachments(): Attachment[] {
    return this.note.attachments.filter(a => a.name?.startsWith('drawing-'));
  }

  // ── Persist ───────────────────────────────────────────────────────────────

  async save(): Promise<void> {
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

  // ── Attachment events ─────────────────────────────────────────────────────

  async onAttachmentAdded(data: { blob: Blob; name: string; mimeType: string }): Promise<void> {
    console.log('[editor] onAttachmentAdded called, blob size:', data.blob.size, 'name:', data.name);
    const id = crypto.randomUUID();
    try {
      console.log('[editor] saving blob to IndexedDB id:', id);
      await this.attachmentStore.save(id, data.blob);
      console.log('[editor] blob saved to IndexedDB ok');
    } catch (err) {
      console.error('[editor] Failed to save attachment blob:', err);
      return;
    }

    this.ngZone.run(() => {
      console.log('[editor] ngZone.run — updating note.attachments');
      const meta: Attachment = {
        id, name: data.name, mimeType: data.mimeType,
        size: data.blob.size, createdAt: new Date().toISOString(),
      };
      this.note.attachments = [...this.note.attachments, meta];
      console.log('[editor] note.attachments count now:', this.note.attachments.length);
      this.sessionAddedIds.push(id);
      this.savedSuccessfully = true;
      this.notesService.save(this.note);
    });
  }

  async onAttachmentUpdated(data: { id: string; blob: Blob }): Promise<void> {
    try {
      await this.attachmentStore.save(data.id, data.blob);
    } catch (err) {
      console.error('Failed to update attachment blob:', err);
      return;
    }
    this.ngZone.run(() => {
      this.note.attachments = this.note.attachments.map(a =>
        a.id === data.id ? { ...a, size: data.blob.size } : a,
      );
      this.savedSuccessfully = true;
      this.notesService.save(this.note);
    });
  }

  onAttachmentRemoved(id: string): void {
    if (this.sessionAddedIds.includes(id)) {
      this.sessionAddedIds = this.sessionAddedIds.filter(s => s !== id);
      this.attachmentStore.delete(id);
    } else {
      this.pendingRemovalIds.push(id);
    }
    this.note.attachments = this.note.attachments.filter(a => a.id !== id);
  }
}
