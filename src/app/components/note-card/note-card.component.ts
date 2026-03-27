import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { Note, NoteType, isMediaNote } from '../../models/note.model';

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
  get isMedia(): boolean     { return isMediaNote(this.note.type); }

  get preview(): string {
    if (!this.note.content) return '';
    return this.note.content.length > 160
      ? this.note.content.slice(0, 160) + '…'
      : this.note.content;
  }

  get visibleItems()   { return this.note.items.slice(0, 4); }
  get hiddenCount(): number { return Math.max(0, this.note.items.length - 4); }

  /** Human-readable attachment count, e.g. "3 recordings". */
  get attachmentLabel(): string | null {
    const count = this.note.attachments?.length ?? 0;
    if (!count) return null;
    const singular: Record<NoteType, string> = {
      text: '', checklist: '',
      audio: 'recording', video: 'video', photo: 'photo', drawing: 'drawing',
    };
    const plural: Record<NoteType, string> = {
      text: '', checklist: '',
      audio: 'recordings', video: 'videos', photo: 'photos', drawing: 'drawings',
    };
    const label = count === 1 ? singular[this.note.type] : plural[this.note.type];
    return `${count} ${label}`;
  }

  /** Short human label for the badge. */
  typeLabel(): string {
    const map: Record<NoteType, string> = {
      text: 'Text', checklist: 'List',
      audio: 'Audio', video: 'Video', photo: 'Photo', drawing: 'Drawing',
    };
    return map[this.note.type] ?? this.note.type;
  }
}
