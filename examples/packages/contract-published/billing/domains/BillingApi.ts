/**
 * Billing Domain API Interface
 * Auto-generated from OpenAPI specification
 * DO NOT EDIT MANUALLY
 */

import type {
  Billing_createInvoiceInput,
  Billing_getInvoiceByIdInput,
  Billing_getInvoicesInput,
  Billing_payInvoiceInput,
  Invoice,
  InvoiceListResponse,
  PaymentResult,
} from '../schemas/types.js';

export interface BillingApi {
  /**
   * GET /api/billing/invoices
   */
  getInvoices(input: Billing_getInvoicesInput): Promise<InvoiceListResponse>;

  /**
   * POST /api/billing/invoices
   */
  createInvoice(input: Billing_createInvoiceInput): Promise<Invoice>;

  /**
   * GET /api/billing/invoices/{id}
   */
  getInvoiceById(input: Billing_getInvoiceByIdInput): Promise<Invoice>;

  /**
   * POST /api/billing/invoices/{id}/pay
   */
  payInvoice(input: Billing_payInvoiceInput): Promise<PaymentResult>;

}