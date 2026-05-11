-- Supabase Schema for Mineazy Payroll
-- Paste this into your Supabase SQL Editor

-- CLEANUP & MIGRATION BLOCK
-- This block handles the rename from users -> profiles if needed
-- and clears old tables/policies to avoid recursion
DO $$
BEGIN
    -- 1. Drop old policies safely
    -- We use EXECUTE to avoid parser errors if the table doesn't exist
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
        EXECUTE 'DROP POLICY IF EXISTS "Admins can view all users" ON profiles';
        EXECUTE 'DROP POLICY IF EXISTS "Admins can modify users" ON profiles';
        EXECUTE 'DROP POLICY IF EXISTS "Users can view their own profile" ON profiles';
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
        EXECUTE 'DROP POLICY IF EXISTS "Admins can view all users" ON users';
        EXECUTE 'DROP POLICY IF EXISTS "Admins can modify users" ON users';
        EXECUTE 'DROP POLICY IF EXISTS "Users can view their own profile" ON users';
    END IF;

    -- 2. Handle table renaming
    -- If profiles exists AND users exists in public, we drop profiles and rename users
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') 
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
        EXECUTE 'DROP TABLE public.profiles CASCADE';
        EXECUTE 'ALTER TABLE public.users RENAME TO profiles';
    -- If only users exists in public, rename it
    ELSIF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') 
          AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
        EXECUTE 'ALTER TABLE public.users RENAME TO profiles';
    END IF;
END $$;

-- Table: subsidiaries
CREATE TABLE IF NOT EXISTS subsidiaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    address TEXT,
    contact_email TEXT,
    tax_number TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Table: profiles (Extends Supabase Auth users)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    role TEXT DEFAULT 'employee', -- 'employee', 'management', 'admin', 'superadmin'
    subsidiary_id UUID REFERENCES subsidiaries(id) ON DELETE SET NULL,
    currency TEXT DEFAULT 'USD',
    base_salary NUMERIC DEFAULT 1000,
    job_title TEXT,
    department TEXT,
    phone TEXT,
    address TEXT,
    emergency_contact TEXT,
    emergency_relation TEXT,
    emergency_phone TEXT,
    national_id TEXT,
    medical_aid_no TEXT,
    bank_name TEXT,
    account_number TEXT,
    branch_code TEXT,
    account_name TEXT,
    annual_leave_balance NUMERIC DEFAULT 0,
    branch TEXT,
    status TEXT DEFAULT 'active',
    payroll_group TEXT DEFAULT 'General', -- 'Management', 'General'
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Trigger to automatically create a profile entry in our public table when a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    assigned_role TEXT;
BEGIN
  -- Assign role based on email first (hardcoded superadmins)
  IF (new.email = 'lodzax@gmail.com' OR new.email = 'accounts@mineazy.co.zw') THEN
    assigned_role := 'superadmin';
  -- Otherwise, use role from metadata if provided (set by admin creator)
  ELSIF (new.raw_user_meta_data->>'role' IS NOT NULL) THEN
    assigned_role := new.raw_user_meta_data->>'role';
  ELSE
    assigned_role := 'employee';
  END IF;

  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'full_name', assigned_role)
  ON CONFLICT (email) DO UPDATE SET
    id = EXCLUDED.id,
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
    role = COALESCE(assigned_role, public.profiles.role),
    updated_at = now();

  -- UPDATE auth.users metadata to include role for RLS efficiency and recursion avoidance
  -- This requires the function to have enough permissions
  BEGIN
    UPDATE auth.users 
    SET raw_app_meta_data = jsonb_set(
      COALESCE(raw_app_meta_data, '{}'::jsonb),
      '{role}',
      to_jsonb(assigned_role)
    )
    WHERE id = new.id;
  EXCEPTION WHEN OTHERS THEN
    -- Fallback: If we can't update auth.users, at least we have the profile
  END;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger (drop first to be safe)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Table: audit_logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id),
    action TEXT NOT NULL,
    category TEXT, -- 'payroll', 'employee', 'auth', 'system'
    subsidiary_id UUID REFERENCES subsidiaries(id),
    details JSONB,
    timestamp TIMESTAMPTZ DEFAULT now()
);

-- Table: payroll_batches
CREATE TABLE IF NOT EXISTS payroll_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subsidiary_id UUID REFERENCES subsidiaries(id),
    month_year TEXT NOT NULL, -- e.g., '2024-03'
    payroll_group TEXT DEFAULT 'General',
    status TEXT DEFAULT 'draft', -- 'draft', 'pending', 'approved', 'paid', 'finalized'
    notes TEXT,
    created_by UUID REFERENCES public.profiles(id),
    approved_by UUID REFERENCES public.profiles(id),
    finalized_at TIMESTAMPTZ,
    finalized_by TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (subsidiary_id, month_year, payroll_group)
);

-- Table: payslips
CREATE TABLE IF NOT EXISTS payslips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) NOT NULL,
    subsidiary_id UUID REFERENCES subsidiaries(id),
    batch_id UUID REFERENCES payroll_batches(id) ON DELETE CASCADE,
    month_year TEXT NOT NULL,
    month_display TEXT,
    base_salary NUMERIC NOT NULL DEFAULT 0,
    overtime_pay NUMERIC DEFAULT 0,
    standard_hours NUMERIC DEFAULT 0,
    overtime_hours NUMERIC DEFAULT 0,
    gross_pay NUMERIC DEFAULT 0,
    tax_amount NUMERIC DEFAULT 0,
    aids_levy NUMERIC DEFAULT 0,
    nssa_deduction NUMERIC DEFAULT 0,
    loan_deductions NUMERIC DEFAULT 0,
    total_deductions NUMERIC DEFAULT 0,
    net_pay NUMERIC NOT NULL,
    currency TEXT DEFAULT 'USD',
    is_published BOOLEAN DEFAULT false,
    breakdown JSONB DEFAULT '{}'::jsonb,
    generated_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Table: leave_requests
CREATE TABLE IF NOT EXISTS leave_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) NOT NULL,
    type TEXT NOT NULL, -- 'annual', 'sick', 'maternity'
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status TEXT DEFAULT 'pending', -- 'pending', 'pending_approval', 'approved', 'rejected'
    reason TEXT,
    rejection_reason TEXT,
    manager_feedback TEXT,
    supervisor_id UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    reviewed_at TIMESTAMPTZ,
    reviewed_by TEXT
);

-- Table: loan_requests
CREATE TABLE IF NOT EXISTS loan_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) NOT NULL,
    amount NUMERIC NOT NULL,
    purpose TEXT,
    installments INTEGER NOT NULL,
    status TEXT DEFAULT 'pending',
    rejection_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    reviewed_at TIMESTAMPTZ,
    reviewed_by TEXT
);

-- Table: timesheets
CREATE TABLE IF NOT EXISTS timesheets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) NOT NULL,
    date DATE NOT NULL,
    month_year TEXT NOT NULL, -- '2024-03'
    hours_worked NUMERIC DEFAULT 0,
    overtime_hours NUMERIC DEFAULT 0,
    description TEXT,
    status TEXT DEFAULT 'pending',
    rejection_reason TEXT,
    submission_mode TEXT DEFAULT 'daily',
    subsidiary_id UUID REFERENCES subsidiaries(id),
    submitted_at TIMESTAMPTZ DEFAULT now(),
    reviewed_at TIMESTAMPTZ,
    reviewed_by TEXT
);

-- Table: personnel_reviews
CREATE TABLE IF NOT EXISTS personnel_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) NOT NULL,
    reviewer_id UUID REFERENCES public.profiles(id),
    review_date DATE NOT NULL,
    overall_rating INTEGER CHECK (overall_rating >= 1 AND overall_rating <= 5),
    feedback TEXT,
    goals TEXT,
    status TEXT DEFAULT 'pending', -- 'pending', 'completed'
    rejection_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    reviewed_at TIMESTAMPTZ,
    reviewed_by TEXT
);

-- Security Policies Fixes
CREATE OR REPLACE FUNCTION public.check_user_is_admin()
RETURNS BOOLEAN AS $$
DECLARE
  u_role TEXT;
BEGIN
  -- 1. Check JWT claims first (most efficient)
  u_role := (auth.jwt() -> 'app_metadata' ->> 'role');
  IF u_role IN ('admin', 'superadmin', 'management') THEN
    RETURN TRUE;
  END IF;

  -- 2. Direct email check in JWT
  IF (auth.jwt() ->> 'email') IN ('lodzax@gmail.com', 'accounts@mineazy.co.zw') THEN
    RETURN TRUE;
  END IF;

  -- 3. Fallback to profiles table query (SECURITY DEFINER ensures we bypass RLS here)
  SELECT role INTO u_role
  FROM public.profiles
  WHERE id = auth.uid();
  
  RETURN COALESCE(u_role IN ('admin', 'superadmin', 'management'), FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Enable Row Level Security (RLS)
ALTER TABLE subsidiaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE payslips ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE timesheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE personnel_reviews ENABLE ROW LEVEL SECURITY;

-- Personnel Reviews
DROP POLICY IF EXISTS "Users can view their own reviews" ON personnel_reviews;
CREATE POLICY "Users can view their own reviews" ON personnel_reviews
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can manage all reviews" ON personnel_reviews;
CREATE POLICY "Admins can manage all reviews" ON personnel_reviews
    FOR ALL USING (
        (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'superadmin', 'management')
        OR (auth.jwt() ->> 'email') IN ('lodzax@gmail.com', 'accounts@mineazy.co.zw')
        OR public.check_user_is_admin()
    );

-- profiles Table Policies (RECURSION RESISTANT)
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
CREATE POLICY "Users can view their own profile" ON profiles 
    FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Admins can view all users" ON profiles;
CREATE POLICY "Admins can view all users" ON profiles 
    FOR SELECT USING (
      -- 1. Direct role check in JWT
      (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'superadmin', 'management')
      -- 2. Direct email check in JWT
      OR (auth.jwt() ->> 'email') IN ('lodzax@gmail.com', 'accounts@mineazy.co.zw')
      -- 3. Fallback to a recursive-safe check (using security definer function)
      OR public.check_user_is_admin()
    );

DROP POLICY IF EXISTS "Admins can modify users" ON profiles;
CREATE POLICY "Admins can modify users" ON profiles
    FOR ALL USING (
      (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'superadmin', 'management')
      OR (auth.jwt() ->> 'email') IN ('lodzax@gmail.com', 'accounts@mineazy.co.zw')
      OR public.check_user_is_admin()
    );

-- Migration block for missing columns and data sync
DO $$
DECLARE
    r RECORD;
BEGIN
    -- ENSURE SUPER ADMINS EXIST IN PROFILES
    INSERT INTO public.profiles (id, email, role, full_name, status)
    SELECT id, email, 'superadmin', COALESCE(raw_user_meta_data->>'full_name', 'Super Admin'), 'active'
    FROM auth.users 
    WHERE email IN ('lodzax@gmail.com', 'accounts@mineazy.co.zw')
    ON CONFLICT (email) DO UPDATE SET 
        role = 'superadmin',
        id = EXCLUDED.id,
        status = 'active';

    -- Ensure personnel_reviews tracking exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'personnel_reviews' AND column_name = 'rejection_reason') THEN
        ALTER TABLE personnel_reviews ADD COLUMN rejection_reason TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'personnel_reviews' AND column_name = 'reviewed_at') THEN
        ALTER TABLE personnel_reviews ADD COLUMN reviewed_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'personnel_reviews' AND column_name = 'reviewed_by') THEN
        ALTER TABLE personnel_reviews ADD COLUMN reviewed_by TEXT;
    END IF;

    -- Fix timesheets submission_mode
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'timesheets' AND column_name = 'submission_mode') THEN
        ALTER TABLE timesheets ADD COLUMN submission_mode TEXT DEFAULT 'daily';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'timesheets' AND column_name = 'rejection_reason') THEN
        ALTER TABLE timesheets ADD COLUMN rejection_reason TEXT;
    END IF;

    -- Fix timesheets subsidiary_id
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'timesheets' AND column_name = 'subsidiary_id') THEN
        ALTER TABLE timesheets ADD COLUMN subsidiary_id UUID REFERENCES subsidiaries(id);
    END IF;

    -- Fix timesheets reviewed_at
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'timesheets' AND column_name = 'reviewed_at') THEN
        ALTER TABLE timesheets ADD COLUMN reviewed_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'timesheets' AND column_name = 'reviewed_by') THEN
        ALTER TABLE timesheets ADD COLUMN reviewed_by TEXT;
    END IF;

    -- Fix leave_requests reviewed_at/by
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leave_requests' AND column_name = 'reviewed_at') THEN
        ALTER TABLE leave_requests ADD COLUMN reviewed_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leave_requests' AND column_name = 'reviewed_by') THEN
        ALTER TABLE leave_requests ADD COLUMN reviewed_by TEXT;
    END IF;

    -- Fix loan_requests reviewed_at/by
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'loan_requests' AND column_name = 'rejection_reason') THEN
        ALTER TABLE loan_requests ADD COLUMN rejection_reason TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'loan_requests' AND column_name = 'reviewed_at') THEN
        ALTER TABLE loan_requests ADD COLUMN reviewed_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'loan_requests' AND column_name = 'reviewed_by') THEN
        ALTER TABLE loan_requests ADD COLUMN reviewed_by TEXT;
    END IF;

    -- Ensure branch exists in profiles
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'branch') THEN
        ALTER TABLE profiles ADD COLUMN branch TEXT;
    END IF;

    -- Explicitly ensure the FK exists with a standard name for PostgREST detection
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'payslips_user_id_fkey') THEN
        ALTER TABLE payslips ADD CONSTRAINT payslips_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id);
    END IF;

    -- Fix payslips columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payslips' AND column_name = 'subsidiary_id') THEN
        ALTER TABLE payslips ADD COLUMN subsidiary_id UUID REFERENCES subsidiaries(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payslips' AND column_name = 'month_display') THEN
        ALTER TABLE payslips ADD COLUMN month_display TEXT;
    END IF;
    -- Ensure basic_salary has a default if it exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payslips' AND column_name = 'basic_salary') THEN
        ALTER TABLE payslips ALTER COLUMN basic_salary SET DEFAULT 0;
    END IF;

    -- Ensure base_salary exists and matches basic_salary if needed
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payslips' AND column_name = 'base_salary') THEN
        ALTER TABLE payslips ADD COLUMN base_salary NUMERIC DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payslips' AND column_name = 'overtime_pay') THEN
        ALTER TABLE payslips ADD COLUMN overtime_pay NUMERIC DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payslips' AND column_name = 'standard_hours') THEN
        ALTER TABLE payslips ADD COLUMN standard_hours NUMERIC DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payslips' AND column_name = 'overtime_hours') THEN
        ALTER TABLE payslips ADD COLUMN overtime_hours NUMERIC DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payslips' AND column_name = 'gross_pay') THEN
        ALTER TABLE payslips ADD COLUMN gross_pay NUMERIC DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payslips' AND column_name = 'tax_amount') THEN
        ALTER TABLE payslips ADD COLUMN tax_amount NUMERIC DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payslips' AND column_name = 'aids_levy') THEN
        ALTER TABLE payslips ADD COLUMN aids_levy NUMERIC DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payslips' AND column_name = 'nssa_deduction') THEN
        ALTER TABLE payslips ADD COLUMN nssa_deduction NUMERIC DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payslips' AND column_name = 'loan_deductions') THEN
        ALTER TABLE payslips ADD COLUMN loan_deductions NUMERIC DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payslips' AND column_name = 'total_deductions') THEN
        ALTER TABLE payslips ADD COLUMN total_deductions NUMERIC DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payslips' AND column_name = 'is_published') THEN
        ALTER TABLE payslips ADD COLUMN is_published BOOLEAN DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payslips' AND column_name = 'breakdown') THEN
        ALTER TABLE payslips ADD COLUMN breakdown JSONB DEFAULT '{}'::jsonb;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payslips' AND column_name = 'updated_at') THEN
        ALTER TABLE payslips ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payslips' AND column_name = 'payroll_group') THEN
        ALTER TABLE payslips ADD COLUMN payroll_group TEXT;
    END IF;

    -- Fix loan_requests columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'loan_requests' AND column_name = 'subsidiary_id') THEN
        ALTER TABLE loan_requests ADD COLUMN subsidiary_id UUID REFERENCES subsidiaries(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'loan_requests' AND column_name = 'currency') THEN
        ALTER TABLE loan_requests ADD COLUMN currency TEXT DEFAULT 'USD';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'loan_requests' AND column_name = 'interest_rate') THEN
        ALTER TABLE loan_requests ADD COLUMN interest_rate NUMERIC DEFAULT 0;
    END IF;
    -- Standardize installment naming if needed
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'loan_requests' AND column_name = 'installment_count') THEN
        ALTER TABLE loan_requests ADD COLUMN installment_count INTEGER;
    END IF;

    -- Fix leave_requests columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leave_requests' AND column_name = 'subsidiary_id') THEN
        ALTER TABLE leave_requests ADD COLUMN subsidiary_id UUID REFERENCES subsidiaries(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leave_requests' AND column_name = 'rejection_reason') THEN
        ALTER TABLE leave_requests ADD COLUMN rejection_reason TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leave_requests' AND column_name = 'requested_days') THEN
        ALTER TABLE leave_requests ADD COLUMN requested_days NUMERIC;
    END IF;

    -- Add shortage_balance to profiles for Sales Reps
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'shortage_balance') THEN
        ALTER TABLE profiles ADD COLUMN shortage_balance NUMERIC DEFAULT 0;
    END IF;

    -- Ensure payroll_group exists in payroll_batches
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payroll_batches' AND column_name = 'payroll_group') THEN
        ALTER TABLE payroll_batches ADD COLUMN payroll_group TEXT DEFAULT 'General';
    END IF;
    
    -- Add notes column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payroll_batches' AND column_name = 'notes') THEN
        ALTER TABLE payroll_batches ADD COLUMN notes TEXT;
    END IF;
    
    -- Add finalized_at/by if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payroll_batches' AND column_name = 'finalized_at') THEN
        ALTER TABLE payroll_batches ADD COLUMN finalized_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payroll_batches' AND column_name = 'finalized_by') THEN
        ALTER TABLE payroll_batches ADD COLUMN finalized_by TEXT;
    END IF;

    -- Ensure unique constraint for upsert
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'payroll_batches' AND constraint_name = 'payroll_batches_sub_month_group_key'
    ) THEN
        ALTER TABLE payroll_batches ADD CONSTRAINT payroll_batches_sub_month_group_key UNIQUE (subsidiary_id, month_year, payroll_group);
    END IF;

    -- SYNC EXISTING ROLES TO auth.users metadata for RLS (Avoid recursion)
    -- This block tries to update auth metadata for current users
    BEGIN
      FOR r IN SELECT id, role FROM public.profiles LOOP
        UPDATE auth.users 
        SET raw_app_meta_data = jsonb_set(
          COALESCE(raw_app_meta_data, '{}'::jsonb),
          '{role}',
          to_jsonb(r.role)
        )
        WHERE id = r.id;
      END LOOP;
    EXCEPTION WHEN OTHERS THEN
      -- Silently fail if auth.users is inaccessible
    END;
END $$;

-- Audit Logs Table Security Fix
DROP POLICY IF EXISTS "Allow authenticated users to insert audit logs" ON audit_logs;
CREATE POLICY "Allow authenticated users to insert audit logs"
ON public.audit_logs
FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

-- Common Policies for Employee Data
-- Payslips
DROP POLICY IF EXISTS "Users can view their own payslips" ON payslips;
CREATE POLICY "Users can view their own payslips" ON payslips
    FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Admins can manage all payslips" ON payslips;
CREATE POLICY "Admins can manage all payslips" ON payslips
    FOR ALL 
    TO authenticated
    USING (
        (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'superadmin', 'management')
        OR (auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'superadmin', 'management')
        OR (auth.jwt() ->> 'email') IN ('lodzax@gmail.com', 'accounts@mineazy.co.zw')
        OR public.check_user_is_admin()
    )
    WITH CHECK (
        (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'superadmin', 'management')
        OR (auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'superadmin', 'management')
        OR (auth.jwt() ->> 'email') IN ('lodzax@gmail.com', 'accounts@mineazy.co.zw')
        OR public.check_user_is_admin()
    );

-- Leave Requests
DROP POLICY IF EXISTS "Users can view their own leave" ON leave_requests;
CREATE POLICY "Users can view their own leave" ON leave_requests
    FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can create their own leave" ON leave_requests;
CREATE POLICY "Users can create their own leave" ON leave_requests
    FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Admins can manage all leave" ON leave_requests;
CREATE POLICY "Admins can manage all leave" ON leave_requests
    FOR ALL USING (
        (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'superadmin', 'management')
        OR (auth.jwt() ->> 'email') IN ('lodzax@gmail.com', 'accounts@mineazy.co.zw')
        OR public.check_user_is_admin()
    );

-- Loan Requests
DROP POLICY IF EXISTS "Users can view their own loans" ON loan_requests;
CREATE POLICY "Users can view their own loans" ON loan_requests
    FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can create their own loans" ON loan_requests;
CREATE POLICY "Users can create their own loans" ON loan_requests
    FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Admins can manage all loans" ON loan_requests;
CREATE POLICY "Admins can manage all loans" ON loan_requests
    FOR ALL USING (
        (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'superadmin', 'management')
        OR (auth.jwt() ->> 'email') IN ('lodzax@gmail.com', 'accounts@mineazy.co.zw')
        OR public.check_user_is_admin()
    );

-- Timesheets
DROP POLICY IF EXISTS "Users can view their own timesheets" ON timesheets;
CREATE POLICY "Users can view their own timesheets" ON timesheets
    FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can create their own timesheets" ON timesheets;
CREATE POLICY "Users can create their own timesheets" ON timesheets
    FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Admins can manage all timesheets" ON timesheets;
CREATE POLICY "Admins can manage all timesheets" ON timesheets
    FOR ALL USING (
        (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'superadmin', 'management')
        OR (auth.jwt() ->> 'email') IN ('lodzax@gmail.com', 'accounts@mineazy.co.zw')
        OR public.check_user_is_admin()
    );

-- Subsidiaries
DROP POLICY IF EXISTS "Public subsidiaries viewable by authenticated" ON subsidiaries;
CREATE POLICY "Public subsidiaries viewable by authenticated" ON subsidiaries
    FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Admins can manage subsidiaries" ON subsidiaries;
CREATE POLICY "Admins can manage subsidiaries" ON subsidiaries
    FOR ALL USING (
        (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'superadmin', 'management')
        OR (auth.jwt() ->> 'email') IN ('lodzax@gmail.com', 'accounts@mineazy.co.zw')
        OR public.check_user_is_admin()
    );

-- Audit Logs
DROP POLICY IF EXISTS "Admins can view audit logs" ON audit_logs;
CREATE POLICY "Admins can view audit logs" ON audit_logs
    FOR SELECT USING (
        (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'superadmin', 'management')
        OR (auth.jwt() ->> 'email') IN ('lodzax@gmail.com', 'accounts@mineazy.co.zw')
        OR public.check_user_is_admin()
    );
DROP POLICY IF EXISTS "Authenticated users can create audit logs" ON audit_logs;
CREATE POLICY "Authenticated users can create audit logs" ON audit_logs
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Payroll Batches
DROP POLICY IF EXISTS "Admins can manage payroll batches" ON payroll_batches;
CREATE POLICY "Admins can manage payroll batches" ON payroll_batches
    FOR ALL USING (
        (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'superadmin', 'management')
        OR (auth.jwt() ->> 'email') IN ('lodzax@gmail.com', 'accounts@mineazy.co.zw')
        OR public.check_user_is_admin()
    );
DROP POLICY IF EXISTS "Users can view relevant batches" ON payroll_batches;
CREATE POLICY "Users can view relevant batches" ON payroll_batches
    FOR SELECT USING (auth.role() = 'authenticated');
