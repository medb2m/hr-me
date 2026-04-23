import http from 'http';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import dotenv from 'dotenv';

// middleware imports
import errorHandler from './middleware/error-handler.js';

// Routes
import candidateRoutes from './routes/candidate.routes.js';
import offerRoutes from './routes/offer.routes.js';
import positionRoutes from './routes/position.routes.js';
import applicationRoutes from './routes/application.routes.js';
import ticketRoutes from './routes/ticket.routes.js';
import skillRoutes from './routes/skill.routes.js';
import interviewRoutes from './routes/interview.routes.js';
import ttsRoutes from './routes/tts.routes.js';
import authRoutes from './routes/auth.routes.js';
import adminRoutes from './routes/admin.routes.js';
import notificationsRoutes from './routes/notifications.routes.js';
import meetingsRoutes from './routes/meetings.routes.js';
import calendarRoutes from './routes/calendar.routes.js';

import path from 'path';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

import { attachSocketIo } from './realtime/socket-hub.js';
import { startMeetingRemindersJob } from './jobs/meeting-reminders.job.js';

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cookieParser());
app.use(morgan('dev'));
app.use(cors());

// MongoDB Connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('MongoDB connection error:', err));

// Sample Route
app.get('/', (req, res) => {
  res.send('Welcome to the HR me backend');
});

// Images Routes
app.use('/img', express.static(path.join(__dirname, 'public', 'images')));
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

// Auth (register, login, password reset, email verification)
app.use('/api/auth', authRoutes);

// Admin (JWT + role admin)
app.use('/api/admin', adminRoutes);

// Real-time stack: notifications, meetings, unified calendar
app.use('/api/notifications', notificationsRoutes);
app.use('/api/meetings', meetingsRoutes);
app.use('/api/calendar', calendarRoutes);

// Candidates Routes
app.use('/api/candidates', candidateRoutes);
// Offer Routes
app.use('/api/offer', offerRoutes);
// Position Routes
app.use('/api/position', positionRoutes);
// Application Routes
app.use('/api/application', applicationRoutes);
// Ticket Routes
app.use('/api/ticket', ticketRoutes);
// Skill Routes
app.use('/api/skill', skillRoutes);
// AI Interview sessions
app.use('/api/interview', interviewRoutes);
// Free neural TTS (Microsoft Edge online — no API key)
app.use('/api/tts', ttsRoutes);

// global error handler
app.use(errorHandler);

const httpServer = http.createServer(app);
const frontendOrigin = process.env.FRONTEND_URL || process.env.PUBLIC_APP_URL || 'http://localhost:4200';
attachSocketIo(httpServer, frontendOrigin);
startMeetingRemindersJob();

httpServer.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(`Socket.io path: /socket.io (CORS: ${frontendOrigin})`);
});
