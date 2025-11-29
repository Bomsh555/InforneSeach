const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Path to users log file
const usersLogFile = path.join(__dirname, 'users_log.txt');

// Serve static files from parent directory (project root)
app.use(express.static(path.join(__dirname, '..')));
app.use(bodyParser.json());

// Simple request logger for debugging
app.use((req, res, next) => {
  console.log(new Date().toISOString(), req.method, req.url);
  if (req.method === 'POST' && req.url.startsWith('/api')){
    console.log('Body:', req.body);
  }
  next();
});

// Basic CORS support (for debugging across origins)
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Simple SQLite DB in file
const dbFile = path.join(__dirname, 'users.db');
const db = new sqlite3.Database(dbFile);

// Initialize table
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});

function validateEmail(email){
  return typeof email === 'string' && /\S+@\S+\.\S+/.test(email);
}

app.post('/api/register', (req, res) => {
  const { email, password, password2 } = req.body || {};
  if (!validateEmail(email)) return res.status(400).json({ ok: false, error: 'Неверный email' });
  if (!password || !password2) return res.status(400).json({ ok: false, error: 'Оба пароля обязательны' });
  if (password !== password2) return res.status(400).json({ ok: false, error: 'Пароли не совпадают' });
  if (password.length < 6) return res.status(400).json({ ok: false, error: 'Пароль должен быть минимум 6 символов' });

  const hashed = bcrypt.hashSync(password, 10);
  const stmt = db.prepare('INSERT INTO users (email, password) VALUES (?, ?)');
  stmt.run(email.toLowerCase(), hashed, function(err){
    if (err){
      console.error('DB insert error:', err.message);
      if (err.message && err.message.includes('UNIQUE')){
        return res.status(400).json({ ok: false, error: 'Пользователь с таким email уже существует' });
      }
      return res.status(500).json({ ok: false, error: 'Ошибка сервера' });
    }
    console.log('User registered id=', this.lastID, 'email=', email.toLowerCase());
    
    // Log to text file
    const logEntry = `[${new Date().toISOString()}] Регистрация: ID=${this.lastID}, Email=${email.toLowerCase()}\n`;
    fs.appendFileSync(usersLogFile, logEntry, 'utf8');
    
    return res.json({ ok: true, id: this.lastID });
  });
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!validateEmail(email)) return res.status(400).json({ ok: false, error: 'Неверный email' });
  if (!password) return res.status(400).json({ ok: false, error: 'Пароль обязателен' });

  db.get('SELECT id, email, password FROM users WHERE email = ?', [email.toLowerCase()], (err, row) => {
    if (err) return res.status(500).json({ ok: false, error: 'Ошибка сервера' });
    if (!row) return res.status(400).json({ ok: false, error: 'Пользователь не найден' });
    const matches = bcrypt.compareSync(password, row.password);
    if (!matches) return res.status(400).json({ ok: false, error: 'Неверный пароль' });
    
    // Log login
    const logEntry = `[${new Date().toISOString()}] Вход: ID=${row.id}, Email=${row.email}\n`;
    fs.appendFileSync(usersLogFile, logEntry, 'utf8');
    
    // For this minimal example we just return ok; in real apps return a session/JWT
    return res.json({ ok: true, id: row.id, email: row.email });
  });
});

// Health check for debugging
app.get('/api/ping', (req, res) => {
  res.json({ ok: true, time: Date.now() });
});

// Debug: list users (DO NOT enable in production)
app.get('/api/users', (req, res) => {
  db.all('SELECT id, email, created_at FROM users ORDER BY id DESC LIMIT 100', [], (err, rows) => {
    if (err) return res.status(500).json({ ok: false, error: 'DB error' });
    res.json({ ok: true, users: rows });
  });
});

// Get users log file
app.get('/api/log', (req, res) => {
  if (!fs.existsSync(usersLogFile)) {
    return res.json({ ok: true, log: 'Нет записей' });
  }
  const log = fs.readFileSync(usersLogFile, 'utf8');
  res.json({ ok: true, log });
});

app.listen(PORT, () => {
  console.log(`Server started on http://localhost:${PORT}`);
});
