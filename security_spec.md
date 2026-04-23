# Security Specification - Mineazy Payroll

## Data Invariants
1. **User Identity Invariant**: Users can only create their own profile and view their own documents (timesheets, leave, etc.).
2. **Admin Authority Invariant**: Only users with the `role == 'admin'` can view ALL documents and perform approvals/payroll runs.
3. **Bootstrapped Admin Invariant**: The specified admin email (`lodzax@gmail.com`) is granted admin privileges by default.
4. **Relationship Invariant**: Every sub-document (timesheet, leave) must be linked to a valid user ID.
5. **Terminal State Invariant**: Once a timesheet or leave request is 'approved' or 'rejected', only an admin can modify it further.

## The "Dirty Dozen" Payloads (Denial Tests)

1. **Identity Theft (Create)**: Creating a user profile with a different UID.
2. **Privilege Escalation (Create)**: Creating a user profile with `role: 'admin'`.
3. **Privilege Escalation (Update)**: Changing own `role` from 'employee' to 'admin'.
4. **Data Snooping (List)**: Non-admin trying to list all timesheets.
5. **Data Snooping (Get)**: Non-admin trying to get someone else's payslip.
6. **State Hijacking (Update)**: Employee trying to set their own timesheet to 'approved'.
7. **Shadow Update (Update)**: Adding a `salaryBonus: 99999` field to a user profile.
8. **Resource Poisoning (Create)**: Creating a document with a 1MB string in the `reason` field.
9. **ID Poisoning (Create)**: Attempting to create a document with an extremely long or invalid character document ID.
10. **Relational Orphan (Create)**: Creating a leave request with a `userId` that doesn't match the authenticated user.
11. **Time Spoofing (Create)**: Providing a manual `createdAt` timestamp instead of using `serverTimestamp()`.
12. **PII Leak (List)**: Non-authenticated user trying to access the `users` collection.

## Test Runner (Verification Plan)
The following fields must be strictly validated in the rules:
- `userId` matches `request.auth.uid` for non-admins.
- `role` is immutable for non-admins.
- `status` only changeable by admins during updates.
- All strings have `.size()` limits.
- Timestamps use `request.time`.
