/**
 * Auto-generated JSON Schemas from OpenAPI specification
 * Generated from: Core API v1.0.0
 * DO NOT EDIT MANUALLY
 */

export const User = {
    "$id": "User",
    "type": "object",
    "properties": {
      "id": {
        "type": "string",
        "format": "uuid"
      },
      "email": {
        "type": "string",
        "format": "email"
      },
      "name": {
        "type": "string"
      },
      "role": {
        "type": "string",
        "enum": [
          "user",
          "admin"
        ]
      },
      "status": {
        "type": "string",
        "enum": [
          "active",
          "suspended"
        ]
      },
      "createdAt": {
        "type": "string",
        "format": "date-time"
      },
      "updatedAt": {
        "type": "string",
        "format": "date-time"
      },
      "internalNotes": {
        "type": "string"
      }
    },
    "required": [
      "id",
      "email",
      "name",
      "role",
      "createdAt"
    ]
  } as const;

export const UserListResponse = {
    "$id": "UserListResponse",
    "type": "object",
    "properties": {
      "users": {
        "type": "array",
        "items": {
          "$ref": "User#"
        }
      },
      "total": {
        "type": "integer"
      },
      "hasMore": {
        "type": "boolean"
      }
    },
    "required": [
      "users",
      "total"
    ]
  } as const;

export const CreateUserRequest = {
    "$id": "CreateUserRequest",
    "type": "object",
    "properties": {
      "email": {
        "type": "string",
        "format": "email"
      },
      "name": {
        "type": "string",
        "minLength": 1,
        "maxLength": 100
      },
      "role": {
        "type": "string",
        "enum": [
          "user",
          "admin"
        ],
        "default": "user"
      }
    },
    "required": [
      "email",
      "name"
    ]
  } as const;

export const UpdateUserRequest = {
    "$id": "UpdateUserRequest",
    "type": "object",
    "properties": {
      "name": {
        "type": "string",
        "minLength": 1,
        "maxLength": 100
      },
      "role": {
        "type": "string",
        "enum": [
          "user",
          "admin"
        ]
      }
    }
  } as const;

export const TenantData = {
    "$id": "TenantData",
    "type": "object",
    "properties": {
      "id": {
        "type": "string",
        "format": "uuid"
      },
      "tenantId": {
        "type": "string",
        "format": "uuid"
      },
      "data": {
        "type": "object",
        "additionalProperties": true
      },
      "createdAt": {
        "type": "string",
        "format": "date-time"
      }
    },
    "required": [
      "id",
      "tenantId",
      "data"
    ]
  } as const;

export const CreateTenantDataRequest = {
    "$id": "CreateTenantDataRequest",
    "type": "object",
    "properties": {
      "data": {
        "type": "object",
        "additionalProperties": true
      }
    },
    "required": [
      "data"
    ]
  } as const;

export const SystemStats = {
    "$id": "SystemStats",
    "type": "object",
    "properties": {
      "userCount": {
        "type": "integer"
      },
      "activeUsers": {
        "type": "integer"
      },
      "tenantCount": {
        "type": "integer"
      },
      "uptime": {
        "type": "number",
        "description": "Uptime in seconds"
      }
    },
    "required": [
      "userCount",
      "activeUsers",
      "tenantCount"
    ]
  } as const;

export const SuspendUserRequest = {
    "$id": "SuspendUserRequest",
    "type": "object",
    "properties": {
      "reason": {
        "type": "string",
        "minLength": 10,
        "maxLength": 500
      }
    },
    "required": [
      "reason"
    ]
  } as const;

export const HealthStatus = {
    "$id": "HealthStatus",
    "type": "object",
    "properties": {
      "status": {
        "type": "string",
        "enum": [
          "healthy",
          "degraded",
          "unhealthy"
        ]
      },
      "version": {
        "type": "string"
      },
      "timestamp": {
        "type": "string",
        "format": "date-time"
      }
    },
    "required": [
      "status"
    ]
  } as const;

// Parameter schemas
export const UserDomain_getUsersParams = {
    "$id": "UserDomain_getUsersParams",
    "type": "object",
    "properties": {
      "limit": {
        "type": "integer",
        "default": 20,
        "maximum": 100
      },
      "offset": {
        "type": "integer",
        "default": 0
      }
    }
  } as const;

export const UserDomain_getUserByIdParams = {
    "$id": "UserDomain_getUserByIdParams",
    "type": "object",
    "properties": {
      "id": {
        "type": "string",
        "format": "uuid"
      }
    },
    "required": [
      "id"
    ]
  } as const;

export const UserDomain_updateUserParams = {
    "$id": "UserDomain_updateUserParams",
    "type": "object",
    "properties": {
      "id": {
        "type": "string",
        "format": "uuid"
      }
    },
    "required": [
      "id"
    ]
  } as const;

export const UserDomain_deleteUserParams = {
    "$id": "UserDomain_deleteUserParams",
    "type": "object",
    "properties": {
      "id": {
        "type": "string",
        "format": "uuid"
      }
    },
    "required": [
      "id"
    ]
  } as const;

export const AdminDomain_suspendUserParams = {
    "$id": "AdminDomain_suspendUserParams",
    "type": "object",
    "properties": {
      "id": {
        "type": "string",
        "format": "uuid"
      }
    },
    "required": [
      "id"
    ]
  } as const;


// All schemas for registration
export const allSchemas = [
  User,
  UserListResponse,
  CreateUserRequest,
  UpdateUserRequest,
  TenantData,
  CreateTenantDataRequest,
  SystemStats,
  SuspendUserRequest,
  HealthStatus,
  UserDomain_getUsersParams,
  UserDomain_getUserByIdParams,
  UserDomain_updateUserParams,
  UserDomain_deleteUserParams,
  AdminDomain_suspendUserParams,
] as const;