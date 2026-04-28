import { supabase } from '../lib/supabase';

export type AuditCategory = 'payroll' | 'personnel' | 'system' | 'financial' | 'performance' | 'report';

export interface AuditLogEntry {
  action: string;
  category: AuditCategory;
  details?: string;
  entityId?: string;
  userName?: string;
  userEmail?: string;
  subsidiaryId?: string;
}

/**
 * Logs a system action for audit purposes using Supabase.
 */
export async function logAction(entry: AuditLogEntry) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return;

  try {
    // If subsidiaryId isn't provided, try to get it from the user's profile
    let subId = entry.subsidiaryId;
    if (!subId || subId === "") {
      const { data: profile } = await supabase
        .from('profiles')
        .select('subsidiary_id')
        .eq('id', session.user.id)
        .maybeSingle();
      if (profile) subId = profile.subsidiary_id;
    }

    // Explicitly set to null if still empty string to avoid DB errors
    if (subId === "") subId = undefined;

    const { error } = await supabase
      .from('audit_logs')
      .insert({
        action: entry.action,
        category: entry.category,
        details: {
          details: entry.details,
          entityId: entry.entityId,
          userName: entry.userName || session.user.user_metadata?.full_name || 'System User',
          userEmail: entry.userEmail || session.user.email,
        },
        user_id: session.user.id,
        subsidiary_id: subId,
        timestamp: new Date().toISOString()
      });

    if (error) throw error;
  } catch (error) {
    console.error("Supabase Audit Logging Failure:", error);
  }
}
