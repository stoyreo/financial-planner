/**
 * Financial 101 Master crafted by Toy - Email Template System
 * Generates beautiful HTML emails with branded buttons and links
 */

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

interface EmailButton {
  text: string;
  url: string;
  color?: string; // hex or rgb
}

/**
 * Base email template with Financial 101 Master crafted by Toy branding
 */
function createBaseTemplate(
  title: string,
  content: string,
  buttons?: EmailButton[],
  footerMessage?: string
): EmailTemplate {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://financial-planner.vercel.app';
  const buttonColor = '#4F46E5'; // Indigo 600

  const buttonsHTML = buttons
    ? buttons
        .map(
          (btn) => `
      <div style="margin: 20px 0;">
        <a href="${btn.url}" style="
          display: inline-block;
          padding: 12px 32px;
          background-color: ${btn.color || buttonColor};
          color: white;
          text-decoration: none;
          border-radius: 6px;
          font-weight: 600;
          font-size: 16px;
          transition: opacity 0.3s ease;
        " onmouseover="this.style.opacity='0.8'" onmouseout="this.style.opacity='1'">
          ${btn.text}
        </a>
      </div>
    `
        )
        .join('')
    : '';

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background-color: #f3f4f6;
            margin: 0;
            padding: 0;
          }
          .email-container {
            max-width: 600px;
            margin: 0 auto;
            background-color: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          }
          .header {
            background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%);
            padding: 30px;
            text-align: center;
            color: white;
          }
          .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 700;
          }
          .header p {
            margin: 8px 0 0 0;
            font-size: 14px;
            opacity: 0.9;
          }
          .content {
            padding: 40px;
          }
          .content h2 {
            color: #1f2937;
            font-size: 24px;
            margin-top: 0;
            margin-bottom: 16px;
          }
          .content p {
            color: #4b5563;
            font-size: 16px;
            line-height: 1.6;
            margin: 12px 0;
          }
          .highlight {
            background-color: #eff6ff;
            border-left: 4px solid #4F46E5;
            padding: 16px;
            margin: 20px 0;
            border-radius: 4px;
          }
          .highlight strong {
            color: #4F46E5;
          }
          .footer {
            background-color: #f9fafb;
            padding: 24px 40px;
            text-align: center;
            border-top: 1px solid #e5e7eb;
          }
          .footer p {
            margin: 8px 0;
            color: #6b7280;
            font-size: 14px;
          }
          .footer a {
            color: #4F46E5;
            text-decoration: none;
          }
          .footer a:hover {
            text-decoration: underline;
          }
          .metric {
            display: inline-block;
            margin: 12px;
            padding: 16px;
            background-color: #f0f9ff;
            border-radius: 6px;
            text-align: center;
            min-width: 120px;
          }
          .metric .value {
            font-size: 20px;
            font-weight: 700;
            color: #4F46E5;
          }
          .metric .label {
            font-size: 12px;
            color: #6b7280;
            margin-top: 4px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .divider {
            border-top: 1px solid #e5e7eb;
            margin: 24px 0;
          }
        </style>
      </head>
      <body>
        <div class="email-container">
          <div class="header">
            <h1>Financial 101 Master crafted by Toy</h1>
            <p>${title}</p>
          </div>
          <div class="content">
            ${content}
            ${buttonsHTML}
          </div>
          <div class="footer">
            <p>${footerMessage || 'Financial planning made simple. Manage your wealth with confidence.'}</p>
            <p>
              <a href="${appUrl}">Visit Financial 101 Master crafted by Toy</a> |
              <a href="${appUrl}/help">Help Center</a> |
              <a href="mailto:toy.theeranan@gmail.com">Contact Support</a>
            </p>
            <p style="margin-top: 16px; font-size: 12px; color: #9ca3af;">
              © 2026 Financial 101 Master crafted by Toy. All rights reserved.
            </p>
          </div>
        </div>
      </body>
    </html>
  `;

  const textVersion = `
${title.toUpperCase()}

${content.replace(/<[^>]*>/g, '')}

${buttons ? buttons.map((btn) => `${btn.text}: ${btn.url}`).join('\n') : ''}

${footerMessage || 'Financial planning made simple. Manage your wealth with confidence.'}

Financial 101 Master crafted by Toy - https://financial-planner.vercel.app
  `.trim();

  return { subject: title, html, text: textVersion };
}

/**
 * Google Drive Sync Completed Email
 */
export function googleDriveSyncEmail(
  accountName: string,
  backupCount: number,
  backupSize: string
): EmailTemplate {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://financial-planner.vercel.app';
  const content = `
    <h2>Backup Completed Successfully</h2>
    <p>Your Financial 101 Master crafted by Toy data has been backed up to Google Drive.</p>

    <div class="highlight">
      <strong>Account:</strong> ${accountName}<br>
      <strong>Backup Time:</strong> ${new Date().toLocaleString()}<br>
      <strong>Total Versions:</strong> ${backupCount}
    </div>

    <div style="text-align: center;">
      <div class="metric">
        <div class="value">${backupCount}</div>
        <div class="label">Backups</div>
      </div>
      <div class="metric">
        <div class="value">${backupSize}</div>
        <div class="label">Total Size</div>
      </div>
    </div>

    <p>Your data is securely stored in Google Drive with automatic versioning. You can restore any previous version at any time.</p>
  `;

  return createBaseTemplate(
    '✓ Backup Successful',
    content,
    [
      { text: 'View Backups', url: `${appUrl}/settings?tab=backup` },
      { text: 'Google Drive', url: 'https://drive.google.com', color: '#4285F4' },
    ],
    'Your financial data is backed up and protected.'
  );
}

/**
 * AI Insights Generated Email
 */
export function aiInsightsEmail(
  accountName: string,
  insights: { title: string; recommendation: string }[]
): EmailTemplate {
  const insightsHTML = insights
    .map(
      (insight) => `
    <div class="highlight">
      <strong>${insight.title}</strong><br>
      <p style="margin: 8px 0 0 0; font-size: 14px;">${insight.recommendation}</p>
    </div>
  `
    )
    .join('');

  const content = `
    <h2>Your AI Insights Are Ready</h2>
    <p>Financial 101 Master crafted by Toy has analyzed your financial data and generated personalized insights.</p>

    <div class="divider"></div>

    ${insightsHTML}

    <div class="divider"></div>

    <p>Review these insights and take action to optimize your financial plan. Our data scientist recommends prioritizing the highest-impact recommendations first.</p>
  `;

  return createBaseTemplate(
    '📊 Your AI Insights Are Ready',
    content,
    [{ text: 'View All Insights', url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://financial-planner.vercel.app'}/scenarios` }],
    'Data-driven recommendations for your financial success.'
  );
}

/**
 * Mortgage Payoff Milestone Email
 */
export function mortgagePayoffEmail(
  accountName: string,
  debtName: string,
  payoffYear: number,
  monthsRemaining: number,
  balance: number
): EmailTemplate {
  const content = `
    <h2>Debt Payoff Milestone</h2>
    <p>Great news! Based on your current payment schedule, this debt will be paid off soon.</p>

    <div class="highlight">
      <strong>${debtName}</strong><br>
      <strong>Payoff Year:</strong> ${payoffYear}<br>
      <strong>Months Remaining:</strong> ${monthsRemaining}<br>
      <strong>Current Balance:</strong> ฿${balance.toLocaleString()}
    </div>

    <div style="text-align: center;">
      <div class="metric">
        <div class="value">${payoffYear}</div>
        <div class="label">Payoff Year</div>
      </div>
      <div class="metric">
        <div class="value">${monthsRemaining}</div>
        <div class="label">Months Left</div>
      </div>
    </div>

    <p>Stay the course with your current payment plan, or consider making extra payments to be debt-free even sooner!</p>
  `;

  return createBaseTemplate(
    '🎯 Debt Payoff Milestone',
    content,
    [{ text: 'View Mortgage Plan', url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://financial-planner.vercel.app'}/debts?tab=mortgage` }],
    'You\'re on track to financial freedom.'
  );
}

/**
 * Expert Recommendation Email
 */
export function expertRecommendationEmail(
  accountName: string,
  expertType: 'retirement' | 'investment',
  recommendation: string,
  actionItems: string[]
): EmailTemplate {
  const expertTitle = expertType === 'retirement' ? 'Life & Retirement Planner' : 'Investment Expert';
  const actionItemsHTML = actionItems.map((item) => `<li style="margin: 8px 0; color: #4b5563;">${item}</li>`).join('');

  const content = `
    <h2>${expertTitle} Recommendation</h2>
    <p>Your ${expertTitle.toLowerCase()} has reviewed your financial profile and has the following recommendation:</p>

    <div class="highlight">
      <p style="margin: 0;">${recommendation}</p>
    </div>

    <h3 style="color: #1f2937; margin-top: 20px;">Action Items:</h3>
    <ul style="padding-left: 20px; margin: 12px 0;">
      ${actionItemsHTML}
    </ul>

    <p>Implementing these recommendations can significantly improve your financial outcomes. Schedule a review to discuss these suggestions in detail.</p>
  `;

  return createBaseTemplate(
    `💼 ${expertTitle} Recommendation`,
    content,
    [
      { text: 'View Full Analysis', url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://financial-planner.vercel.app'}/scenarios` },
      { text: 'Schedule Review', url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://financial-planner.vercel.app'}/profile` },
    ],
    `Your ${expertTitle.toLowerCase()} is here to help you succeed.`
  );
}

/**
 * Welcome Email (New User)
 */
export function welcomeEmail(userName: string, accountType: string): EmailTemplate {
  const content = `
    <h2>Welcome to Financial 101 Master crafted by Toy, ${userName}!</h2>
    <p>We're excited to have you on board. Your account is fully set up and ready to use.</p>

    <div class="highlight">
      <strong>Account Type:</strong> ${accountType}<br>
      <strong>Account Access:</strong> Read & Write<br>
      <strong>Cloud Backup:</strong> Google Drive (Auto-sync enabled)
    </div>

    <h3 style="color: #1f2937;">Get Started:</h3>
    <ul style="padding-left: 20px; color: #4b5563;">
      <li>Add your income sources</li>
      <li>Track your expenses</li>
      <li>Set up your investments</li>
      <li>Plan your debts and mortgages</li>
      <li>Get AI-driven insights and recommendations</li>
    </ul>

    <p style="margin-top: 20px;">Our expert advisors are ready to help you optimize your financial plan. Start with the Scenario Planner to see data-driven recommendations.</p>
  `;

  return createBaseTemplate(
    '👋 Welcome to Financial 101 Master crafted by Toy',
    content,
    [{ text: 'Start Planning', url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://financial-planner.vercel.app'}/income` }],
    'Your financial success starts here.'
  );
}

/**
 * System Alert Email
 */
export function systemAlertEmail(
  accountName: string,
  alertTitle: string,
  alertMessage: string,
  severity: 'info' | 'warning' | 'critical'
): EmailTemplate {
  const severityColor = {
    info: '#4F46E5',
    warning: '#F59E0B',
    critical: '#EF4444',
  };

  const severityIcon = {
    info: 'ℹ️',
    warning: '⚠️',
    critical: '🚨',
  };

  const content = `
    <h2>${severityIcon[severity]} ${alertTitle}</h2>
    <p>Account: <strong>${accountName}</strong></p>

    <div class="highlight" style="border-left-color: ${severityColor[severity]};">
      <p style="margin: 0; color: #4b5563;">${alertMessage}</p>
    </div>

    <p>If you did not authorize this action or have questions, please review your account immediately.</p>
  `;

  return createBaseTemplate(
    `${severityIcon[severity]} ${alertTitle}`,
    content,
    [{ text: 'Review Account', url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://financial-planner.vercel.app'}/profile` }],
    'Keeping you informed and secure.'
  );
}

/**
 * Deployment Notification Email
 */
export function deploymentNotificationEmail(
  deploymentUrl: string,
  version: string,
  changes: string[]
): EmailTemplate {
  const changesHTML = changes
    .map(
      (change) => `
    <div style="margin: 8px 0; padding: 8px; background: #f0f9ff; border-radius: 4px; font-size: 13px; color: #4b5563;">
      ✓ ${change}
    </div>
  `
    )
    .join('');

  const content = `
    <h2>🚀 Deployment Successful</h2>
    <p>Financial 101 Master crafted by Toy has been successfully deployed to production.</p>

    <div class="highlight" style="border-left-color: #22c55e;">
      <strong>Version:</strong> ${version}<br>
      <strong>Deployed:</strong> ${new Date().toLocaleString()}<br>
      <strong>Environment:</strong> Cloudflare Pages & Workers
    </div>

    <h3 style="color: #1f2937; margin-top: 20px;">Live Application</h3>
    <p style="margin: 12px 0;">
      <a href="${deploymentUrl}" style="color: #4F46E5; text-decoration: none; font-weight: 600;">
        🌍 ${deploymentUrl}
      </a>
    </p>

    <h3 style="color: #1f2937; margin-top: 20px;">What's New</h3>
    ${changesHTML}

    <h3 style="color: #1f2937; margin-top: 20px;">Deployment Details</h3>
    <ul style="padding-left: 20px; color: #4b5563; font-size: 14px;">
      <li>✓ Cloudflare Pages deployment complete</li>
      <li>✓ Email Worker (email-notify) deployed</li>
      <li>✓ Database and storage configured</li>
      <li>✓ SSL/HTTPS enabled</li>
      <li>✓ All secrets and environment variables set</li>
    </ul>

    <p style="margin-top: 20px; color: #6b7280; font-size: 13px;">
      This is an automated deployment notification. No action is required.
    </p>
  `;

  return createBaseTemplate(
    `🚀 ${version} Deployed to Production`,
    content,
    [{ text: 'Visit Live App', url: deploymentUrl }],
    'Your application is live and ready for use.'
  );
}

/**
 * Export all templates
 */
export const emailTemplates = {
  googleDriveSync: googleDriveSyncEmail,
  aiInsights: aiInsightsEmail,
  mortgagePayoff: mortgagePayoffEmail,
  expertRecommendation: expertRecommendationEmail,
  welcome: welcomeEmail,
  systemAlert: systemAlertEmail,
  deploymentNotification: deploymentNotificationEmail,
};
