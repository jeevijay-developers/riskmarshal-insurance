-- Notification type enum
CREATE TYPE public.notification_type AS ENUM (
  'renewal_due',
  'lead_assigned',
  'commission_paid',
  'commission_pending'
);

-- Notifications table
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  reference_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast queries
CREATE INDEX idx_notifications_user_unread ON public.notifications (user_id, is_read, created_at DESC);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can view their own notifications
CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can update (mark read) their own notifications
CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- System can insert notifications (via triggers/functions)
CREATE POLICY "Service role can insert notifications"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Super admins can manage all notifications
CREATE POLICY "Admins can manage all notifications"
  ON public.notifications FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Trigger function: notify on lead assignment
CREATE OR REPLACE FUNCTION public.notify_lead_assigned()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid;
BEGIN
  IF NEW.assigned_intermediary_id IS NOT NULL AND
     (OLD.assigned_intermediary_id IS NULL OR OLD.assigned_intermediary_id != NEW.assigned_intermediary_id) THEN
    SELECT user_id INTO _user_id FROM public.profiles WHERE id = NEW.assigned_intermediary_id;
    IF _user_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, type, title, message, reference_id)
      VALUES (_user_id, 'lead_assigned', 'New Lead Assigned',
              'Lead "' || NEW.full_name || '" has been assigned to you.', NEW.id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_lead_assigned
  AFTER INSERT OR UPDATE OF assigned_intermediary_id ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.notify_lead_assigned();

-- Trigger function: notify on commission status change
CREATE OR REPLACE FUNCTION public.notify_commission_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid;
  _type notification_type;
  _title text;
  _msg text;
BEGIN
  IF NEW.status != OLD.status THEN
    SELECT user_id INTO _user_id FROM public.profiles WHERE id = NEW.intermediary_id;
    IF _user_id IS NOT NULL THEN
      IF NEW.status = 'paid' THEN
        _type := 'commission_paid';
        _title := 'Commission Paid';
        _msg := 'A commission of ₹' || NEW.commission_amount || ' has been marked as paid.';
      ELSIF NEW.status = 'pending' THEN
        _type := 'commission_pending';
        _title := 'Commission Pending';
        _msg := 'A new commission of ₹' || NEW.commission_amount || ' is pending.';
      ELSE
        RETURN NEW;
      END IF;
      INSERT INTO public.notifications (user_id, type, title, message, reference_id)
      VALUES (_user_id, _type, _title, _msg, NEW.id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_commission_status
  AFTER UPDATE OF status ON public.commissions
  FOR EACH ROW EXECUTE FUNCTION public.notify_commission_status();

-- Trigger function: notify on policy nearing expiry
CREATE OR REPLACE FUNCTION public.notify_renewal_due()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid;
  _client_name text;
  _days int;
BEGIN
  IF NEW.status IN ('active', 'expiring') AND NEW.end_date <= (CURRENT_DATE + INTERVAL '30 days') THEN
    IF OLD.renewal_status IS DISTINCT FROM NEW.renewal_status OR TG_OP = 'INSERT' THEN
      SELECT user_id INTO _user_id FROM public.profiles WHERE id = NEW.intermediary_id;
      SELECT full_name INTO _client_name FROM public.clients WHERE id = NEW.client_id;
      _days := (NEW.end_date - CURRENT_DATE);
      IF _user_id IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, type, title, message, reference_id)
        VALUES (_user_id, 'renewal_due', 'Policy Renewal Due',
                'Policy #' || NEW.policy_number || ' for ' || COALESCE(_client_name, 'Unknown') ||
                ' expires in ' || _days || ' days.', NEW.id);
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_renewal_due
  AFTER INSERT OR UPDATE OF renewal_status, status, end_date ON public.policies
  FOR EACH ROW EXECUTE FUNCTION public.notify_renewal_due();