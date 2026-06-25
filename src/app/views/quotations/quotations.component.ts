import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import {
  CardComponent,
  CardHeaderComponent,
  CardBodyComponent,
  TableDirective,
  ButtonDirective,
  PageItemDirective,
  PageLinkDirective,
  PaginationComponent,
  RowComponent,
  ColComponent,
  ModalComponent,
  ModalHeaderComponent,
  ModalTitleDirective,
  ModalBodyComponent,
  ModalFooterComponent,
  ButtonCloseDirective,
  FormDirective,
  FormControlDirective
} from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';

interface Quotation {
  id: number;
  code: string;
  vendorName: string;
  itemsList: string;
  expiryDate: string;
  createdBy: string;
  createdDate: string;
}

@Component({
  selector: 'app-quotations',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    ReactiveFormsModule,
    CardComponent,
    CardHeaderComponent,
    CardBodyComponent,
    TableDirective,
    ButtonDirective,
    PageItemDirective,
    PageLinkDirective,
    PaginationComponent,
    RowComponent,
    ColComponent,
    IconDirective,
    ModalComponent,
    ModalHeaderComponent,
    ModalTitleDirective,
    ModalBodyComponent,
    ModalFooterComponent,
    ButtonCloseDirective,
    FormDirective,
    FormControlDirective
  ],
  templateUrl: './quotations.component.html',
  styleUrls: ['./quotations.component.scss']
})
export class QuotationsComponent {
  modalVisible = false;
  quotationForm: FormGroup;

  constructor(private fb: FormBuilder) {
    this.quotationForm = this.fb.group({
      code: ['', Validators.required],
      vendorName: ['', Validators.required],
      itemsList: ['', Validators.required],
      expiryDate: ['', Validators.required],
      createdBy: ['', Validators.required],
      createdDate: ['', Validators.required]
    });
  }

  quotations: Quotation[] = [
    {
      id: 1,
      code: 'QTN001',
      vendorName: 'ABC Suppliers Pvt Ltd',
      itemsList: 'Cement OPC 43 Grade, Steel TMT Bar 12mm',
      expiryDate: '2026-02-15',
      createdBy: 'Admin',
      createdDate: '2026-01-20'
    },
    {
      id: 2,
      code: 'QTN002',
      vendorName: 'Steel India Corp',
      itemsList: 'Steel TMT Bar 12mm, MS Angle 50x50x6',
      expiryDate: '2026-03-01',
      createdBy: 'Jacob',
      createdDate: '2026-01-25'
    }
  ];

  // Pagination
  currentPage = 1;
  itemsPerPage = 10;

  get totalPages(): number {
    return Math.ceil(this.quotations.length / this.itemsPerPage);
  }

  get paginatedQuotations(): Quotation[] {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    return this.quotations.slice(startIndex, startIndex + this.itemsPerPage);
  }

  get pages(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  addNewQuotation(): void {
    this.quotationForm.reset();
    this.modalVisible = true;
  }

  toggleModal(): void {
    this.modalVisible = !this.modalVisible;
  }

  handleModalVisibilityChange(visible: boolean): void {
    this.modalVisible = visible;
  }

  saveQuotation(): void {
    if (this.quotationForm.valid) {
      const newQuotation: Quotation = {
        id: this.quotations.length + 1,
        ...this.quotationForm.value
      };
      this.quotations.push(newQuotation);
      this.modalVisible = false;
      this.quotationForm.reset();
    }
  }

  editQuotation(quotation: Quotation): void {
    console.log('Edit quotation:', quotation);
  }

  deleteQuotation(quotation: Quotation): void {
    console.log('Delete quotation:', quotation);
  }
}
