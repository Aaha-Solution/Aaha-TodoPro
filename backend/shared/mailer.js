import nodemailer from 'nodemailer';
import pool from './db.js';

/**
 * Shared Mailer Service for India Nippon Electricals Limited Portal
 */

// SMTP Configuration
const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = Number(process.env.SMTP_PORT) || 587;
const SMTP_SECURE = process.env.SMTP_SECURE === 'true' || SMTP_PORT === 465;
const SMTP_USER = process.env.SMTP_USER || process.env.EMAIL_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || process.env.EMAIL_PASS || '';
const SMTP_FROM = process.env.SMTP_FROM || '"INEL Quality Portal" <noreply.inel.portal@gmail.com>';

function getTransporter() {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = Number(process.env.SMTP_PORT) || 587;
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
        tls: { rejectUnauthorized: false }
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
}) {
  if (!to || !to.trim()) {
    console.warn(`[Mailer] Skipping email send: No recipient email provided for ${recipientName || 'user'}`);
    return { success: false, reason: 'No recipient email' };
  }

  const cleanTo = to.trim();
  console.log(`\n======================================================`);
  console.log(`📧 [EMAIL NOTIFICATION TRIGGERED]`);
  console.log(`   Module    : ${moduleType}`);
  console.log(`   Reference : ${referenceNo || 'N/A'}`);
  console.log(`   Role      : ${recipientRole}`);
  console.log(`   To        : ${recipientName ? `${recipientName} <${cleanTo}>` : cleanTo}`);
  console.log(`   Subject   : ${subject}`);
  console.log(`======================================================\n`);

  const transporter = getTransporter();
  const senderFrom = process.env.SMTP_FROM || (process.env.SMTP_USER ? `"INEL Quality Portal" <${process.env.SMTP_USER}>` : SMTP_FROM);

  if (transporter) {
    try {
      const info = await transporter.sendMail({
        from: senderFrom,
        to: cleanTo,
        subject,
        text,
        html,
      });

      console.log(`[Mailer] Real email successfully sent to ${cleanTo} (Message ID: ${info.messageId})`);
      await logEmail({
        moduleType,
        requestId,
        referenceNo,
        recipientRole,
        recipientName,
        recipientEmail: cleanTo,
        subject,
        bodyText: text,
        bodyHtml: html,
        deliveryStatus: 'DELIVERED',
        smtpResponse: info.response || info.messageId,
      });

      return { success: true, messageId: info.messageId };
    } catch (sendErr) {
      console.error(`[Mailer] SMTP delivery error to ${cleanTo}:`, sendErr.message);
      await logEmail({
        moduleType,
        requestId,
        referenceNo,
        recipientRole,
        recipientName,
        recipientEmail: cleanTo,
        subject,
        bodyText: text,
        bodyHtml: html,
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
      bodyHtml: html,
      deliveryStatus: 'DISPATCHED_SIMULATED',
      smtpResponse: 'Simulated dispatch (configure SMTP in .env for live inbox delivery)',
    });

    return { success: true, simulated: true };
  }
}

/**
 * Generate standard HTML template for INEL portal emails
 */
function generateEmailTemplate({
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
}) {
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
      <td style="background: #0f172a; padding: 24px 32px;">
        <table width="100%" border="0" cellspacing="0" cellpadding="0">
          <tr>
            <td>
              <div style="font-size: 18px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">
                INDIA NIPPON ELECTRICALS LIMITED
              </div>
              <div style="font-size: 12px; color: #94a3b8; margin-top: 4px; font-weight: 500;">
                Enterprise Quality Management &amp; Audit System
              </div>
            </td>
            <td align="right">
              <span style="background: ${badgeColor}; color: #ffffff; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 9999px; text-transform: uppercase; letter-spacing: 0.5px;">
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

  const creatorEmail = creatorUser?.email || request.created_by_email;
  const creatorName = creatorUser?.name || request.analysis_done_by || request.created_by || 'Quality Engineer';

  const assignedEmail = assignedUser?.email || request.resp_person_email;
  const assignedName = assignedUser?.name || request.resp_person || 'Responsible Officer';
  const assignedDept = request.resp || assignedUser?.department || 'PRODUCTION';

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
    { label: 'Current Status', value: request.status || 'OPEN' },
  ];

  const results = {};

  // 1. EMAIL TO RAISED PERSON (CREATOR)
  if (creatorEmail) {
    const creatorSubject = `[IHLR Confirmation] Defect Request #${reqNo} Successfully Submitted`;
    const creatorHtml = generateEmailTemplate({
      headerTitle: `IHLR Defect Report Logged: #${reqNo}`,
      headerSubtitle: `Your In-House Line Rejection analysis report has been recorded and dispatched for containment.`,
      recipientName: creatorName,
      greetingMessage: `Your IHLR defect observation report for <strong>${request.model}</strong> has been logged into the database and assigned to <strong>${assignedName}</strong> (${assignedDept}) for 5-Why root cause countermeasure.`,
      tableData: tableSummary,
      actionButtonText: 'View My IHLR Requests',
      actionButtonUrl: myRequestsUrl,
      footerNote: 'You will receive an alert once the responsible department submits containment action and why-why analysis.',
      badgeColor: '#10b981',
      badgeText: 'SUBMITTED',
    });

    results.creator = await sendEmail({
      to: creatorEmail,
      recipientName: creatorName,
      recipientRole: 'RAISED_PERSON',
      subject: creatorSubject,
      text: `Your IHLR defect request #${reqNo} (${request.model} - "${request.problem}") has been successfully logged and assigned to ${assignedName} (${assignedDept}).`,
      html: creatorHtml,
      moduleType: 'IHLR',
      requestId: request.id,
      referenceNo: reqNo,
    });
  } else {
    console.warn(`[Mailer] No email address found for raised person: ${creatorName}`);
  }

  // 2. EMAIL TO SELECTED PERSON IN FIELD (ASSIGNED USER)
  if (assignedEmail) {
    const assignedSubject = `[Action Required] IHLR Rejection #${reqNo} Assigned to You (${assignedDept})`;
    const assignedHtml = generateEmailTemplate({
      headerTitle: `Action Required: IHLR Incident #${reqNo}`,
      headerSubtitle: `An in-house line rejection has been assigned to you for investigation and corrective action.`,
      recipientName: assignedName,
      greetingMessage: `<strong>${creatorName}</strong> from Incoming Quality has logged an in-house line rejection and designated you as the responsible owner for containment and 5-Why analysis.`,
      tableData: tableSummary,
      actionButtonText: 'Open Report & Submit Countermeasure',
      actionButtonUrl: myRequestsUrl,
      footerNote: 'Immediate action required: please inspect the defective batch and record corrective containment measures in the portal.',
      badgeColor: '#f59e0b',
      badgeText: 'ACTION REQUIRED',
    });

    results.assigned = await sendEmail({
      to: assignedEmail,
      recipientName: assignedName,
      recipientRole: 'SELECTED_PERSON',
      subject: assignedSubject,
      text: `IHLR Request #${reqNo} (${request.model} - "${request.problem}") has been assigned to you by ${creatorName}. Please log in to complete containment analysis.`,
      html: assignedHtml,
      moduleType: 'IHLR',
      requestId: request.id,
      referenceNo: reqNo,
    });
  } else {
    console.warn(`[Mailer] No email address found for selected person: ${assignedName}`);
  }

  return results;
}

/**
 * Send closer / countermeasure update emails for IHLR requests
 */
export async function sendIhlrCloserEmails({ request, closerUser, creatorUser, assignedUser }) {
  const reqNo = request.req_no || `IHLR-${request.id || '1'}`;
  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const reportUrl = `${baseUrl}/ihlr/my-requests`;
  const approvalsUrl = `${baseUrl}/ihlr/approvals`;

  const creatorEmail = creatorUser?.email || request.created_by_email;
  const creatorName = creatorUser?.name || request.analysis_done_by || request.created_by || 'Quality Engineer';

  const assignedEmail = assignedUser?.email || request.resp_person_email;
  const assignedName = assignedUser?.name || request.resp_person || 'Responsible Officer';
  const assignedDept = request.resp || assignedUser?.department || 'PRODUCTION';

  const isClosed = String(request.status).toUpperCase() === 'CLOSED';
  const closerWhy1 = Array.isArray(request.prod_why_why) ? (request.prod_why_why[0] || '—') : (typeof request.prod_why_why === 'string' ? JSON.parse(request.prod_why_why || '[]')[0] || '—' : '—');

  const tableSummary = [
    { label: 'Request Number', value: reqNo },
    { label: 'Defect / Model', value: `${request.problem || '—'} (${request.model || '—'})` },
    { label: 'Responsible Dept', value: assignedDept },
    { label: 'Responsible Person', value: assignedName },
    { label: 'Occurrence Cause (Why 1)', value: closerWhy1 },
    { label: 'Action Taken', value: request.action || 'Containment in progress' },
    { label: 'Target / Close Date', value: request.target_date || 'N/A' },
    { label: 'Updated Status', value: request.status || (isClosed ? 'CLOSED' : 'IN_PROGRESS') },
    { label: 'Remarks', value: request.remarks || 'None' }
  ];

  const results = {};

  // Notify Creator (Raised Person) that countermeasure was submitted or case closed
  if (creatorEmail) {
    const subject = isClosed 
      ? `[IHLR Case Closed] Defect Report #${reqNo} Verified & Closed`
      : `[IHLR Update] Countermeasure Submitted for #${reqNo} (${assignedDept})`;

    const html = generateEmailTemplate({
      headerTitle: isClosed ? `IHLR Case Closed: #${reqNo}` : `Countermeasure Submitted: #${reqNo}`,
      headerSubtitle: isClosed
        ? `Defect containment and 5-Why corrective actions have been completed and verified.`
        : `Responsible department ${assignedDept} has submitted 5-Why root cause countermeasure for review.`,
      recipientName: creatorName,
      greetingMessage: `<strong>${assignedName}</strong> (${assignedDept}) has updated the closer log for defect report <strong>${reqNo}</strong> (${request.model || 'Report'}).`,
      tableData: tableSummary,
      actionButtonText: 'Review Full IHLR Report',
      actionButtonUrl: reportUrl,
      footerNote: 'Please verify the containment action in the INEL portal.',
      badgeColor: isClosed ? '#10b981' : '#2563eb',
      badgeText: isClosed ? 'CASE CLOSED' : 'COUNTERMEASURE SUBMITTED',
    });

    results.creator = await sendEmail({
      to: creatorEmail,
      recipientName: creatorName,
      recipientRole: 'RAISED_PERSON',
      subject,
      text: `Countermeasure submitted for IHLR #${reqNo} by ${assignedName} (${assignedDept}). Status: ${request.status}. Action: ${request.action}`,
      html,
      moduleType: 'IHLR',
      requestId: request.id,
      referenceNo: reqNo,
    });
  }

  // Also confirm to Assigned Person if their email is available
  if (assignedEmail && assignedEmail !== creatorEmail) {
    const subject = `[IHLR Confirmation] Closer Log Saved for #${reqNo}`;
    const html = generateEmailTemplate({
      headerTitle: `Closer Log Recorded: #${reqNo}`,
      headerSubtitle: `Your countermeasure and root cause analysis have been recorded in the quality system.`,
      recipientName: assignedName,
      greetingMessage: `Your submission for IHLR Report <strong>${reqNo}</strong> has been saved with status <strong>${request.status}</strong>.`,
      tableData: tableSummary,
      actionButtonText: 'View Closer Approvals',
      actionButtonUrl: approvalsUrl,
      footerNote: 'Thank you for submitting quality containment measures.',
      badgeColor: '#10b981',
      badgeText: 'SAVED',
    });

    results.assigned = await sendEmail({
      to: assignedEmail,
      recipientName: assignedName,
      recipientRole: 'SELECTED_PERSON',
      subject,
      text: `Your countermeasure submission for IHLR #${reqNo} has been saved with status ${request.status}.`,
      html,
      moduleType: 'IHLR',
      requestId: request.id,
      referenceNo: reqNo,
    });
  }

  return results;
}


