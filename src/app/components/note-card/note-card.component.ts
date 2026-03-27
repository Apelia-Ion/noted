import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { Note } from '../../models/note.model';

/**
 * NoteCardComponent displays a single note in the home grid.
 *
 * Text notes show a truncated content preview.
 * Checklist notes show the first four items with their checked state.
 *
 * Clicking the card navigates to the editor.
 * Clicking the delete button (with stopPropagation) emits deleteNote.
 */
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

  goToEdit(): void {
    this.router.navigate(['/note', this.note.id]);
  }

  onDelete(event: MouseEvent): void {
    event.stopPropagation();
    if (confirm('Delete this note? This cannot be undone.')) {
      this.deleteNote.emit();
    }
  }

  get preview(): string {
    if (!this.note.content) return '';
    return this.note.content.length > 160
      ? this.note.content.slice(0, 160) + '…'
      : this.note.content;
  }

  /** Only show up to 4 items to keep the card compact. */
  get visibleItems() {
    return this.note.items.slice(0, 4);
  }

  get hiddenCount(): number {
    return Math.max(0, this.note.items.length - 4);
  }

  get displayTitle(): string {
    return this.note.title.trim() || 'Untitled';
  }

  get isUntitled(): boolean {
    return !this.note.title.trim();
  }
}
