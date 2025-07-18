import { Component, ComponentRef, ElementRef, OnInit, ViewChild, ViewContainerRef } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { AccService } from '../@services/acc.service';
import { Router, RouterLink } from '@angular/router';
import { ConfirmationPopUpService } from '../../../shared/services/confirmation-pop-up.service';
import { MenuItem } from 'primeng/api';
import { SharedModule } from '../../../shared/shared.module';
import { DropdownsService } from '../../../core/services/dropdowns.service';
import { PaymentPurchaseComponent } from './payment-purchase/payment-purchase.component';

@Component({
  selector: 'app-purchases',
  imports: [SharedModule, RouterLink],
  templateUrl: './purchases.component.html',
  styleUrl: './purchases.component.scss'
})
export class PurchasesComponent implements OnInit {
  transactions: any[] = [];
  suppliers: any[] = [];
  branches: any[] = [];
  status: any[] = [
    {
      id: "", name: 'All'
    },
    {
      id: "pending", name: 'Pending'
    },
    {
      id: "completed", name: 'Completed'
    },
    {
      id: "cancelled", name: 'Cancelled'
    }
  ];

  rowsPerPage = [5, 10, 20, 50, 100];

  type: any[] = [
    { id: '', name: 'All' },
    { id: 'fixed', name: 'fixed' },
    { id: 'unfixed', name: 'unfixed' },
  ]
  cols: any[] = [];
  filterForm!: FormGroup;
  totalRecords: number = 0;
  pageSize: number = this.rowsPerPage[0];
  first: number = 0;

  constructor(
    private _accService: AccService,
    private _formBuilder: FormBuilder,
    private _router: Router,
    private _confirmPopUp: ConfirmationPopUpService,
    private _dropdown: DropdownsService
  ) { }

  ngOnInit(): void {
    this.cols = [
      { field: "id", header: "Refrence Number" },
      { field: "supplier_name", header: "Supplier Name" },
      { field: "order_date", header: "Date" },
      {
        field: "status",
        header: "Purchase Status",
        body: (row: any) => {
          if (row?.status === 'pending') {
            return `<span class="badge rounded-pill text-bg-warning">Pending</span>`;
          } else if (row?.status === 'cancelled') {
            return `<span class="badge rounded-pill text-bg-danger">Cancelled</span>`;
          } else if (row?.status === 'completed') {
            return `<span class="badge rounded-pill text-bg-success">Completed</span>`;
          } else {
            return `<span>${row?.status || 'Unknown'}</span>`;
          }
        }
      },
      {
        field: "payment_status",
        header: "Payment Status",
        body: (row: any) => {
          if (row?.payment_status === 'due') {
            return `<span class="badge rounded-pill text-bg-warning">Due</span>`;
          } else if (row?.payment_status === 'partially_paid') {
            return `<span class="badge rounded-pill text-bg-danger">Partially Paid</span>`;
          } else if (row?.payment_status === 'paid') {
            return `<span class="badge rounded-pill text-bg-success">Paid</span>`;
          } else {
            return `<span class="badge rounded-pill text-bg-secondary">${row?.payment_status || 'Unknown'}</span>`;
          }
        }
      },
      { field: "total_metal_amount", header: "Metal Amount" },
      { field: "metal_weight", header: "Metal Weight" },
      { field: "total_stone_amount", header: "Total Stone Amount" },
      { field: "metal_making_charge", header: "Making Charge" },
      { field: "tax_amount", header: "Tax" },
      { field: "total_amount", header: "Total Amount" },
      { field: "total_items", header: "Total Items" },
      { field: "total_weight", header: "Total Weight" },
      { field: "type", header: "Type Of Transaction" },
      { field: "salesman", header: "User" },
    ];

    this.filterForm = this._formBuilder.group({
      search: '',
      transaction_type: '',
      branch: '',
      payments__payment_method__id: '',
      supplier: '',
      type: '',
      order_date: '',
      status: ''
    });

    this.getPurchases();

    this._dropdown.getBranches().subscribe(res => {
      this.branches = res?.results
    })

    this._dropdown.getSuppliers().subscribe(res => {
      this.suppliers = res?.results
    })
  }

  // Get transactions with filtering and pagination
  getPurchases(searchParams: any = '', page: number = 1, pageSize: number = 5): void {
    let params = '';
    if (this.filterForm.dirty) {
      params = `
          search=${this.filterForm?.value?.search}&
          status=${this.filterForm?.value?.status}&
          branch=${this.filterForm?.value?.branch}&
          type=${this.filterForm?.value?.type}&
          supplier=${this.filterForm?.value?.supplier}&
          order_date=${this.filterForm?.value?.order_date}&
        `;
    }

    // Correct pagination parameters and make API call
    this._accService.getPurchases(params, page, pageSize).subscribe(res => {
      this.transactions = res?.results;
      this.totalRecords = res?.count;  // Ensure the total count is updated
    });
  }


  loadPurchases(event: any): void {
    const page = event.first / event.rows + 1;
    const pageSize = event.rows;

    this.first = event.first;
    this.pageSize = pageSize;

    this._accService.getPurchases(this.filterForm?.value?.search || '', page, pageSize)
      .subscribe((res) => {
        this.transactions = res.results;
        this.totalRecords = res.count;
      });
  }
  selectedTransaction: any;

  transactionsMenuItems: MenuItem[] = [
    {
      label: 'Edit',
      icon: 'pi pi-fw pi-pen-to-square',
      command: () => this.editPurchase(this.selectedTransaction)
    },
    {
      label: 'Add Payment',
      icon: 'pi pi-fw pi-payment',
      command: () => this.addPayment(this.selectedTransaction)
    },
    {
      label: 'Delete',
      icon: 'pi pi-fw pi-trash',
      command: () => this.showConfirmDelete(this.selectedTransaction)
    }

  ];

  @ViewChild('paymentContainer', { read: ViewContainerRef }) container!: ViewContainerRef;
  private componentRef!: ComponentRef<PaymentPurchaseComponent>;

  addPayment(data: any) {
    this.container.clear();
    this.componentRef = this.container.createComponent(PaymentPurchaseComponent);
    this.componentRef.instance.paymentData = data;
    this.componentRef.instance.showDialog();
  }

  editPurchase(user: any) {
    this._router.navigate([`acc/purchase/edit/${user?.id}`]);
  }

  deletePurchase(user: any) {
    this._accService.deletePurchase(user?.id).subscribe(res => {
      this.getPurchases()
    }, error => { })
  }

  showConfirmDelete(user: any) {
    this._confirmPopUp.confirm({
      message: 'Do you want to delete this item?',
      header: 'Confirm Delete',
      onAccept: () => {
        this.deletePurchase(user);
      },
      target: user?.id
    });
  }

  onSearch(): void {
    const formValues = this.filterForm.value;

    const queryParts: string[] = [];

    Object.keys(formValues).forEach(key => {
      const value = formValues[key];
      if (value !== null && value !== '' && value !== undefined) {
        const encodedKey = encodeURIComponent(key);
        const encodedValue = encodeURIComponent(value).replace(/%20/g, '+'); // Replace space with +
        queryParts.push(`${encodedKey}=${encodedValue}`);
      }
    });

    const queryParams = queryParts.join('&');

    this.getPurchases(queryParams, 1, 5);
  }

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;


  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;

    const file = input.files[0];
    this.submitFile(file);

    // Reset input so user can upload the same file again if needed
    input.value = '';
  }

  submitFile(file: File) {
    const formData = new FormData();
    formData.append('file', file);

    this._accService.importPurchase(formData).subscribe({
      next: (res) => {
        this.loadPurchases({ first: 0, rows: this.pageSize }); // reset to first page
      },
      error: (err) => {
        console.error('Import failed:', err);
        // Show error message here
      },
    });
  }
}
