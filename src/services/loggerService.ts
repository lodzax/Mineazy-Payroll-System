import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';

export type AuditCategory = 'payroll' | 'personnel' | 'system' | 'financial' | 'performance' | 'report';

export interface AuditLogEntry {
  action: string;
  category: AuditCategory;
  details?: string;
  entityId?: string;
  userName?: string;
  userEmail?: string;
}

/**
 * Logs a system action for audit purposes.
 * This is used to track administrator and employee activities globally.
 */
export async function logAction(entry: AuditLogEntry) {
  const user = auth.currentUser;
  if (!user) return;

  try {
    await addDoc(collection(db, 'audit_logs'), {
      ...entry,
      userId: user.uid,
      userName: entry.userName || user.displayName || 'System User',
      userEmail: entry.userEmail || user.email || 'N/A',
      timestamp: serverTimestamp(),
    });
  } catch (error) {
    console.error("Audit Logging Failure:", error);
    // We don't throw here to avoid breaking the main UI flow if logging fails
  }
}
