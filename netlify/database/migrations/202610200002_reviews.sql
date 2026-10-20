ALTER TABLE cinema_loves ADD COLUMN IF NOT EXISTS review text CHECK(review IS NULL OR char_length(review)<=1000);
ALTER TABLE cinema_loves ADD COLUMN IF NOT EXISTS created bigint NOT NULL DEFAULT 0;
