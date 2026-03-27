import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';

import { Note, NoteType } from '../../models/note.model';
import { NotesService, FilterOption, SortOption } from '../../services/notes.service';
import { ExportImportService } from '../../services/export-import.service';
import { NoteCardComponent } from '../note-card/note-card.component';
import { TypePickerComponent } from '../type-picker/type-picker.component';

/**
 * HomeComponent is the main page.
 *
 * It subscribes to the NotesService stream and runs the notes through
 * applyFilters() whenever the list, search query, filter, or sort changes.
 *
 * Lifecycle:
 *  - subscribe in ngOnInit, unsubscribe in ngOnDestroy (no leaks).
 *  - showTypePicker drives the overlay visibility.
 */
@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule, NoteCardComponent, TypePickerComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent implements OnInit, OnDestroy {
  allNotes: Note[] = [];
  filteredNotes: Note[] = [];

  searchQuery = '';
  filterType: FilterOption = 'all';
  sortBy: SortOption = 'newest';
  showTypePicker = false;

  importStatus: string | null = null;
  exporting = false;
  private importStatusTimer?: ReturnType<typeof setTimeout>;
  private sub?: Subscription;

  constructor(
    private notesService: NotesService,
    private router: Router,
    private exportImport: ExportImportService,
  ) {}

  ngOnInit(): void {
    this.sub = this.notesService.notes$.subscribe(notes => {
      this.allNotes = notes;
      this.applyFilters();
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    clearTimeout(this.importStatusTimer);
  }

  applyFilters(): void {
    this.filteredNotes = this.notesService.applyFilters(
      this.allNotes,
      this.searchQuery,
      this.filterType,
      this.sortBy,
    );
  }

  setFilter(type: FilterOption): void {
    this.filterType = type;
    this.applyFilters();
  }

  onTypeSelected(type: NoteType): void {
    this.showTypePicker = false;
    this.router.navigate(['/note/new'], { queryParams: { type } });
  }

  onDeleteNote(id: string): void {
    this.notesService.delete(id);
  }

  get totalCount(): number {
    return this.allNotes.length;
  }

  // ── Export / Import ───────────────────────────────────────────────────────

  async onExport(): Promise<void> {
    this.exporting = true;
    try {
      await this.exportImport.exportAll();
    } finally {
      this.exporting = false;
    }
  }

  async onImport(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    (event.target as HTMLInputElement).value = '';
    if (!file) return;

    try {
      const result = await this.exportImport.importFile(file);
      const parts: string[] = [];
      if (result.imported) parts.push(`${result.imported} imported`);
      if (result.updated)  parts.push(`${result.updated} updated`);
      if (result.skipped)  parts.push(`${result.skipped} skipped`);
      this.showStatus(parts.length ? parts.join(', ') : 'Nothing to import');
    } catch (err) {
      this.showStatus((err as Error).message);
    }
  }

  private showStatus(msg: string): void {
    this.importStatus = msg;
    clearTimeout(this.importStatusTimer);
    this.importStatusTimer = setTimeout(() => { this.importStatus = null; }, 4000);
  }
}
