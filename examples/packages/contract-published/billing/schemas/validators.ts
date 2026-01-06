/**
 * Auto-generated JSON Schemas from OpenAPI specification
 * Generated from: Billing API v1.0.0
 * DO NOT EDIT MANUALLY
 */

export const Invoice = {
    "$id": "Invoice",
    "type": "object",
    "properties": {
      "id": {
        "type": "string"
      },
      "userId": {
        "type": "string",
        "description": "Reference to core.User"
      },
      "amount": {
        "type": "number",
        "format": "double"
      },
      "currency": {
        "type": "string",
        "default": "USD"
      },
      "status": {
        "type": "string",
        "enum": [
          "draft",
          "pending",
          "paid",
          "overdue"
        ]
      },
      "description": {
        "type": "string"
      },
      "createdAt": {
        "type": "string",
        "format": "date-time"
      },
      "paidAt": {
        "type": "string",
        "format": "date-time"
      }
    },
    "required": [
      "id",
      "userId",
      "amount",
      "status",
      "createdAt"
    ]
  } as const;

export const InvoiceListResponse = {
    "$id": "InvoiceListResponse",
    "type": "object",
    "properties": {
      "invoices": {
        "type": "array",
        "items": {
          "$ref": "Invoice#"
        }
      },
      "total": {
        "type": "integer"
      }
    },
    "required": [
      "invoices",
      "total"
    ]
  } as const;

export const CreateInvoiceRequest = {
    "$id": "CreateInvoiceRequest",
    "type": "object",
    "properties": {
      "userId": {
        "type": "string",
        "description": "User ID from core module"
      },
      "amount": {
        "type": "number",
        "format": "double"
      },
      "currency": {
        "type": "string",
        "default": "USD"
      },
      "description": {
        "type": "string"
      }
    },
    "required": [
      "userId",
      "amount"
    ]
  } as const;

export const PayInvoiceRequest = {
    "$id": "PayInvoiceRequest",
    "type": "object",
    "properties": {
      "paymentMethodId": {
        "type": "string"
      },
      "savePaymentMethod": {
        "type": "boolean",
        "default": false
      }
    },
    "required": [
      "paymentMethodId"
    ]
  } as const;

export const PaymentResult = {
    "$id": "PaymentResult",
    "type": "object",
    "properties": {
      "success": {
        "type": "boolean"
      },
      "transactionId": {
        "type": "string"
      },
      "paidAt": {
        "type": "string",
        "format": "date-time"
      }
    },
    "required": [
      "success",
      "transactionId"
    ]
  } as const;

// Parameter schemas
export const Billing_getInvoicesParams = {
    "$id": "Billing_getInvoicesParams",
    "type": "object",
    "properties": {
      "userId": {
        "type": "string"
      },
      "status": {
        "type": "string",
        "enum": [
          "draft",
          "pending",
          "paid",
          "overdue"
        ]
      }
    }
  } as const;

export const Billing_getInvoiceByIdParams = {
    "$id": "Billing_getInvoiceByIdParams",
    "type": "object",
    "properties": {
      "id": {
        "type": "string"
      }
    },
    "required": [
      "id"
    ]
  } as const;

export const Billing_payInvoiceParams = {
    "$id": "Billing_payInvoiceParams",
    "type": "object",
    "properties": {
      "id": {
        "type": "string"
      }
    },
    "required": [
      "id"
    ]
  } as const;


// All schemas for registration
export const allSchemas = [
  Invoice,
  InvoiceListResponse,
  CreateInvoiceRequest,
  PayInvoiceRequest,
  PaymentResult,
  Billing_getInvoicesParams,
  Billing_getInvoiceByIdParams,
  Billing_payInvoiceParams,
] as const;