/**
 * LLM Configuration Diagnostic Script
 *
 * Run this script to verify your LLM configuration:
 *   pnpm diagnostic
 */

import { config } from 'dotenv';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env.local file BEFORE importing any other modules
const envPath = resolve(__dirname, '../.env.local');
const result = config({ path: envPath });

if (result.error) {
  console.warn('Warning: Could not load .env.local file:', result.error.message);
}

interface DiagnosticResult {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  message: string;
}

const results: DiagnosticResult[] = [];

function logResult(result: DiagnosticResult) {
  const statusSymbol = result.status === 'pass' ? '✓' : result.status === 'fail' ? '✗' : '⚠';
  const statusColor = result.status === 'pass' ? '\x1b[32m' : result.status === 'fail' ? '\x1b[31m' : '\x1b[33m';
  console.log(`${statusSymbol} ${result.name}: ${statusColor}${result.message}\x1b[0m`);
  results.push(result);
}

async function runDiagnostics() {
  // Now dynamically import the modules
  const { createLLM, callLLM } = await import('../src/lib/llm/helper.js');

  console.log('\n🔍 LLM Configuration Diagnostics\n');
  console.log('=================================\n');

  // Check 1: Environment Variables
  console.log('1. Checking Environment Variables...');

  // Directly check process.env since env.ts might have failed validation
  const apiKey = process.env.LLM_API_KEY;
  const provider = process.env.LLM_PROVIDER || 'deepseek';
  const model = process.env.LLM_MODEL || 'deepseek-chat';

  if (apiKey && apiKey.length > 0) {
    logResult({
      name: 'LLM_API_KEY',
      status: 'pass',
      message: `Set (length: ${apiKey.length})`,
    });
  } else {
    logResult({
      name: 'LLM_API_KEY',
      status: 'fail',
      message: 'Not set or empty. Please set LLM_API_KEY in .env.local',
    });
  }

  logResult({
    name: 'LLM_PROVIDER',
    status: 'pass',
    message: provider,
  });

  logResult({
    name: 'LLM_MODEL',
    status: 'pass',
    message: model,
  });

  logResult({
    name: 'LLM_BASE_URL',
    status: 'pass',
    message: process.env.LLM_BASE_URL || 'Default (based on provider)',
  });

  console.log('\n2. Testing LLM Instance Creation...');

  try {
    const llm = createLLM();
    logResult({
      name: 'LLM Instance',
      status: 'pass',
      message: 'Successfully created',
    });
  } catch (error) {
    logResult({
      name: 'LLM Instance',
      status: 'fail',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }

  console.log('\n3. Testing LLM API Call...');

  try {
    const response = await callLLM(
      'You are a helpful assistant.',
      'Say "Hello, World!" in exactly those words.'
    );

    if (response.toLowerCase().includes('hello')) {
      logResult({
        name: 'LLM API Call',
        status: 'pass',
        message: `Response: "${response.substring(0, 50)}${response.length > 50 ? '...' : ''}"`,
      });
    } else {
      logResult({
        name: 'LLM API Call',
        status: 'warn',
        message: `Unexpected response: "${response.substring(0, 50)}"`,
      });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    let status: DiagnosticResult['status'] = 'fail';
    let hint = '';

    if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
      hint = ' → Check your LLM_API_KEY';
    } else if (errorMessage.includes('ECONNREFUSED')) {
      hint = ' → Check LLM_BASE_URL and network connection';
    }

    logResult({
      name: 'LLM API Call',
      status,
      message: `${errorMessage}${hint}`,
    });
  }

  console.log('\n=================================');
  console.log('📊 Summary\n');

  const pass = results.filter(r => r.status === 'pass').length;
  const fail = results.filter(r => r.status === 'fail').length;
  const warn = results.filter(r => r.status === 'warn').length;

  console.log(`  Passed: ${pass}`);
  console.log(`  Failed: ${fail}`);
  console.log(`  Warnings: ${warn}`);

  if (fail > 0) {
    console.log('\n❌ Diagnostics failed. Please fix the issues above.');
    process.exit(1);
  } else {
    console.log('\n✅ All diagnostics passed!');
    process.exit(0);
  }
}

runDiagnostics().catch((error) => {
  console.error('\n❌ Diagnostic script error:', error);
  process.exit(1);
});
