const MAX_BODY = 18000;

const clean = (value, max = 1600) =>
  String(value ?? "").replace(/[\u0000-\u001F\u007F]/g, " ").trim().slice(0, max);

const escapeHtml = (value) =>
  clean(value, 5000).replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[ch]));

function json(res, status, body) {
  res.status(status);
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  return res.end(JSON.stringify(body));
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, { ok: false, code: "METHOD_NOT_ALLOWED" });
  }

  const rawLength = Number(req.headers["content-length"] || 0);
  if (rawLength > MAX_BODY) return json(res, 413, { ok: false, code: "TOO_LARGE" });

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { return json(res, 400, { ok: false, code: "BAD_JSON" }); }
  }
  if (!body || typeof body !== "object") return json(res, 400, { ok: false, code: "BAD_REQUEST" });

  // Honeypot + minimum completion time. These are intentionally silent to bots.
  if (clean(body.website, 120)) return json(res, 200, { ok: true });
  const startedAt = Number(body.startedAt || 0);
  const elapsed = Date.now() - startedAt;
  if (!startedAt || elapsed < 2500 || elapsed > 2 * 60 * 60 * 1000) {
    return json(res, 400, { ok: false, code: "FORM_EXPIRED" });
  }

  const service = clean(body.service, 120);
  const name = clean(body.name, 100);
  const email = clean(body.email, 180).toLowerCase();
  const phone = clean(body.phone, 50);
  const postcode = clean(body.postcode, 16).toUpperCase();
  const property = clean(body.property, 100);
  const timing = clean(body.timing, 100);
  const details = clean(body.details, 1800);

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const phoneDigits = phone.replace(/\D/g, "");
  const postcodeOk = /^(GIR\s?0AA|[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2})$/i.test(postcode);

  if (!service || !name || !emailOk || phoneDigits.length < 10 || phoneDigits.length > 15 || !postcodeOk) {
    return json(res, 422, { ok: false, code: "VALIDATION_FAILED" });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.ENQUIRY_TO_EMAIL || "info@lyonsinteriors.uk";
  const from = process.env.ENQUIRY_FROM_EMAIL;

  if (!apiKey || !from) {
    return json(res, 503, { ok: false, code: "EMAIL_NOT_CONFIGURED" });
  }

  const subject = `Website quote enquiry — ${service} — ${name}`;
  const text = [
    "New Lyons Interiors website enquiry",
    "",
    `Project: ${service}`,
    `Name: ${name}`,
    `Email: ${email}`,
    `Phone: ${phone}`,
    `Postcode: ${postcode}`,
    `Property: ${property}`,
    `Timing: ${timing}`,
    "",
    "Project details:",
    details || "No extra project details supplied.",
  ].join("\n");

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#16263c;line-height:1.6">
      <h1 style="font-size:24px;margin:0 0 20px">New Lyons Interiors website enquiry</h1>
      <table style="border-collapse:collapse;width:100%;max-width:680px">
        <tr><td style="padding:7px 12px 7px 0;font-weight:700">Project</td><td>${escapeHtml(service)}</td></tr>
        <tr><td style="padding:7px 12px 7px 0;font-weight:700">Name</td><td>${escapeHtml(name)}</td></tr>
        <tr><td style="padding:7px 12px 7px 0;font-weight:700">Email</td><td><a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></td></tr>
        <tr><td style="padding:7px 12px 7px 0;font-weight:700">Phone</td><td><a href="tel:${escapeHtml(phone)}">${escapeHtml(phone)}</a></td></tr>
        <tr><td style="padding:7px 12px 7px 0;font-weight:700">Postcode</td><td>${escapeHtml(postcode)}</td></tr>
        <tr><td style="padding:7px 12px 7px 0;font-weight:700">Property</td><td>${escapeHtml(property)}</td></tr>
        <tr><td style="padding:7px 12px 7px 0;font-weight:700">Timing</td><td>${escapeHtml(timing)}</td></tr>
      </table>
      <h2 style="font-size:18px;margin:24px 0 8px">Project details</h2>
      <p style="white-space:pre-wrap;margin:0">${escapeHtml(details || "No extra project details supplied.")}</p>
    </div>`;

  let upstream;
  try {
    upstream = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        reply_to: email,
        subject,
        text,
        html,
      }),
    });
  } catch {
    return json(res, 502, { ok: false, code: "EMAIL_PROVIDER_UNREACHABLE" });
  }

  if (!upstream.ok) {
    const providerStatus = upstream.status;
    console.error("Enquiry email provider error", { providerStatus });
    return json(res, 502, { ok: false, code: "EMAIL_PROVIDER_ERROR" });
  }

  const result = await upstream.json().catch(() => ({}));
  return json(res, 200, { ok: true, id: result.id || null });
}
