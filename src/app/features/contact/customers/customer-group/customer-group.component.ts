import { Component } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { ContactService } from '../../@services/contact.service';
import { Router, RouterLink } from '@angular/router';
import { ConfirmationPopUpService } from '../../../../shared/services/confirmation-pop-up.service';
import { MenuItem } from 'primeng/api';
import { SharedModule } from '../../../../shared/shared.module';

@Component({
  selector: 'app-customer-group',
  imports: [SharedModule , RouterLink],
  templateUrl: './customer-group.component.html',
  styleUrl: './customer-group.component.scss'
})
export class CustomerGroupComponent {
    customers: any[] = [];
    cols: any[] = [];
    filterForm!: FormGroup;
    totalRecords: number = 0;
    pageSize: number = 10;
    first: number = 0;
  
    constructor(
      private _contactService: ContactService,
      private _formBuilder: FormBuilder,
      private _router: Router,
      private _confirmPopUp: ConfirmationPopUpService
    ) { }
  
    ngOnInit(): void {
      this.cols = [
        { field: "name", header: "Name" },
        { field: "description", header: "Description" },
        { field: "count", header: "Users" }
      ];
      this.filterForm = this._formBuilder.group({
        search: '',
      });
      this.getCustomersGroup();
    }
  
    // Get customers with filtering and pagination
    getCustomersGroup(search: any = '', page: number = 1, pageSize: number = 10): void {
      //const searchParams = new URLSearchParams(this.filterForm.value).toString() || '';
  
      // Correct pagination parameters and make API call
      this._contactService.getCustomersGroup(this.filterForm?.value?.search || '', page, pageSize).subscribe(res => {
        this.customers = res?.results;
        this.totalRecords = res?.count;  // Ensure the total count is updated
      });
    }
    loadCustomers(event: any): void {
      const page = event.first / event.rows + 1;
      const pageSize = event.rows;
  
      this.first = event.first;
      this.pageSize = pageSize;
  
      this._contactService.getCustomersGroup(this.filterForm?.value?.search || '', page, pageSize)
        .subscribe((res) => {
          this.customers = res.results;
          this.totalRecords = res.count;
        });
    }
    selectedProduct: any;
  
    customersMenuItems: MenuItem[] = [
      {
        label: 'Edit',
        icon: 'pi pi-fw pi-pen-to-square',
        command: () => this.editCustomer(this.selectedProduct)
      },
      {
        label: 'Delete',
        icon: 'pi pi-fw pi-trash',
        command: () => this.showConfirmDelete(this.selectedProduct)
      }
  
    ];
  
    editCustomer(user: any) {
      this._router.navigate([`customers-group/edit/${user?.id}`]);
    }
    deleteCustomer(user: any) {
      this._contactService.deleteCustomer(user?.id).subscribe(res=>{
        if(res){
          this.getCustomersGroup()
        }
      })
    }
    showConfirmDelete(user: any) {
      this._confirmPopUp.confirm({
        message: 'Do you want to delete this item?',
        header: 'Confirm Delete',
        onAccept: () => {
          this.deleteCustomer(user);
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
  
      this.getCustomersGroup(queryParams, 1, 10);
    }
  }
