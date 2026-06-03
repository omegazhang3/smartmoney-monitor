import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

/**
 * Execute okx CLI command and return parsed JSON
 */
export function okxCommand(cmd, args = {}) {
  let command = `okx ${cmd} --json`;
  
  for (const [key, value] of Object.entries(args)) {
    if (value !== undefined && value !== null && value !== '') {
      command += ` --${key} ${value}`;
    }
  }
  
  try {
    const output = execSync(command, { 
      encoding: 'utf8',
      timeout: 30000,
      maxBuffer: 1024 * 1024
    });
    
    // Extract JSON from output (skip update notices)
    const lines = output.split('\n');
    let jsonStr = '';
    let inJson = false;
    
    for (const line of lines) {
      if (line.trim().startsWith('{') || line.trim().startsWith('[')) {
        inJson = true;
      }
      if (inJson) {
        jsonStr += line;
      }
    }
    
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error(`❌ Command failed: ${command}`);
    console.error(error.message);
    return null;
  }
}

/**
 * Format timestamp
 */
export function formatTime(date = new Date()) {
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
}

/**
 * Format number with commas
 */
export function formatNumber(num) {
  if (num === null || num === undefined) return '-';
  return Number(num).toLocaleString('en-US', { maximumFractionDigits: 2 });
}

/**
 * Format percentage
 */
export function formatPercent(num) {
  if (num === null || num === undefined) return '-';
  return `${(Number(num) * 100).toFixed(2)}%`;
}

/**
 * Format currency
 */
export function formatCurrency(num) {
  if (num === null || num === undefined) return '-';
  const n = Number(num);
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(2)}K`;
  return `$${n.toFixed(2)}`;
}

/**
 * Create log directory and file
 */
export function ensureLogFile(logFile) {
  const dir = path.dirname(logFile);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(logFile)) {
    fs.writeFileSync(logFile, '');
  }
}

/**
 * Append to log file
 */
export function log(logFile, message) {
  ensureLogFile(logFile);
  const timestamp = formatTime();
  const line = `[${timestamp}] ${message}\n`;
  fs.appendFileSync(logFile, line);
}

/**
 * Console log with emoji
 */
export function print(message) {
  console.log(message);
}

/**
 * Sleep helper
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculate change percentage
 */
export function changePercent(current, previous) {
  if (!previous || previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}
