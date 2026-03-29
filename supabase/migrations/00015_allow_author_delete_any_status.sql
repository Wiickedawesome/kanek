-- Allow post authors to delete their own posts regardless of status
DROP POLICY IF EXISTS "posts_delete_author_open" ON posts;

CREATE POLICY "posts_delete_author" ON posts
  FOR DELETE TO authenticated
  USING (author_id = auth.uid());
