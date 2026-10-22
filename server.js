require('dotenv').config();
const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const SHOP_NAME = process.env.SHOP_NAME || 'E-Point & Printx Digital Hub';
const SHOP_WHATSAPP = (process.env.SHOP_WHATSAPP || '91XXXXXXXXXX').replace(/\D/g, '');
const SHOP_ADDRESS = process.env.SHOP_ADDRESS || 'দোকানের ঠিকানা যোগ করুন';
const SESSION_SECRET = process.env.SESSION_SECRET || 'development-only-change-me-before-deployment';

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false, limit: '100kb' }));
app.use(cookieParser());
app.use(session({
  name: 'epx.sid',
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 1000 * 60 * 60 * 8 }
}));

const db = new Database(path.join(__dirname, 'epoint.db'));
db.pragma('journal_mode = WAL');
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('customer','admin','rider')),
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES users(id),
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  service TEXT NOT NULL CHECK(service IN ('repair','accessory','purchase')),
  category TEXT NOT NULL,
  item_name TEXT NOT NULL,
  issue TEXT NOT NULL,
  weight_kg REAL NOT NULL DEFAULT 0,
  distance_km REAL NOT NULL DEFAULT 0,
  address TEXT NOT NULL,
  preferred_time TEXT NOT NULL DEFAULT '',
  estimated_charge INTEGER NOT NULL,
  final_repair_cost INTEGER,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK(status IN ('pending','confirmed','rider_assigned','picked_up','repairing','ready','out_for_delivery','delivered','cancelled')),
  rider_id INTEGER REFERENCES users(id),
  admin_note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS bookings_customer_idx ON bookings(customer_id);
CREATE INDEX IF NOT EXISTS bookings_status_idx ON bookings(status);
`);

const adminCount = db.prepare("SELECT COUNT(*) AS n FROM users WHERE role='admin'").get().n;
if (!adminCount) {
  const phone = process.env.ADMIN_PHONE || '9999999999';
  const password = process.env.ADMIN_PASSWORD || 'ChangeThisAdminPassword123!';
  db.prepare('INSERT OR IGNORE INTO users(name,phone,password_hash,role) VALUES(?,?,?,?)')
    .run(process.env.ADMIN_NAME || 'Shop Admin', phone, bcrypt.hashSync(password, 12), 'admin');
  console.log(`Initial admin login phone: ${phone}`);
  if (!process.env.ADMIN_PASSWORD) console.warn('SECURITY: set ADMIN_PASSWORD before public deployment.');
}

const safeUser = u => ({ id: u.id, name: u.name, phone: u.phone, role: u.role });
const currentUser = req => req.session.user || null;
function auth(req, res, next) {
  if (!currentUser(req)) return res.status(401).json({ error: 'আগে লগইন করুন।' });
  next();
}
function role(...roles) {
  return (req, res, next) => {
    if (!currentUser(req)) return res.status(401).json({ error: 'আগে লগইন করুন।' });
    if (!roles.includes(currentUser(req).role)) return res.status(403).json({ error: 'এই কাজের অনুমতি নেই।' });
    next();
  };
}
function estimate(service, weight, distance) {
  if (service === 'accessory') return 40;
  if (service === 'purchase') return 0;
  if (weight > 2 || distance < 0) return null;
  // ₹100 base covers pickup and delivery within 10 km. Extra distance is calculated per km beyond 10.
  if (distance <= 10) return 100;
  return 100 + Math.ceil(distance - 10) * 10;
}
function bookingView(b) {
  return {
    ...b,
    customer_id: undefined,
    whatsapp_url: `https://wa.me/${SHOP_WHATSAPP}?text=${encodeURIComponent(
      `${SHOP_NAME} — বুকিং #${b.id}\nনাম: ${b.customer_name}\nফোন: ${b.phone}\nপরিষেবা: ${b.service}\nপণ্য: ${b.category} / ${b.item_name}\nসমস্যা/বিবরণ: ${b.issue}\nওজন: ${b.weight_kg} কেজি\nদূরত্ব: ${b.distance_km} কিমি\nঠিকানা: ${b.address}\nআনুমানিক চার্জ: ₹${b.estimated_charge}\nস্ট্যাটাস: ${b.status}`
    )}`
  };
}
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/config', (req, res) => res.json({
  shopName: SHOP_NAME, shopAddress: SHOP_ADDRESS,
  whatsappConfigured: !SHOP_WHATSAPP.includes('X'),
  whatsappNumber: SHOP_WHATSAPP,
  charges: { repairBase: 100, accessoryDelivery: 40, includedDistanceKm: 10, extraPerKm: 10, includedWeightKg: 2 }
}));

app.post('/api/register', (req, res) => {
  const { name, phone, password } = req.body || {};
  if (!name || !phone || !password || String(password).length < 8)
    return res.status(400).json({ error: 'নাম, ফোন এবং কমপক্ষে ৮ অক্ষরের পাসওয়ার্ড দিন।' });
  const normalizedPhone = String(phone).replace(/[^\d+]/g, '');
  if (normalizedPhone.length < 10 || normalizedPhone.length > 15)
    return res.status(400).json({ error: 'সঠিক ফোন নম্বর দিন।' });
  try {
    const info = db.prepare('INSERT INTO users(name,phone,password_hash,role) VALUES(?,?,?,?)')
      .run(String(name).trim(), normalizedPhone, bcrypt.hashSync(password, 12), 'customer');
    const user = db.prepare('SELECT * FROM users WHERE id=?').get(info.lastInsertRowid);
    req.session.user = safeUser(user);
    res.json({ user: req.session.user });
  } catch {
    res.status(409).json({ error: 'এই ফোন নম্বরে অ্যাকাউন্ট আছে। লগইন করুন।' });
  }
});

app.post('/api/login', (req, res) => {
  const { phone, password } = req.body || {};
  const u = db.prepare('SELECT * FROM users WHERE phone=? AND active=1').get(String(phone || '').replace(/[^\d+]/g, ''));
  if (!u || !bcrypt.compareSync(String(password || ''), u.password_hash))
    return res.status(401).json({ error: 'ফোন নম্বর অথবা পাসওয়ার্ড সঠিক নয়।' });
  req.session.user = safeUser(u);
  res.json({ user: req.session.user });
});
app.post('/api/logout', (req, res) => req.session.destroy(() => res.json({ ok: true })));
app.get('/api/me', (req, res) => res.json({ user: currentUser(req) }));

app.post('/api/bookings', auth, role('customer'), (req, res) => {
  const u = currentUser(req);
  const { service, category, item_name, issue, weight_kg, distance_km, address, preferred_time } = req.body || {};
  if (!['repair','accessory','purchase'].includes(service) || !category || !item_name || !issue || !address)
    return res.status(400).json({ error: 'সব প্রয়োজনীয় তথ্য পূরণ করুন।' });
  const weight = Number(weight_kg || 0), distance = Number(distance_km || 0);
  if (!Number.isFinite(weight) || weight < 0 || !Number.isFinite(distance) || distance < 0)
    return res.status(400).json({ error: 'ওজন ও দূরত্ব সঠিকভাবে লিখুন।' });
  const charge = estimate(service, weight, distance);
  if (charge === null)
    return res.status(400).json({ error: '২ কেজির বেশি ওজনের জন্য বুকিং নেওয়ার আগে দোকান থেকে চার্জ নিশ্চিত করুন।' });
  const info = db.prepare(`INSERT INTO bookings
    (customer_id,customer_name,phone,service,category,item_name,issue,weight_kg,distance_km,address,preferred_time,estimated_charge)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(u.id, u.name, u.phone, service, String(category), String(item_name), String(issue),
      weight, distance, String(address), String(preferred_time || ''), charge);
  const b = db.prepare('SELECT * FROM bookings WHERE id=?').get(info.lastInsertRowid);
  res.status(201).json({ booking: bookingView(b) });
});

app.get('/api/bookings', auth, (req, res) => {
  const u = currentUser(req);
  let rows;
  if (u.role === 'admin') {
    rows = db.prepare(`SELECT b.*, r.name AS rider_name FROM bookings b LEFT JOIN users r ON r.id=b.rider_id ORDER BY b.id DESC`).all();
  } else if (u.role === 'rider') {
    rows = db.prepare(`SELECT b.*, r.name AS rider_name FROM bookings b LEFT JOIN users r ON r.id=b.rider_id WHERE b.rider_id=? OR b.status IN ('confirmed','pending') ORDER BY b.id DESC`).all(u.id);
  } else {
    rows = db.prepare('SELECT * FROM bookings WHERE customer_id=? ORDER BY id DESC').all(u.id);
  }
  res.json({ bookings: rows.map(bookingView) });
});

app.get('/api/riders', auth, role('admin'), (req, res) => {
  res.json({ riders: db.prepare("SELECT id,name,phone FROM users WHERE role='rider' AND active=1 ORDER BY name").all() });
});
app.post('/api/riders', auth, role('admin'), (req, res) => {
  const { name, phone, password } = req.body || {};
  if (!name || !phone || !password || String(password).length < 8)
    return res.status(400).json({ error: 'রাইডারের নাম, ফোন ও ৮ অক্ষরের পাসওয়ার্ড দিন।' });
  try {
    db.prepare("INSERT INTO users(name,phone,password_hash,role) VALUES(?,?,?,'rider')")
      .run(String(name).trim(), String(phone).replace(/[^\d+]/g, ''), bcrypt.hashSync(password, 12));
    res.status(201).json({ ok: true });
  } catch { res.status(409).json({ error: 'এই ফোন নম্বরটি ইতিমধ্যে ব্যবহার করা হয়েছে।' }); }
});

app.patch('/api/bookings/:id', auth, role('admin','rider'), (req, res) => {
  const id = Number(req.params.id);
  const b = db.prepare('SELECT * FROM bookings WHERE id=?').get(id);
  if (!b) return res.status(404).json({ error: 'বুকিং পাওয়া যায়নি।' });
  const u = currentUser(req);
  const allowed = ['pending','confirmed','rider_assigned','picked_up','repairing','ready','out_for_delivery','delivered','cancelled'];
  const { status, rider_id, admin_note, final_repair_cost } = req.body || {};
  if (status && !allowed.includes(status)) return res.status(400).json({ error: 'স্ট্যাটাস সঠিক নয়।' });
  if (u.role === 'rider') {
    if (b.rider_id && b.rider_id !== u.id) return res.status(403).json({ error: 'এই বুকিং আপনার নামে বরাদ্দ নয়।' });
    if (!['picked_up','repairing','ready','out_for_delivery','delivered'].includes(status))
      return res.status(400).json({ error: 'রাইডার এই স্ট্যাটাসটি দিতে পারবেন না।' });
    if (!b.rider_id && !['picked_up'].includes(status)) return res.status(403).json({ error: 'অ্যাডমিনের বরাদ্দের পর কাজ করুন।' });
  }
  const nextRider = u.role === 'admin' && rider_id !== undefined ? (rider_id === '' || rider_id === null ? null : Number(rider_id)) : (u.role === 'rider' && !b.rider_id && status === 'picked_up' ? u.id : b.rider_id);
  if (nextRider !== null && !db.prepare("SELECT id FROM users WHERE id=? AND role='rider' AND active=1").get(nextRider))
    return res.status(400).json({ error: 'বৈধ রাইডার বেছে নিন।' });
  const note = u.role === 'admin' && admin_note !== undefined ? String(admin_note).slice(0,1000) : b.admin_note;
  const repairCost = u.role === 'admin' && final_repair_cost !== undefined && final_repair_cost !== ''
    ? Math.max(0, Number(final_repair_cost)) : b.final_repair_cost;
  const nextStatus = status || b.status;
  db.prepare(`UPDATE bookings SET status=?,rider_id=?,admin_note=?,final_repair_cost=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`)
    .run(nextStatus, nextRider, note, repairCost, id);
  res.json({ booking: bookingView(db.prepare('SELECT * FROM bookings WHERE id=?').get(id)) });
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.listen(PORT, () => console.log(`${SHOP_NAME} running at http://localhost:${PORT}`));
