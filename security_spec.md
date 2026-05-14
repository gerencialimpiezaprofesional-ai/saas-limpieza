# Security Specification: Impeccable AI

## Data Invariants
1.  **Tenant Isolation:** No user can read or write data belonging to another `tenantId`.
2.  **Role Integrity:** Roles (`ceo`, `supervisor`, `operator`, `rh`, `client`) can only be assigned by a `superadmin` or at creation if permitted. Standard users cannot change their own roles.
3.  **Ownership:** Individual PII (Private User Data) is only readable by the owner or authorized roles (`ceo`, `rh`).
4.  **Action validation:** Updates for critical states (tasks, redemptions, candidates) must follow specific transitions and only affect allowed fields.
5.  **Immutability:** `tenantId` and `createdAt` are immutable after creation.
6.  **IDs:** All document IDs must be alphanumeric strings <= 128 characters.

## Dirty Dozen Payloads (Target: DENIED)

1.  **ID Injection:** Create a user with a document ID of 1MB of junk characters.
2.  **Tenant Leak:** User in `TenantA` tries to read a client in `TenantB`.
3.  **Self-Promotion:** Operator tries to update their own `role` to `ceo`.
4.  **Point Injection:** Operator tries to update their own `points` to 999,999.
5.  **Phantom Achievement:** Operator tries to create a `post` with `type: 'achievement'` for themselves.
6.  **Task Shortcut:** Operator tries to update a task and set `score: 100` directly without AI.
7.  **Shadow Candidate:** Unauthenticated user tries to write to the `candidates` collection.
8.  **Orphaned Task:** Creating a task with a `clientId` that does not exist in the `clients` collection.
9.  **Terminal State Bypass:** Trying to update a `redemption` that is already `applied`.
10. **Geofence Spoof:** Operator tries to write `lastLocation` without being authenticated.
11. **PII Leak:** An operator tries to `list` the `users` collection to scrape email addresses of others.
12. **Inventory Poisoning:** Operator (non-manager) tries to delete an item from `inventory`.

## Test Runner Plan
A `firestore.rules.test.ts` will be created to verify these denials using the Firebase Rules Unit Testing library.

---

# Draft Blueprint: firebase-blueprint.json

```json
{
  "entities": {
    "User": {
      "title": "User Profile",
      "description": "System user with role-based access and tenant isolation.",
      "type": "object",
      "properties": {
        "uid": { "type": "string" },
        "name": { "type": "string" },
        "email": { "type": "string", "format": "email" },
        "role": { "type": "string", "enum": ["ceo", "rh", "supervisor", "operator", "client", "superadmin"] },
        "tenantId": { "type": "string" },
        "points": { "type": "number" },
        "status": { "type": "string", "enum": ["active", "inactive"] },
        "lastCheckIn": { "type": "string", "format": "date-time" },
        "lastLocation": { "type": "object" },
        "lastSelfie": { "type": "string" },
        "isInventoryManager": { "type": "boolean" }
      },
      "required": ["uid", "role", "tenantId"]
    },
    "Client": {
      "title": "Client Location",
      "description": "A service location assigned to a tenant.",
      "type": "object",
      "properties": {
        "name": { "type": "string" },
        "address": { "type": "string" },
        "location": { "type": "object" },
        "schedule": { "type": "string" },
        "tenantId": { "type": "string" },
        "areas": { "type": "array" },
        "assignedStaff": { "type": "array" }
      }
    },
    "Task": {
      "title": "Operational Task",
      "description": "A specific cleaning or maintenance task assigned to an operator.",
      "type": "object",
      "properties": {
        "title": { "type": "string" },
        "client": { "type": "string" },
        "clientId": { "type": "string" },
        "operatorId": { "type": "string" },
        "status": { "type": "string", "enum": ["pending", "in_progress", "completed", "rejected"] },
        "score": { "type": "number" },
        "aiNotes": { "type": "string" },
        "afterPhoto": { "type": "string" },
        "tenantId": { "type": "string" }
      }
    }
  },
  "firestore": {
    "/users/{userId}": { "schema": "User", "description": "User profiles" },
    "/clients/{clientId}": { "schema": "Client", "description": "Service locations" },
    "/tasks/{taskId}": { "schema": "Task", "description": "Service tasks" },
    "/inventory/{itemId}": { "schema": "object", "description": "Supplies" },
    "/requisitions/{reqId}": { "schema": "object", "description": "Supply requests" },
    "/redemptions/{redemptionId}": { "schema": "object", "description": "Reward redemptions" },
    "/posts/{postId}": { "schema": "object", "description": "Social feed" },
    "/candidates/{candidateId}": { "schema": "object", "description": "RH candidates" },
    "/staff/{memberId}": { "schema": "object", "description": "RH active staff" },
    "/notifications/{notifId}": { "schema": "object", "description": "App notifications" },
    "/tenants/{tenantId}": { "schema": "object", "description": "Tenant settings" }
  }
}
```
