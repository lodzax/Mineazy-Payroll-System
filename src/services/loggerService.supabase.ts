import { supabase } from '../lib/supabase';

export type AuditCategory = 'payroll' | 'personnel' | 'system' | 'financial' | 'performance' | 'report';

export interface AuditLogEntry {
  action: string;
  category: AuditCategory;
  details?: any;
  entityId?: string;
  userName?: string;
  userEmail?: string;
}

/**
 * Logs a system action for audit purposes using Supabase.
 */
export async function logAction(entry: AuditLogEntry) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  try {
    const { error } = await supabase
      .from('audit_logs')
      .insert({
        action: entry.action,
        category: entry.category,
        details: entry.details,
        user_id: user.id,
        // In Supabase, we might prefer using the relational link, 
        // but can store these for quick reference if desired
        timestamp: new Date().toISOString()
      });

    if (error) throw error;
  } catch (error) {
    console.error("Supabase Audit Logging Failure:", error);
  }
}
