import { Resend } from "resend";

export type EmailAttachment = {
  filename: string;
  content: Buffer;
};

export async function sendDesprendibleEmail(opts: {
  to: string;
  subject: string;
  html: string;
  attachments: EmailAttachment[];
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY not configured");
  const from = process.env.RESEND_FROM ?? "desprendibles@centicsas.com.co";

  const resend = new Resend(apiKey);
  const result = await resend.emails.send({
    from,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    attachments: opts.attachments.map((a) => ({
      filename: a.filename,
      content: a.content,
    })),
  });
  if (result.error) throw new Error(result.error.message);
  return result.data;
}
