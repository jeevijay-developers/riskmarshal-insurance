-- Add notification preferences to user profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS notification_preferences JSONB NOT NULL DEFAULT '{"email": true, "renewalReminders": true, "claimsAlerts": false, "newClients": true}'::jsonb;

-- Add singleton-style organization settings table for admin-managed business config
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL DEFAULT '',
  address TEXT,
  city TEXT,
  state TEXT,
  pincode TEXT,
  gst_number TEXT,
  api_config JSONB,
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'organizations'
      AND policyname = 'Authenticated users can view organizations'
  ) THEN
    CREATE POLICY "Authenticated users can view organizations"
      ON public.organizations
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'organizations'
      AND policyname = 'Super admins can manage organizations'
  ) THEN
    CREATE POLICY "Super admins can manage organizations"
      ON public.organizations
      FOR ALL
      TO authenticated
      USING (public.has_role(auth.uid(), 'super_admin'::public.app_role))
      WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));
  END IF;
END;
$$;

-- Ensure renewal_config exists for environments where this table was not migrated yet
CREATE TABLE IF NOT EXISTS public.renewal_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_email_template TEXT NOT NULL DEFAULT 'Your insurance policy with {{insurerName}} is expiring in {{days}} days. Please contact your agent to renew.',
  intermediary_email_template TEXT NOT NULL DEFAULT 'Your client {{clientName}}''s policy {{policyNumber}} is expiring in {{days}} days. Please follow up for renewal.',
  cron_schedule TEXT NOT NULL DEFAULT '0 8 * * *',
  reminder_windows TEXT NOT NULL DEFAULT '60, 30, 15, 7',
  enabled BOOLEAN NOT NULL DEFAULT true,
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.renewal_config ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'renewal_config'
      AND policyname = 'Authenticated users can view renewal config'
  ) THEN
    CREATE POLICY "Authenticated users can view renewal config"
      ON public.renewal_config
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'renewal_config'
      AND policyname = 'Super admins can manage renewal config'
  ) THEN
    CREATE POLICY "Super admins can manage renewal config"
      ON public.renewal_config
      FOR ALL
      TO authenticated
      USING (public.has_role(auth.uid(), 'super_admin'::public.app_role))
      WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.touch_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_organizations_updated_at ON public.organizations;
CREATE TRIGGER trg_touch_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at_column();

DROP TRIGGER IF EXISTS trg_touch_renewal_config_updated_at ON public.renewal_config;
CREATE TRIGGER trg_touch_renewal_config_updated_at
  BEFORE UPDATE ON public.renewal_config
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at_column();
