#!/usr/bin/env node

// Load environment variables from .env.local manually (no package dependency)
import { spawn } from 'child_process';
import { readFileSync, existsSync } from 'fs';

// Simple .env file parser
function loadEnvFile(filePath) {
  if (!existsSync(filePath)) {
    console.log(`⚠️  Environment file ${filePath} not found. Make sure to run the setup script first.`);
    process.exit(1);
  }

  const envContent = readFileSync(filePath, 'utf8');
  const envVars = {};
  
  envContent.split('\n').forEach(line => {
    line = line.trim();
    if (line && !line.startsWith('#')) {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        envVars[key.trim()] = valueParts.join('=').trim();
      }
    }
  });
  
  return envVars;
}

// Load .env.local
const envVars = loadEnvFile('.env.local');

// Start the development server with loaded environment
const server = spawn('npx', ['tsx', 'server/index.ts'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    ...envVars,
    NODE_ENV: 'development'
  }
});

server.on('error', (err) => {
  console.error('Failed to start server:', err);
  console.error('Make sure you have run the setup script: ./scripts/setup-local.sh');
  process.exit(1);
});

server.on('close', (code) => {
  process.exit(code);
});