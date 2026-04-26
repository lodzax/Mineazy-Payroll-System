-- Supabase Schema for Mineazy Payroll
-- Paste this into your Supabase SQL Editor

-- Table: subsidiaries
CREATE TABLE IF NOT EXISTS subsidiaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    address TEXT,
    contact_email TEXT,
    tax_number TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Table: users (Extends Supabase Auth users)
CREATE TABLE IF NOT EXISTS users (
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

-- Trigger to automatically create a user entry in our public table when a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    assigned_role TEXT;
BEGIN
  -- Assign role based on email
  IF (new.email = 'lodzax@gmail.com' OR new.email = 'accounts@mineazy.co.zw') THEN
    assigned_role := 'admin';
  ELSE
    assigned_role := 'employee';
  END IF;

  INSERT INTO public.users (id, email, full_name, role)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'full_name', assigned_role)
  ON CONFLICT (email) DO UPDATE SET
    id = EXCLUDED.id,
    full_name = COALESCE(EXCLUDED.full_name, public.users.full_name),
    updated_at = now();
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Table: audit_logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
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
    status TEXT DEFAULT 'draft', -- 'draft', 'pending', 'approved', 'paid'
    created_by UUID REFERENCES auth.users(id),
    approved_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Table: payslips
CREATE TABLE IF NOT EXISTS payslips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    batch_id UUID REFERENCES payroll_batches(id) ON DELETE CASCADE,
    month_year TEXT NOT NULL,
    basic_salary NUMERIC NOT NULL,
    allowances NUMERIC DEFAULT 0,
    deductions NUMERIC DEFAULT 0,
    paye NUMERIC DEFAULT 0,
    nssa NUMERIC DEFAULT 0,
    net_pay NUMERIC NOT NULL,
    currency TEXT DEFAULT 'USD',
    generated_at TIMESTAMPTZ DEFAULT now()
);

-- Table: leave_requests
CREATE TABLE IF NOT EXISTS leave_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    type TEXT NOT NULL, -- 'annual', 'sick', 'maternity'
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Table: loan_requests
CREATE TABLE IF NOT EXISTS loan_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    amount NUMERIC NOT NULL,
    purpose TEXT,
    installments INTEGER NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Table: timesheets
CREATE TABLE IF NOT EXISTS timesheets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    date DATE NOT NULL,
    month_year TEXT NOT NULL, -- '2024-03'
    hours_worked NUMERIC DEFAULT 0,
    overtime_hours NUMERIC DEFAULT 0,
    description TEXT,
    status TEXT DEFAULT 'pending',
    submission_mode TEXT DEFAULT 'daily',
    subsidiary_id TEXT,
    submitted_at TIMESTAMPTZ DEFAULT now()
);

-- Table: personnel_reviews
CREATE TABLE IF NOT EXISTS personnel_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    reviewer_id UUID REFERENCES auth.users(id),
    review_date DATE NOT NULL,
    overall_rating INTEGER CHECK (overall_rating >= 1 AND overall_rating <= 5),
    feedback TEXT,
    goals TEXT,
    status TEXT DEFAULT 'completed',
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE personnel_reviews ENABLE ROW LEVEL SECURITY;

-- Security Policies Fixes
CREATE OR REPLACE FUNCTION public.check_user_is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  -- We MUST NOT query users table recursively if this is called from a users policy
  -- SECURITY DEFINER runs as the creator (postgres) which bypasses RLS
  RETURN EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'superadmin', 'management')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Enable Row Level Security (RLS)
ALTER TABLE subsidiaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE payslips ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE timesheets ENABLE ROW LEVEL SECURITY;

-- Personnel Reviews
CREATE POLICY "Users can view their own reviews" ON personnel_reviews
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage all reviews" ON personnel_reviews
    FOR ALL USING (public.check_user_is_admin());

-- Users Table Policies (Careful with recursion)
DROP POLICY IF EXISTS "Users can view their own profile" ON users;
CREATE POLICY "Users can view their own profile" ON users 
    FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Admins can view all users" ON users;
CREATE POLICY "Admins can view all users" ON users 
    FOR SELECT USING (public.check_user_is_admin());

DROP POLICY IF EXISTS "Admins can modify users" ON users;
CREATE POLICY "Admins can modify users" ON users
    FOR ALL USING (public.check_user_is_admin());

-- Migration block for missing columns
DO $$
BEGIN
    -- Fix timesheets submission_mode
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'timesheets' AND column_name = 'submission_mode') THEN
        ALTER TABLE timesheets ADD COLUMN submission_mode TEXT DEFAULT 'daily';
    END IF;

    -- Fix timesheets subsidiary_id
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'timesheets' AND column_name = 'subsidiary_id') THEN
        ALTER TABLE timesheets ADD COLUMN subsidiary_id TEXT;
    END IF;

    -- Ensure branch exists in users
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'branch') THEN
        ALTER TABLE users ADD COLUMN branch TEXT;
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
END $$;

-- Audit Logs Table Security Fix
DROP POLICY IF EXISTS "Authenticated users can create audit logs" ON audit_logs;
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
DROP POLICY IF EXISTS "Admins can view all payslips" ON payslips;
CREATE POLICY "Admins can view all payslips" ON payslips
    FOR SELECT USING (public.check_user_is_admin());

-- Leave Requests
DROP POLICY IF EXISTS "Users can view their own leave" ON leave_requests;
CREATE POLICY "Users can view their own leave" ON leave_requests
    FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can create their own leave" ON leave_requests;
CREATE POLICY "Users can create their own leave" ON leave_requests
    FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Admins can view all leave" ON leave_requests;
CREATE POLICY "Admins can view all leave" ON leave_requests
    FOR SELECT USING (public.check_user_is_admin());

-- Loan Requests
DROP POLICY IF EXISTS "Users can view their own loans" ON loan_requests;
CREATE POLICY "Users can view their own loans" ON loan_requests
    FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can create their own loans" ON loan_requests;
CREATE POLICY "Users can create their own loans" ON loan_requests
    FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Admins can view all loans" ON loan_requests;
CREATE POLICY "Admins can view all loans" ON loan_requests
    FOR SELECT USING (public.check_user_is_admin());

-- Timesheets
DROP POLICY IF EXISTS "Users can view their own timesheets" ON timesheets;
CREATE POLICY "Users can view their own timesheets" ON timesheets
    FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can create their own timesheets" ON timesheets;
CREATE POLICY "Users can create their own timesheets" ON timesheets
    FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Admins can view all timesheets" ON timesheets;
CREATE POLICY "Admins can view all timesheets" ON timesheets
    FOR SELECT USING (public.check_user_is_admin());

-- Subsidiaries
DROP POLICY IF EXISTS "Public subsidiaries viewable by authenticated" ON subsidiaries;
CREATE POLICY "Public subsidiaries viewable by authenticated" ON subsidiaries
    FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Admins can manage subsidiaries" ON subsidiaries;
CREATE POLICY "Admins can manage subsidiaries" ON subsidiaries
    FOR ALL USING (public.check_user_is_admin());

-- Audit Logs
DROP POLICY IF EXISTS "Admins can view audit logs" ON audit_logs;
CREATE POLICY "Admins can view audit logs" ON audit_logs
    FOR SELECT USING (public.check_user_is_admin());
DROP POLICY IF EXISTS "Authenticated users can create audit logs" ON audit_logs;
CREATE POLICY "Authenticated users can create audit logs" ON audit_logs
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Payroll Batches
DROP POLICY IF EXISTS "Admins can manage payroll batches" ON payroll_batches;
CREATE POLICY "Admins can manage payroll batches" ON payroll_batches
    FOR ALL USING (public.check_user_is_admin());
DROP POLICY IF EXISTS "Users can view relevant batches" ON payroll_batches;
CREATE POLICY "Users can view relevant batches" ON payroll_batches
    FOR SELECT USING (auth.role() = 'authenticated');
