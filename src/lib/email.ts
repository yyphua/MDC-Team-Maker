import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false, // true for 465, false for other ports
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

export interface SwapEmailData {
    requesterName: string;
    requesterEmail: string;
    targetName: string;
    targetEmail: string;
    requesterTeam: string;
    targetTeam: string;
    verifyUrl: string;
}

export async function sendSwapRequestEmail(data: SwapEmailData) {
    const { targetName, targetEmail, requesterName, requesterTeam, targetTeam, verifyUrl } = data;

    const mailOptions = {
        from: `"Team Maker App" <${process.env.SMTP_USER}>`,
        to: targetEmail,
        subject: 'Team Swap Request',
        html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Team Swap Request</h2>
        <p>Hi ${targetName},</p>
        <p><strong>${requesterName}</strong> from <strong>${requesterTeam}</strong> has requested to swap teams with you.</p>
        <p>If you accept this swap, you will move to <strong>${requesterTeam}</strong> and they will move to <strong>${targetTeam}</strong>.</p>
        <p>Click the button below to review and respond to this request:</p>
        <a href="${verifyUrl}" style="display: inline-block; padding: 12px 24px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 6px; margin: 16px 0;">
          Review Swap Request
        </a>
        <p style="color: #666; font-size: 14px;">This link will expire in 7 days.</p>
        <p style="color: #666; font-size: 14px;">If you did not expect this request, you can safely ignore this email.</p>
      </div>
    `,
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent:', info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('Error sending email:', error);
        return { success: false, error };
    }
}

export async function sendSwapConfirmationEmail(data: SwapEmailData & { approved: boolean }) {
    const { requesterName, requesterEmail, targetName, approved, requesterTeam, targetTeam } = data;

    const subject = approved ? 'Team Swap Approved' : 'Team Swap Declined';
    const message = approved
        ? `<p><strong>${targetName}</strong> has approved your team swap request. You are now on <strong>${targetTeam}</strong>!</p>`
        : `<p><strong>${targetName}</strong> has declined your team swap request.</p>`;

    const mailOptions = {
        from: `"Team Maker App" <${process.env.SMTP_USER}>`,
        to: requesterEmail,
        subject,
        html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>${subject}</h2>
        <p>Hi ${requesterName},</p>
        ${message}
      </div>
    `,
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('Confirmation email sent:', info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('Error sending confirmation email:', error);
        return { success: false, error };
    }
}
