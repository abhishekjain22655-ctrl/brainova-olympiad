-- =====================================================================
-- BRAINOVA NATIONAL OLYMPIAD - SUPABASE / POSTGRESQL RLS SCHEMA
-- Multi-Tenant Row Level Security (RLS) Architecture
-- =====================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------------------------------------------------------------------
-- 1. SCHOOLS (Institutional Tenants)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.schools (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_code VARCHAR(30) UNIQUE NOT NULL,
    school_name VARCHAR(255) NOT NULL,
    affiliation_board VARCHAR(50) DEFAULT 'CBSE',
    contact_person VARCHAR(150) NOT NULL,
    contact_email VARCHAR(150) UNIQUE NOT NULL,
    contact_phone VARCHAR(20) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    city VARCHAR(100) NOT NULL,
    district VARCHAR(100),
    state VARCHAR(100) NOT NULL,
    pincode VARCHAR(10) NOT NULL,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'pending', 'suspended')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for Schools
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;

-- School Tenant RLS Policies:
-- 1. Authenticated School users can only read and update their own institution's profile
CREATE POLICY "Schools can view own institutional record"
    ON public.schools
    FOR SELECT
    USING (auth.uid()::text = id::text OR auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Schools can update own record"
    ON public.schools
    FOR UPDATE
    USING (auth.uid()::text = id::text OR auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Allow public school registration"
    ON public.schools
    FOR INSERT
    WITH CHECK (true);

-- ---------------------------------------------------------------------
-- 2. STUDENTS TABLE (Scoped to Institutional Tenant)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.students (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    roll_number VARCHAR(50) UNIQUE NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    dob DATE,
    school_id UUID REFERENCES public.schools(id) ON DELETE SET NULL,
    grade_class VARCHAR(20) NOT NULL,
    parent_name VARCHAR(150),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    pincode VARCHAR(10),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'pending', 'suspended')),
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for Students
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

-- Student Tenant RLS Policies:
-- A student can view their own record; A school admin can view all students registered under their school_id
CREATE POLICY "Students can view own profile"
    ON public.students
    FOR SELECT
    USING (
        auth.uid()::text = id::text 
        OR (auth.jwt() ->> 'school_id')::text = school_id::text
        OR auth.jwt() ->> 'role' = 'admin'
    );

CREATE POLICY "Public registration for students"
    ON public.students
    FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Students can update own details"
    ON public.students
    FOR UPDATE
    USING (auth.uid()::text = id::text OR auth.jwt() ->> 'role' = 'admin');

-- ---------------------------------------------------------------------
-- 3. SUBJECTS & QUESTIONS
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subjects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug VARCHAR(50) UNIQUE NOT NULL,
    title VARCHAR(100) NOT NULL,
    description TEXT,
    duration_minutes INT DEFAULT 30,
    total_questions INT DEFAULT 15,
    marks_per_question INT DEFAULT 4,
    negative_marks NUMERIC(3,2) DEFAULT 0.00,
    icon_class VARCHAR(50) DEFAULT 'fa-book',
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read subjects" ON public.subjects FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS public.exam_questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE,
    class_group VARCHAR(30) DEFAULT 'All',
    question_text TEXT NOT NULL,
    option_a TEXT NOT NULL,
    option_b TEXT NOT NULL,
    option_c TEXT NOT NULL,
    option_d TEXT NOT NULL,
    correct_option VARCHAR(2) NOT NULL CHECK (correct_option IN ('A', 'B', 'C', 'D')),
    explanation TEXT,
    difficulty VARCHAR(20) DEFAULT 'medium',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.exam_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read questions" ON public.exam_questions FOR SELECT USING (true);

-- ---------------------------------------------------------------------
-- 4. EXAM ATTEMPTS (Multi-Tenant Score Ledger)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.exam_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    school_id UUID REFERENCES public.schools(id) ON DELETE SET NULL,
    subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
    total_questions INT NOT NULL,
    answered_count INT DEFAULT 0,
    correct_count INT DEFAULT 0,
    wrong_count INT DEFAULT 0,
    score INT NOT NULL DEFAULT 0,
    max_score INT NOT NULL DEFAULT 60,
    percentage NUMERIC(5,2) DEFAULT 0.00,
    time_taken_seconds INT DEFAULT 0,
    status VARCHAR(20) DEFAULT 'completed',
    attempted_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.exam_attempts ENABLE ROW LEVEL SECURITY;

-- Tenant Isolated Attempts:
-- Student can see own attempts; School can see attempts made by its registered students; Global admin sees all
CREATE POLICY "Tenant isolated exam attempts"
    ON public.exam_attempts
    FOR SELECT
    USING (
        student_id::text = auth.uid()::text
        OR school_id::text = (auth.jwt() ->> 'school_id')::text
        OR auth.jwt() ->> 'role' = 'admin'
    );

CREATE POLICY "Insert exam attempts"
    ON public.exam_attempts
    FOR INSERT
    WITH CHECK (true);

-- ---------------------------------------------------------------------
-- 5. CONTACT & NEWSLETTERS
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.contact_inquiries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name VARCHAR(150) NOT NULL,
    phone_number VARCHAR(25) NOT NULL,
    email VARCHAR(150) NOT NULL,
    message TEXT NOT NULL,
    inquiry_type VARCHAR(50) DEFAULT 'quote_request',
    status VARCHAR(20) DEFAULT 'new',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.newsletter_subscribers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(150) UNIQUE NOT NULL,
    subscribed_at TIMESTAMPTZ DEFAULT NOW()
);
