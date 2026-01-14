import React from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { groupTracksByRecordAndSide, getCamelotKey, formatDuration, formatPercentage } from './vinylLabelUtils';

const VinylLabelGenerator = ({ record }) => {
  const generateLabel = async () => {
    if (!record.tracklist || record.tracklist.length === 0) {
      alert('No tracklist available for this record');
      return;
    }

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [210, 297] // A4
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;

    // Title
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text(record.title, margin, margin + 10);

    // Artist
    doc.setFontSize(14);
    doc.setFont('helvetica', 'normal');
    doc.text(record.artists, margin, margin + 18);

    // Year
    if (record.year) {
      doc.setFontSize(10);
      doc.text(`(${record.year})`, margin, margin + 24);
    }

    // Add cover image in top right (grayscale)
    // Use CORS proxy to bypass restrictions
    if (record.cover_image) {
      try {
        const corsProxy = 'https://corsproxy.io/?';
        const imageUrl = corsProxy + encodeURIComponent(record.cover_image);

        // Fetch image through CORS proxy
        const response = await Promise.race([
          fetch(imageUrl),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000))
        ]);

        if (response.ok) {
          const blob = await response.blob();
          const objectUrl = URL.createObjectURL(blob);

          const img = new Image();
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = objectUrl;
          });

          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          canvas.width = img.width;
          canvas.height = img.height;

          ctx.drawImage(img, 0, 0);

          // Convert to grayscale
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imageData.data;
          for (let i = 0; i < data.length; i += 4) {
            const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
            data[i] = gray;
            data[i + 1] = gray;
            data[i + 2] = gray;
          }
          ctx.putImageData(imageData, 0, 0);

          const imgData = canvas.toDataURL('image/jpeg', 0.7);
          const imgWidth = 30;
          const imgHeight = 30;
          const imgX = pageWidth - margin - imgWidth;
          const imgY = margin;
          doc.addImage(imgData, 'JPEG', imgX, imgY, imgWidth, imgHeight);

          // Clean up object URL
          URL.revokeObjectURL(objectUrl);
        }
      } catch {
        // Continue without image if loading fails
      }
    }

    // Group tracks by record and side
    const groups = groupTracksByRecordAndSide(record.tracklist);

    // Starting Y position for tables (after header)
    let startY = margin + 35;

    groups.forEach((group, groupIndex) => {
      // Add spacing before new record
      if (groupIndex > 0 && groups[groupIndex - 1].record !== group.record) {
        startY += 10;
      }
      startY += 2;

      // Record and Side header
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      const recordLabel = groups.length > 1 && group.record > 1
        ? `Record ${group.record}, Side ${group.side}`
        : `Side ${group.side}`;
      doc.text(recordLabel, margin, startY);
      startY += 4;

      // Prepare table data
      const tableData = group.tracks.map(track => {
        const getsongbpm = track.getsongbpm || {};
        const bpm = getsongbpm.bpm || 'N/A';
        const key = getsongbpm.key || 'N/A';
        const camelot = getCamelotKey(key);
        const duration = formatDuration(track.duration);
        const timeSig = getsongbpm.time_signature || 'N/A';
        const danceability = formatPercentage(getsongbpm.danceability);
        const acousticness = formatPercentage(getsongbpm.acousticness);

        return [
          track.position || '',
          track.title || '',
          bpm.toString(),
          key,
          camelot,
          duration,
          timeSig,
          danceability,
          acousticness
        ];
      });

      // Generate table using autoTable
      autoTable(doc, {
        head: [['Pos', 'Title', 'BPM', 'Key', 'Camelot', 'Duration', 'Time', 'Dance', 'Acoustic']],
        body: tableData,
        startY: startY,
        margin: { left: margin, right: margin },
        styles: {
          fontSize: 7,
          cellPadding: 1.5,
          overflow: 'linebreak',
          cellWidth: 'wrap'
        },
        headStyles: {
          fillColor: [240, 240, 240],
          textColor: [0, 0, 0],
          fontStyle: 'bold',
          halign: 'center',
          fontSize: 7
        },
        bodyStyles: {
          halign: 'center',
          valign: 'middle',
          fontSize: 7
        },
        columnStyles: {
          0: { cellWidth: 12, halign: 'center' }, // Pos
          1: { cellWidth: 60, halign: 'left' },   // Title (left-aligned for readability, expanded to use available space)
          2: { cellWidth: 15, halign: 'center' },  // BPM
          3: { cellWidth: 15, halign: 'center' },  // Key
          4: { cellWidth: 16, halign: 'center' },  // Camelot
          5: { cellWidth: 18, halign: 'center' },  // Duration
          6: { cellWidth: 15, halign: 'center' },  // Time
          7: { cellWidth: 15, halign: 'center' },  // Dance
          8: { cellWidth: 14, halign: 'center' }   // Acoustic
        },
        theme: 'grid',
        showHead: 'everyPage',
        tableLineColor: [200, 200, 200],
        tableLineWidth: 0.1
      });

      // Get the final Y position after the table
      const lastAutoTable = doc.lastAutoTable;
      startY = lastAutoTable ? lastAutoTable.finalY + 5 : startY + 50;
    });

    // Save PDF
    const filename = `${record.artists} - ${record.title}`.replace(/[^a-z0-9]/gi, '_');
    doc.save(`${filename}_vinyl_label.pdf`);
  };

  return (
    <button
      className="vinyl-label-btn"
      onClick={generateLabel}
      title="Download Vinyl Label PDF"
      aria-label="Download Vinyl Label PDF"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 8v8M8 12l4-4 4 4" />
      </svg>
      <span>Label</span>
    </button>
  );
};

export default VinylLabelGenerator;
