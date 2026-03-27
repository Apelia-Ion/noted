import { Routes } from '@angular/router';
import { HomeComponent } from './components/home/home.component';
import { NoteEditorComponent } from './components/note-editor/note-editor.component';

export const routes: Routes = [
  { path: '',          component: HomeComponent },
  { path: 'note/new',  component: NoteEditorComponent },  // ?type=text|checklist
  { path: 'note/:id',  component: NoteEditorComponent },  // edit existing
  { path: '**',        redirectTo: '' },
];
