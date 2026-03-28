-- 00007_notifications.sql
-- In-app notifications and route waitlist

-- Notifications
CREATE TABLE notifications (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type       text NOT NULL,
  title      text NOT NULL,
  body       text,
  data       jsonb,
  read       boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Waitlist for full routes
CREATE TABLE waitlist (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  notified   boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- One waitlist entry per user per post
CREATE UNIQUE INDEX idx_waitlist_unique ON waitlist(post_id, user_id);

-- Indexes
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id) WHERE read = false;
CREATE INDEX idx_notifications_created ON notifications(created_at DESC);
CREATE INDEX idx_waitlist_post ON waitlist(post_id);
