import express from 'express';
import cors from 'cors';
import routes from './routes/index.js';
import path from 'path';
import { fileURLToPath } from 'url';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadPath = path.join(__dirname, '..', 'uploads');

const app = express();

const allowedOrigins = [
  'http://localhost:8081',
  'http://172.30.96.1:8081',
  'http://10.30.248.87:8081',
  'http://192.168.1.85:8081',
  'http://10.12.9.2:8081',
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Set-Cookie']
}));

app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

app.use(express.urlencoded({ extended: true }));


app.use('/api', routes);

app.use('/uploads', (req, res, next) => {
  next();
});

app.use('/uploads', express.static(uploadPath));

app.use('/uploads/*', (req, res) => {
  console.log('File not found:', req.url);
  res.status(404).send('File not found');
});

export default app;