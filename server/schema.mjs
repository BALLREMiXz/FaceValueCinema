export const schema = `
CREATE TABLE IF NOT EXISTS cinema_orders (
 id text PRIMARY KEY, token_hash text NOT NULL, request_id text UNIQUE NOT NULL,
 status text NOT NULL CHECK(status IN ('pending','approved','rejected')),
 payload jsonb NOT NULL, created bigint NOT NULL, expires bigint NOT NULL
);
CREATE TABLE IF NOT EXISTS cinema_seats (
 movie text NOT NULL, show_date text NOT NULL, show_time text NOT NULL,
 seat text NOT NULL CHECK(seat ~ '^[A-DS][0-7]$'), order_id text NOT NULL REFERENCES cinema_orders(id),
 PRIMARY KEY(movie,show_date,show_time,seat)
);
CREATE INDEX IF NOT EXISTS cinema_seats_order ON cinema_seats(order_id);
CREATE TABLE IF NOT EXISTS cinema_receipts (
 order_id text PRIMARY KEY REFERENCES cinema_orders(id), receipt_id text UNIQUE NOT NULL,
 image bytea NOT NULL CHECK(octet_length(image)<=2097152)
);
CREATE TABLE IF NOT EXISTS cinema_sessions (token_hash text PRIMARY KEY, expires bigint NOT NULL, password_tag text NOT NULL);
CREATE TABLE IF NOT EXISTS cinema_limits (key text PRIMARY KEY, attempts integer NOT NULL, until_ms bigint NOT NULL);
CREATE TABLE IF NOT EXISTS cinema_loves (
 movie text NOT NULL, browser_hash text NOT NULL, hearts integer NOT NULL CHECK(hearts BETWEEN 1 AND 5),
 PRIMARY KEY(movie,browser_hash)
);
ALTER TABLE cinema_loves ADD COLUMN IF NOT EXISTS review text CHECK(review IS NULL OR char_length(review)<=1000);
ALTER TABLE cinema_loves ADD COLUMN IF NOT EXISTS created bigint NOT NULL DEFAULT 0;
ALTER TABLE cinema_seats DROP CONSTRAINT IF EXISTS cinema_seats_seat_check;
ALTER TABLE cinema_seats ADD CONSTRAINT cinema_seats_seat_check CHECK(seat ~ '^[A-DS][0-7]$');
`;
