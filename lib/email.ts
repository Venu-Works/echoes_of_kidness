import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = "Poppylat Stories <noreply@poppylat.com>";
const BASE_URL = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

export async function sendApprovalEmail(
  to: string,
  storyTitle: string,
  storyId: string
) {
  try {
    await resend.emails.send({
      from: FROM,
      to,
      subject: `Your story has been published! 🌸`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #e11d48;">Great news! 🌸</h2>
          <p>Your story <strong>"${storyTitle}"</strong> has been approved and is now live on Poppylat Stories.</p>
          <p>Thank you for sharing your heart with our community.</p>
          <a href="${BASE_URL}/stories/${storyId}"
             style="display:inline-block;background:#e11d48;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;margin-top:16px;">
            Read your story →
          </a>
          <p style="margin-top:24px;color:#6b7280;font-size:14px;">
            With gratitude, the Poppylat Stories team
          </p>
        </div>
      `,
    });
  } catch (err) {
    console.error("[Email] Failed to send approval email:", err);
  }
}

export async function sendRejectionEmail(
  to: string,
  storyTitle: string,
  reason: string
) {
  try {
    await resend.emails.send({
      from: FROM,
      to,
      subject: `Update on your Poppylat Stories submission`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #374151;">Thank you for sharing your story</h2>
          <p>We reviewed <strong>"${storyTitle}"</strong> but weren't able to publish it at this time.</p>
          <p><strong>Reason:</strong> ${reason}</p>
          <p>You're welcome to revise and resubmit. We appreciate you being part of our community.</p>
          <a href="${BASE_URL}/submit"
             style="display:inline-block;background:#e11d48;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;margin-top:16px;">
            Submit another story →
          </a>
          <p style="margin-top:24px;color:#6b7280;font-size:14px;">
            With gratitude, the Poppylat Stories team
          </p>
        </div>
      `,
    });
  } catch (err) {
    console.error("[Email] Failed to send rejection email:", err);
  }
}
