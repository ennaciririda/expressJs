require('dotenv').config(); // Load environment variables from .env

module.exports = {
  PORT: process.env.PORT || 3000,
  DATABASE_URL: process.env.DATABASE_URL,
};