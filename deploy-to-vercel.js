#!/usr/bin/env node
/**
 * Deploy to Vercel - syncs password logic to remote host
 * Usage: node deploy-to-vercel.js
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
const VERCEL_ORG_ID = process.env.VERCEL_ORG_ID;
const VERCEL_PROJECT_ID = process.env.VERCEL_PROJECT_ID;

if (!VERCEL_TOKEN || !VERCEL_PROJECT_ID) {
  console.error('❌ Missing VERCEL_TOKEN or VERCEL_PROJECT_ID in .env.local');
  process.exit(1);
}

console.log('🚀 Deploying to Vercel...');
console.log(`   Project ID: ${VERCEL_PROJECT_ID}`);
console.log(`   Org ID: ${VERCEL_ORG_ID || 'default'}`);

// Trigger redeploy by calling Vercel API
const options = {
  hostname: 'api.vercel.com',
  port: 443,
  path: `/v12/deployments?teamId=${VERCEL_ORG_ID || ''}`,
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${VERCEL_TOKEN}`,
    'Content-Type': 'application/json',
  },
};

const req = https.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const json = JSON.parse(data);

      if (res.statusCode >= 200 && res.statusCode < 300) {
        console.log('\n✅ Deployment triggered successfully!');
        console.log(`   Deployment URL: https://${json.url}`);
        console.log(`   Deployment ID: ${json.id}`);
        console.log('\n📝 Monitor deployment at:');
        console.log(`   https://vercel.com/${VERCEL_ORG_ID ? `teams/${VERCEL_ORG_ID}/` : ''}${json.projectId}/deployments`);
      } else {
        console.error('\n❌ Deployment failed:');
        console.error(json.error?.message || data);
        process.exit(1);
      }
    } catch (e) {
      console.error('❌ Failed to parse response:', e.message);
      process.exit(1);
    }
  });
});

req.on('error', (e) => {
  console.error('❌ Request error:', e.message);
  process.exit(1);
});

// Send request with project data
req.write(JSON.stringify({
  projectId: VERCEL_PROJECT_ID,
  gitSource: {
    type: 'github',
    // This will redeploy from the current git branch
  },
}));

req.end();
