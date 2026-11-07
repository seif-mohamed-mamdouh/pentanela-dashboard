import { Injectable, signal } from '@angular/core';
export interface WorkspaceNotice { tone: 'info' | 'success' | 'warning' | 'error'; title: string; message: string; }
export const WELCOME_NOTICE: WorkspaceNotice = { tone: 'info', title: 'A clear view of your operations.', message: 'Review your vendor connections and keep your next steps in sight.' };
@Injectable({ providedIn: 'root' })
export class NoticeService {
 readonly current = signal<WorkspaceNotice | null>(WELCOME_NOTICE);
 show(title: string, message = '', tone: WorkspaceNotice['tone'] = 'success'): void { this.current.set({ title, message, tone }); }
 dismiss(): void { this.current.set(null); }
 restore(): void { this.current.set(WELCOME_NOTICE); }
}
