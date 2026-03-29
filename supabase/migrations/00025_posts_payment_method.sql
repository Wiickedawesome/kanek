-- Add payment_method column to posts (reuses existing payment_method enum from bookings)
ALTER TABLE posts ADD COLUMN payment_method payment_method NOT NULL DEFAULT 'cash';
