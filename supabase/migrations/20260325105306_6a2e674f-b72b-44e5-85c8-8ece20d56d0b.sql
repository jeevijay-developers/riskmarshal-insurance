-- Fix overly permissive INSERT policy
DROP POLICY "Service role can insert notifications" ON public.notifications;

CREATE POLICY "Users can receive notifications"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);