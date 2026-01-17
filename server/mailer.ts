import nodemailer from "nodemailer";

// 1. Setup your email transporter
// (For Gmail, you might need an "App Password" if 2FA is on)
const transporter = nodemailer.createTransport({
  service: "gmail", 
  auth: {
    user: "your-campusshare-email@gmail.com", // REPLACE THIS
    pass: "your-app-password-here"            // REPLACE THIS
  }
});

export async function sendVerificationEmail(toEmail: string, code: string) {
  const mailOptions = {
    from: '"CampusShare Security" <your-campusshare-email@gmail.com>',
    to: toEmail,
    subject: "Verify your CampusShare Account",
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>Welcome to CampusShare!</h2>
        <p>You are registering for the exclusive marketplace at your university.</p>
        <p>Your verification code is:</p>
        <h1 style="color: #2563eb; letter-spacing: 5px;">${code}</h1>
        <p>Enter this code on the verification screen to unlock your account.</p>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent to ${toEmail}`);
    return true;
  } catch (error) {
    console.error("❌ Email failed to send:", error);
    return false;
  }
}
