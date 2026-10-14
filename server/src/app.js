import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import env from './config/env.js';
import { AppError } from './utils/errors.js';
import systemRoutes from './routes/systemRoutes.js';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import departmentRoutes from './routes/departmentRoutes.js';
import categoryRoutes from './routes/categoryRoutes.js';
import supplierRoutes from './routes/supplierRoutes.js';
import itemRoutes from './routes/itemRoutes.js';
import stockMovementRoutes from './routes/stockMovementRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true
  })
);
app.use(express.json({ limit: '100kb' }));

if (env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Mount routes
app.use('/api', systemRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/stock-movements', stockMovementRoutes);
app.use('/api/notifications', notificationRoutes);

// 404 Not Found handler
app.use((req, res, _next) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Cannot ${req.method} ${req.originalUrl}`,
      details: []
    }
  });
});

// Central error handler
app.use((err, req, res, _next) => {
  let statusCode = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'An unexpected error occurred';
  let details = [];

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    code = err.code;
    message = err.message;
    details = err.details || [];
  } else if (err.code === 'ER_DUP_ENTRY') {
    statusCode = 409;
    code = 'DUPLICATE_ENTRY';
    message = 'A resource with this identifier already exists';
  } else if (err.status) {
    statusCode = err.status;
    message = err.message;
  } else {
    if (env.NODE_ENV !== 'test') {
      console.error('[Unhandled Error]:', err);
    }
  }

  res.status(statusCode).json({
    error: {
      code,
      message,
      details
    }
  });
});

export default app;
