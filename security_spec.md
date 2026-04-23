# Security Specification: Audit Trail Protocol

## 1. Data Invariants
- An audit log MUST be immutable once created (no update, no delete).
- The `userId` in the log MUST match the authenticated `request.auth.uid`.
- The `timestamp` MUST be the server-side `request.time`.
- Only administrators (Admins or Super Admins) can read the audit trail.
- All system users can *create* audit logs to track their own activities.

## 2. The "Dirty Dozen" Payloads (Audit Trail)

1. **Identity Spoofing**: `userId` mismatching `auth.uid`.
2. **Timestamp Manipulation**: Providing a client-side timestamp instead of `request.time`.
3. **Unauthorized Read**: An employee trying to `list` the `/audit_logs` collection.
4. **Log Tampering (Update)**: Attempting to `update` an existing log entry.
5. **Log Deletion**: Attempting to `delete` an existing log entry.
6. **Shadow Field Injection**: Adding undocumented fields to a log entry.
7. **Resource Poisoning**: Providing a 1MB string in the `details` field.
8. **ID Poisoning**: Using a 2KB string as the document ID.
9. **Category Bypass**: Using an invalid enum value for `category`.
10. **Admin Claim Spoofing**: A non-admin user trying to `get` a specific log.
11. **Massive Query**: Attempting to list logs without an admin role.
12. **Orphaned Write**: Logging an action for a non-existent `entityId` (mitigated by app logic, but rules ensure type/size).

## 3. Test Runner (Conceptual)
Detailed tests will verify:
- `allow create: if isSignedIn() && isValidAuditLog(incoming())`
- `isValidAuditLog` enforces strict keys and server timestamps.
- `allow update: if false`
- `allow delete: if false`
- `allow read: if isAdmin()`
