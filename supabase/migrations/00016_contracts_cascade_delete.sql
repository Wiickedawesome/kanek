-- Fix contracts FK to cascade on post deletion
ALTER TABLE contracts
  DROP CONSTRAINT IF EXISTS contracts_post_id_fkey,
  ADD CONSTRAINT contracts_post_id_fkey
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE;
