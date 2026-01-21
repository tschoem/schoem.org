/* eslint-env node */
import nodemailer from 'nodemailer';
import crypto from 'crypto';
import { storeMixData } from './mix-storage.js';
import DOMPurify from 'isomorphic-dompurify';
import validator from 'validator';
import { validateOrigin, getAllowedOrigins } from './security-utils.js';

// Camelot Wheel mapping: musical key -> Camelot notation
const keyToCamelot = {
  // Minor keys (A)
  'Abm': '1A', 'Abmin': '1A', 'Ab minor': '1A', 'G#m': '1A', 'G#min': '1A', 'G# minor': '1A',
  'Ebm': '2A', 'Ebmin': '2A', 'Eb minor': '2A', 'D#m': '2A', 'D#min': '2A', 'D# minor': '2A',
  'Bbm': '3A', 'Bbmin': '3A', 'Bb minor': '3A', 'A#m': '3A', 'A#min': '3A', 'A# minor': '3A',
  'Fm': '4A', 'Fmin': '4A', 'F minor': '4A',
  'Cm': '5A', 'Cmin': '5A', 'C minor': '5A',
  'Gm': '6A', 'Gmin': '6A', 'G minor': '6A',
  'Dm': '7A', 'Dmin': '7A', 'D minor': '7A',
  'Am': '8A', 'Amin': '8A', 'A minor': '8A',
  'Em': '9A', 'Emin': '9A', 'E minor': '9A',
  'Bm': '10A', 'Bmin': '10A', 'B minor': '10A',
  'F#m': '11A', 'F#min': '11A', 'F# minor': '11A', 'F♯m': '11A', 'F♯min': '11A', 'F♯ minor': '11A',
  'C#m': '12A', 'C#min': '12A', 'C# minor': '12A', 'C♯m': '12A', 'C♯min': '12A', 'C♯ minor': '12A',
  
  // Major keys (B)
  'B': '1B', 'B major': '1B',
  'Gb': '2B', 'Gb major': '2B', 'F#': '2B', 'F# major': '2B', 'F♯': '2B', 'F♯ major': '2B',
  'Db': '3B', 'Db major': '3B', 'C#': '3B', 'C# major': '3B', 'C♯': '3B', 'C♯ major': '3B',
  'Ab': '4B', 'Ab major': '4B', 'G#': '4B', 'G# major': '4B',
  'Eb': '5B', 'Eb major': '5B', 'D#': '5B', 'D# major': '5B',
  'Bb': '6B', 'Bb major': '6B', 'A#': '6B', 'A# major': '6B',
  'F': '7B', 'F major': '7B',
  'C': '8B', 'C major': '8B',
  'G': '9B', 'G major': '9B',
  'D': '10B', 'D major': '10B',
  'A major': '11B',
  'E': '12B', 'E major': '12B'
};

function getCamelotKey(key) {
  if (!key) return 'N/A';
  
  // Normalize the key
  let normalized = key.replace('♯', '#').replace('♭', 'b').trim();
  
  // Handle minor keys
  if (normalized.toLowerCase().includes('min')) {
    normalized = normalized.replace(/min/i, 'm');
  }
  if (normalized.toLowerCase().includes('minor')) {
    normalized = normalized.replace(/minor/i, 'm');
  }
  
  // Try direct lookup
  if (keyToCamelot[normalized]) {
    return keyToCamelot[normalized];
  }
  
  // Try case-insensitive
  const lowerKey = normalized.toLowerCase();
  for (const [k, camelot] of Object.entries(keyToCamelot)) {
    if (k.toLowerCase() === lowerKey) {
      return camelot;
    }
  }
  
  return key; // Return original if not found
}

function formatDuration(ms) {
  if (!ms || ms === 0) return '0:00';
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // CSRF protection: Validate origin
  if (!validateOrigin(req, getAllowedOrigins())) {
    return res.status(403).json({ error: 'Forbidden: Invalid origin' });
  }

  const { email, playlistName, description, trackUris, tracks } = req.body;

  if (!email || !playlistName || !trackUris || !Array.isArray(trackUris)) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  // Validate and sanitize email
  if (!validator.isEmail(email)) {
    return res.status(400).json({ error: 'Invalid email address' });
  }
  const sanitizedEmail = validator.normalizeEmail(email) || email;

  // Validate input lengths
  if (playlistName.length > 200) {
    return res.status(400).json({ error: 'Playlist name too long (max 200 characters)' });
  }
  if (description && description.length > 1000) {
    return res.status(400).json({ error: 'Description too long (max 1000 characters)' });
  }
  if (trackUris.length > 500) {
    return res.status(400).json({ error: 'Too many tracks (max 500)' });
  }

  // Validate Spotify URI format
  const spotifyUriRegex = /^spotify:track:[a-zA-Z0-9]{22}$/;
  if (!trackUris.every(uri => typeof uri === 'string' && spotifyUriRegex.test(uri))) {
    return res.status(400).json({ error: 'Invalid Spotify URI format' });
  }

  // Sanitize user inputs
  const sanitizedPlaylistName = DOMPurify.sanitize(playlistName, { ALLOWED_TAGS: [] });
  const sanitizedDescription = description ? DOMPurify.sanitize(description, { ALLOWED_TAGS: [] }) : '';

  try {
    // Generate a short, secure token ID
    const tokenId = crypto.randomBytes(16).toString('hex');
    
    console.log('Share mix - storing data for token:', tokenId);
    console.log('Environment check:', {
      hasUpstashUrl: !!process.env.UPSTASH_REDIS_REST_URL,
      hasUpstashToken: !!process.env.UPSTASH_REDIS_REST_TOKEN,
      hasRedisUrl: !!process.env.REDIS_URL,
    });

    // Validate tracks array size
    if (tracks && tracks.length > 500) {
      return res.status(400).json({ error: 'Too many tracks (max 500)' });
    }

    // Store playlist data temporarily (with expiration handled by storage layer)
    await storeMixData(tokenId, {
      playlistName: sanitizedPlaylistName,
      description: sanitizedDescription,
      trackUris,
      tracks: tracks || []
    });
    
    console.log('✅ Mix data stored successfully for token:', tokenId);

    // Get base URL for confirmation link
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : (req.headers.origin || `http://${req.headers.host}`);

    const confirmationUrl = `${baseUrl}/mix-confirm/${tokenId}`;

    // Format track list for email (show all tracks) - sanitize all user inputs
    const trackListHtml = tracks && tracks.length > 0
      ? tracks.map((track, index) => {
          const title = DOMPurify.sanitize((track.name || track.title || 'N/A').toString(), { ALLOWED_TAGS: [] });
          const artist = DOMPurify.sanitize((track.artists || track.albumArtist || 'N/A').toString(), { ALLOWED_TAGS: [] });
          const bpm = track.getsongbpm?.bpm || 'N/A';
          const key = track.getsongbpm?.key || null;
          const camelotKey = getCamelotKey(key);
          const duration = formatDuration(track.duration_ms || 0);
          
          return `<tr>
            <td style="padding: 4px 8px; border-bottom: 1px solid #eee; font-size: 11px;">${index + 1}</td>
            <td style="padding: 4px 8px; border-bottom: 1px solid #eee; font-size: 11px;">${title}</td>
            <td style="padding: 4px 8px; border-bottom: 1px solid #eee; font-size: 11px;">${artist}</td>
            <td style="padding: 4px 8px; border-bottom: 1px solid #eee; font-size: 11px; text-align: center;">${bpm}</td>
            <td style="padding: 4px 8px; border-bottom: 1px solid #eee; font-size: 11px; text-align: center;">${camelotKey}</td>
            <td style="padding: 4px 8px; border-bottom: 1px solid #eee; font-size: 11px; text-align: center;">${duration}</td>
          </tr>`;
        }).join('')
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
      to: sanitizedEmail,
      subject: `Your Vinyl Mix: ${sanitizedPlaylistName}`,
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
                <h2 style="margin-top: 0;">${sanitizedPlaylistName}</h2>
                <p><strong>${tracks?.length || trackUris.length} tracks</strong> · <strong>${durationText}</strong></p>
                ${sanitizedDescription ? `<p style="color: #666; font-size: 14px;">${sanitizedDescription}</p>` : ''}
              </div>

              ${trackListHtml ? `
                <table class="track-table" style="width: 100%; border-collapse: collapse; margin: 20px 0; background: white; border-radius: 8px; overflow: hidden;">
                  <thead>
                    <tr>
                      <th style="background: #1a1a2e; color: white; padding: 10px 8px; text-align: left; font-size: 11px;">#</th>
                      <th style="background: #1a1a2e; color: white; padding: 10px 8px; text-align: left; font-size: 11px;">Title</th>
                      <th style="background: #1a1a2e; color: white; padding: 10px 8px; text-align: left; font-size: 11px;">Artist</th>
                      <th style="background: #1a1a2e; color: white; padding: 10px 8px; text-align: center; font-size: 11px;">BPM</th>
                      <th style="background: #1a1a2e; color: white; padding: 10px 8px; text-align: center; font-size: 11px;">Key</th>
                      <th style="background: #1a1a2e; color: white; padding: 10px 8px; text-align: center; font-size: 11px;">Duration</th>
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

Playlist: ${sanitizedPlaylistName}
${tracks?.length || trackUris.length} tracks · ${durationText}
${sanitizedDescription ? `\n${sanitizedDescription}\n` : ''}

${tracks && tracks.length > 0 ? `
Track List:
${tracks.map((track, index) => {
  const title = track.name || track.title || 'N/A';
  const artist = track.artists || track.albumArtist || 'N/A';
  const bpm = track.getsongbpm?.bpm || 'N/A';
  const key = track.getsongbpm?.key || null;
  const camelotKey = getCamelotKey(key);
  const duration = formatDuration(track.duration_ms || 0);
  return `${index + 1}. ${title} - ${artist} (BPM: ${bpm}, Key: ${camelotKey}, Duration: ${duration})`;
}).join('\n')}
` : ''}

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
    console.log(`Share email sent to ${sanitizedEmail} for playlist: ${sanitizedPlaylistName}`);

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

