# Supabase Migration Guide

This application has been updated to use Supabase for Authentication and Audit Logging. Follow these steps to complete the remaining database migration.

## 1. Database Setup

1.  Create a new project on [Supabase](https://supabase.com).
2.  Go to the **SQL Editor** in your Supabase dashboard.
3.  Open the `supabase_schema.sql` file provided in this project.
4.  Copy and paste the contents into the SQL Editor and run it to create your tables and RLS policies.

## 2. Environment Variables

1.  In your Supabase project, go to **Project Settings > API**.
2.  Copy your `Project URL` and `anon public` key.
3.  Add them to your `.env` (or secrets in AI Studio settings):
    *   `VITE_SUPABASE_URL=your_project_url`
    *   `VITE_SUPABASE_ANON_KEY=your_anon_key`

## 3. Current State

*   **Authentication**: Switched to Supabase. Components still use `useAuth()`, but the underlying logic is now Supabase-powered.
*   **Audit Logging**: Switched to Supabase `audit_logs` table.
*   **Other Data**: Currently still pointing to Firebase Firestore. You will need to migrate each service layer (Employee management, Payroll, etc.) to use Supabase if you wish to fully exit Firebase.

## 4. Migrating Data

If you have existing data in Firestore, you will need to export it (e.g., to JSON/CSV) and import it into Supabase via the dashboard.

## 5. Authentication Providers

Ensure you enable **Google Auth** (or your preferred provider) in the Supabase Dashboard under **Authentication > Providers** if you wish to maintain the same login flow.
