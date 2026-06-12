'use strict';

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const appDir = __dirname;
const appEnvPath = path.join(appDir, '.env');
const rootEnvPath = path.join(appDir, '..', '.env');

function isUnset(value) {
  return value === undefined || String(value).trim() === '';
}

if (fs.existsSync(appEnvPath)) {
  dotenv.config({ path: appEnvPath });
}

if (fs.existsSync(rootEnvPath)) {
  const parsed = dotenv.parse(fs.readFileSync(rootEnvPath));
  for (const [key, value] of Object.entries(parsed)) {
    if (isUnset(process.env[key]) && !isUnset(value)) {
      process.env[key] = value;
    }
  }
}
