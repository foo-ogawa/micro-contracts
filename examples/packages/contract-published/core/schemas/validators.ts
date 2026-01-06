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


// All schemas for registration
export const allSchemas = [
  User,
  UserListResponse,
  CreateUserRequest,
  HealthStatus,
  UserDomain_getUsersParams,
  UserDomain_getUserByIdParams,
] as const;