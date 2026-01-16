CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS items (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  price DECIMAL NOT NULL,
  owner_id INTEGER REFERENCES users(id),
  available BOOLEAN DEFAULT TRUE,
  image_url TEXT
);

CREATE TABLE IF NOT EXISTS rentals (
  id SERIAL PRIMARY KEY,
  item_id INTEGER REFERENCES items(id),
  renter_id INTEGER REFERENCES users(id),
  start_date TIMESTAMP NOT NULL,
  end_date TIMESTAMP NOT NULL,
  status TEXT DEFAULT 'active'
);
