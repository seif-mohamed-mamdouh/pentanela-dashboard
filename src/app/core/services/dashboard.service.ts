import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { DashboardSummaryDto } from '../models/api.models';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly http = inject(HttpClient);
  summary(): Observable<DashboardSummaryDto> { return this.http.get<DashboardSummaryDto>('/api/dashboard/summary'); }
}