-- Phase 4: Paystack billing integration for UserSessions.io
-- We use a credit model. Credits are purchased via Paystack and deducted per action.

ALTER TABLE us_clients
  ADD COLUMN IF NOT EXISTS credit_balance integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paystack_authorization_code text,
  ADD COLUMN IF NOT EXISTS email text;

-- Atomic RPC to deduct credits
CREATE OR REPLACE FUNCTION us_deduct_credits(p_client_id uuid, p_amount integer)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  v_balance integer;
BEGIN
  SELECT credit_balance INTO v_balance
  FROM us_clients WHERE id = p_client_id FOR UPDATE;

  IF v_balance < p_amount THEN
    RETURN jsonb_build_object('allowed', false, 'balance', v_balance);
  END IF;

  UPDATE us_clients SET
    credit_balance = credit_balance - p_amount
  WHERE id = p_client_id;

  RETURN jsonb_build_object('allowed', true, 'balance', v_balance - p_amount);
END;
$$;
