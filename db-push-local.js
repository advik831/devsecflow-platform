#!/usr/bin/env node

// Push database schema changes using local .env.local file
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

console.log('🔄 Pushing database schema changes...');

// Run drizzle-kit push with loaded environment
const drizzle = spawn('npx', ['drizzle-kit', 'push'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    ...envVars
  }
});

drizzle.on('error', (err) => {
  console.error('Failed to push schema:', err);
  process.exit(1);
});

drizzle.on('close', (code) => {
  if (code === 0) {
    console.log('✅ Schema updated successfully!');
  }
  process.exit(code);
});