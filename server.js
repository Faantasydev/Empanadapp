import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());

// API health endpoint (migrated from Python backend)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', app: 'zampa' });
});

// Serve static frontend assets from frontend/public
const publicPath = path.join(__dirname, 'frontend', 'public');
app.use(express.static(publicPath));

// Fallback route for SPA / PWA routing
app.get('*', (req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
