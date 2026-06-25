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
  BadgeComponent,
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

interface Vendor {
  id: number;
  vendorName: string;
  vendorAddress: string;
  vendorCode: string;
  vendorPhone: string;
  vendorAltPhone: string;
  vendorEmail: string;
  contactPerson1: string;
  contactPerson1Phone: string;
  contactPerson1Email: string;
  contactPerson1Designation: string;
  contactPerson2: string;
  contactPerson2Phone: string;
  contactPerson2Email: string;
  contactPerson2Designation: string;
  status: string;
}

@Component({
  selector: 'app-vendors',
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
    BadgeComponent,
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
  templateUrl: './vendors.component.html',
  styleUrls: ['./vendors.component.scss']
})
export class VendorsComponent {
  modalVisible = false;
  vendorForm: FormGroup;

  constructor(private fb: FormBuilder) {
    this.vendorForm = this.fb.group({
      vendorName: ['', Validators.required],
      vendorAddress: ['', Validators.required],
      vendorCode: ['', Validators.required],
      vendorPhone: ['', Validators.required],
      vendorAltPhone: [''],
      vendorEmail: ['', [Validators.required, Validators.email]],
      contactPerson1: ['', Validators.required],
      contactPerson1Phone: ['', Validators.required],
      contactPerson1Email: ['', Validators.email],
      contactPerson1Designation: [''],
      contactPerson2: [''],
      contactPerson2Phone: [''],
      contactPerson2Email: ['', Validators.email],
      contactPerson2Designation: [''],
      status: ['Active', Validators.required]
    });
  }

  vendors: Vendor[] = [
    {
      id: 1,
      vendorName: 'ABC Suppliers Pvt Ltd',
      vendorAddress: '123 Industrial Area, Mumbai',
      vendorCode: 'VND001',
      vendorPhone: '022-12345678',
      vendorAltPhone: '022-87654321',
      vendorEmail: 'contact@abcsuppliers.com',
      contactPerson1: 'Rajesh Kumar',
      contactPerson1Phone: '9876543210',
      contactPerson1Email: 'rajesh@abcsuppliers.com',
      contactPerson1Designation: 'Sales Manager',
      contactPerson2: 'Priya Sharma',
      contactPerson2Phone: '9876543211',
      contactPerson2Email: 'priya@abcsuppliers.com',
      contactPerson2Designation: 'Accounts Manager',
      status: 'Active'
    },
    {
      id: 2,
      vendorName: 'Steel India Corp',
      vendorAddress: '456 Steel Complex, Pune',
      vendorCode: 'VND002',
      vendorPhone: '020-23456789',
      vendorAltPhone: '',
      vendorEmail: 'info@steelindia.com',
      contactPerson1: 'Amit Patel',
      contactPerson1Phone: '9988776655',
      contactPerson1Email: 'amit@steelindia.com',
      contactPerson1Designation: 'Director',
      contactPerson2: '',
      contactPerson2Phone: '',
      contactPerson2Email: '',
      contactPerson2Designation: '',
      status: 'Active'
    },
    {
      id: 3,
      vendorName: 'BuildMart Solutions',
      vendorAddress: '789 Construction Hub, Delhi',
      vendorCode: 'VND003',
      vendorPhone: '011-34567890',
      vendorAltPhone: '011-09876543',
      vendorEmail: 'sales@buildmart.in',
      contactPerson1: 'Suresh Verma',
      contactPerson1Phone: '8877665544',
      contactPerson1Email: 'suresh@buildmart.in',
      contactPerson1Designation: 'General Manager',
      contactPerson2: 'Neha Gupta',
      contactPerson2Phone: '8877665545',
      contactPerson2Email: 'neha@buildmart.in',
      contactPerson2Designation: 'Purchase Head',
      status: 'Inactive'
    },
    {
      id: 4,
      vendorName: 'Electrical World',
      vendorAddress: '321 Power Lane, Bangalore',
      vendorCode: 'VND004',
      vendorPhone: '080-45678901',
      vendorAltPhone: '',
      vendorEmail: 'orders@electricalworld.com',
      contactPerson1: 'Vinod Rao',
      contactPerson1Phone: '7766554433',
      contactPerson1Email: 'vinod@electricalworld.com',
      contactPerson1Designation: 'Owner',
      contactPerson2: '',
      contactPerson2Phone: '',
      contactPerson2Email: '',
      contactPerson2Designation: '',
      status: 'Active'
    },
    {
      id: 5,
      vendorName: 'Plumbing Pro Ltd',
      vendorAddress: '567 Water Works, Chennai',
      vendorCode: 'VND005',
      vendorPhone: '044-56789012',
      vendorAltPhone: '044-21098765',
      vendorEmail: 'info@plumbingpro.co.in',
      contactPerson1: 'Karthik S',
      contactPerson1Phone: '6655443322',
      contactPerson1Email: 'karthik@plumbingpro.co.in',
      contactPerson1Designation: 'Sales Executive',
      contactPerson2: 'Lakshmi N',
      contactPerson2Phone: '6655443323',
      contactPerson2Email: 'lakshmi@plumbingpro.co.in',
      contactPerson2Designation: 'Customer Support',
      status: 'Active'
    }
  ];

  // Pagination
  currentPage = 1;
  itemsPerPage = 10;

  get totalPages(): number {
    return Math.ceil(this.vendors.length / this.itemsPerPage);
  }

  get paginatedVendors(): Vendor[] {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    return this.vendors.slice(startIndex, startIndex + this.itemsPerPage);
  }

  get pages(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'Active': return 'success';
      case 'Inactive': return 'secondary';
      default: return 'primary';
    }
  }

  addNewVendor(): void {
    this.vendorForm.reset({ status: 'Active' });
    this.modalVisible = true;
  }

  toggleModal(): void {
    this.modalVisible = !this.modalVisible;
  }

  handleModalVisibilityChange(visible: boolean): void {
    this.modalVisible = visible;
  }

  saveVendor(): void {
    if (this.vendorForm.valid) {
      const newVendor: Vendor = {
        id: this.vendors.length + 1,
        ...this.vendorForm.value
      };
      this.vendors.push(newVendor);
      this.modalVisible = false;
      this.vendorForm.reset({ status: 'Active' });
    }
  }

  editVendor(vendor: Vendor): void {
    console.log('Edit vendor:', vendor);
  }

  deleteVendor(vendor: Vendor): void {
    console.log('Delete vendor:', vendor);
  }
}
