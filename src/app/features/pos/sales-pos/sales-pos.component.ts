import { AfterViewInit, Component, ComponentRef, OnDestroy, OnInit, ViewChild, ViewContainerRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { DropdownsService } from '../../../core/services/dropdowns.service';
import { PosService } from '../@services/pos.service';
import { PosSalesService } from '../@services/pos-sales.service';
import { distinctUntilChanged, filter, Subject, takeUntil } from 'rxjs';
import { PosSharedService } from '../@services/pos-shared.service';
import { PosStatusService } from '../@services/pos-status.service';
import { MenuItem } from 'primeng/api';
import { SetDiscountComponent } from './set-discount/set-discount.component';
import { Currency, Tax } from '../interfaces/pos.interfaces';

@Component({
  selector: 'app-sales-pos',
  standalone: false,
  templateUrl: './sales-pos.component.html',
  styleUrl: './sales-pos.component.scss'
})
export class SalesPosComponent implements OnInit, OnDestroy {
  @ViewChild('container', { read: ViewContainerRef }) container!: ViewContainerRef;
  private destroy$ = new Subject<void>();

  products: any = [];
  productForm!: FormGroup;
  salesDataOrders: any = [];
  cols: any = [];
  selectedVat: any = ''
  taxes: Tax[] = [];
  salesProduct: any = [];
  menuItem: MenuItem[] = [];
  manualGoldPrice = '';
  selectedCurrency: Currency | null = null
  defualtVat = 0;
  shiftData: any = [];
  isSelectedCustomerAndCurrency: boolean = true;
  selectedVatId: any = null;
  priceOfProductToPatch: any = 0;
  isShiftActive: boolean = false;
  selectedRowData: any = [];
  componentRef!: ComponentRef<SetDiscountComponent>;



  constructor(private _formBuilder: FormBuilder, private _posSalesService: PosSalesService, private _posService: PosService,
    private _dropdownService: DropdownsService, private _posSharedService: PosSharedService, private _posStatusService: PosStatusService
  ) { }


  ngOnInit(): void {
    this.productForm = this._formBuilder.group({
      product_id: ['', Validators.required]
    })

    this.getProductList()

    // this._posService.getProductSalesList().subscribe((res) => {
    //   this.products = res?.results;
    // });
    this._dropdownService.getTaxes().subscribe((res) => {
      this.taxes = res?.results || [];
      this.selectedVatId = this.taxes[0]?.id; // Set first VAT as default
    });
    this.getSalesOrder()
    this._posStatusService.shiftData$
      .pipe(takeUntil(this.destroy$))
      .subscribe(data => {
        this.shiftData = data;
        if (this.shiftData && this.shiftData?.is_active) {
          this._posService.getGoldPrice(this.shiftData?.branch).subscribe(res => {
            this.manualGoldPrice = res?.manual_gold_price;
          });
        }
      });

    this._posSharedService.selectedCurrency$
      .pipe(takeUntil(this.destroy$))
      .subscribe(currency => {
        this.selectedCurrency = currency;
      });

    this.productForm.get('product_id')?.valueChanges
      .pipe(
        takeUntil(this.destroy$),
        distinctUntilChanged(), // prevent firing if same value is set again
        filter(value => !!value) // avoid null/undefined triggers
      )
      .subscribe((productId: number) => {
        this.onProductSelected(productId);
      });

    this._posStatusService.shiftActive$
      .pipe(takeUntil(this.destroy$))
      .subscribe(status => {
        this.isShiftActive = status;
        if (!status) {
          this.selectedCurrency = null;
        }
      });

    this.menuItem = [
      {
        label: 'Set Discount',
        icon: 'pi pi-percentage',
        command: () => {
          this.setDiscount(this.selectedRowData?.id);
        }
      },
      {
        label: 'Delete',
        icon: 'pi pi-trash',
        command: () => {
          this.removeItem(this.selectedRowData?.id);
        }
      }
    ];
    this._posStatusService.shiftActive$
      .pipe(takeUntil(this.destroy$))
      .subscribe(status => {
        this.isShiftActive = status;
      });

    this._posSharedService.orderPlaced$.subscribe(() => {
      this.getProductList();
    });
  }

  setDiscount(id: any) {
    this.container.clear();
    this.componentRef = this.container.createComponent(SetDiscountComponent);
    this.componentRef.instance.selectedRowId = id;
    this.componentRef.instance.visible = true;
  }

  onRowClick(rowData: any): void {
    this.selectedRowData = rowData;
  }

  getSalesOrder() {
    this._posSalesService._salesReciepts$
      .pipe(takeUntil(this.destroy$))
      .subscribe((res: any) => {
        this.salesDataOrders = res;
        if (this.salesDataOrders.length == 0) {
          this._posSharedService.setTotalPrice(0)
          this._posSharedService.setVat(0)
          this._posSharedService.setGrandTotalWithVat(0)
          this._posSharedService.setSalesTax(0)
          this._posSharedService.setSalesTotalGrand(0)
          this._posSharedService.setSalesTotalPrice(0)
        }
        this.productForm.get('product_id')?.patchValue(null)
      });

    // initial load
    this._posSalesService.getSalesOrdersFromServer();
  }

  getProductList() {
    this._posService.getProductSalesList().subscribe((res) => {
      this.products = res?.results.map((product: { name: any; tag_number: any; }) => ({
        ...product,
        displayLabel: ` ${product.tag_number} | ${product.name}`
      }));
    });
  }

  removeItem(id: any) {
    this._posService.deleteProductPos(id).subscribe({
      next: res => {
        this._posSalesService.getSalesOrdersFromServer();
      },
      error: () => { },
      complete: () => {
        this.getProductList();

      }
    })
  }

  calcGoldPriceAccordingToPurity(group: any): number {
    if (
      !this.manualGoldPrice ||
      !group?.purity ||
      !group?.purity_value ||
      !this.selectedCurrency?.currency_decimal_point
    ) {
      return 0;
    }

    const baseValue = (+this.manualGoldPrice);
    let purityFactor = 1;

    switch (group.purity) {
      case 24:
        purityFactor = 1;
        break;
      case 22:
        purityFactor = 0.916;
        break;
      case 21:
        purityFactor = 0.88;
        break;
      case 18:
        purityFactor = 0.75;
        break;
      default:
        purityFactor = 1;
    }

    const goldPrice = baseValue * purityFactor * group.purity_value;

    // Format based on selected currency decimal point
    const decimalPlaces = this.selectedCurrency?.currency_decimal_point ?? 2;
    this._posSharedService.setGoldPrice(+goldPrice.toFixed(decimalPlaces));
    return +goldPrice.toFixed(decimalPlaces);
  }

  calcMetalValueAccordingToPurity(group: any) {
    const decimalPlaces = this.selectedCurrency?.currency_decimal_point ?? 2;
    const metalValue = this.calcGoldPriceAccordingToPurity(group) * group?.weight;
    this._posSharedService.setMetalValue(+metalValue.toFixed(decimalPlaces));
    return +metalValue.toFixed(decimalPlaces);
  }


  calcTotalPrice(group: any): number {
    this.priceOfProductToPatch = 0;
    const metalValue = this.calcMetalValueAccordingToPurity(group);

    const makingCharge = +group?.retail_making_charge || 0;
    const discountPercentage = +group?.discount || 0;

    // Calculate discount amount
    const discountAmount = (discountPercentage / 100) * makingCharge;

    // Share the discount amount with the service
    this._posSharedService.setDiscountAmount(discountAmount);

    const discountedMakingCharge = makingCharge - discountAmount;

    const stoneValues = (group?.stones || [])
      .slice(0, 3)
      .reduce((sum: number, stone: any) => sum + (+stone?.retail_value || 0), 0);

    const total = metalValue + discountedMakingCharge + stoneValues;

    const decimalPlaces = this.selectedCurrency?.currency_decimal_point ?? 3;

    this.priceOfProductToPatch = +total.toFixed(decimalPlaces);

    return +total.toFixed(decimalPlaces);
  }

  onVatChange(vatId: number, group: any): void {
    group.selectedVat = vatId;

    const vat = this.taxes.find((t: { id: number }) => t.id === vatId);
    const vatRate = vat?.rate || 0;

    // Patch VAT rate into the form
    this.productForm.get('vat')?.patchValue(vatRate);

    // Recalculate grand total with VAT
    this.calcGrandTotalWithVat();

    // Track if it's the first or second+ selection
    if (!group._vatSelectedOnce) {
      group._vatSelectedOnce = true; // first time, don't send
    } else {
      // second time or more, send to backend
      const pId = group?.id;
      const form = this._formBuilder.group({
        vat_amount: [vatRate]
      });
      this._posService.setDiscountProductSale(pId, form.value).subscribe();
    }
  }

  calcTotalPriceWithVat(group: any): number {
    this.priceOfProductToPatch = 0
    const baseTotal = this.calcTotalPrice(group);
    const selectedTax = this.taxes.find((tax: { id: any; }) => tax.id === group.selectedVat);
    const vatRate = selectedTax?.rate ? +selectedTax.rate : 0;
    const vatAmount = (vatRate / 100) * baseTotal;
    const totalVat = this.salesDataOrders.reduce((acc: number, group: any) => {
      const baseTotal = this.calcTotalPrice(group); // your existing method
      const selectedTax = this.taxes.find((tax: { id: any }) => tax.id === group.selectedVat);
      const vatRate = selectedTax?.rate ? +selectedTax.rate : 0;
      const vatAmount = (vatRate / 100) * baseTotal;
      return acc + vatAmount;
    }, 0);
    // Update shared VAT immediately
    const decimalPlaces = this.selectedCurrency?.currency_decimal_point ?? 2;
    this._posSharedService.setSalesTax(+totalVat.toFixed(decimalPlaces));

    const totalWithVat = baseTotal + vatAmount;
    return +totalWithVat.toFixed(decimalPlaces);
  }

  calcGrandTotalWithVat(): number {
    if (!this.salesDataOrders || this.salesDataOrders.length === 0) return 0;

    const total = this.salesDataOrders.reduce((sum: number, group: any) => {
      return sum + this.calcTotalPriceWithVat(group);
    }, 0);

    const decimalPlaces = this.selectedCurrency?.currency_decimal_point ?? 2;
    this._posSharedService.setSalesTotalGrand(+total.toFixed(decimalPlaces));

    return +total.toFixed(decimalPlaces);
  }

  onProductSelected(productId: number): void {
    const selectedProduct = this.products.find((p: any) => p.id === productId);
    if (!selectedProduct) return;
    this._posService.getBranchTax(this.shiftData?.branch).subscribe(res => {
      const branchTaxNo = res?.tax_rate || 0;
      const tempGroup = {
        purity: selectedProduct.purity_name,
        price: selectedProduct.price,
        purity_value: selectedProduct.purity_value,
        weight: selectedProduct.weight,
        stones: selectedProduct.stones || [],
        retail_making_charge: selectedProduct.retail_making_charge,
        discount: selectedProduct.discount || 0,
        max_discount: selectedProduct.max_discount,
        selectedVat: this.selectedVatId
      };

      const goldPrice = this.calcGoldPriceAccordingToPurity(tempGroup);
      const metalValue = this.calcMetalValueAccordingToPurity(tempGroup);
      const totalPrice = this.calcTotalPrice(tempGroup);
      const totalWithVat = this.calcTotalPriceWithVat(tempGroup);

      const payload = {
        product: selectedProduct.id,
        amount: totalPrice,
        vat_amount: branchTaxNo,
        metal_value: metalValue
      };

      this._posService.addProductSale(payload).subscribe({
        next: res => {
          this._posSalesService.getSalesOrdersFromServer(); // Refresh after post
        },
        error: err => {
          console.error('Error posting product', err);
        },
        complete: () => {
          this.getProductList()
        }
      });
    });
  }

  get totalPrice(): number {
    const total = this.salesDataOrders.reduce((sum: number, group: any) => {
      return sum + this.calcTotalPrice(group);
    }, 0);

    const decimalPlaces = this.selectedCurrency?.currency_decimal_point ?? 2;
    const formattedTotal = +total.toFixed(decimalPlaces);
    // Update the service with the calculated gold price
    this._posSharedService.setSalesTotalPrice(formattedTotal);

    return formattedTotal;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

}
