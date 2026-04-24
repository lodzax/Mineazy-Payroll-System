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

-- Table: profiles (Extends Supabase Auth users)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    role TEXT DEFAULT 'employee', -- 'employee', 'admin'
    subsidiary_id UUID REFERENCES subsidiaries(id) ON DELETE SET NULL,
    currency TEXT DEFAULT 'USD',
    base_salary NUMERIC DEFAULT 1000,
    job_title TEXT,
    department TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

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

-- Enable Row Level Security (RLS)
ALTER TABLE subsidiaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE payslips ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_requests ENABLE ROW LEVEL SECURITY;

-- Basic Policies (example for profiles)
CREATE POLICY "Users can view their own profile" ON profiles 
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles" ON profiles 
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );
