import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { ColComponent, RowComponent, TableDirective } from '@coreui/angular';
import { firstValueFrom } from 'rxjs';

interface SorDisplayItem {
  id: number;
  itemCode: string;
  itemName: string;
  unit: string;
  rate: string;
  chapter: number;
}

interface SorJsonItem {
  chapter: number;
  item_no: string;
  description: string;
  unit: string;
  rate: number;
}

interface SorJsonPayload {
  document?: string;
  extraction_range?: string;
  items?: SorJsonItem[];
  chapters?: Record<string, { name?: string; items?: SorJsonItem[] }>;
}

@Component({
  selector: 'app-sor-items',
  standalone: true,
  imports: [
    CommonModule,
    HttpClientModule,
    RowComponent,
    ColComponent,
    TableDirective
  ],
  template: `
    <c-row class="mt-4">
      <c-col xs="12">
        <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
          <h4 class="mb-0">SOR Items</h4>
          <small *ngIf="!isLoading" class="text-body-secondary">Showing {{ startItem }} to {{ endItem }} of {{ sorItems.length }}</small>
        </div>

        <div *ngIf="isLoading" class="text-center py-4 text-body-secondary">Loading SOR items...</div>

        <div *ngIf="!isLoading" class="table-responsive border rounded bg-white">
          <table cTable hover striped class="mb-0 align-middle">
            <thead>
              <tr>
                <th>#</th>
                <th>Item No</th>
                <th>Item</th>
                <th>Unit</th>
                <th>Rate</th>
                <th>Chapter</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let item of paginatedSorItems">
                <td>{{ item.id }}</td>
                <td>{{ item.itemCode }}</td>
                <td>{{ item.itemName }}</td>
                <td>{{ item.unit }}</td>
                <td>{{ item.rate }}</td>
                <td>{{ item.chapter }}</td>
              </tr>
              <tr *ngIf="!paginatedSorItems.length">
                <td colspan="6" class="text-center py-4 text-body-secondary">No SOR items found.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div *ngIf="!isLoading && sorItems.length > itemsPerPage" class="d-flex justify-content-end align-items-center gap-2 mt-3 flex-wrap">
          <button class="btn btn-outline-secondary btn-sm" (click)="goToPage(1)" [disabled]="currentPage === 1">First</button>
          <button class="btn btn-outline-secondary btn-sm" (click)="goToPage(currentPage - 1)" [disabled]="currentPage === 1">Previous</button>
          <span class="small text-body-secondary">Page {{ currentPage }} of {{ totalPages }}</span>
          <button class="btn btn-outline-secondary btn-sm" (click)="goToPage(currentPage + 1)" [disabled]="currentPage === totalPages">Next</button>
          <button class="btn btn-outline-secondary btn-sm" (click)="goToPage(totalPages)" [disabled]="currentPage === totalPages">Last</button>
        </div>
      </c-col>
    </c-row>
  `
})
export class SorItemsComponent implements OnInit {
  isLoading = false;
  sorItems: SorDisplayItem[] = [];
  currentPage = 1;
  readonly itemsPerPage = 10;

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) {}

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.sorItems.length / this.itemsPerPage));
  }

  get paginatedSorItems(): SorDisplayItem[] {
    const start = (this.currentPage - 1) * this.itemsPerPage;
    return this.sorItems.slice(start, start + this.itemsPerPage);
  }

  get startItem(): number {
    if (!this.sorItems.length) {
      return 0;
    }
    return (this.currentPage - 1) * this.itemsPerPage + 1;
  }

  get endItem(): number {
    return Math.min(this.currentPage * this.itemsPerPage, this.sorItems.length);
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  private extractSorItems(payload: SorJsonPayload): SorJsonItem[] {
    if (Array.isArray(payload.items)) {
      return payload.items;
    }

    const chapterEntries = Object.entries(payload.chapters || {});
    if (!chapterEntries.length) {
      return [];
    }

    const flattened: SorJsonItem[] = [];
    for (const [chapterKey, chapterData] of chapterEntries) {
      const chapterNo = Number(chapterKey);
      for (const item of chapterData?.items || []) {
        flattened.push({
          ...item,
          chapter: Number.isFinite(chapterNo) ? chapterNo : item.chapter
        });
      }
    }

    return flattened;
  }

  async ngOnInit(): Promise<void> {
    this.isLoading = true;
    try {
      const payload = await firstValueFrom(this.http.get<SorJsonPayload>('assets/converted/SOR.json'));
      const sourceItems = this.extractSorItems(payload);
      let index = 1;
      this.sorItems = [];

      // Items are already flattened with combined item_no and description
      for (const item of sourceItems) {
        this.sorItems.push({
          id: index++,
          itemCode: item.item_no || '-',
          itemName: item.description || '-',
          unit: item.unit || '-',
          rate: String(item.rate ?? '-'),
          chapter: item.chapter || 0
        });
      }

      this.currentPage = 1;
    } catch (error) {
      console.error('Failed to load SOR items', error);
      this.sorItems = [];
    } finally {
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }
}
