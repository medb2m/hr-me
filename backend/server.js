import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import bodyParser from 'body-parser'
import cookieParser from 'cookie-parser'
import morgan from 'morgan'
import dotenv from 'dotenv';

// middleware imports
import errorHandler from './middleware/error-handler.js'

// Routes  
import candidateRoutes from './routes/candidate.routes.js';
import offerRoutes from './routes/offer.routes.js';
import positionRoutes from './routes/position.routes.js';
import applicationRoutes from './routes/application.routes.js';
import ticketRoutes from './routes/ticket.routes.js';
import skillRoutes from './routes/skill.routes.js';

// path 
import path from 'path';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cookieParser());
app.use(morgan("dev"))
app.use(cors());
//app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI).then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Sample Route
app.get('/', (req, res) => {
  res.send('Welcome to the HR me backend');
});

// Images Routes
app.use('/img', express.static(path.join(__dirname, 'public', 'images')))
// Images Routes
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')))

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

// global error handler
app.use(errorHandler);

// Start the Server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
