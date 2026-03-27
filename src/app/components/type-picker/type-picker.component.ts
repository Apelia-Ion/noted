import { Component, Output, EventEmitter } from '@angular/core';
import { NoteType } from '../../models/note.model';

/**
 * TypePickerComponent is a modal overlay that lets the user choose between
 * creating a plain text note or a checklist note.
 * It emits the chosen type upward and lets the parent handle navigation.
 */
@Component({
  selector: 'app-type-picker',
  standalone: true,
  templateUrl: './type-picker.component.html',
  styleUrl: './type-picker.component.scss',
})
export class TypePickerComponent {
  @Output() typeSelected = new EventEmitter<NoteType>();
  @Output() cancel = new EventEmitter<void>();

  select(type: NoteType): void {
    this.typeSelected.emit(type);
  }
}
