import { Component, DestroyRef, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { OperationsApiService } from '../../core/services/operations-api.service';
import { CreateUserRequest } from '../../core/models/api.models';
import { NoticeService } from '../../core/state/notice.service';
import { apiError } from '../../core/utils/api-error';
@Component({ standalone: true, selector: 'app-team-form', imports: [FormsModule], template: `
<section class="panel workflow-panel" aria-labelledby="team-form-heading"><div class="panel-heading"><h2 id="team-form-heading">Add a team member</h2><button class="secondary-button" type="button" (click)="closed.emit()" [disabled]="busy()">Close</button></div>
@if (error()) { <p class="inline-error" role="alert">{{ error() }}</p> }
<form #userForm="ngForm" (ngSubmit)="save()"><fieldset [disabled]="busy()"><div class="form-grid"><label class="form-field">Username<input name="username" [(ngModel)]="form.username" autocomplete="off" required></label><label class="form-field">Email<input name="email" type="email" email [(ngModel)]="form.email" required></label><label class="form-field">Initial password<input name="password" type="password" [(ngModel)]="form.password" autocomplete="new-password" required></label><label class="form-field">Role<select name="role" [(ngModel)]="form.role"><option value="User">Team member</option><option value="Admin">Administrator</option></select></label></div><button class="primary-button" type="submit" [disabled]="userForm.invalid || !form.username.trim() || busy()">{{ busy() ? 'Creating…' : 'Create team member' }}</button></fieldset></form></section>` })
export class TeamFormComponent {
 readonly closed = output<void>(); readonly changed = output<void>(); private readonly api = inject(OperationsApiService); private readonly notices = inject(NoticeService); private readonly destroyRef = inject(DestroyRef);
 readonly busy = signal(false); readonly error = signal(''); form: CreateUserRequest = { username:'', email:'', password:'', role:'User' };
 save(): void { if (this.busy() || !this.form.username.trim() || !this.form.email.trim() || !this.form.password) return; this.busy.set(true); this.error.set(''); this.api.createUser({ ...this.form, username:this.form.username.trim(), email:this.form.email.trim() }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: () => { this.form.password = ''; this.notices.show('Team member created'); this.changed.emit(); this.closed.emit(); }, error: e => { this.error.set(apiError(e)); this.busy.set(false); } }); }
}
