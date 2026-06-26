import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { config } from './config';
import routes from './routes';
import { setupWebSocket } from './websocket';
import { errorHandler, requestLogger } from './middleware';

const app = express();
const server = createServer(app);

// Middleware
app.use(cors({ origin: config.cors.origin }));
app.use(express.json());
app.use(requestLogger);

// Routes
app.use('/api', routes);

// Health check at root
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// WebSocket
setupWebSocket(server);

// Error handling
app.use(errorHandler);

// Start server
server.listen(config.port, () => {
  console.log(`[Server] Running on port ${config.port}`);
  console.log(`[Server] Health: http://localhost:${config.port}/health`);
  console.log(`[Server] API: http://localhost:${config.port}/api/health`);
  console.log(`[Server] WebSocket: ws://localhost:${config.port}/ws`);
});
