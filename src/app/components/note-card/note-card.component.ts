import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { Note } from '../../models/note.model';

@Component({
  selector: 'app-note-card',
  standalone: true,
  imports: [CommonModule, DatePipe],
  templateUrl: './note-card.component.html',
  styleUrl: './note-card.component.scss',
})
export class NoteCardComponent {
  @Input() note!: Note;
  @Output() deleteNote = new EventEmitter<void>();

  constructor(private router: Router) {}

  goToEdit(): void { this.router.navigate(['/note', this.note.id]); }

  onDelete(event: MouseEvent): void {
    event.stopPropagation();
    if (confirm('Delete this note? This cannot be undone.')) this.deleteNote.emit();
  }

  get isUntitled(): boolean  { return !this.note.title.trim(); }
  get displayTitle(): string { return this.note.title.trim() || 'Untitled'; }

  get preview(): string {
    if (!this.note.content) return '';
    return this.note.content.length > 160
      ? this.note.content.slice(0, 160) + '…'
      : this.note.content;
  }

  get visibleItems()        { return this.note.items.slice(0, 4); }
  get hiddenCount(): number { return Math.max(0, this.note.items.length - 4); }

  /** "2/5 done" shown when no text preview is available but items exist. */
  get checklistSummary(): string | null {
    const items = this.note.items ?? [];
    if (!items.length) return null;
    const done = items.filter(i => i.checked).length;
    return `${done} / ${items.length} done`;
  }

  /**
   * Multi-type summary, e.g. "4 recordings · 2 photos · 1 drawing".
   * Only includes types that actually have attachments.
   */
  get attachmentSummary(): string | null {
    const atts = this.note.attachments ?? [];
    if (!atts.length) return null;

    const recordings = atts.filter(a => a.mimeType?.startsWith('audio/')).length;
    const videos     = atts.filter(a => a.mimeType?.startsWith('video/')).length;
    const photos     = atts.filter(a => a.mimeType?.startsWith('image/') && !a.name?.startsWith('drawing-')).length;
    const drawings   = atts.filter(a => a.name?.startsWith('drawing-')).length;

    const parts: string[] = [];
    if (recordings) parts.push(`${recordings} ${recordings === 1 ? 'recording' : 'recordings'}`);
    if (videos)     parts.push(`${videos} ${videos === 1 ? 'video' : 'videos'}`);
    if (photos)     parts.push(`${photos} ${photos === 1 ? 'photo' : 'photos'}`);
    if (drawings)   parts.push(`${drawings} ${drawings === 1 ? 'drawing' : 'drawings'}`);

    return parts.length ? parts.join(' · ') : null;
  }
}
