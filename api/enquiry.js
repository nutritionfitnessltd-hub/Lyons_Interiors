const TO_EMAIL = 'info@lyonsinteriors.uk';
const ALLOWED_SERVICES = new Set([
  'Wall skimming',
  'Interior plastering',
  'Ceiling plastering',
  'Plaster repairs',
  'Refurbishment',
  'Commercial space',
  'Several of these',
  'Not sure yet'
]);

const trim = (value, max = 1600) => String(value ?? '').trim().slice(0, max);
const escapeHtml = (value) => trim(value).replace(/[&<>"']/g, (char) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}[char]));

function json(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  return res.end(JSON.stringify(body));
}

async function sendEmail(payload) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Email provider returned ${response.status}: ${detail.slice(0, 500)}`);
  }

  return response.json().catch(() => ({}));
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { ok: false, error: 'Method not allowed.' });
  }

  if (!process.env.RESEND_API_KEY) {
    return json(res, 503, { ok: false, error: 'Email delivery is not configured yet.' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return json(res, 400, { ok: false, error: 'Invalid request.' });
    }
  }

  body = body && typeof body === 'object' ? body : {};

  // Honeypot: silently accept obvious bot submissions without sending anything.
  if (trim(body.website, 200)) return json(res, 200, { ok: true });

  const name = trim(body.name, 80);
  const email = trim(body.email, 160).toLowerCase();
  const postcode = trim(body.postcode, 12).toUpperCase();
  const property = trim(body.property, 80);
  const timing = trim(body.timing, 80);
  const details = trim(body.details, 1500);
  const service = trim(body.service, 80);

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const postcodePattern = /^(GIR\s?0AA|[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2})$/i;

  if (!name || !emailPattern.test(email) || !postcodePattern.test(postcode) || !ALLOWED_SERVICES.has(service)) {
    return json(res, 400, { ok: false, error: 'Please check the required enquiry details and try again.' });
  }

  const from = process.env.ENQUIRY_FROM_EMAIL || 'Lyons Interiors Website <website@lyonsinteriors.uk>';
  const subject = `Website quote enquiry — ${service} — ${name}`;

  const text = [
    'New Lyons Interiors website enquiry',
    '',
    `Project: ${service}`,
    `Name: ${name}`,
    `Email: ${email}`,
    `Postcode: ${postcode}`,
    `Property: ${property || 'Not provided'}`,
    `Timing: ${timing || 'Not provided'}`,
    '',
    'Project details:',
    details || 'I would like some advice on the right approach.',
    '',
    'Reply directly to this email to respond to the customer.'
  ].join('\n');

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#243247;line-height:1.6;max-width:680px;margin:auto">
      <h1 style="font-family:Georgia,'Times New Roman',serif;font-weight:400;color:#16263c">New website enquiry</h1>
      <table role="presentation" style="width:100%;border-collapse:collapse">
        <tr><td style="padding:8px 0;font-weight:700">Project</td><td style="padding:8px 0">${escapeHtml(service)}</td></tr>
        <tr><td style="padding:8px 0;font-weight:700">Name</td><td style="padding:8px 0">${escapeHtml(name)}</td></tr>
        <tr><td style="padding:8px 0;font-weight:700">Email</td><td style="padding:8px 0"><a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></td></tr>
        <tr><td style="padding:8px 0;font-weight:700">Postcode</td><td style="padding:8px 0">${escapeHtml(postcode)}</td></tr>
        <tr><td style="padding:8px 0;font-weight:700">Property</td><td style="padding:8px 0">${escapeHtml(property || 'Not provided')}</td></tr>
        <tr><td style="padding:8px 0;font-weight:700">Timing</td><td style="padding:8px 0">${escapeHtml(timing || 'Not provided')}</td></tr>
      </table>
      <h2 style="font-family:Georgia,'Times New Roman',serif;font-weight:400;color:#16263c">Project details</h2>
      <p style="white-space:pre-wrap">${escapeHtml(details || 'I would like some advice on the right approach.')}</p>
      <p style="margin-top:28px;padding-top:18px;border-top:1px solid #dbe2ea">Reply to this email to respond directly to ${escapeHtml(name)}.</p>
    </div>
  `;

  try {
    await sendEmail({
      from,
      to: [TO_EMAIL],
      reply_to: email,
      subject,
      text,
      html
    });

    // Customer acknowledgement is helpful, but it should not turn a successful
    // enquiry into a failure if the confirmation itself is rejected.
    try {
      await sendEmail({
        from,
        to: [email],
        reply_to: TO_EMAIL,
        subject: 'We received your Lyons Interiors enquiry',
        text: `Hi ${name},\n\nThanks for getting in touch with Lyons Interiors. We have received your enquiry about ${service.toLowerCase()} and will come back to you as soon as we can.\n\nYour postcode: ${postcode}\n\nIf you have useful project photos, reply to this email and attach them.\n\nLyons Interiors\n07306 160862\ninfo@lyonsinteriors.uk`,
        html: `<div style="font-family:Arial,Helvetica,sans-serif;color:#243247;line-height:1.6;max-width:640px;margin:auto"><h1 style="font-family:Georgia,'Times New Roman',serif;font-weight:400;color:#16263c">Thanks, ${escapeHtml(name)}.</h1><p>We’ve received your enquiry about <strong>${escapeHtml(service.toLowerCase())}</strong> and will come back to you as soon as we can.</p><p><strong>Postcode:</strong> ${escapeHtml(postcode)}</p><p>If you have useful project photos, just reply to this email and attach them.</p><p style="margin-top:28px">Lyons Interiors<br>07306 160862<br><a href="mailto:info@lyonsinteriors.uk">info@lyonsinteriors.uk</a></p></div>`
      });
    } catch (confirmationError) {
      console.error('Customer confirmation email failed', confirmationError);
    }

    return json(res, 200, { ok: true });
  } catch (error) {
    console.error('Enquiry email failed', error);
    return json(res, 502, { ok: false, error: 'We could not send your enquiry just now. Please try again or call 07306 160862.' });
  }
}
