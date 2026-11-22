const path = require('path');
const dotenv = require('dotenv');

const envPath = path.resolve(__dirname, '../../.env');

function loadEnv() {
  dotenv.config({ path: envPath, override: true });
}

loadEnv();

function sanitizeKey(val) {
  if (!val) return '';
  return String(val)
    .replace(/^["']|["']$/g, '')
    .replace(/\s+client\s+key$/i, '')
    .replace(/\s+server\s+key$/i, '')
    .trim();
}

const env = {
  get PORT() {
    return parseInt(process.env.PORT || '3000', 10);
  },
  set PORT(val) {
    process.env.PORT = String(val);
  },
  get DATABASE_URL() {
    return process.env.DATABASE_URL || 'file:./dev.db';
  },
  get MIDTRANS() {
    return {
      get SERVER_KEY() {
        return sanitizeKey(process.env.MIDTRANS_SERVER_KEY);
      },
      set SERVER_KEY(val) {
        process.env.MIDTRANS_SERVER_KEY = val;
      },
      get CLIENT_KEY() {
        return sanitizeKey(process.env.MIDTRANS_CLIENT_KEY);
      },
      set CLIENT_KEY(val) {
        process.env.MIDTRANS_CLIENT_KEY = val;
      },
      get IS_PRODUCTION() {
        return String(process.env.MIDTRANS_IS_PRODUCTION).toLowerCase() === 'true';
      },
      set IS_PRODUCTION(val) {
        process.env.MIDTRANS_IS_PRODUCTION = String(val);
      },
    };
  },
  reload() {
    loadEnv();
  },
};

module.exports = env;
