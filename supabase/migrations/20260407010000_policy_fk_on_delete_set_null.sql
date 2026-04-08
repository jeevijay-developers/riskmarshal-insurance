-- Allow deleting policies without violating dependent foreign keys.
-- Keep history rows (quotations/commissions/renewals) by nulling the reference.

ALTER TABLE public.quotations
  DROP CONSTRAINT IF EXISTS quotations_policy_id_fkey;

ALTER TABLE public.quotations
  ADD CONSTRAINT quotations_policy_id_fkey
  FOREIGN KEY (policy_id)
  REFERENCES public.policies(id)
  ON DELETE SET NULL;

ALTER TABLE public.commissions
  DROP CONSTRAINT IF EXISTS commissions_policy_id_fkey;

ALTER TABLE public.commissions
  ADD CONSTRAINT commissions_policy_id_fkey
  FOREIGN KEY (policy_id)
  REFERENCES public.policies(id)
  ON DELETE SET NULL;

ALTER TABLE public.policies
  DROP CONSTRAINT IF EXISTS policies_renewed_from_policy_id_fkey;

ALTER TABLE public.policies
  ADD CONSTRAINT policies_renewed_from_policy_id_fkey
  FOREIGN KEY (renewed_from_policy_id)
  REFERENCES public.policies(id)
  ON DELETE SET NULL;
