const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {defineSecret, defineString} = require("firebase-functions/params");
const {initializeApp} = require("firebase-admin/app");
const nodemailer = require("nodemailer");

initializeApp();

const OUTLOOK_SMTP_PASSWORD = defineSecret("OUTLOOK_SMTP_PASSWORD");
const TEST_MAILBOX = defineString("HAKEDIS_TEST_MAILBOX");
const APP_HOST = "demircanerayy-hue.github.io";
const APP_PATH = "/ddh-takip/";

function safeText(value, maxLength = 160) {
  return String(value == null ? "" : value).trim().slice(0, maxLength);
}

function safeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function escapeHtml(value) {
  return safeText(value, 500)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
}

function validatedAppUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new HttpsError("invalid-argument", "The app link is invalid.");
  }
  if (url.protocol !== "https:" || url.hostname !== APP_HOST ||
      !url.pathname.startsWith(APP_PATH)) {
    throw new HttpsError("invalid-argument", "The app link is not allowed.");
  }
  return url.toString();
}

exports.sendHakedisApprovalEmail = onCall(
    {region: "europe-west1", secrets: [OUTLOOK_SMTP_PASSWORD]},
    async (request) => {
      if (!request.auth || !request.auth.token.email) {
        throw new HttpsError("unauthenticated", "Sign in to send this notification.");
      }
      const sender = String(request.auth.token.email).trim().toLowerCase();
      const mailbox = TEST_MAILBOX.value().trim().toLowerCase();
      if (!mailbox || sender !== mailbox) {
        throw new HttpsError("permission-denied", "This account cannot submit hakediş for review.");
      }

      const items = request.data && request.data.items;
      if (!Array.isArray(items) || items.length < 1 || items.length > 40) {
        throw new HttpsError("invalid-argument", "Provide between 1 and 40 hakediş items.");
      }
      const appUrl = validatedAppUrl(request.data.appUrl);
      const rows = items.map((item) => ({
        kuyu: safeText(item && item.kuyu, 40),
        makine: safeText(item && item.makine, 80),
        lokasyon: safeText(item && item.lokasyon, 80),
        metraj: safeNumber(item && item.metraj),
        brutUsd: safeNumber(item && item.brutUsd),
        netUsd: safeNumber(item && item.netUsd),
      }));
      if (rows.some((item) => !item.kuyu)) {
        throw new HttpsError("invalid-argument", "Each item must include a kuyu number.");
      }

      const tableRows = rows.map((item) => `
        <tr>
          <td>${escapeHtml(item.kuyu)}</td>
          <td>${escapeHtml(item.makine)}</td>
          <td>${escapeHtml(item.lokasyon)}</td>
          <td style="text-align:right">${item.metraj.toFixed(2)} m</td>
          <td style="text-align:right">$${item.brutUsd.toFixed(2)}</td>
          <td style="text-align:right">$${item.netUsd.toFixed(2)}</td>
        </tr>`).join("");
      const date = new Date().toLocaleString("tr-TR", {timeZone: "Europe/Istanbul"});
      const subject = `Hakediş kontrol bekliyor · ${rows.length} kuyu`;
      const html = `
        <div style="font-family:Arial,sans-serif;color:#231f20;max-width:900px">
          <h2 style="margin-bottom:6px">Hakediş kontrol bekliyor</h2>
          <p>${rows.length} kuyu için hakediş kontrolünüz bekleniyor.</p>
          <p><b>Gönderen:</b> ${escapeHtml(sender)}<br><b>Tarih:</b> ${escapeHtml(date)}</p>
          <table style="border-collapse:collapse;width:100%;font-size:13px">
            <thead><tr style="background:#231f20;color:#fff">
              <th style="padding:8px;text-align:left">Kuyu</th>
              <th style="padding:8px;text-align:left">Makine</th>
              <th style="padding:8px;text-align:left">Lokasyon</th>
              <th style="padding:8px;text-align:right">Metraj</th>
              <th style="padding:8px;text-align:right">Brüt USD</th>
              <th style="padding:8px;text-align:right">Net USD</th>
            </tr></thead>
            <tbody>${tableRows}</tbody>
          </table>
          <p style="margin-top:22px">
            <a href="${escapeHtml(appUrl)}" style="display:inline-block;background:#e9cd53;color:#231f20;padding:12px 18px;text-decoration:none;font-weight:bold;border-radius:6px">
              Uygulamada kontrol et
            </a>
          </p>
          <p style="font-size:12px;color:#606363">Bağlantı sizi DDH Takip uygulamasındaki “Kontrol Bekliyor” listesine yönlendirir. Onay veya revizyon için uygulamaya giriş yapın.</p>
        </div>`;
      const text = [
        "Hakediş kontrol bekliyor",
        `${rows.length} kuyu için hakediş kontrolünüz bekleniyor.`,
        `Gönderen: ${sender}`,
        `Tarih: ${date}`,
        ...rows.map((item) => `${item.kuyu} | ${item.makine} | ${item.lokasyon} | ${item.metraj.toFixed(2)} m | Brüt $${item.brutUsd.toFixed(2)} | Net $${item.netUsd.toFixed(2)}`),
        `Uygulamada kontrol et: ${appUrl}`,
      ].join("\n");

      const transport = nodemailer.createTransport({
        host: "smtp.office365.com",
        port: 587,
        secure: false,
        requireTLS: true,
        auth: {user: mailbox, pass: OUTLOOK_SMTP_PASSWORD.value()},
      });
      try {
        await transport.sendMail({
          from: `"DDH Takip" <${mailbox}>`,
          to: mailbox,
          subject,
          text,
          html,
        });
      } catch (error) {
        console.error("Hakediş Outlook bildirimi gönderilemedi:", error);
        throw new HttpsError("internal", "Outlook e-postası gönderilemedi. SMTP ayarlarını kontrol edin.");
      } finally {
        transport.close();
      }
      return {sent: true, count: rows.length};
    },
);
