import nodemailer from 'nodemailer';
import DOMPurify from 'isomorphic-dompurify';
import validator from 'validator';
import { validateOrigin, getAllowedOrigins } from './security-utils.js';

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

    // Sanitize user inputs (remove HTML tags)
    const sanitizedName = DOMPurify.sanitize(name, { ALLOWED_TAGS: [] });
    const sanitizedMessage = DOMPurify.sanitize(message, { ALLOWED_TAGS: ['br', 'p'] }); // Allow only line breaks

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
