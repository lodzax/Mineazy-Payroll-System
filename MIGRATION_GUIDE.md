# Supabase Migration Guide

This application has been prepared to support Supabase as a backend. Follow these steps to complete the migration from Firebase.

## 1. Database Setup

1.  Create a new project on [Supabase](https://supabase.com).
2.  Go to the **SQL Editor** in your Supabase dashboard.
3.  Open the `supabase_schema.sql` file provided in this project.
4.  Copy and paste the contents into the SQL Editor and run it to create your tables and RLS policies.

## 2. Environment Variables

1.  In your Supabase project, go to **Project Settings > API**.
2.  Copy your `Project URL` and `anon public` key.
3.  Add them to your `.env` (or secrets in AI Studio):
    *   `VITE_SUPABASE_URL=your_project_url`
    *   `VITE_SUPABASE_ANON_KEY=your_anon_key`

## 3. Swapping Authentication

To switch to Supabase Auth:

1.  Open `src/main.tsx`.
2.  Replace `AuthProvider` with `SupabaseAuthProvider` from `./lib/SupabaseAuthContext`.
3.  Update components to use `useSupabaseAuth()` instead of `useAuth()`.

## 4. Swapping Services

The following services have Supabase equivalents ready:
*   `loggerService.ts` -> `loggerService.supabase.ts`

To use them, simply update the imports in your components.

## 5. Migrating Data

If you have existing data in Firestore, you will need to export it (e.g., to JSON/CSV) and import it into Supabase via the dashboard.

## 6. Authentication Providers

Ensure you enable **Google Auth** (or your preferred provider) in the Supabase Dashboard under **Authentication > Providers** if you wish to maintain the same login flow.
