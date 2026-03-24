
-- ============================================
-- RISKMARSHAL DATABASE SCHEMA - Phase 1 MVP
-- ============================================

-- 1. Create role enum
CREATE TYPE public.app_role AS ENUM ('super_admin', 'intermediary', 'staff');

-- 2. Create policy_status enum
CREATE TYPE public.policy_status AS ENUM ('active', 'expiring', 'expired', 'cancelled');

-- 3. Create renewal_status enum
CREATE TYPE public.renewal_status AS ENUM ('upcoming', 'reminder_sent', 'renewed', 'lapsed');

-- 4. Create lead_status enum
CREATE TYPE public.lead_status AS ENUM ('new', 'contacted', 'in_discussion', 'converted', 'lost');

-- 5. Create payment_status enum
CREATE TYPE public.payment_status AS ENUM ('pending', 'paid', 'expired', 'cancelled');

-- 6. Create commission_status enum
CREATE TYPE public.commission_status AS ENUM ('pending', 'paid', 'cancelled');

-- ============================================
-- USER ROLES TABLE (separate from profiles)
-- ============================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Helper to get user's role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- RLS for user_roles
CREATE POLICY "Users can view own role" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles" ON public.user_roles
  FOR SELECT USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));

-- ============================================
-- PROFILES TABLE
-- ============================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  phone TEXT,
  parent_intermediary_id UUID REFERENCES public.profiles(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all profiles" ON public.profiles
  FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), NEW.email);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- INSURERS TABLE
-- ============================================
CREATE TABLE public.insurers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  logo_url TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.insurers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view active insurers" ON public.insurers
  FOR SELECT TO authenticated USING (is_active = true OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admins can manage insurers" ON public.insurers
  FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));

-- ============================================
-- INTERMEDIARY_INSURERS (junction table)
-- ============================================
CREATE TABLE public.intermediary_insurers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intermediary_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  insurer_id UUID REFERENCES public.insurers(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(intermediary_id, insurer_id)
);

ALTER TABLE public.intermediary_insurers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own insurer associations" ON public.intermediary_insurers
  FOR SELECT USING (
    intermediary_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    OR public.has_role(auth.uid(), 'super_admin')
  );

CREATE POLICY "Admins can manage insurer associations" ON public.intermediary_insurers
  FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));

-- ============================================
-- CLIENTS TABLE
-- ============================================
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  date_of_birth DATE,
  intermediary_id UUID REFERENCES public.profiles(id) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- Helper to get profile id from auth uid
CREATE OR REPLACE FUNCTION public.get_profile_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.profiles WHERE user_id = _user_id LIMIT 1
$$;

CREATE POLICY "Intermediaries can view own clients" ON public.clients
  FOR SELECT USING (
    intermediary_id = public.get_profile_id(auth.uid())
    OR public.has_role(auth.uid(), 'super_admin')
  );

CREATE POLICY "Intermediaries can create clients" ON public.clients
  FOR INSERT WITH CHECK (
    intermediary_id = public.get_profile_id(auth.uid())
    OR public.has_role(auth.uid(), 'super_admin')
  );

CREATE POLICY "Intermediaries can update own clients" ON public.clients
  FOR UPDATE USING (
    intermediary_id = public.get_profile_id(auth.uid())
    OR public.has_role(auth.uid(), 'super_admin')
  );

CREATE POLICY "Intermediaries can delete own clients" ON public.clients
  FOR DELETE USING (
    intermediary_id = public.get_profile_id(auth.uid())
    OR public.has_role(auth.uid(), 'super_admin')
  );

-- ============================================
-- POLICIES TABLE
-- ============================================
CREATE TABLE public.policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_number TEXT NOT NULL UNIQUE,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  intermediary_id UUID REFERENCES public.profiles(id) NOT NULL,
  insurer_id UUID REFERENCES public.insurers(id),
  policy_type TEXT NOT NULL DEFAULT 'general',
  premium_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  coverage_amount NUMERIC(14,2),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status policy_status NOT NULL DEFAULT 'active',
  renewal_status renewal_status NOT NULL DEFAULT 'upcoming',
  renewed_from_policy_id UUID REFERENCES public.policies(id),
  original_document_url TEXT,
  ocr_extracted_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Intermediaries can view own policies" ON public.policies
  FOR SELECT USING (
    intermediary_id = public.get_profile_id(auth.uid())
    OR public.has_role(auth.uid(), 'super_admin')
  );

CREATE POLICY "Intermediaries can create policies" ON public.policies
  FOR INSERT WITH CHECK (
    intermediary_id = public.get_profile_id(auth.uid())
    OR public.has_role(auth.uid(), 'super_admin')
  );

CREATE POLICY "Intermediaries can update own policies" ON public.policies
  FOR UPDATE USING (
    intermediary_id = public.get_profile_id(auth.uid())
    OR public.has_role(auth.uid(), 'super_admin')
  );

-- ============================================
-- QUOTATIONS TABLE
-- ============================================
CREATE TABLE public.quotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id UUID REFERENCES public.policies(id),
  client_id UUID REFERENCES public.clients(id) NOT NULL,
  intermediary_id UUID REFERENCES public.profiles(id) NOT NULL,
  sent_via TEXT DEFAULT 'email',
  sent_at TIMESTAMPTZ,
  payment_status payment_status NOT NULL DEFAULT 'pending',
  alert_count INTEGER NOT NULL DEFAULT 0,
  amount NUMERIC(12,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Intermediaries can view own quotations" ON public.quotations
  FOR SELECT USING (
    intermediary_id = public.get_profile_id(auth.uid())
    OR public.has_role(auth.uid(), 'super_admin')
  );

CREATE POLICY "Intermediaries can manage own quotations" ON public.quotations
  FOR ALL USING (
    intermediary_id = public.get_profile_id(auth.uid())
    OR public.has_role(auth.uid(), 'super_admin')
  );

-- ============================================
-- LEADS TABLE
-- ============================================
CREATE TABLE public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  source TEXT DEFAULT 'website',
  insurance_type_interest TEXT,
  message TEXT,
  status lead_status NOT NULL DEFAULT 'new',
  assigned_intermediary_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all leads" ON public.leads
  FOR SELECT USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Intermediaries can view assigned leads" ON public.leads
  FOR SELECT USING (assigned_intermediary_id = public.get_profile_id(auth.uid()));

CREATE POLICY "Admins can manage leads" ON public.leads
  FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Intermediaries can update assigned leads" ON public.leads
  FOR UPDATE USING (assigned_intermediary_id = public.get_profile_id(auth.uid()));

-- ============================================
-- COMMISSIONS TABLE
-- ============================================
CREATE TABLE public.commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intermediary_id UUID REFERENCES public.profiles(id) NOT NULL,
  policy_id UUID REFERENCES public.policies(id),
  insurer_id UUID REFERENCES public.insurers(id),
  premium_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  commission_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  commission_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  status commission_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all commissions" ON public.commissions
  FOR SELECT USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Intermediaries can view own commissions" ON public.commissions
  FOR SELECT USING (intermediary_id = public.get_profile_id(auth.uid()));

CREATE POLICY "Admins can manage commissions" ON public.commissions
  FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));

-- ============================================
-- UPDATED_AT TRIGGER FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Apply to all tables
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_insurers_updated_at BEFORE UPDATE ON public.insurers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_policies_updated_at BEFORE UPDATE ON public.policies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_quotations_updated_at BEFORE UPDATE ON public.quotations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_commissions_updated_at BEFORE UPDATE ON public.commissions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- POLICY DOCUMENTS STORAGE BUCKET
-- ============================================
INSERT INTO storage.buckets (id, name, public) VALUES ('policy-documents', 'policy-documents', false);

CREATE POLICY "Authenticated users can upload policy documents" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'policy-documents');

CREATE POLICY "Users can view own policy documents" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'policy-documents');
