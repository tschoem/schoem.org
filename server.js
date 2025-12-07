
import express from 'express';
import nodemailer from 'nodemailer';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Debug: Check if env vars are loaded
console.log('--- Environment Check ---');
console.log('SMTP_HOST:', process.env.SMTP_HOST ? 'Set' : 'MISSING');
console.log('SMTP_PORT:', process.env.SMTP_PORT ? 'Set' : 'MISSING');
console.log('SMTP_USER:', process.env.SMTP_USER ? 'Set' : 'MISSING');
console.log('SMTP_PASS:', process.env.SMTP_PASS ? 'Set' : 'MISSING');
console.log('-------------------------');

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from the React app build directory
app.use(express.static(path.join(__dirname, 'dist')));

// API Routes
app.post('/api/send-email', async (req, res) => {
    const { name, email, message } = req.body;

    if (!name || !email || !message) {
        return res.status(400).json({ error: 'Please fill in all fields.' });
    }

    try {
        // Create Transporter
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT,
            secure: false, // true for 465, false for other ports
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });

        // Email Options
        const mailOptions = {
            from: `"${name}" <${process.env.SMTP_USER}>`, // Sender address (must often be same as auth user)
            to: 'thomas.schoemaecker@gmail.com', // Your email
            replyTo: email, // Valid reply-to address
            subject: `New Message from Portfolio Website: ${name}`,
            text: `
                Name: ${name}
                Email: ${email}
                
                Message:
                ${message}
            `,
            html: `
                <h3>New Contact Form Submission</h3>
                <p><strong>Name:</strong> ${name}</p>
                <p><strong>Email:</strong> ${email}</p>
                <br/>
                <p><strong>Message:</strong></p>
                <p>${message.replace(/\n/g, '<br>')}</p>
            `,
        };

        // Send Email
        await transporter.sendMail(mailOptions);
        console.log(`Email sent from ${email}`);
        res.status(200).json({ message: 'Email sent successfully!' });

    } catch (error) {
        console.error('Error sending email:', error);
        res.status(500).json({ error: 'Failed to send email.' });
    }
});

// Catch all handler for React routing
app.get(/.*/, (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
