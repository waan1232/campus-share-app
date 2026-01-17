import { Resend } from 'resend';

// Initialize Resend with your API Key
const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendVerificationEmail(toEmail: string, code: string) {
  try {
    // UPDATED: Destructure data and error from the response
    const { data, error } = await resend.emails.send({
      from: 'CampusShare Security <noreply@campusshareapp.com>',
      to: [toEmail],
      subject: 'Verify your CampusShare Account',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h2 style="color: #1e293b;">Welcome to CampusShare!</h2>
          <p style="color: #475569;">You are registering for the exclusive marketplace at your university. Please verify your email to continue.</p>
          
          <div style="margin: 24px 0;">
            <p style="margin-bottom: 8px; font-weight: 500; color: #64748b;">Your verification code is:</p>
            <h1 style="color: #2563eb; letter-spacing: 5px; background: #f0fdf4; padding: 12px 24px; display: inline-block; border-radius: 8px; margin: 0;">
              ${code}
            </h1>
          </div>

          <p style="color: #475569;">Enter this code on the verification screen to unlock your account.</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">
          <p style="font-size: 12px; color: #94a3b8;">
            If you didn't request this, you can safely ignore this email.
          </p>
        </div>
      `
    });

    // CRITICAL FIX: Check if Resend returned an error
    if (error) {
      console.error("❌ Resend API Error:", error);
      return false;
    }

    console.log(`✅ Email sent successfully to ${toEmail}. ID: ${data?.id}`);
    return true;
  } catch (error) {
    console.error("❌ Network/System Error:", error);
    return false;
  }
}
