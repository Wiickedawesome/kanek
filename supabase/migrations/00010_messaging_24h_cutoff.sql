-- Disable messaging 24 hours after a contract is completed or cancelled.
-- Replaces the existing contract_messages_insert policy with one that
-- also checks the contract status and the 24-hour grace period.

DROP POLICY IF EXISTS "contract_messages_insert" ON "public"."contract_messages";

CREATE POLICY "contract_messages_insert"
  ON "public"."contract_messages"
  FOR INSERT
  WITH CHECK (
    "sender_id" = "auth"."uid"()
    AND "public"."is_active_account"()
    AND EXISTS (
      SELECT 1
      FROM "public"."contracts" c
      WHERE c."id" = "contract_messages"."contract_id"
        AND "auth"."uid"() = ANY (c."parties")
        AND (
          -- Active or disputed contracts: messaging always allowed
          c."status" IN ('active', 'disputed')
          OR (
            -- Completed/cancelled: allow for 24 hours after completion
            c."status" IN ('completed', 'cancelled')
            AND COALESCE(c."completed_at", c."created_at")
                > (now() - interval '24 hours')
          )
        )
    )
  );
