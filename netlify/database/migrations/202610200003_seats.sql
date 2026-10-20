ALTER TABLE cinema_seats DROP CONSTRAINT IF EXISTS cinema_seats_seat_check;
ALTER TABLE cinema_seats ADD CONSTRAINT cinema_seats_seat_check CHECK(seat ~ '^[A-DS][0-7]$');
