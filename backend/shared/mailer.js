import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import pool from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

export function getLogoPath() {
  const candidatePaths = [
    path.resolve(__dirname, 'assets/logo.png'),
    path.resolve(__dirname, '../assets/logo.png'),
    path.resolve(__dirname, '../../frontend/public/images/logo.png'),
    path.resolve(__dirname, '../../frontend/src/assets/images/Nippon Logo.png'),
    path.resolve(__dirname, '../../frontend/src/assets/Nippon Logo.png'),
  ];
  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  return null;
}

export function getLogoBase64() {
  const p = getLogoPath();
  if (p && fs.existsSync(p)) {
    try {
      const buf = fs.readFileSync(p);
      return `data:image/png;base64,${buf.toString('base64')}`;
    } catch {
      return '';
    }
  }
  return '';
}

/**
 * Shared Mailer Service for India Nippon Electricals Limited Portal
 */

export function getTransporter() {
  const host = process.env.SMTP_HOST || 'localhost';
  const port = Number(process.env.SMTP_PORT) || 465;
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;
  const user = process.env.SMTP_USER || process.env.EMAIL_USER || '';
  const pass = process.env.SMTP_PASS || process.env.EMAIL_PASS || '';

  if (user && pass) {
    try {
      return nodemailer.createTransport({
        host,
        port,
        secure,
        auth: { user, pass },
        tls: {
          ciphers: 'SSLv3',
          rejectUnauthorized: false
        }
      });
    } catch (err) {
      console.warn('[Mailer] Could not initialize nodemailer transporter:', err.message);
    }
  }
  return null;
}


/**
 * Log an email event to MySQL email_logs table
 */
async function logEmail({
  moduleType,
  requestId,
  referenceNo,
  recipientRole,
  recipientName,
  recipientEmail,
  subject,
  bodyText,
  bodyHtml,
  deliveryStatus,
  smtpResponse,
  errorMessage,
}) {
  if (!pool) return;
  try {
    await pool.query(
      `INSERT INTO email_logs 
       (module_type, request_id, reference_no, recipient_role, recipient_name, recipient_email, subject, body_text, body_html, delivery_status, smtp_response, error_message)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        moduleType || 'GENERAL',
        requestId || null,
        referenceNo || null,
        recipientRole || 'USER',
        recipientName || '',
        recipientEmail || '',
        subject || '',
        bodyText || '',
        bodyHtml || '',
        deliveryStatus || 'SENT',
        smtpResponse || null,
        errorMessage || null,
      ]
    );
  } catch (dbErr) {
    console.warn('[Mailer] Could not insert into email_logs:', dbErr.message);
  }
}

/**
 * Send an email (with fallback to database log & console)
 */
export async function sendEmail({
  to,
  recipientName = '',
  recipientRole = 'USER',
  subject,
  text,
  html,
  moduleType = 'IHLR',
  requestId = null,
  referenceNo = '',
  skipCc = false,
  attachments = [],
}) {
  // Restrict email notifications strictly to focused module (Default: ALL)
  const focusModule = (process.env.EMAIL_FOCUS_MODULE || 'ALL').toUpperCase();
  const currentModule = (moduleType || 'GENERAL').toUpperCase();
  const allowedModules = focusModule.split(',').map((s) => s.trim());
  if (focusModule !== 'ALL' && !allowedModules.includes(currentModule) && currentModule !== 'DIAGNOSTIC') {
    return {
      success: true,
      skipped: true,
      message: `Mailer is focused on ${focusModule}. Notification for '${moduleType}' skipped.`
    };
  }

  const DEFAULT_TRIGGER_EMAIL = process.env.SMTP_USER || process.env.EMAIL_USER || '';
  const cleanTo = (to && to.trim()) ? to.trim() : DEFAULT_TRIGGER_EMAIL;

  // Whenever a mail is triggered, also ensure the configured trigger email receives the notification
  const ccRecipient = (!skipCc && DEFAULT_TRIGGER_EMAIL && cleanTo.toLowerCase() !== DEFAULT_TRIGGER_EMAIL.toLowerCase())
    ? DEFAULT_TRIGGER_EMAIL
    : undefined;

  console.log(`\n======================================================`);
  console.log(`📧 [EMAIL NOTIFICATION TRIGGERED]`);
  console.log(`   Module    : ${moduleType}`);
  console.log(`   Reference : ${referenceNo || 'N/A'}`);
  console.log(`   Role      : ${recipientRole}`);
  console.log(`   To        : ${recipientName ? `${recipientName} <${cleanTo}>` : cleanTo}`);
  if (ccRecipient) {
    console.log(`   Also CC   : ${ccRecipient} (User Email Trigger)`);
  }
  console.log(`   Subject   : ${subject}`);
  console.log(`======================================================\n`);

  const transporter = getTransporter();
  let defaultPortalName = 'INEL Quality Portal';
  if (currentModule === 'PROCESS_AUDIT') defaultPortalName = 'INEL Process Audit Portal';
  else if (currentModule === 'IHLR') defaultPortalName = 'INEL IHLR Portal';

  const senderFrom = process.env.SMTP_FROM || (DEFAULT_TRIGGER_EMAIL ? `"${defaultPortalName}" <${DEFAULT_TRIGGER_EMAIL}>` : `"${defaultPortalName}"`);

  // Automatically attach INEL logo if referenced in HTML
  const finalAttachments = Array.isArray(attachments) ? [...attachments] : [];
  if (html && html.includes('cid:inel-logo') && !finalAttachments.some((a) => a.cid === 'inel-logo')) {
    const logoPath = getLogoPath();
    if (logoPath) {
      finalAttachments.push({
        filename: 'inel-logo.png',
        path: logoPath,
        cid: 'inel-logo',
        contentDisposition: 'inline'
      });
    }
  }

  if (transporter) {
    try {
      const mailOptions = {
        from: senderFrom,
        to: cleanTo,
        subject,
        text,
        html,
        attachments: finalAttachments,
      };
      if (ccRecipient) {
        mailOptions.cc = ccRecipient;
      }

      const info = await transporter.sendMail(mailOptions);

      console.log(`[Mailer] Real email successfully sent to ${cleanTo}${ccRecipient ? ` & CC: ${ccRecipient}` : ''} (Message ID: ${info.messageId})`);
      await logEmail({
        moduleType,
        requestId,
        referenceNo,
        recipientRole,
        recipientName,
        recipientEmail: cleanTo,
        subject,
        bodyText: text,
        bodyHtml: (html && html.includes('cid:inel-logo')) ? html.replace(/src=["']cid:inel-logo["']/g, `src="${getLogoBase64() || 'cid:inel-logo'}"`) : html,
        deliveryStatus: 'DELIVERED',
        smtpResponse: info.response || info.messageId,
      });

      return { success: true, messageId: info.messageId };
    } catch (sendErr) {
      console.error(`[Mailer] SMTP delivery attempt to ${cleanTo}:`, sendErr.message);
      if (sendErr.message && sendErr.message.includes('535')) {
        console.warn(`[Mailer Notice] SMTP authentication failed. Check SMTP_USER & SMTP_PASS in backend/.env.`);
      }
      await logEmail({
        moduleType,
        requestId,
        referenceNo,
        recipientRole,
        recipientName,
        recipientEmail: cleanTo,
        subject,
        bodyText: text,
        bodyHtml: (html && html.includes('cid:inel-logo')) ? html.replace(/src=["']cid:inel-logo["']/g, `src="${getLogoBase64() || 'cid:inel-logo'}"`) : html,
        deliveryStatus: 'FAILED',
        errorMessage: sendErr.message,
      });

      return { success: false, error: sendErr.message };
    }
  } else {
    // Development or Offline Mode without active SMTP credentials
    // We log the complete email dispatch to database and console for verification
    await logEmail({
      moduleType,
      requestId,
      referenceNo,
      recipientRole,
      recipientName,
      recipientEmail: cleanTo,
      subject,
      bodyText: text,
      bodyHtml: (html && html.includes('cid:inel-logo')) ? html.replace(/src=["']cid:inel-logo["']/g, `src="${getLogoBase64() || 'cid:inel-logo'}"`) : html,
      deliveryStatus: 'DISPATCHED_SIMULATED',
      smtpResponse: 'Simulated dispatch (configure SMTP in .env for live inbox delivery)',
    });

    return { success: true, simulated: true };
  }
}

/**
 * Resolves standard user-facing status label for IHLR emails:
 * - 'Closed'
 * - 'Awaiting Review'
 * - 'Pending'
 */
export function formatIhlrMailStatus(statusOrReq) {
  const req = typeof statusOrReq === 'object' && statusOrReq !== null ? statusOrReq : null;
  const rawStatus = (typeof statusOrReq === 'string' ? statusOrReq : req?.status) || '';
  const s = String(rawStatus).trim().toUpperCase();

  if (s === 'CLOSED' || s === 'APPROVED') {
    return 'Closed';
  }

  const isCompleted = (
    s === 'IN_PROGRESS' ||
    s === 'IN-PROGRESS' ||
    s === 'APPROVAL_PENDING' ||
    s === 'APPROVAL PENDING' ||
    s === 'AWAITING_REVIEW' ||
    s === 'AWAITING REVIEW' ||
    s === 'UNDER_REVIEW' ||
    (req && (
      Boolean((req.temporary_action || req.permanent_fix || req.action) && String(req.temporary_action || req.permanent_fix || req.action).trim()) &&
      (Array.isArray(req.prod_why_why)
        ? req.prod_why_why.some((w) => Boolean(w && String(w).trim()))
        : Boolean(req.prod_why_why?.[0] && String(req.prod_why_why[0]).trim()))
    ))
  );

  if (isCompleted) {
    return 'Awaiting Review';
  }

  return 'Pending';
}

/**
 * Generate standard HTML template for INEL portal emails
 */
export function generateEmailTemplate({
  headerTitle,
  headerSubtitle,
  recipientName,
  greetingMessage,
  tableData = [],
  actionButtonText,
  actionButtonUrl,
  footerNote,
  badgeColor = '#2563eb',
  badgeText = 'NOTIFICATION',
  logoUrl,
}) {
  const resolvedLogo = logoUrl || 'cid:inel-logo';
  const tableRows = tableData
    .map(
      (item) => `
      <tr>
        <td style="padding: 10px 14px; border-bottom: 1px solid #f1f5f9; color: #64748b; font-size: 13px; font-weight: 600; width: 35%; background: #f8fafc;">
          ${item.label}
        </td>
        <td style="padding: 10px 14px; border-bottom: 1px solid #f1f5f9; color: #0f172a; font-size: 13px; font-weight: 500;">
          ${item.value || '—'}
        </td>
      </tr>
    `
    )
    .join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${headerTitle}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 24px;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 620px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 14px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
    
    <!-- Top Brand Header -->
    <tr>
      <td style="background: #0f172a; padding: 20px 28px;">
        <table width="100%" border="0" cellspacing="0" cellpadding="0">
          <tr>
            <td style="vertical-align: middle;">
              <table border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="vertical-align: middle; padding-right: 14px; width: 44px;">
                    <div style="background: #ffffff; border-radius: 10px; padding: 5px; display: inline-block; box-shadow: 0 2px 6px rgba(0,0,0,0.25); line-height: 0; text-align: center;">
                      <img src="${resolvedLogo}" alt="INEL Logo" width="34" height="34" style="display: block; width: 34px; height: 34px; object-fit: contain; margin: 0 auto; border: 0;" />
                    </div>
                  </td>
                  <td style="vertical-align: middle;">
                    <div style="font-size: 16px; font-weight: 800; color: #ffffff; letter-spacing: -0.3px; line-height: 1.25;">
                      INDIA NIPPON ELECTRICALS LIMITED
                    </div>
                    <div style="font-size: 11px; color: #94a3b8; margin-top: 3px; font-weight: 500; letter-spacing: 0.2px;">
                      Enterprise Quality Management &amp; Audit System
                    </div>
                  </td>
                </tr>
              </table>
            </td>
            <td align="right" style="vertical-align: middle;">
              <span style="background: ${badgeColor}; color: #ffffff; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 9999px; text-transform: uppercase; letter-spacing: 0.5px; white-space: nowrap; display: inline-block;">
                ${badgeText}
              </span>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Body Header -->
    <tr>
      <td style="padding: 32px 32px 16px 32px;">
        <h1 style="font-size: 20px; font-weight: 700; color: #0f172a; margin: 0 0 8px 0;">
          ${headerTitle}
        </h1>
        <p style="font-size: 13px; color: #64748b; margin: 0 0 20px 0; line-height: 1.5;">
          ${headerSubtitle}
        </p>

        <p style="font-size: 14px; color: #334155; margin: 0 0 20px 0; line-height: 1.6;">
          Dear <strong>${recipientName || 'Team Member'}</strong>,<br/>
          ${greetingMessage}
        </p>

        <!-- Information Table -->
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; margin-bottom: 24px;">
          ${tableRows}
        </table>

        <!-- Action CTA -->
        ${
          actionButtonText && actionButtonUrl
            ? `
          <div style="text-align: center; margin: 28px 0 20px 0;">
            <a href="${actionButtonUrl}" style="background: #2563eb; color: #ffffff; padding: 12px 28px; font-size: 13px; font-weight: 700; text-decoration: none; border-radius: 10px; display: inline-block; box-shadow: 0 2px 8px rgba(37,99,235,0.25);">
              ${actionButtonText} &rarr;
            </a>
          </div>
        `
            : ''
        }

        <p style="font-size: 12px; color: #64748b; margin: 20px 0 0 0; line-height: 1.5; border-top: 1px solid #f1f5f9; padding-top: 16px;">
          ${footerNote || 'Please do not reply directly to this automated email. Log in to the INEL portal to submit your containment actions and sign-offs.'}
        </p>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="background: #f8fafc; padding: 20px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
        <p style="font-size: 11px; color: #94a3b8; margin: 0;">
          &copy; ${new Date().getFullYear()} India Nippon Electricals Limited. All rights reserved.<br/>
          Automated Notification Dispatcher • Hosur Plant
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

/**
 * Send dual emails (to raised person & selected person) for IHLR requests
 */
export async function sendIhlrRequestEmails({ request, creatorUser, assignedUser }) {
  const reqNo = request.req_no || `IHLR-${request.id || '1'}`;
  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const myRequestsUrl = `${baseUrl}/ihlr/my-requests`;

  const creatorEmail = creatorUser?.email || request.created_by_email || process.env.SMTP_USER || '';
  const creatorName = creatorUser?.name || request.analysis_done_by || request.created_by || 'Quality Engineer';

  const assignedEmail = assignedUser?.email || request.resp_person_email || process.env.SMTP_USER || '';
  const assignedName = assignedUser?.name || request.resp_person || 'Responsible Officer';
  const assignedDept = request.resp || assignedUser?.department || 'PRODUCTION';

  const mailStatus = formatIhlrMailStatus(request); // Returns 'Pending'

  const tableSummary = [
    { label: 'Request Number', value: reqNo },
    { label: 'Defect / Problem', value: request.problem },
    { label: 'Model', value: request.model },
    { label: 'Detected At', value: request.problem_detected_at || 'Cell Inspection' },
    { label: 'Shift / Batch Date', value: `Shift ${request.shift || 'I'} • ${request.batch_date || 'Today'}` },
    { label: '4M Category', value: request.four_m || 'MAN' },
    { label: 'Actual Qty', value: String(request.actual_qty || 1) },
    { label: 'Target Dept', value: assignedDept },
    { label: 'Assigned Person', value: assignedName },
    { label: 'Status', value: mailStatus },
  ];

  const results = {};

  // 1. EMAIL TO RAISED PERSON (CREATOR)
  if (creatorEmail) {
    const creatorSubject = `[IHLR Confirmation] Defect Request #${reqNo} Successfully Submitted (Pending)`;
    const creatorHtml = generateEmailTemplate({
      headerTitle: `IHLR Defect Report Logged: #${reqNo}`,
      headerSubtitle: `Your In-House Line Rejection analysis report has been recorded and dispatched for containment.`,
      recipientName: creatorName,
      greetingMessage: `Your IHLR defect observation report for <strong>${request.model}</strong> has been logged into the database and assigned to <strong>${assignedName}</strong> (${assignedDept}) for 5-Why root cause countermeasure.<br><br><strong>Current Status:</strong> <span style="display:inline-block; padding: 2px 8px; font-weight:700; background:#fef3c7; color:#b45309; border-radius:4px;">Pending</span>`,
      tableData: tableSummary,
      actionButtonText: 'View My IHLR Requests',
      actionButtonUrl: myRequestsUrl,
      footerNote: 'You will receive an alert once the responsible department submits containment action and why-why analysis.',
      badgeColor: '#f59e0b',
      badgeText: 'PENDING',
    });

    results.creator = await sendEmail({
      to: creatorEmail,
      recipientName: creatorName,
      recipientRole: 'RAISED_PERSON',
      subject: creatorSubject,
      text: `Your IHLR defect request #${reqNo} (${request.model} - "${request.problem}") has been successfully logged (Status: Pending) and assigned to ${assignedName} (${assignedDept}).`,
      html: creatorHtml,
      moduleType: 'IHLR',
      requestId: request.id,
      referenceNo: reqNo,
    });
  }

  // 2. EMAIL TO SELECTED PERSON IN FIELD (ASSIGNED USER)
  if (assignedEmail) {
    const assignedSubject = `[Action Required] IHLR Rejection #${reqNo} Assigned to You (${assignedDept}) - Pending`;
    const assignedHtml = generateEmailTemplate({
      headerTitle: `Action Required: IHLR Incident #${reqNo}`,
      headerSubtitle: `An in-house line rejection has been assigned to you for investigation and corrective action.`,
      recipientName: assignedName,
      greetingMessage: `<strong>${creatorName}</strong> from Incoming Quality has logged an in-house line rejection and designated you as the responsible owner for containment and 5-Why analysis.<br><br><strong>Current Status:</strong> <span style="display:inline-block; padding: 2px 8px; font-weight:700; background:#fef3c7; color:#b45309; border-radius:4px;">Pending</span>`,
      tableData: tableSummary,
      actionButtonText: 'Open Report & Submit Countermeasure',
      actionButtonUrl: myRequestsUrl,
      footerNote: 'Immediate action required: please inspect the defective batch and record corrective containment measures in the portal.',
      badgeColor: '#f59e0b',
      badgeText: 'PENDING ACTION',
    });

    results.assigned = await sendEmail({
      to: assignedEmail,
      recipientName: assignedName,
      recipientRole: 'SELECTED_PERSON',
      subject: assignedSubject,
      text: `IHLR Request #${reqNo} (${request.model} - "${request.problem}") has been assigned to you by ${creatorName} (Status: Pending). Please log in to complete containment analysis.`,
      html: assignedHtml,
      moduleType: 'IHLR',
      requestId: request.id,
      referenceNo: reqNo,
    });
  }

  return results;
}

/**
 * Send closer / countermeasure update emails for IHLR requests
 */
export async function sendIhlrCloserEmails({ request, closerUser, creatorUser, assignedUser, adminUsers = [] }) {
  const reqNo = request.req_no || `IHLR-${request.id || '1'}`;
  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const reportUrl = `${baseUrl}/ihlr/my-requests`;
  const approvalsUrl = `${baseUrl}/ihlr/approvals`;

  const creatorEmail = creatorUser?.email || request.created_by_email || process.env.SMTP_USER || '';
  const creatorName = creatorUser?.name || request.analysis_done_by || request.created_by || 'Quality Engineer';

  const assignedEmail = assignedUser?.email || request.resp_person_email || process.env.SMTP_USER || '';
  const assignedName = assignedUser?.name || request.resp_person || 'Responsible Officer';
  const assignedDept = request.resp || assignedUser?.department || 'PRODUCTION';

  const isClosed = String(request.status).toUpperCase() === 'CLOSED' || String(request.status).toUpperCase() === 'APPROVED';
  const mailStatus = isClosed ? 'Closed' : 'Awaiting Review';
  const closerWhy1 = Array.isArray(request.prod_why_why) ? (request.prod_why_why[0] || '—') : (typeof request.prod_why_why === 'string' ? JSON.parse(request.prod_why_why || '[]')[0] || '—' : '—');

  const tableSummary = [
    { label: 'Request Number', value: reqNo },
    { label: 'Defect / Model', value: `${request.problem || '—'} (${request.model || '—'})` },
    { label: 'Responsible Dept', value: assignedDept },
    { label: 'Responsible Closer', value: assignedName },
    { label: 'Occurrence Cause (Why 1)', value: closerWhy1 },
    { label: 'Action Taken', value: request.action || request.temporary_action || request.permanent_fix || 'Containment in progress' },
    { label: 'Target / Close Date', value: request.target_date || request.permanent_target_date || request.temporary_target_date || 'N/A' },
    { label: 'Status', value: mailStatus },
    { label: 'Remarks', value: request.remarks || (isClosed ? 'Closed' : '(Pending validation by Requester/Admin)') }
  ];

  const results = { admins: [] };

  // 1. Notify Creator (Raised Person / Requester)
  if (creatorEmail) {
    const subject = isClosed 
      ? `[IHLR Case Closed] Defect Report #${reqNo} Verified & Closed`
      : `[Action Required] Closer Completed Countermeasures for #${reqNo} (Awaiting Review)`;

    const html = generateEmailTemplate({
      headerTitle: isClosed ? `IHLR Case Closed: #${reqNo}` : `Closer Countermeasure Completed: #${reqNo}`,
      headerSubtitle: isClosed
        ? `Defect containment and 5-Why corrective actions have been completed and verified.`
        : `Closer ${assignedName} (${assignedDept}) has completed 5-Why root cause analysis and corrective action. Ready for review and sign-off.`,
      recipientName: creatorName,
      greetingMessage: isClosed
        ? `Defect observation report <strong>${reqNo}</strong> (${request.model || 'Model'}) has been signed off and marked as <strong>Closed</strong>.<br><br><strong>Final Status:</strong> <span style="display:inline-block; padding: 2px 8px; font-weight:700; background:#dcfce7; color:#166534; border-radius:4px;">Closed</span>`
        : `Closer <strong>${assignedName}</strong> (${assignedDept}) has completed the 5-Why root cause analysis and corrective action for defect report <strong>${reqNo}</strong> (${request.model || 'Report'}).<br><br><strong>Current Status:</strong> <span style="display:inline-block; padding: 2px 8px; font-weight:700; background:#fef3c7; color:#b45309; border-radius:4px;">Awaiting Review</span><br><br><strong>Action Required:</strong> Please review the containment countermeasure details below and complete the pending fields: <strong>Remarks</strong> &amp; <strong>Status sign-off</strong>.`,
      tableData: tableSummary,
      actionButtonText: isClosed ? 'Review Full IHLR Report' : 'Complete Pending Remarks & Sign-Off',
      actionButtonUrl: approvalsUrl,
      footerNote: isClosed ? 'Verification complete in the INEL portal.' : 'Action required: Please enter your review remarks and sign off status in the portal.',
      badgeColor: isClosed ? '#10b981' : '#d97706',
      badgeText: isClosed ? 'CLOSED' : 'AWAITING REVIEW',
    });

    results.creator = await sendEmail({
      to: creatorEmail,
      recipientName: creatorName,
      recipientRole: 'RAISED_PERSON',
      subject,
      text: isClosed
        ? `Defect report #${reqNo} verified and marked as Closed.`
        : `Action Required: Closer ${assignedName} (${assignedDept}) completed root cause countermeasures for #${reqNo} (Status: Awaiting Review). Please complete remarks and sign off status at: ${approvalsUrl}`,
      html,
      moduleType: 'IHLR',
      requestId: request.id,
      referenceNo: reqNo,
    });
  }

  // 2. Notify Quality Admins
  if (Array.isArray(adminUsers) && adminUsers.length > 0) {
    for (const admin of adminUsers) {
      const adminEmail = admin?.email;
      const adminName = admin?.name || 'Quality Admin';
      if (!adminEmail || (creatorEmail && adminEmail.toLowerCase() === creatorEmail.toLowerCase())) {
        continue; // avoid duplicate email if creator is this admin
      }

      const adminSubject = isClosed
        ? `[IHLR Case Closed] Incident #${reqNo} Closed by Quality Team`
        : `[Admin Action Required] Closer Completed Countermeasures for #${reqNo} (Awaiting Review)`;

      const adminHtml = generateEmailTemplate({
        headerTitle: isClosed ? `Case Closed: #${reqNo}` : `Pending Closer Review: #${reqNo}`,
        headerSubtitle: isClosed
          ? `Defect report #${reqNo} has been finalized and closed.`
          : `Closer ${assignedName} (${assignedDept}) has completed root cause analysis and countermeasures. Ready for validation remarks and status sign-off.`,
        recipientName: adminName,
        greetingMessage: isClosed
          ? `Defect report <strong>${reqNo}</strong> (${request.model || 'Model'}) has been signed off and marked as <strong>Closed</strong>.<br><br><strong>Final Status:</strong> <span style="display:inline-block; padding: 2px 8px; font-weight:700; background:#dcfce7; color:#166534; border-radius:4px;">Closed</span>`
          : `Closer <strong>${assignedName}</strong> (${assignedDept}) has completed the 5-Why root cause analysis and corrective action for defect report <strong>${reqNo}</strong> (${request.model || 'Report'}).<br><br><strong>Current Status:</strong> <span style="display:inline-block; padding: 2px 8px; font-weight:700; background:#fef3c7; color:#b45309; border-radius:4px;">Awaiting Review</span><br><br><strong>Admin Action Required:</strong> Please review root cause details, provide validation remarks, and finalize the incident status.`,
        tableData: tableSummary,
        actionButtonText: 'Review & Sign-Off Incident',
        actionButtonUrl: approvalsUrl,
        footerNote: 'Please sign off in the INEL Quality Portal.',
        badgeColor: isClosed ? '#10b981' : '#d97706',
        badgeText: isClosed ? 'CLOSED' : 'AWAITING REVIEW',
      });

      const adminRes = await sendEmail({
        to: adminEmail,
        recipientName: adminName,
        recipientRole: 'ADMIN',
        subject: adminSubject,
        text: `Admin Action Required: Closer ${assignedName} completed countermeasures for #${reqNo} (Status: Awaiting Review). Please review and finalize sign-off at: ${approvalsUrl}`,
        html: adminHtml,
        moduleType: 'IHLR',
        requestId: request.id,
        referenceNo: reqNo,
      });
      results.admins.push(adminRes);
    }
  }

  // 3. Acknowledge to Closer (Assigned Person)
  if (assignedEmail) {
    const subject = isClosed
      ? `[IHLR Case Closed] Closer Confirmation: Defect Report #${reqNo} Marked as Closed`
      : `[IHLR Acknowledgment] Closer Countermeasures Submitted for #${reqNo} (Awaiting Review)`;

    const html = generateEmailTemplate({
      headerTitle: isClosed ? `Case Closed & Signed-Off: #${reqNo}` : `Closer Submission Acknowledged: #${reqNo}`,
      headerSubtitle: isClosed
        ? `Your closure sign-off and root cause containment measures have been confirmed in the quality portal.`
        : `Your 5-Why root cause countermeasures have been successfully submitted (Status: Awaiting Review). Requester and Admin have been alerted to complete the pending fields.`,
      recipientName: assignedName,
      greetingMessage: isClosed
        ? `You have successfully verified and marked IHLR Report <strong>${reqNo}</strong> as <strong>Closed</strong>.<br><br><strong>Final Status:</strong> <span style="display:inline-block; padding: 2px 8px; font-weight:700; background:#dcfce7; color:#166534; border-radius:4px;">Closed</span>`
        : `Thank you <strong>${assignedName}</strong>. Your 5-Why root cause analysis and corrective actions for IHLR Report <strong>${reqNo}</strong> have been recorded in the quality system.<br><br><strong>Current Status:</strong> <span style="display:inline-block; padding: 2px 8px; font-weight:700; background:#fef3c7; color:#b45309; border-radius:4px;">Awaiting Review</span><br><br>The Requester (<strong>${creatorName}</strong>) and Quality Admin have been alerted with notifications and email to complete the pending validation remarks and finalize status.`,
      tableData: tableSummary,
      actionButtonText: 'View Closer Approvals',
      actionButtonUrl: approvalsUrl,
      footerNote: 'Thank you for submitting quality containment measures.',
      badgeColor: isClosed ? '#10b981' : '#2563eb',
      badgeText: isClosed ? 'CLOSED' : 'AWAITING REVIEW',
    });

    results.assigned = await sendEmail({
      to: assignedEmail,
      recipientName: assignedName,
      recipientRole: 'SELECTED_PERSON',
      subject,
      text: isClosed
        ? `Defect report #${reqNo} has been marked as Closed. Containment verified.`
        : `Closer Log Acknowledged for #${reqNo} (Status: Awaiting Review). Requester and Admin have been notified to complete pending remarks and status.`,
      html,
      moduleType: 'IHLR',
      requestId: request.id,
      referenceNo: reqNo,
    });
  }

  return results;
}

/**
 * Send request creation emails for Process Audit requests
 */
export async function sendProcessAuditRequestEmails({ request, creatorUser, assignedUser, skipCreator = false }) {
  const reqNo = request.issue_no || (request.id ? `PA-${request.id}` : 'PA-1');
  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const myRequestsUrl = `${baseUrl}/process-audit/all-requests`;
  const approvalsUrl = `${baseUrl}/process-audit/approvals`;

  const creatorEmail = creatorUser?.email || (!skipCreator ? (request.created_by_email || process.env.SMTP_USER || '') : '');
  const creatorName = creatorUser?.name || request.created_by || 'Quality Auditor';

  const assignedEmail = assignedUser?.email || request.executor_email || process.env.SMTP_USER || '';
  const assignedName = assignedUser?.name || request.executor || 'Assigned Executor';
  const assignedDept = request.department || assignedUser?.department || 'Production';

  const tableSummary = [
    { label: 'Request Number', value: reqNo },
    { label: 'Product / Model', value: `${request.product || '—'} (${request.model || '—'})` },
    { label: 'Process / Operation', value: request.process_operation || '—' },
    { label: 'Shift / Escalation Date', value: `Shift ${request.shift || 'I'} • ${request.escalation_date || 'Today'}` },
    { label: 'Issue Type / Priority', value: `${request.issue_type || 'Process'} / ${request.priority || 'Medium'}` },
    { label: 'Target Dept', value: assignedDept },
    { label: 'Assigned Executor', value: assignedName },
    { label: 'Audit Observation', value: request.issue_observation || request.problem || '—' },
    { label: 'Audited By', value: creatorName },
    { label: 'Status', value: 'Pending' }
  ];

  const results = {};

  // 1. Email to Creator (Confirmation)
  if (creatorEmail && !skipCreator) {
    const creatorSubject = `[Process Audit Confirmation] Observation Finding #${reqNo} Successfully Submitted (Pending)`;
    const creatorHtml = generateEmailTemplate({
      headerTitle: `Process Audit Report Logged: #${reqNo}`,
      headerSubtitle: `Your process audit observation finding has been recorded and assigned for root cause containment.`,
      recipientName: creatorName,
      greetingMessage: `Your Process Audit observation report for <strong>${request.model || request.product}</strong> has been logged into the database and assigned to <strong>${assignedName}</strong> (${assignedDept}) for 5-Why root cause analysis and corrective action.<br><br><strong>Current Status:</strong> <span style="display:inline-block; padding: 2px 8px; font-weight:700; background:#fef3c7; color:#b45309; border-radius:4px;">Pending</span>`,
      tableData: tableSummary,
      actionButtonText: 'View Process Audit Requests',
      actionButtonUrl: myRequestsUrl,
      footerNote: 'You will receive an alert once the responsible department submits containment action and 5-Why analysis.',
      badgeColor: '#f59e0b',
      badgeText: 'PENDING',
    });

    results.creator = await sendEmail({
      to: creatorEmail,
      recipientName: creatorName,
      recipientRole: 'RAISED_PERSON',
      subject: creatorSubject,
      text: `Your Process Audit request #${reqNo} (${request.model || request.product} - "${request.issue_observation || request.problem}") has been successfully logged (Status: Pending) and assigned to ${assignedName} (${assignedDept}).`,
      html: creatorHtml,
      moduleType: 'PROCESS_AUDIT',
      requestId: request.id,
      referenceNo: reqNo,
    });
  }

  // 2. Email to Assigned Executor (Action Required)
  if (assignedEmail) {
    const assignedSubject = `[Action Required] Process Audit #${reqNo} Assigned to You (${assignedDept}) - Pending`;
    const assignedHtml = generateEmailTemplate({
      headerTitle: `Action Required: Process Audit Finding #${reqNo}`,
      headerSubtitle: `A process audit finding has been assigned to you for investigation and corrective action.`,
      recipientName: assignedName,
      greetingMessage: `<strong>${creatorName}</strong> has logged a process audit finding and designated you as the responsible owner for containment and 5-Why analysis.<br><br><strong>Current Status:</strong> <span style="display:inline-block; padding: 2px 8px; font-weight:700; background:#fef3c7; color:#b45309; border-radius:4px;">Pending</span>`,
      tableData: tableSummary,
      actionButtonText: 'Open Report & Submit Countermeasure',
      actionButtonUrl: approvalsUrl,
      footerNote: 'Immediate action required: please inspect the process finding and record corrective containment measures in the portal.',
      badgeColor: '#f59e0b',
      badgeText: 'PENDING ACTION',
    });

    results.assigned = await sendEmail({
      to: assignedEmail,
      recipientName: assignedName,
      recipientRole: 'SELECTED_PERSON',
      subject: assignedSubject,
      text: `Process Audit Request #${reqNo} (${request.model || request.product} - "${request.issue_observation || request.problem}") has been assigned to you by ${creatorName} (Status: Pending). Please log in to complete containment analysis.`,
      html: assignedHtml,
      moduleType: 'PROCESS_AUDIT',
      requestId: request.id,
      referenceNo: reqNo,
    });
  }

  return results;
}

/**
 * Send closer / countermeasure update emails for Process Audit requests
 */
export async function sendProcessAuditCloserEmails({ request, closerUser, creatorUser, assignedUser, adminUsers = [] }) {
  const reqNo = request.issue_no || (request.id ? `PA-${request.id}` : 'PA-1');
  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const approvalsUrl = `${baseUrl}/process-audit/approvals`;
  const allRequestsUrl = `${baseUrl}/process-audit/all-requests`;

  const creatorEmail = creatorUser?.email || request.created_by_email || process.env.SMTP_USER || '';
  const creatorName = creatorUser?.name || request.created_by || 'Quality Auditor';

  const assignedEmail = assignedUser?.email || request.executor_email || process.env.SMTP_USER || '';
  const assignedName = assignedUser?.name || request.executor || 'Assigned Lead';
  const assignedDept = request.department || assignedUser?.department || 'Production';

  const isClosed = String(request.status).toLowerCase().includes('close') || String(request.status).toLowerCase().includes('approv');
  const mailStatus = isClosed ? 'Closed' : 'Awaiting Review';

  let closerWhy1 = '—';
  if (Array.isArray(request.prod_why_why) && request.prod_why_why.length > 0) {
    closerWhy1 = request.prod_why_why[0] || '—';
  } else if (typeof request.prod_why_why === 'string') {
    try {
      const parsed = JSON.parse(request.prod_why_why);
      closerWhy1 = Array.isArray(parsed) && parsed.length > 0 ? (parsed[0] || '—') : '—';
    } catch {}
  }
  if (closerWhy1 === '—' && request.root_cause) {
    closerWhy1 = request.root_cause;
  }

  const tableSummary = [
    { label: 'Request Number', value: reqNo },
    { label: 'Product / Model', value: `${request.product || '—'} (${request.model || '—'})` },
    { label: 'Responsible Dept', value: assignedDept },
    { label: 'Responsible Executor', value: assignedName },
    { label: 'Occurrence Cause (Why 1)', value: closerWhy1 },
    { label: 'Action Taken', value: request.permanent_fix || request.temporary_action || request.corrective_action || 'Containment in progress' },
    { label: 'Target / Close Date', value: request.permanent_target_date || request.temporary_target_date || request.target_date || 'N/A' },
    { label: 'Status', value: mailStatus },
    { label: 'Auditor Remarks', value: request.creator_remark || request.remarks || (isClosed ? 'Closed' : '(Pending validation by Auditor/Admin)') }
  ];

  const results = { admins: [] };

  // 1. Notify Creator (Raised Person / Auditor)
  if (creatorEmail) {
    const subject = isClosed 
      ? `[Process Audit Case Closed] Audit Finding #${reqNo} Verified & Closed`
      : `[Action Required] Closer Completed Countermeasures for #${reqNo} (Awaiting Review)`;

    const html = generateEmailTemplate({
      headerTitle: isClosed ? `Process Audit Case Closed: #${reqNo}` : `Closer Countermeasure Completed: #${reqNo}`,
      headerSubtitle: isClosed
        ? `Audit observation containment and corrective actions have been completed and verified.`
        : `Closer ${assignedName} (${assignedDept}) has completed 5-Why root cause analysis and corrective action. Ready for review and sign-off.`,
      recipientName: creatorName,
      greetingMessage: isClosed
        ? `Process Audit report <strong>${reqNo}</strong> (${request.model || request.product || 'Process'}) has been signed off and marked as <strong>Closed</strong>.<br><br><strong>Final Status:</strong> <span style="display:inline-block; padding: 2px 8px; font-weight:700; background:#dcfce7; color:#166534; border-radius:4px;">Closed</span>`
        : `Closer <strong>${assignedName}</strong> (${assignedDept}) has completed the 5-Why root cause analysis and corrective action for audit report <strong>${reqNo}</strong> (${request.model || request.product || 'Report'}).<br><br><strong>Current Status:</strong> <span style="display:inline-block; padding: 2px 8px; font-weight:700; background:#fef3c7; color:#b45309; border-radius:4px;">Awaiting Review</span><br><br><strong>Action Required:</strong> Please review the containment countermeasure details below and complete the pending fields: <strong>Remarks</strong> &amp; <strong>Status sign-off</strong>.`,
      tableData: tableSummary,
      actionButtonText: isClosed ? 'Review Full Audit Report' : 'Complete Pending Remarks & Sign-Off',
      actionButtonUrl: isClosed ? allRequestsUrl : approvalsUrl,
      footerNote: isClosed ? 'Verification complete in the INEL portal.' : 'Action required: Please enter your review remarks and sign off status in the portal.',
      badgeColor: isClosed ? '#10b981' : '#d97706',
      badgeText: isClosed ? 'CLOSED' : 'AWAITING REVIEW',
    });

    results.creator = await sendEmail({
      to: creatorEmail,
      recipientName: creatorName,
      recipientRole: 'RAISED_PERSON',
      subject,
      text: isClosed
        ? `Audit report #${reqNo} verified and marked as Closed.`
        : `Action Required: Closer ${assignedName} (${assignedDept}) completed root cause countermeasures for #${reqNo} (Status: Awaiting Review). Please complete remarks and sign off status at: ${approvalsUrl}`,
      html,
      moduleType: 'PROCESS_AUDIT',
      requestId: request.id,
      referenceNo: reqNo,
    });
  }

  // 2. Notify Quality Admins
  if (Array.isArray(adminUsers) && adminUsers.length > 0) {
    for (const admin of adminUsers) {
      const adminEmail = admin?.email;
      const adminName = admin?.name || 'Quality Admin';
      if (!adminEmail || (creatorEmail && adminEmail.toLowerCase() === creatorEmail.toLowerCase())) {
        continue;
      }

      const adminSubject = isClosed
        ? `[Process Audit Case Closed] Incident #${reqNo} Closed by Quality Team`
        : `[Admin Action Required] Closer Completed Countermeasures for #${reqNo} (Awaiting Review)`;

      const adminHtml = generateEmailTemplate({
        headerTitle: isClosed ? `Case Closed: #${reqNo}` : `Pending Closer Review: #${reqNo}`,
        headerSubtitle: isClosed
          ? `Process audit report #${reqNo} has been finalized and closed.`
          : `Closer ${assignedName} (${assignedDept}) has completed root cause analysis and countermeasures. Ready for validation remarks and status sign-off.`,
        recipientName: adminName,
        greetingMessage: isClosed
          ? `Audit report <strong>${reqNo}</strong> (${request.model || request.product || 'Process'}) has been signed off and marked as <strong>Closed</strong>.<br><br><strong>Final Status:</strong> <span style="display:inline-block; padding: 2px 8px; font-weight:700; background:#dcfce7; color:#166534; border-radius:4px;">Closed</span>`
          : `Closer <strong>${assignedName}</strong> (${assignedDept}) has completed the 5-Why root cause analysis and corrective action for audit report <strong>${reqNo}</strong> (${request.model || request.product || 'Report'}).<br><br><strong>Current Status:</strong> <span style="display:inline-block; padding: 2px 8px; font-weight:700; background:#fef3c7; color:#b45309; border-radius:4px;">Awaiting Review</span><br><br><strong>Admin Action Required:</strong> Please review root cause details, provide validation remarks, and finalize the audit status.`,
        tableData: tableSummary,
        actionButtonText: 'Review & Sign-Off Incident',
        actionButtonUrl: approvalsUrl,
        footerNote: 'Please sign off in the INEL Quality Portal.',
        badgeColor: isClosed ? '#10b981' : '#d97706',
        badgeText: isClosed ? 'CLOSED' : 'AWAITING REVIEW',
      });

      const adminRes = await sendEmail({
        to: adminEmail,
        recipientName: adminName,
        recipientRole: 'ADMIN',
        subject: adminSubject,
        text: `Admin Action Required: Closer ${assignedName} completed countermeasures for #${reqNo} (Status: Awaiting Review). Please review and finalize sign-off at: ${approvalsUrl}`,
        html: adminHtml,
        moduleType: 'PROCESS_AUDIT',
        requestId: request.id,
        referenceNo: reqNo,
      });
      results.admins.push(adminRes);
    }
  }

  // 3. Acknowledge to Closer (Assigned Executor)
  if (assignedEmail) {
    const subject = isClosed
      ? `[Process Audit Case Closed] Closer Confirmation: Finding #${reqNo} Marked as Closed`
      : `[Process Audit Acknowledgment] Closer Countermeasures Submitted for #${reqNo} (Awaiting Review)`;

    const html = generateEmailTemplate({
      headerTitle: isClosed ? `Case Closed & Signed-Off: #${reqNo}` : `Closer Submission Acknowledged: #${reqNo}`,
      headerSubtitle: isClosed
        ? `Your closure sign-off and root cause containment measures have been confirmed in the quality portal.`
        : `Your 5-Why root cause countermeasures have been successfully submitted (Status: Awaiting Review). Auditor and Admin have been alerted to complete the pending fields.`,
      recipientName: assignedName,
      greetingMessage: isClosed
        ? `You have successfully verified and marked Process Audit Report <strong>${reqNo}</strong> as <strong>Closed</strong>.<br><br><strong>Final Status:</strong> <span style="display:inline-block; padding: 2px 8px; font-weight:700; background:#dcfce7; color:#166534; border-radius:4px;">Closed</span>`
        : `Thank you <strong>${assignedName}</strong>. Your 5-Why root cause analysis and corrective actions for Process Audit Report <strong>${reqNo}</strong> have been recorded in the quality system.<br><br><strong>Current Status:</strong> <span style="display:inline-block; padding: 2px 8px; font-weight:700; background:#fef3c7; color:#b45309; border-radius:4px;">Awaiting Review</span><br><br>The Auditor (<strong>${creatorName}</strong>) and Quality Admin have been alerted with notifications and email to complete the pending validation remarks and finalize status.`,
      tableData: tableSummary,
      actionButtonText: 'View Closer Approvals',
      actionButtonUrl: approvalsUrl,
      footerNote: 'Thank you for submitting quality containment measures.',
      badgeColor: isClosed ? '#10b981' : '#2563eb',
      badgeText: isClosed ? 'CLOSED' : 'AWAITING REVIEW',
    });

    results.assigned = await sendEmail({
      to: assignedEmail,
      recipientName: assignedName,
      recipientRole: 'SELECTED_PERSON',
      subject,
      text: isClosed
        ? `Process audit report #${reqNo} has been marked as Closed. Containment verified.`
        : `Closer Log Acknowledged for #${reqNo} (Status: Awaiting Review). Auditor and Admin have been notified to complete pending remarks and status.`,
      html,
      moduleType: 'PROCESS_AUDIT',
      requestId: request.id,
      referenceNo: reqNo,
    });
  }

  return results;
}

/**
 * Verify SMTP connection & authentication
 */
export async function verifySmtpConnection({ logToConsole = true } = {}) {
  const host = process.env.SMTP_HOST || 'localhost';
  const port = Number(process.env.SMTP_PORT) || 465;
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;
  const user = process.env.SMTP_USER || process.env.EMAIL_USER || '';
  const pass = process.env.SMTP_PASS || process.env.EMAIL_PASS || '';

  const configInfo = {
    host,
    port,
    secure,
    user: user || '(not configured)',
    hasPassword: Boolean(pass && pass.length > 0),
    from: process.env.SMTP_FROM || `"INEL Quality Portal" <${user}>`
  };

  if (!user || !pass) {
    if (logToConsole) {
      console.log('[Mailer] Transporter not configured (missing SMTP credentials)');
    }
    return {
      success: false,
      status: 'NOT_CONFIGURED',
      message: 'SMTP credentials missing in .env.',
      config: configInfo
    };
  }

  const transporter = getTransporter();
  if (!transporter) {
    if (logToConsole) {
      console.log('[Mailer] Transporter initialization failed');
    }
    return {
      success: false,
      status: 'INIT_FAILED',
      message: 'Could not create nodemailer transporter.',
      config: configInfo
    };
  }

  const startTime = Date.now();
  try {
    await transporter.verify();
    const duration = Date.now() - startTime;

    if (logToConsole) {
      console.log('Transporter is ready');
    }

    return {
      success: true,
      status: 'CONNECTED',
      message: 'Transporter is ready',
      duration,
      config: configInfo
    };
  } catch (err) {
    const duration = Date.now() - startTime;
    if (logToConsole) {
      console.warn('[Mailer] Transporter verification failed:', err.message);
    }
    return {
      success: false,
      status: 'FAILED',
      error: err.message,
      code: err.code || 'AUTH_OR_CONN_ERROR',
      duration,
      config: configInfo
    };
  }
}

/**
 * Send a diagnostic test email
 */
export async function sendTestEmail({ to, subject, logToConsole = true } = {}) {
  const target = to || process.env.SMTP_USER || '';
  const testSubject = subject || `[TEST] INEL Portal Mailer Diagnostic - ${new Date().toLocaleTimeString()}`;
  const timestamp = new Date().toLocaleString();

  if (logToConsole) {
    console.log('\n============================================================');
    console.log('📤 [MAILER TEST] Sending diagnostic test email...');
    console.log(`   Recipient : ${target || '(Not Specified - check SMTP_USER in .env)'}`);
    console.log(`   Subject   : ${testSubject}`);
    console.log(`   Timestamp : ${timestamp}`);
    console.log('============================================================\n');
  }

  const html = generateEmailTemplate({
    headerTitle: 'INEL Portal Mail Diagnostic',
    headerSubtitle: 'Outbound SMTP Verification Test',
    recipientName: 'Portal Administrator',
    greetingMessage: 'This is an automated test message dispatched to verify outbound email communications.',
    tableData: [
      { label: 'SMTP Host', value: process.env.SMTP_HOST || 'localhost' },
      { label: 'Port', value: String(process.env.SMTP_PORT || 465) },
      { label: 'Sender', value: process.env.SMTP_FROM || process.env.SMTP_USER || '(Not configured)' },
      { label: 'Dispatched At', value: timestamp }
    ],
    footerNote: 'India Nippon Electricals Limited — Automated Notification System',
    badgeColor: '#10b981',
    badgeText: 'DIAGNOSTIC TEST'
  });

  const result = await sendEmail({
    to: target,
    recipientName: 'Portal Administrator',
    recipientRole: 'TEST',
    subject: testSubject,
    text: `INEL Portal Mail Diagnostic Test dispatched at ${timestamp}.`,
    html,
    moduleType: 'DIAGNOSTIC',
    referenceNo: 'TEST-MAIL',
    skipCc: true
  });

  if (logToConsole) {
    if (result.success && !result.simulated) {
      console.log(`[Mailer Test] ✅ Live email successfully delivered to ${target}! Message ID: ${result.messageId}`);
    } else if (result.success && result.simulated) {
      console.log(`[Mailer Test] ⚠️ Simulated delivery logged to database (SMTP offline / credentials unverified).`);
    } else {
      console.log(`[Mailer Test] ❌ Email delivery failed: ${result.error}`);
    }
  }

  return result;
}




