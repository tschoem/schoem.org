/* eslint-env node */
import nodemailer from 'nodemailer';
import crypto from 'crypto';
import { storeMixData } from './mix-storage.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { email, playlistName, description, trackUris, tracks } = req.body;

  if (!email || !playlistName || !trackUris || !Array.isArray(trackUris)) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email address' });
  }

  try {
    // Generate a short, secure token ID
    const tokenId = crypto.randomBytes(16).toString('hex');

    // Store playlist data temporarily (with expiration handled by storage layer)
    await storeMixData(tokenId, {
      playlistName,
      description,
      trackUris,
      tracks: tracks || []
    });

    // Get base URL for confirmation link
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : (req.headers.origin || `http://${req.headers.host}`);

    const confirmationUrl = `${baseUrl}/mix-confirm/${tokenId}`;

    // Format track list for email (limit to first 10 tracks to avoid email clipping)
    const trackListHtml = tracks && tracks.length > 0
      ? tracks.slice(0, 10).map((track, index) => 
          `<tr>
            <td style="padding: 4px 8px; border-bottom: 1px solid #eee; font-size: 11px;">${index + 1}</td>
            <td style="padding: 4px 8px; border-bottom: 1px solid #eee; font-size: 11px;">${(track.name || track.title || 'N/A').substring(0, 40)}</td>
            <td style="padding: 4px 8px; border-bottom: 1px solid #eee; font-size: 11px;">${(track.artists || track.albumArtist || 'N/A').substring(0, 30)}</td>
            <td style="padding: 4px 8px; border-bottom: 1px solid #eee; font-size: 11px;">${track.getsongbpm?.bpm || 'N/A'}</td>
          </tr>`
        ).join('') + (tracks.length > 10 ? `<tr><td colspan="4" style="padding: 8px; text-align: center; color: #666; font-size: 11px;">... and ${tracks.length - 10} more tracks</td></tr>` : '')
      : '';

    const totalDuration = tracks && tracks.length > 0
      ? tracks.reduce((sum, t) => sum + (t.duration_ms || 0), 0)
      : 0;
    const hours = Math.floor(totalDuration / 3600000);
    const minutes = Math.floor((totalDuration % 3600000) / 60000);
    const durationText = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

    // Send email
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
      from: `"Mix Creator" <${process.env.SMTP_USER}>`,
      to: email,
      subject: `Your Vinyl Mix: ${playlistName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
            .playlist-info { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .track-table { width: 100%; border-collapse: collapse; margin: 20px 0; background: white; border-radius: 8px; overflow: hidden; }
            .track-table th { background: #1a1a2e; color: white; padding: 10px 8px; text-align: left; font-size: 11px; }
            .track-table td { padding: 6px 8px; border-bottom: 1px solid #eee; font-size: 11px; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎵 Thank You for Creating a Mix!</h1>
            </div>
            <div class="content">
              <p>Hi there,</p>
              <p>Thank you for taking the time to create a mix from my vinyl collection! Your musical journey through the records is a gift to me, and I'm excited to discover which tracks you've chosen.</p>
              
              <div class="playlist-info">
                <h2 style="margin-top: 0;">${playlistName}</h2>
                <p><strong>${tracks?.length || trackUris.length} tracks</strong> · <strong>${durationText}</strong></p>
                ${description ? `<p style="color: #666; font-size: 14px;">${description}</p>` : ''}
              </div>

              ${trackListHtml ? `
                <table class="track-table" style="width: 100%; border-collapse: collapse; margin: 20px 0; background: white; border-radius: 8px; overflow: hidden;">
                  <thead>
                    <tr>
                      <th style="background: #1a1a2e; color: white; padding: 10px 8px; text-align: left; font-size: 11px;">#</th>
                      <th style="background: #1a1a2e; color: white; padding: 10px 8px; text-align: left; font-size: 11px;">Title</th>
                      <th style="background: #1a1a2e; color: white; padding: 10px 8px; text-align: left; font-size: 11px;">Artist</th>
                      <th style="background: #1a1a2e; color: white; padding: 10px 8px; text-align: left; font-size: 11px;">BPM</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${trackListHtml}
                  </tbody>
                </table>
              ` : ''}

              <p>To create this playlist on Spotify and share it, please click the button below:</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${confirmationUrl}" style="display: inline-block; background: #1db954; color: white; padding: 15px 30px; text-decoration: none; border-radius: 30px; font-weight: bold; font-size: 16px;">Create Playlist on Spotify</a>
              </div>
              <p style="font-size: 12px; color: #666; margin-top: 20px;">This link will expire in 24 hours. If you have any questions, feel free to reply to this email.</p>
              
              <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
                <p style="margin: 0; color: #666; font-size: 14px;">
                  Best regards,<br>
                  <strong>Thomas Schoemaecker</strong><br>
                  <span style="font-size: 12px; color: #888;">Engineer, Sailor, Melomane</span>
                </p>
              </div>
            </div>
            <div class="footer">
              <p>This email was sent from the Mix Creator on schoem.org</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
Thank You for Creating a Mix!

Hi there,

Thank you for taking the time to create a mix from my vinyl collection! Your musical journey through the records is a gift to me, and I'm excited to discover which tracks you've chosen.

Playlist: ${playlistName}
${tracks?.length || trackUris.length} tracks · ${durationText}
${description ? `\n${description}\n` : ''}

To create this playlist on Spotify and share it, please visit:
${confirmationUrl}

This link will expire in 24 hours.

Best regards,
Thomas Schoemaecker
Engineer, Sailor, Melomane

This email was sent from the Mix Creator on schoem.org
      `
    };

    await transporter.sendMail(mailOptions);
    console.log(`Share email sent to ${email} for playlist: ${playlistName}`);

    return res.status(200).json({ 
      success: true, 
      message: 'Email sent successfully!'
    });

  } catch (error) {
    console.error('Error sending share email:', error);
    return res.status(500).json({ 
      error: 'Failed to send email',
      details: error.message 
    });
  }
}

