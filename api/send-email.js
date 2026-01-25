import nodemailer from 'nodemailer';
import validator from 'validator';
import { validateOrigin, getAllowedOrigins } from './security-utils.js';

// Simple HTML tag stripper for server-side (avoids jsdom ESM issues)
// This is sufficient for XSS prevention when we just need to remove HTML tags
function sanitizeHtml(input) {
  if (!input || typeof input !== 'string') return '';
  // Remove all HTML tags (including script, style, etc.)
  let sanitized = input.replace(/<[^>]*>/g, '');
  // Decode common HTML entities (in order to avoid double-encoding issues)
  sanitized = sanitized
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&#x60;/g, '`')
    .replace(/&#x3D;/g, '=');
  return sanitized.trim();
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // CSRF protection: Validate origin
    if (!validateOrigin(req, getAllowedOrigins())) {
        return res.status(403).json({ error: 'Forbidden: Invalid origin' });
    }

    const { name, email, message } = req.body;

    if (!name || !email || !message) {
        return res.status(400).json({ error: 'Please fill in all fields.' });
    }

    // Validate and sanitize inputs
    if (!validator.isEmail(email)) {
        return res.status(400).json({ error: 'Invalid email address' });
    }
    const sanitizedEmail = validator.normalizeEmail(email) || email;

    // Validate input lengths
    if (name.length > 100) {
        return res.status(400).json({ error: 'Name too long (max 100 characters)' });
    }
    if (message.length > 5000) {
        return res.status(400).json({ error: 'Message too long (max 5000 characters)' });
    }

    // Sanitize user inputs (remove HTML tags for XSS prevention)
    const sanitizedName = sanitizeHtml(name);
    // For messages, we allow basic line breaks by converting <br> and <p> to newlines
    const sanitizedMessage = sanitizeHtml(message)
      .replace(/<br\s*\/?>/gi, '\n') // Convert <br> to newline
      .replace(/<\/p>/gi, '\n') // Convert </p> to newline
      .replace(/<p[^>]*>/gi, ''); // Remove opening <p> tags

    try {
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT,
            secure: false,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });

        const mailOptions = {
            from: `"${sanitizedName}" <${process.env.SMTP_USER}>`,
            to: 'tom@schoem.org',
            replyTo: sanitizedEmail, // Sanitized email to prevent header injection
            subject: `New Message from Portfolio Website: ${sanitizedName}`,
            text: `
                Name: ${sanitizedName}
                Email: ${sanitizedEmail}
                
                Message:
                ${sanitizedMessage.replace(/<br\s*\/?>/gi, '\n').replace(/<p>/gi, '').replace(/<\/p>/gi, '\n\n')}
            `,
            html: `
                <h3>New Contact Form Submission</h3>
                <p><strong>Name:</strong> ${sanitizedName}</p>
                <p><strong>Email:</strong> ${sanitizedEmail}</p>
                <br/>
                <p><strong>Message:</strong></p>
                <p>${sanitizedMessage.replace(/\n/g, '<br>')}</p>
            `,
        };

        await transporter.sendMail(mailOptions);
        console.log(`Email sent from ${sanitizedEmail}`); // Logs to Vercel function logs
        return res.status(200).json({ message: 'Email sent successfully!' });

    } catch (error) {
        console.error('Error sending email:', error);
        return res.status(500).json({ error: 'Failed to send email.' });
    }
}
