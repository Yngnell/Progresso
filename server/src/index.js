require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const officialRoutes = require('./routes/officialRoutes');
const newsRoutes = require('./routes/newsRoutes');
const statsRoutes = require('./routes/statsRoutes');
const errorHandler = require('./middleware/error');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/', (req, res) => {
  res.json({ message: 'SK Monitoring API is running', status: 'ok' });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/officials', officialRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/stats', statsRoutes);

// Centralized error handler (must be last)
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`SK Monitoring API running on http://localhost:${PORT}`);
});

