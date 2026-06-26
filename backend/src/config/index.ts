import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  daytona: {
    apiKey: process.env.DAYTONA_API_KEY || '',
    apiUrl: process.env.DAYTONA_API_URL || 'https://app.daytona.io/api',
    target: process.env.DAYTONA_TARGET || 'us',
  },
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
  },
};
