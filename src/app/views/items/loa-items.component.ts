import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { ColComponent, RowComponent, TableDirective } from '@coreui/angular';
import { firstValueFrom } from 'rxjs';

interface LoaDisplayItem {
  id: number;
  datasetLabel: string;
  sourceFile: string;
  schedule: string;
  itemCode: string;
  itemName: string;
  unit: string;
  qty: string;
  rate: string;
  amount: string;
  fileType: string;
}

interface LoaFileItem {
  sourceFile: string;
  schedule: string;
  itemNo: string;
  description: string;
  unit: string;
  qty: string;
  rate: string;
  amount: string;
  FileType: string;
}

interface LoaFilePayload {
  fileName: string;
  items: LoaFileItem[];
}

interface LoaCombinedSource {
  fileName: string;
  items: LoaFileItem[];
}

interface LoaCombinedPayload {
  allItems?: LoaFileItem[];
  items?: LoaFileItem[];
  files?: LoaCombinedSource[];
}

@Component({
  selector: 'app-loa-items',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    HttpClientModule,
    RowComponent,
    ColComponent,
    TableDirective
  ],
  template: `
    <c-row class="mt-4">
      <c-col xs="12">
        <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
          <h4 class="mb-0">LOA Items</h4>
          <small *ngIf="!isLoading" class="text-body-secondary">Showing {{ startItem }} to {{ endItem }} of {{ loaItems.length }}</small>
        </div>

        <div *ngIf="!isLoading" class="d-flex align-items-center gap-2 flex-wrap mb-3">
          <label class="small text-body-secondary">JSON:</label>
          <select class="form-select form-select-sm w-auto" [(ngModel)]="selectedDataset" (ngModelChange)="onDatasetChange()">
            <option *ngFor="let dataset of availableDatasets" [value]="dataset">{{ dataset }}</option>
          </select>

          <label class="small text-body-secondary">File:</label>
          <select class="form-select form-select-sm w-auto" [(ngModel)]="selectedFile" (ngModelChange)="onFileFilterChange()">
            <option value="ALL">All Files</option>
            <option *ngFor="let file of availableFiles" [value]="file">{{ file }}</option>
          </select>
        </div>

        <div *ngIf="isLoading" class="text-center py-4 text-body-secondary">Loading LOA items...</div>

        <div *ngIf="!isLoading" class="table-responsive border rounded bg-white">
          <table cTable hover striped class="mb-0 align-middle">
            <thead>
              <tr>
                <th>#</th>
                <th>File</th>
                <th>Schedule</th>
                <th>Item No</th>
                <th>Item</th>
                <th>Unit</th>
                <th>Qty</th>
                <th>Rate</th>
                <th>Amount</th>
                <th>FileType</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let item of paginatedLoaItems">
                <td>{{ item.id }}</td>
                <td>{{ item.sourceFile }}</td>
                <td>{{ item.schedule }}</td>
                <td>{{ item.itemCode }}</td>
                <td>{{ item.itemName }}</td>
                <td>{{ item.unit }}</td>
                <td>{{ item.qty }}</td>
                <td>{{ item.rate }}</td>
                <td>{{ item.amount }}</td>
                <td>
                  <span class="badge" [ngClass]="item.fileType === 'SOR' ? 'bg-success' : 'bg-danger'">{{ item.fileType }}</span>
                </td>
              </tr>
              <tr *ngIf="!paginatedLoaItems.length">
                <td colspan="10" class="text-center py-4 text-body-secondary">No LOA items found.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div *ngIf="!isLoading && loaItems.length > itemsPerPage" class="d-flex justify-content-end align-items-center gap-2 mt-3 flex-wrap">
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
export class LoaItemsComponent implements OnInit {
  isLoading = false;
  datasetItems: Record<string, LoaDisplayItem[]> = {};
  allLoaItems: LoaDisplayItem[] = [];
  loaItems: LoaDisplayItem[] = [];
  availableDatasets: string[] = [];
  availableFiles: string[] = [];
  selectedDataset = 'LOA_ITEMS_WITH_FILETYPE.json';
  selectedFile = 'ALL';
  currentPage = 1;
  readonly itemsPerPage = 10;

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) {}

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.loaItems.length / this.itemsPerPage));
  }

  get paginatedLoaItems(): LoaDisplayItem[] {
    const start = (this.currentPage - 1) * this.itemsPerPage;
    return this.loaItems.slice(start, start + this.itemsPerPage);
  }

  get startItem(): number {
    if (!this.loaItems.length) {
      return 0;
    }
    return (this.currentPage - 1) * this.itemsPerPage + 1;
  }

  get endItem(): number {
    return Math.min(this.currentPage * this.itemsPerPage, this.loaItems.length);
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  async ngOnInit(): Promise<void> {
    this.isLoading = true;
    try {
      const [abssPayload, combinedPayload, sttcPayload, zonalPayload] = await Promise.all([
        firstValueFrom(this.http.get<LoaFilePayload>('assets/Json/LOA/LOA_ABSS_WITH_FILETYPE.json')),
        firstValueFrom(this.http.get<LoaCombinedPayload>('assets/Json/LOA/LOA_ITEMS_WITH_FILETYPE.json')),
        firstValueFrom(this.http.get<LoaFilePayload>('assets/Json/LOA/STTC_WITH_FILETYPE.json')),
        firstValueFrom(this.http.get<LoaFilePayload>('assets/Json/LOA/ZONAL_2024_WITH_FILETYPE.json'))
      ]);

        this.datasetItems = {
          'LOA_ITEMS_WITH_FILETYPE.json': this.mapLoaItems(this.extractCombinedItems(combinedPayload), 'LOA_ITEMS_WITH_FILETYPE.json'),
          'LOA_ABSS_WITH_FILETYPE.json': this.mapLoaItems(abssPayload?.items || [], 'LOA_ABSS_WITH_FILETYPE.json'),
          'STTC_WITH_FILETYPE.json': this.mapLoaItems(sttcPayload?.items || [], 'STTC_WITH_FILETYPE.json'),
          'ZONAL_2024_WITH_FILETYPE.json': this.mapLoaItems(zonalPayload?.items || [], 'ZONAL_2024_WITH_FILETYPE.json')
        };

        this.availableDatasets = Object.keys(this.datasetItems);
        if (!this.availableDatasets.includes(this.selectedDataset)) {
          this.selectedDataset = this.availableDatasets[0] || 'LOA_ITEMS_WITH_FILETYPE.json';
        }

        this.applyDatasetAndFileFilter();
        this.currentPage = 1;
    } catch (error) {
      console.error('Failed to load LOA items', error);
      this.datasetItems = {};
      this.allLoaItems = [];
      this.loaItems = [];
      this.availableDatasets = [];
      this.availableFiles = [];
    } finally {
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }

  onDatasetChange(): void {
    this.selectedFile = 'ALL';
    this.applyDatasetAndFileFilter();
    this.currentPage = 1;
  }

  onFileFilterChange(): void {
    this.applyDatasetAndFileFilter();
    this.currentPage = 1;
  }

  private applyDatasetAndFileFilter(): void {
    this.allLoaItems = [...(this.datasetItems[this.selectedDataset] || [])];
    this.availableFiles = Array.from(new Set(this.allLoaItems.map(item => item.sourceFile))).sort();

    if (this.selectedFile === 'ALL') {
      this.loaItems = [...this.allLoaItems];
      return;
    }

    this.loaItems = this.allLoaItems.filter(item => item.sourceFile === this.selectedFile);
  }

  private mapLoaItems(items: LoaFileItem[], datasetLabel: string): LoaDisplayItem[] {
    return items.map((item, index) => ({
      id: index + 1,
      datasetLabel,
      sourceFile: item.sourceFile || '-',
      schedule: item.schedule || '-',
      itemCode: item.itemNo || '-',
      itemName: item.description || '-',
      unit: item.unit || '-',
      qty: item.qty || '-',
      rate: item.rate || '-',
      amount: item.amount || '-',
      fileType: item.FileType || 'NOT'
    }));
  }

  private extractCombinedItems(payload: LoaCombinedPayload | null | undefined): LoaFileItem[] {
    if (!payload) {
      return [];
    }

    if (payload.allItems?.length) {
      return payload.allItems;
    }

    if (payload.items?.length) {
      return payload.items;
    }

    return (payload.files || []).flatMap(file => file.items || []);
  }
}
