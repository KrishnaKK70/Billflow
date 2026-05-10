import "dotenv/config";
import express from "express";
import cors from "cors";
import nodemailer from "nodemailer";
import twilio from "twilio";

const app = express();
const port = Number(process.env.API_PORT || 8787);

app.use(cors());
app.use(express.json({ limit: "1mb" }));

const required = {
  email:
    process.env.SMTP_HOST &&
    process.env.SMTP_PORT &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS &&
    process.env.EMAIL_FROM,
  twilio:
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_SMS_FROM &&
    process.env.TWILIO_WHATSAPP_FROM,
};

const transporter = required.email
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    })
  : null;

const twilioClient = required.twilio
  ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  : null;

app.get("/api/send/health", (_req, res) => {
  res.json({
    ok: true,
    providers: {
      email: Boolean(transporter),
      twilio: Boolean(twilioClient),
    },
  });
});

app.post("/api/send/email", async (req, res) => {
  try {
    if (!transporter) {
      return res.status(400).json({ ok: false, error: "SMTP not configured on server" });
    }
    const { to, subject, body, cc, bcc } = req.body || {};
    if (!to || !subject || !body) {
      return res.status(400).json({ ok: false, error: "Missing to/subject/body" });
    }
    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to,
      cc,
      bcc,
      subject,
      text: body,
    });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || "Failed to send email" });
  }
});

app.post("/api/send/whatsapp", async (req, res) => {
  try {
    if (!twilioClient) {
      return res.status(400).json({ ok: false, error: "Twilio not configured on server" });
    }
    const { to, body } = req.body || {};
    if (!to || !body) {
      return res.status(400).json({ ok: false, error: "Missing to/body" });
    }
    await twilioClient.messages.create({
      from: process.env.TWILIO_WHATSAPP_FROM,
      to: `whatsapp:${to}`,
      body,
    });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || "Failed to send WhatsApp" });
  }
});

app.post("/api/send/sms", async (req, res) => {
  try {
    if (!twilioClient) {
      return res.status(400).json({ ok: false, error: "Twilio not configured on server" });
    }
    const { to, body } = req.body || {};
    if (!to || !body) {
      return res.status(400).json({ ok: false, error: "Missing to/body" });
    }
    await twilioClient.messages.create({
      from: process.env.TWILIO_SMS_FROM,
      to,
      body,
    });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || "Failed to send SMS" });
  }
});

app.listen(port, () => {
  console.log(`Billflow send API running at http://localhost:${port}`);
});
