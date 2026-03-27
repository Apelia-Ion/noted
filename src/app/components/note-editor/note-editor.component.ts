import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { Note, ChecklistItem } from '../../models/note.model';
import { NotesService } from '../../services/notes.service';

/**
 * NoteEditorComponent handles both creating and editing a note.
 *
 * Create flow  → route /note/new?type=text|checklist
 *   - buildNew() creates an in-memory Note (not persisted yet)
 *   - Save button calls notesService.save() and goes back to home
 *
 * Edit flow    → route /note/:id
 *   - Loads note from service; a deep copy is kept so unsaved edits
 *     don't mutate the service state directly
 *   - Save overwrites the original via upsert
 *
 * Checklist UX:
 *   - Enter in an item input creates a new item below it
 *   - Backspace on an empty item deletes it and focuses the previous one
 *   - The last item is never removed via Backspace (at least one must exist)
 */
@Component({
  selector: 'app-note-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe],
  templateUrl: './note-editor.component.html',
  styleUrl: './note-editor.component.scss',
})
export class NoteEditorComponent implements OnInit {
  note!: Note;
  isNew = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private notesService: NotesService,
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    const type = this.route.snapshot.queryParamMap.get('type') as 'text' | 'checklist' | null;

    if (id) {
      // Edit existing note
      const existing = this.notesService.getNote(id);
      if (!existing) {
        this.router.navigate(['/']);
        return;
      }
      // Deep copy so edits don't touch the service state until Save
      this.note = {
        ...existing,
        items: existing.items.map(i => ({ ...i })),
      };
    } else {
      // Create new note
      this.isNew = true;
      this.note = this.notesService.buildNew(type ?? 'text');
      if (this.note.type === 'checklist') {
        // Start with one blank item so the input is ready
        this.note.items.push(this.notesService.buildItem());
      }
    }
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  save(): void {
    this.notesService.save(this.note);
    this.router.navigate(['/']);
  }

  goBack(): void {
    this.router.navigate(['/']);
  }

  // ── Checklist helpers ─────────────────────────────────────────────────────

  addItemAfter(index?: number): void {
    const item = this.notesService.buildItem();
    if (index === undefined) {
      this.note.items.push(item);
    } else {
      this.note.items.splice(index + 1, 0, item);
    }
    // Focus the new input on the next tick (after Angular renders it)
    this.focusItemAt(index === undefined ? this.note.items.length - 1 : index + 1);
  }

  removeItem(index: number): void {
    this.note.items.splice(index, 1);
  }

  onItemKeydown(event: KeyboardEvent, index: number): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.addItemAfter(index);
    } else if (event.key === 'Backspace') {
      const item = this.note.items[index];
      if (item.text === '' && this.note.items.length > 1) {
        event.preventDefault();
        this.removeItem(index);
        this.focusItemAt(Math.max(0, index - 1));
      }
    }
  }

  private focusItemAt(index: number): void {
    setTimeout(() => {
      const inputs = document.querySelectorAll<HTMLInputElement>('.item-input');
      inputs[index]?.focus();
    }, 0);
  }

  // ── Checklist stats (shown in editor) ────────────────────────────────────

  get checkedCount(): number {
    return this.note.items.filter(i => i.checked).length;
  }

  trackItem(_: number, item: ChecklistItem): string {
    return item.id;
  }
}
