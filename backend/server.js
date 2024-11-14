import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import bodyParser from 'body-parser'
import cookieParser from 'cookie-parser'
import morgan from 'morgan'
import dotenv from 'dotenv';

// Routes
import candidateRoutes from './routes/candidate.routes.js';

dotenv.config();

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

app.use('/api', candidateRoutes);

// global error handler
app.use(errorHandler);

// Start the Server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
