#!/usr/bin/env node
/**
 * Check Vercel deployment status
 * Verifies that password logic is synced to remote host
 */

const https = require('https');
require('dotenv').config({ path: '.env.local' });

const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
const VERCEL_PROJECT_ID = process.env.VERCEL_PROJECT_ID;
const VERCEL_ORG_ID = process.env.VERCEL_ORG_ID;

if (!VERCEL_TOKEN || !VERCEL_PROJECT_ID) {
  console.error('❌ Missing VERCEL_TOKEN or VERCEL_PROJECT_ID in .env.local');
  process.exit(1);
}

console.log('🔍 Checking deployment status...\n');

const teamId = VERCEL_ORG_ID ? `teamId=${VERCEL_ORG_ID}&` : '';
const options = {
  hostname: 'api.vercel.com',
  path: `/v6/deployments?${teamId}projectId=${VERCEL_PROJECT_ID}&limit=5`,
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${VERCEL_TOKEN}`,
  },
};

https.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const json = JSON.parse(data);

      if (json.deployments && json.deployments.length > 0) {
        const latest = json.deployments[0];
        console.log('📊 Latest Deployments:');
        console.log('─'.repeat(60));

        json.deployments.slice(0, 3).forEach((deploy, idx) => {
          const status = deploy.state;
          const statusIcon = {
            'READY': '✅',
            'ERROR': '❌',
            'BUILDING': '⏳',
            'QUEUED': '⏳',
          }[status] || '❓';

          console.log(`\n${idx === 0 ? '🔴 LATEST' : '⚪'}`);
          console.log(`${statusIcon} Status: ${status}`);
          console.log(`📅 Created: ${new Date(deploy.createdAt).toLocaleString()}`);
          console.log(`🔗 URL: https://${deploy.url}`);
          if (deploy.gitSource) {
            console.log(`🌿 Branch: ${deploy.gitSource.ref}`);
          }
        });

        console.log('\n' + '─'.repeat(60));
        if (latest.state === 'READY') {
          console.log('\n✅ Deployment is LIVE!');
          console.log(`   Test password login at: https://${latest.url}/login`);
        } else if (latest.state === 'BUILDING') {
          console.log('\n⏳ Deployment is still building... check back in a moment');
        } else if (latest.state === 'ERROR') {
          console.log('\n❌ Latest deployment failed. Check Vercel dashboard.');
        }
      } else {
        console.log('⚠️  No deployments found for this project');
      }
    } catch (e) {
      console.error('❌ Error parsing response:', e.message);
      process.exit(1);
    }
  });
}).on('error', (e) => {
  console.error('❌ Request error:', e.message);
  process.exit(1);
}).end();
