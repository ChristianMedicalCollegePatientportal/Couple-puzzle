const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;
const SENDER_PASSWORD = process.env.SENDER_PASSWORD || 'love1234';

// Storage for puzzles in memory + uploads folder
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

// In-memory puzzle store (persists as long as server runs)
// On Glitch, files persist on disk so we save a JSON index too
const puzzleIndexFile = path.join(__dirname, 'puzzles.json');
let puzzles = {};
if (fs.existsSync(puzzleIndexFile)) {
  try { puzzles = JSON.parse(fs.readFileSync(puzzleIndexFile, 'utf8')); } catch(e) {}
}

function savePuzzles() {
  fs.writeFileSync(puzzleIndexFile, JSON.stringify(puzzles, null, 2));
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, uuidv4() + ext);
  }
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(uploadsDir));

// ── AUTH CHECK ──
app.post('/api/auth', (req, res) => {
  const { password } = req.body;
  if (password === SENDER_PASSWORD) {
    res.json({ ok: true });
  } else {
    res.status(401).json({ ok: false, error: 'Wrong password' });
  }
});

// ── CREATE PUZZLE ──
app.post('/api/create', upload.single('photo'), (req, res) => {
  const { password, message, difficulty } = req.body;
  if (password !== SENDER_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!req.file) return res.status(400).json({ error: 'No photo uploaded' });

  const id = uuidv4().slice(0, 8);
  puzzles[id] = {
    id,
    imagePath: '/uploads/' + req.file.filename,
    message: message || '❤️ You solved it!',
    difficulty: parseInt(difficulty) || 3,
    createdAt: new Date().toISOString()
  };
  savePuzzles();

  const link = `${req.protocol}://${req.get('host')}/play/${id}`;
  res.json({ ok: true, link, id });
});

// ── GET PUZZLE DATA ──
app.get('/api/puzzle/:id', (req, res) => {
  const puzzle = puzzles[req.params.id];
  if (!puzzle) return res.status(404).json({ error: 'Puzzle not found' });
  res.json(puzzle);
});

// ── SERVE PLAY PAGE ──
app.get('/play/:id', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'play.html'));
});

// ── SERVE SENDER PAGE ──
app.get('/sender', (req, res) => {
  res.sendFile(path.join(__dirname, 'sender.html'));
});

app.listen(PORT, () => console.log(`💌 Puzzle app running on port ${PORT}`));

