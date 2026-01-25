import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cvData } from '../data/cvData';
import CompanyLogo from './CompanyLogo';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import '../styles/CVPage.css';

// Helper function to render text with bold tags and line breaks
const renderTextWithBold = (text) => {
  if (!text) return null;

  // Split by double newlines to handle paragraphs
  const paragraphs = text.split(/\n\n+/);

  return paragraphs.map((paragraph, pIndex) => {
    const parts = [];
    const regex = /<b>(.*?)<\/b>/g;
    let lastIndex = 0;
    let match;
    let keyCounter = 0;

    while ((match = regex.exec(paragraph)) !== null) {
      // Add text before the bold tag
      if (match.index > lastIndex) {
        parts.push(paragraph.substring(lastIndex, match.index));
      }
      // Add the bold text
      parts.push(<strong key={`bold-${pIndex}-${keyCounter++}`}>{match[1]}</strong>);
      lastIndex = regex.lastIndex;
    }

    // Add remaining text
    if (lastIndex < paragraph.length) {
      parts.push(paragraph.substring(lastIndex));
    }

    return (
      <React.Fragment key={`para-${pIndex}`}>
        {parts.length > 0 ? parts : paragraph}
        {pIndex < paragraphs.length - 1 && <><br /><br /></>}
      </React.Fragment>
    );
  });
};


const CVPage = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const cvPageRef = useRef(null);

  // Auto-advance slides
  useEffect(() => {
    if (!cvData.profile.slideshowImages || cvData.profile.slideshowImages.length === 0) return;
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % cvData.profile.slideshowImages.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  const generatePDF = async () => {
    if (!cvPageRef.current) return;

    setIsGeneratingPDF(true);

    try {
      // Get the CV content elements
      const cvContent = cvPageRef.current.querySelector('.cv-content-grid');
      const cvHeader = cvPageRef.current.querySelector('.cv-header');

      if (!cvContent || !cvHeader) {
        throw new Error('CV content not found');
      }

      // Create a temporary container for PDF generation
      const pdfContainer = document.createElement('div');
      pdfContainer.style.position = 'absolute';
      pdfContainer.style.left = '-9999px';
      pdfContainer.style.top = '0';
      pdfContainer.style.width = '210mm'; // A4 width
      pdfContainer.style.background = '#ffffff'; // White background for printing
      pdfContainer.style.padding = '20mm';
      pdfContainer.style.color = '#000000'; // Black text
      pdfContainer.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      pdfContainer.className = 'cv-pdf-container';

      // Clone the header and content
      const headerClone = cvHeader.cloneNode(true);
      const contentClone = cvContent.cloneNode(true);

      // Apply white background and dark text styles to all elements
      const applyPrintStyles = (element) => {
        if (!element) return;

        // Get computed styles
        const computedStyle = window.getComputedStyle(element);
        const bgColor = computedStyle.backgroundColor;
        const textColor = computedStyle.color;

        // If element has dark background, change to white/light
        if (bgColor && (bgColor.includes('rgb(10, 10, 10)') || bgColor.includes('rgba(10, 10, 10') || bgColor.includes('#0a0a0a'))) {
          element.style.backgroundColor = '#ffffff';
        }

        // If element has white/light text, change to dark
        if (textColor && (textColor.includes('rgb(255, 255, 255)') || textColor.includes('white') || textColor.includes('#fff'))) {
          element.style.color = '#000000';
        }

        // Handle accent colors - make them darker for print
        if (element.style.color && element.style.color.includes('var(--accent-color)')) {
          element.style.color = '#0066cc'; // Darker blue
        }

        // Recursively apply to children
        Array.from(element.children).forEach(child => applyPrintStyles(child));
      };

      // Remove slideshow from header clone
      const slideshow = headerClone.querySelector('.cv-slideshow-container');
      if (slideshow) slideshow.remove();

      // Remove action buttons from header clone
      const actions = headerClone.querySelector('.cv-actions');
      if (actions) actions.remove();

      // Update header layout for PDF (single column)
      const headerContainer = headerClone.querySelector('.cv-header-container');
      if (headerContainer) {
        headerContainer.style.gridTemplateColumns = '1fr';
        headerContainer.style.gap = '2rem';
      }

      // Add profile picture to header for PDF
      const headerContent = headerClone.querySelector('.cv-header-content');
      // Profile picture size (30% bigger: 80px * 1.3 = 104px) - declared outside if block for reuse
      const profilePicSize = 104;

      if (headerContent) {
        // Create profile picture container
        const profilePicContainer = document.createElement('div');
        profilePicContainer.className = 'cv-profile-picture-pdf';
        profilePicContainer.style.cssText = `
          position: absolute;
          left: 0;
          top: 0;
          width: ${profilePicSize}px;
          height: ${profilePicSize}px;
          border-radius: 50%;
          overflow: hidden;
          border: 2px solid #0066cc;
          z-index: 1;
        `;

        const profileImg = document.createElement('img');
        profileImg.src = '/images/cv-pics/cvpic.png';
        profileImg.style.cssText = `
          width: 100%;
          height: 100%;
          object-fit: cover;
        `;
        profilePicContainer.appendChild(profileImg);

        // Make header content relative positioned to allow absolute positioning of picture
        headerContent.style.position = 'relative';
        headerContent.style.minHeight = `${profilePicSize}px`;

        // Only add padding to the first 4 rows (name, title, contact, headlines)
        // Summary and following sections should use full width
        const nameH1 = headerContent.querySelector('.cv-name');
        const titleH2 = headerContent.querySelector('.cv-title');
        const headlinesDiv = headerContent.querySelector('.cv-headlines');

        if (nameH1) {
          nameH1.style.paddingLeft = `${profilePicSize + 20}px`;
        }
        if (titleH2) {
          titleH2.style.paddingLeft = `${profilePicSize + 20}px`;
        }

        // Contact info should also have padding
        const contactInfo = headerContent.querySelector('.cv-contact-info');
        if (contactInfo) {
          contactInfo.style.paddingLeft = `${profilePicSize + 20}px`;
        }
        if (headlinesDiv) {
          headlinesDiv.style.paddingLeft = `${profilePicSize + 20}px`;
        }

        headerContent.insertBefore(profilePicContainer, headerContent.firstChild);
      }

      // Add contact information and social links to header for PDF
      if (headerContent) {
        // Add contact information section after title (closer to heading)
        const titleH2 = headerContent.querySelector('.cv-title');
        if (titleH2) {
          const contactInfo = document.createElement('div');
          contactInfo.className = 'cv-contact-info';
          contactInfo.style.cssText = `
            margin-top: 0.3rem;
            margin-bottom: 0.5rem;
            display: flex;
            flex-wrap: wrap;
            gap: 1rem;
            font-size: 0.85rem;
            color: #666;
            padding-left: ${profilePicSize + 20}px;
          `;

          if (cvData.profile.location) {
            const locationItem = document.createElement('div');
            locationItem.className = 'cv-contact-item';
            locationItem.style.cssText = 'display: flex; align-items: center; gap: 0.5rem;';
            locationItem.innerHTML = `
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                <circle cx="12" cy="10" r="3"></circle>
              </svg>
              <span>${cvData.profile.location}</span>
            `;
            contactInfo.appendChild(locationItem);
          }

          if (cvData.profile.phone) {
            const phoneItem = document.createElement('div');
            phoneItem.className = 'cv-contact-item';
            phoneItem.style.cssText = 'display: flex; align-items: center; gap: 0.5rem;';
            phoneItem.innerHTML = `
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
              </svg>
              <span>${cvData.profile.phone}</span>
            `;
            contactInfo.appendChild(phoneItem);
          }

          if (cvData.profile.social.email) {
            const emailItem = document.createElement('div');
            emailItem.className = 'cv-contact-item';
            emailItem.style.cssText = 'display: flex; align-items: center; gap: 0.5rem;';
            emailItem.innerHTML = `
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                <polyline points="22,6 12,13 2,6"></polyline>
              </svg>
              <a href="mailto:${cvData.profile.social.email}" style="color: inherit; text-decoration: underline;">${cvData.profile.social.email}</a>
            `;
            contactInfo.appendChild(emailItem);
          }

          titleH2.parentNode.insertBefore(contactInfo, titleH2.nextSibling);
        }

        // Add social links section after summary
        const summaryP = headerContent.querySelector('.cv-summary');
        if (summaryP) {
          const socialLinks = document.createElement('div');
          socialLinks.className = 'cv-social-links';
          socialLinks.style.marginTop = '1rem';
          socialLinks.style.display = 'flex';
          socialLinks.style.flexDirection = 'column';
          socialLinks.style.gap = '0.5rem';
          socialLinks.style.fontSize = '0.9rem';

          if (cvData.profile.social.linkedin) {
            const linkedinLink = document.createElement('a');
            linkedinLink.href = cvData.profile.social.linkedin;
            linkedinLink.target = '_blank';
            linkedinLink.rel = 'noopener noreferrer';
            linkedinLink.className = 'cv-social-link';
            linkedinLink.style.color = '#0066cc';
            linkedinLink.style.textDecoration = 'underline';
            linkedinLink.textContent = cvData.profile.social.linkedin.replace('https://', '').replace('www.', '');
            socialLinks.appendChild(linkedinLink);
          }

          if (cvData.profile.social.github) {
            const githubLink = document.createElement('a');
            githubLink.href = cvData.profile.social.github;
            githubLink.target = '_blank';
            githubLink.rel = 'noopener noreferrer';
            githubLink.className = 'cv-social-link';
            githubLink.style.color = '#0066cc';
            githubLink.style.textDecoration = 'underline';
            githubLink.textContent = cvData.profile.social.github;
            socialLinks.appendChild(githubLink);
          }

          summaryP.parentNode.insertBefore(socialLinks, summaryP.nextSibling);
        }
      }

      // Apply print styles to both clones
      applyPrintStyles(headerClone);
      applyPrintStyles(contentClone);

      // Force all elements to be visible (remove animation opacity/transform)
      const forceVisible = (element) => {
        if (!element) return;

        // Remove framer-motion animation classes and inline styles
        if (element.style) {
          element.style.opacity = '1';
          element.style.transform = 'none';
          element.style.visibility = 'visible';
        }

        // Remove any animation-related classes
        if (element.classList) {
          element.classList.remove('framer-motion-animated');
        }

        // Recursively apply to children
        Array.from(element.children).forEach(child => forceVisible(child));
      };

      forceVisible(headerClone);
      forceVisible(contentClone);

      // Force all job cards, skills, projects to be visible
      const allJobCards = contentClone.querySelectorAll('.cv-job-card');
      allJobCards.forEach(card => {
        card.style.opacity = '1';
        card.style.transform = 'none';
        card.style.visibility = 'visible';
      });

      const allSkills = contentClone.querySelectorAll('.cv-skill-item');
      allSkills.forEach((skill, index) => {
        skill.style.opacity = '1';
        skill.style.transform = 'none';
        skill.style.visibility = 'visible';
        // Force skill bars to their full width using the actual data
        const skillBar = skill.querySelector('.cv-skill-bar-fill');
        if (skillBar && cvData.skills[index]) {
          const level = cvData.skills[index].level;
          skillBar.style.width = `${level}%`;
          skillBar.style.opacity = '1';
        }
      });

      const allProjects = contentClone.querySelectorAll('.cv-project-card');
      allProjects.forEach(project => {
        project.style.opacity = '1';
        project.style.transform = 'none';
        project.style.visibility = 'visible';
      });

      // Additional style overrides for common CV elements
      const styleOverrides = `
                <style>
                    .cv-pdf-container * {
                        background-color: transparent !important;
                    }
                    .cv-pdf-container {
                        background-color: #ffffff !important;
                        color: #000000 !important;
                    }
                    .cv-pdf-container * {
                        opacity: 1 !important;
                        visibility: visible !important;
                        transform: none !important;
                    }
                    .cv-pdf-container .cv-name,
                    .cv-pdf-container .cv-job-role,
                    .cv-pdf-container .cv-education-qual,
                    .cv-pdf-container .cv-project-name,
                    .cv-pdf-container h1,
                    .cv-pdf-container h2,
                    .cv-pdf-container h3,
                    .cv-pdf-container h4 {
                        color: #000000 !important;
                    }
                    .cv-pdf-container .cv-title,
                    .cv-pdf-container .cv-job-period,
                    .cv-pdf-container .cv-education-year,
                    .cv-pdf-container .cv-section-title {
                        color: #0066cc !important;
                    }
                    .cv-pdf-container .cv-summary,
                    .cv-pdf-container .cv-job-desc,
                    .cv-pdf-container .cv-text,
                    .cv-pdf-container .cv-project-desc,
                    .cv-pdf-container .cv-education-details,
                    .cv-pdf-container p {
                        color: #333333 !important;
                    }
                    .cv-pdf-container .cv-job-company,
                    .cv-pdf-container .cv-education-inst {
                        color: #666666 !important;
                    }
                    .cv-pdf-container .cv-job-card,
                    .cv-pdf-container .cv-education-card,
                    .cv-pdf-container .cv-project-card {
                        background-color: #f9f9f9 !important;
                        border-color: #e0e0e0 !important;
                        opacity: 1 !important;
                        visibility: visible !important;
                        transform: none !important;
                    }
                    .cv-pdf-container .cv-headline-chip,
                    .cv-pdf-container .cv-tag,
                    .cv-pdf-container .cv-project-tag {
                        background-color: #f0f0f0 !important;
                        border-color: #d0d0d0 !important;
                        color: #333333 !important;
                    }
                    .cv-pdf-container .cv-skill-bar-bg {
                        background-color: #e0e0e0 !important;
                    }
                    .cv-pdf-container .cv-skill-bar-fill {
                        background-color: #0066cc !important;
                    }
                    /* Reduce font sizes for PDF */
                    .cv-pdf-container {
                        font-size: 0.85rem !important;
                    }
                    .cv-pdf-container .cv-name {
                        font-size: 2rem !important;
                    }
                    .cv-pdf-container .cv-title {
                        font-size: 0.95rem !important;
                    }
                    .cv-pdf-container .cv-headline-chip {
                        font-size: 0.75rem !important;
                        padding: 0.3rem 0.6rem !important;
                    }
                    .cv-pdf-container .cv-summary {
                        font-size: 0.85rem !important;
                        line-height: 1.5 !important;
                    }
                    .cv-pdf-container .cv-section-title {
                        font-size: 1.1rem !important;
                    }
                    .cv-pdf-container .cv-job-role {
                        font-size: 1.1rem !important;
                    }
                    .cv-pdf-container .cv-job-company {
                        font-size: 0.95rem !important;
                    }
                    .cv-pdf-container .cv-job-period {
                        font-size: 0.7rem !important;
                    }
                    .cv-pdf-container .cv-job-desc,
                    .cv-pdf-container .cv-job-desc p {
                        font-size: 0.8rem !important;
                        line-height: 1.4 !important;
                        margin-bottom: 0.5rem !important;
                    }
                    .cv-pdf-container .cv-education-qual {
                        font-size: 0.95rem !important;
                    }
                    .cv-pdf-container .cv-education-inst {
                        font-size: 0.85rem !important;
                    }
                    .cv-pdf-container .cv-education-details {
                        font-size: 0.75rem !important;
                    }
                    .cv-pdf-container .cv-project-name {
                        font-size: 0.95rem !important;
                    }
                    .cv-pdf-container .cv-project-desc {
                        font-size: 0.8rem !important;
                    }
                    .cv-pdf-container .cv-text {
                        font-size: 0.8rem !important;
                        line-height: 1.5 !important;
                    }
                    .cv-pdf-container .cv-tag,
                    .cv-pdf-container .cv-project-tag {
                        font-size: 0.7rem !important;
                    }
                    /* Hide logos in PDF */
                    .cv-pdf-container .cv-job-logo {
                        display: none !important;
                    }
                    .cv-pdf-container .cv-timeline {
                        padding-left: 0 !important;
                    }
                    .cv-pdf-container .cv-job-card {
                        padding-left: 0 !important;
                    }
                    /* Reduce spacing for PDF */
                    .cv-pdf-container .cv-header {
                        margin-bottom: 1.5rem !important;
                    }
                    .cv-pdf-container .cv-content-grid {
                        gap: 1.5rem !important;
                    }
                    /* Page break controls and spacing */
                    .cv-pdf-container .cv-section {
                        page-break-inside: avoid;
                        break-inside: avoid;
                        margin-bottom: 1.2rem !important;
                    }
                    .cv-pdf-container .cv-section-title {
                        margin-bottom: 0.8rem !important;
                        page-break-after: avoid;
                        break-after: avoid;
                    }
                    .cv-pdf-container .cv-job-card {
                        page-break-inside: avoid;
                        break-inside: avoid;
                        margin-bottom: 1rem !important;
                    }
                    .cv-pdf-container .cv-education-card {
                        page-break-inside: avoid;
                        break-inside: avoid;
                        margin-bottom: 0.6rem !important;
                    }
                    .cv-pdf-container .cv-project-card {
                        page-break-inside: avoid;
                        break-inside: avoid;
                        margin-bottom: 0.6rem !important;
                    }
                    .cv-pdf-container .cv-skills-grid {
                        gap: 0.6rem !important;
                    }
                    .cv-pdf-container .cv-skill-item {
                        page-break-inside: avoid;
                        break-inside: avoid;
                        margin-bottom: 0.3rem !important;
                    }
                    .cv-pdf-container .cv-skill-info {
                        margin-bottom: 0.2rem !important;
                    }
                    .cv-pdf-container .cv-skill-bar-bg {
                        height: 4px !important;
                    }
                    .cv-pdf-container .cv-header {
                        page-break-after: avoid;
                        break-after: avoid;
                        margin-bottom: 3rem;
                    }
                    .cv-pdf-container .cv-content-grid {
                        grid-template-columns: 1fr !important;
                        gap: 2.5rem;
                    }
                    .cv-pdf-container .cv-left-col,
                    .cv-pdf-container .cv-right-col {
                        width: 100% !important;
                    }
                    .cv-pdf-container .cv-timeline {
                        padding-left: 2rem;
                    }
                </style>
            `;

      pdfContainer.innerHTML = styleOverrides;
      pdfContainer.appendChild(headerClone);
      pdfContainer.appendChild(contentClone);
      document.body.appendChild(pdfContainer);

      // Wait for images, fonts, and ensure all content is rendered
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Force scroll to ensure all elements are "in view" for any remaining animations
      pdfContainer.scrollTop = 0;
      await new Promise(resolve => setTimeout(resolve, 500));
      pdfContainer.scrollTop = pdfContainer.scrollHeight;
      await new Promise(resolve => setTimeout(resolve, 500));
      pdfContainer.scrollTop = 0;
      await new Promise(resolve => setTimeout(resolve, 500));

      // Create PDF with proper margins (declare early)
      const marginTop = 10; // Used for pages after the first
      const marginTopFirst = 0; // No top margin on first page
      const marginBottom = 10;
      const marginLeft = 0; // Reduced from 10
      const marginRight = 0; // Reduced from 10
      const pageWidth = 210; // A4 width in mm
      const pageHeight = 297; // A4 height in mm

      // Get element positions BEFORE capturing canvas (positions are relative to container)
      const getElementPositions = () => {
        const positions = [];
        const containerRect = pdfContainer.getBoundingClientRect();

        // Prioritize job cards - these should never be split
        const jobCards = pdfContainer.querySelectorAll('.cv-job-card');
        jobCards.forEach(el => {
          const rect = el.getBoundingClientRect();
          const top = rect.top - containerRect.top + pdfContainer.scrollTop;
          const bottom = rect.bottom - containerRect.top + pdfContainer.scrollTop;
          positions.push({
            element: el,
            top: top,
            bottom: bottom,
            height: rect.height,
            type: 'job-card',
            priority: 1 // Highest priority - never break
          });
        });

        // Also get other elements that shouldn't be broken
        const otherElements = pdfContainer.querySelectorAll('.cv-education-card, .cv-project-card, .cv-section-title');
        otherElements.forEach(el => {
          const rect = el.getBoundingClientRect();
          const top = rect.top - containerRect.top + pdfContainer.scrollTop;
          const bottom = rect.bottom - containerRect.top + pdfContainer.scrollTop;
          positions.push({
            element: el,
            top: top,
            bottom: bottom,
            height: rect.height,
            type: 'other',
            priority: 2 // Lower priority
          });
        });

        // Sort by top position for easier processing
        positions.sort((a, b) => a.top - b.top);
        return positions;
      };

      const elementPositions = getElementPositions();
      const contentWidth = pageWidth - marginLeft - marginRight;
      const contentHeight = pageHeight - marginTop - marginBottom;

      // Get link positions before removing container
      const getLinkPositions = () => {
        const links = [];
        const containerRect = pdfContainer.getBoundingClientRect();

        // Get LinkedIn and GitHub links from actions
        const actionLinks = pdfContainer.querySelectorAll('.cv-actions a[href]');
        actionLinks.forEach(link => {
          const rect = link.getBoundingClientRect();
          const top = rect.top - containerRect.top + pdfContainer.scrollTop;
          const bottom = rect.bottom - containerRect.top + pdfContainer.scrollTop;
          const left = rect.left - containerRect.left;
          const width = rect.width;
          const height = rect.height;

          links.push({
            url: link.href,
            text: link.textContent.trim(),
            top: top,
            bottom: bottom,
            left: left,
            width: width,
            height: height
          });
        });

        // Also get project links
        const projectLinks = pdfContainer.querySelectorAll('a.cv-project-name[href]');
        projectLinks.forEach(link => {
          const rect = link.getBoundingClientRect();
          const top = rect.top - containerRect.top + pdfContainer.scrollTop;
          const bottom = rect.bottom - containerRect.top + pdfContainer.scrollTop;
          const left = rect.left - containerRect.left;
          const width = rect.width;
          const height = rect.height;

          links.push({
            url: link.href,
            text: link.textContent.trim().replace(/\s+/g, ' '),
            top: top,
            bottom: bottom,
            left: left,
            width: width,
            height: height
          });
        });

        return links;
      };

      const linkPositions = getLinkPositions();

      // Capture container dimensions before removing it
      const containerScrollHeight = pdfContainer.scrollHeight;
      const containerScrollWidth = pdfContainer.scrollWidth;

      const pdf = new jsPDF('p', 'mm', 'a4');

      // Capture as canvas with very high quality for better text rendering
      const canvas = await html2canvas(pdfContainer, {
        backgroundColor: '#ffffff',
        scale: 3, // Increased from 2 for better quality
        useCORS: true,
        logging: false,
        allowTaint: false,
        width: containerScrollWidth,
        height: containerScrollHeight,
      });

      // Clean up
      document.body.removeChild(pdfContainer);

      // Calculate image dimensions
      const imgWidth = contentWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      // Scale factor: how many mm per pixel in the original container
      const scaleFactor = imgHeight / containerScrollHeight;
      const scaleFactorX = imgWidth / containerScrollWidth;

      // Convert pixel positions to PDF mm positions
      const pdfPositions = elementPositions.map(pos => ({
        top: pos.top * scaleFactor,
        bottom: pos.bottom * scaleFactor,
        height: pos.height * scaleFactor,
        type: pos.type,
        priority: pos.priority
      }));

      // Convert link positions to PDF mm positions
      const pdfLinks = linkPositions.map(link => ({
        url: link.url,
        text: link.text,
        top: link.top * scaleFactor,
        bottom: link.bottom * scaleFactor,
        left: link.left * scaleFactorX,
        width: link.width * scaleFactorX,
        height: link.height * scaleFactor
      }));

      // Split into pages respecting section boundaries
      let currentY = 0;
      const pageBreaks = [0]; // Track where pages should break

      // Find good break points (avoid breaking sections, especially job cards)
      while (currentY < imgHeight) {
        // Calculate how much space is left on current page
        const currentPageStart = pageBreaks[pageBreaks.length - 1];
        const spaceUsedOnPage = currentY - currentPageStart;
        const remainingOnPage = contentHeight - spaceUsedOnPage;

        // If less than 20mm remaining, start a new page at current position
        if (remainingOnPage < 20) {
          if (currentY < imgHeight) {
            pageBreaks.push(currentY);
          }
          // Move to next iteration - currentY stays the same, will start new page
          if (currentY >= imgHeight) break;
          continue;
        }

        const nextBreak = currentY + remainingOnPage;

        // If we've reached the end, break
        if (nextBreak >= imgHeight) {
          break;
        }

        // Check if next break would cut through any element
        let wouldBreakElement = false;
        let bestBreakPoint = null;

        // First, check for job cards (highest priority - must never break)
        for (const pos of pdfPositions) {
          if (pos.type === 'job-card') {
            // If break would cut through a job card
            if (pos.top < nextBreak && pos.bottom > nextBreak) {
              // Always break before the job card starts
              if (pos.top > currentY) {
                bestBreakPoint = pos.top;
                wouldBreakElement = true;
                break; // Take the first job card we find
              }
            }
          }
        }

        // If no job card conflict, check other elements
        if (!wouldBreakElement) {
          for (const pos of pdfPositions) {
            // Check if break would cut through this element
            if (pos.top < nextBreak && pos.bottom > nextBreak) {
              // If element is small enough to fit on one page, break before it
              if (pos.height < contentHeight && pos.top > currentY) {
                bestBreakPoint = pos.top;
                wouldBreakElement = true;
                break; // Take the first element we find
              }
            }
          }
        }

        if (wouldBreakElement && bestBreakPoint !== null && bestBreakPoint > currentY) {
          // Check if the break point is too close to current position (would create tiny pages)
          // Minimum 30mm between breaks to avoid excessive page breaks
          if (bestBreakPoint - currentY < 30) {
            // Too close, skip this element and break at normal position
            pageBreaks.push(nextBreak);
            currentY = nextBreak;
          } else {
            // Break before the element
            pageBreaks.push(bestBreakPoint);
            currentY = bestBreakPoint;
          }
        } else {
          // Safe to break at calculated position
          pageBreaks.push(nextBreak);
          currentY = nextBreak;
        }

        // Safety check to prevent infinite loops
        if (pageBreaks.length > 50) {
          console.warn('Too many page breaks, forcing end');
          break;
        }
      }

      // Ensure we end at the image height
      if (pageBreaks[pageBreaks.length - 1] < imgHeight) {
        pageBreaks.push(imgHeight);
      }

      // Remove duplicate or very close page breaks (minimum 20mm between pages)
      const cleanedBreaks = [pageBreaks[0]];
      for (let i = 1; i < pageBreaks.length; i++) {
        const distance = pageBreaks[i] - cleanedBreaks[cleanedBreaks.length - 1];
        if (distance > 20) {
          cleanedBreaks.push(pageBreaks[i]);
        }
      }
      pageBreaks.length = 0;
      pageBreaks.push(...cleanedBreaks);

      // Ensure final break is at image height
      if (pageBreaks[pageBreaks.length - 1] < imgHeight) {
        pageBreaks.push(imgHeight);
      }



      // Render pages
      for (let i = 0; i < pageBreaks.length - 1; i++) {
        if (i > 0) {
          pdf.addPage();
        }

        const pageStart = pageBreaks[i];
        const pageEnd = pageBreaks[i + 1];
        const pageHeight_mm = pageEnd - pageStart;

        // Calculate source coordinates in canvas pixels
        const sourceY = (pageStart / imgHeight) * canvas.height;
        const sourceHeight = (pageHeight_mm / imgHeight) * canvas.height;

        // Ensure valid dimensions
        if (sourceHeight <= 0 || pageHeight_mm <= 0) {
          console.warn(`Skipping page ${i} - invalid dimensions`);
          continue;
        }

        // Create canvas for this page
        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = canvas.width;
        pageCanvas.height = Math.max(1, Math.floor(sourceHeight)); // Ensure at least 1px height
        const ctx = pageCanvas.getContext('2d');

        // Fill with white background first
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);

        // Draw the portion for this page
        try {
          ctx.drawImage(
            canvas,
            0, Math.max(0, Math.floor(sourceY)),
            canvas.width, Math.max(1, Math.floor(sourceHeight)),
            0, 0,
            pageCanvas.width, pageCanvas.height
          );

          const pageImgData = pageCanvas.toDataURL('image/png', 1.0);

          // Validate image data
          if (!pageImgData || pageImgData === 'data:,') {
            console.warn(`Invalid image data for page ${i}, using full canvas`);
            // Fallback: use the full canvas for this page
            const currentMarginTop = i === 0 ? marginTopFirst : marginTop;
            const fallbackData = canvas.toDataURL('image/png', 1.0);
            pdf.addImage(fallbackData, 'PNG', marginLeft, currentMarginTop, imgWidth, pageHeight_mm);
          } else {
            // Use no top margin on first page, normal margin on subsequent pages
            const currentMarginTop = i === 0 ? marginTopFirst : marginTop;
            // Add page content
            pdf.addImage(pageImgData, 'PNG', marginLeft, currentMarginTop, imgWidth, pageHeight_mm);

            // Add clickable links for this page
            const pageStartY = pageBreaks[i];
            const pageEndY = pageBreaks[i + 1];

            pdfLinks.forEach(link => {
              // Check if link is on this page
              if (link.top >= pageStartY && link.top < pageEndY) {
                // Calculate position relative to this page
                const linkY = link.top - pageStartY + currentMarginTop;
                const linkX = link.left + marginLeft;

                // Add clickable link
                pdf.link(linkX, linkY, link.width, link.height, { url: link.url });
              }
            });
          }
        } catch (drawError) {
          console.error(`Error drawing page ${i}:`, drawError);
          // Fallback: use the full canvas
          const currentMarginTop = i === 0 ? marginTopFirst : marginTop;
          const fallbackData = canvas.toDataURL('image/png', 1.0);
          pdf.addImage(fallbackData, 'PNG', marginLeft, currentMarginTop, imgWidth, pageHeight_mm);
        }
      }

      // Download PDF
      const fileName = `${cvData.profile.name.replace(/\s+/g, '_')}_CV.pdf`;
      pdf.save(fileName);

    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  return (
    <div className="cv-page" ref={cvPageRef}>

      {/* Header Section */}
      <header className="cv-header">
        <div className="cv-header-container">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="cv-header-content"
          >
            <h1 className="cv-name">{cvData.profile.name}</h1>
            <h2 className="cv-title">{cvData.profile.title}</h2>
            <div className="cv-headlines">
              {cvData.profile.headlines.map((headline, index) => (
                <span key={index} className="cv-headline-chip">{headline}</span>
              ))}
            </div>
            <p className="cv-summary">{renderTextWithBold(cvData.profile.summary)}</p>

            <div className="cv-actions">
              <button
                onClick={generatePDF}
                disabled={isGeneratingPDF}
                className="cv-btn primary"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="btn-icon">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7 10 12 15 17 10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
                {isGeneratingPDF ? 'Generating PDF...' : 'Download CV'}
              </button>
              {cvData.profile.social.linkedin && (
                <a href={cvData.profile.social.linkedin} target="_blank" rel="noopener noreferrer" className="cv-btn secondary">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="btn-icon">
                    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path>
                    <rect x="2" y="9" width="4" height="12"></rect>
                    <circle cx="4" cy="4" r="2"></circle>
                  </svg>
                  LinkedIn
                </a>
              )}
              {cvData.profile.social.github && (
                <a href={cvData.profile.social.github} target="_blank" rel="noopener noreferrer" className="cv-btn secondary">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="btn-icon">
                    <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path>
                  </svg>
                  GitHub
                </a>
              )}
            </div>
          </motion.div>

          {/* Slideshow */}
          <motion.div
            className="cv-slideshow-container"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <AnimatePresence mode="wait">
              {cvData.profile.slideshowImages && cvData.profile.slideshowImages.length > 0 ? (
                <motion.img
                  key={currentSlide}
                  src={cvData.profile.slideshowImages[currentSlide]}
                  alt="Profile Slideshow"
                  className="cv-slide-image"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5 }}
                />
              ) : (
                <div className="cv-slide-placeholder">Add images to /images/cv-pics/</div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </header>

      <div className="cv-content-grid">
        {/* Left Column: Experience */}
        <div className="cv-left-col">
          <section className="cv-section">
            <h3 className="cv-section-title">Work Experience</h3>
            <div className="cv-timeline">
              {cvData.experience.map((job, index) => (
                <motion.div
                  key={job.id}
                  className="cv-job-card"
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                >
                  {job.logo && (
                    <CompanyLogo
                      company={job.company}
                      logo={job.logo}
                      className="cv-job-logo"
                      alt={`${job.company} logo`}
                    />
                  )}

                  <div className="cv-job-header">
                    <div className="cv-job-period">{job.period}</div>
                    <h4 className="cv-job-role">{job.role}</h4>
                    <div className="cv-job-company">{job.company}</div>
                  </div>
                  <div className="cv-job-desc">
                    {job.description.map((para, i) => (
                      <p key={i}>{renderTextWithBold(para)}</p>
                    ))}
                  </div>
                </motion.div>
              ))}
            </div>
          </section>
        </div>

        {/* Right Column: Skills, Education, Other */}
        <div className="cv-right-col">
          <section className="cv-section">
            <h3 className="cv-section-title">Skills</h3>
            <div className="cv-skills-grid">
              {cvData.skills.map((skill, index) => (
                <motion.div
                  key={index}
                  className="cv-skill-item"
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                >
                  <div className="cv-skill-info">
                    <span>{skill.name}</span>
                    {/* <span>{skill.level}%</span> */}
                  </div>
                  <div className="cv-skill-bar-bg">
                    <motion.div
                      className="cv-skill-bar-fill"
                      initial={{ width: 0 }}
                      whileInView={{ width: `${skill.level}%` }}
                      transition={{ duration: 1, ease: "easeOut" }}
                      viewport={{ once: true }}
                    />
                  </div>
                </motion.div>
              ))}
            </div>
          </section>

          <section className="cv-section">
            <h3 className="cv-section-title">Education</h3>
            <div className="cv-education-list">
              {cvData.education.map((edu) => (
                <div key={edu.id} className="cv-education-card">
                  <div className="cv-education-year">{edu.year}</div>
                  <div className="cv-education-qual">{edu.qualification}</div>
                  <div className="cv-education-inst">{edu.institution}</div>
                  {edu.details && <div className="cv-education-details">{renderTextWithBold(edu.details)}</div>}
                </div>
              ))}
            </div>
          </section>

          <section className="cv-section">
            <h3 className="cv-section-title">Languages</h3>
            <div className="cv-tags">
              {cvData.languages.map((lang, index) => (
                <span key={index} className="cv-tag">{lang}</span>
              ))}
            </div>
          </section>

          <section className="cv-section">
            <h3 className="cv-section-title">Projects</h3>
            <div className="cv-projects-list">
              {cvData.projects.map((project) => (
                <motion.div
                  key={project.id}
                  className="cv-project-card"
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                >
                  <div className="cv-project-header">
                    <a
                      href={project.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="cv-project-name"
                    >
                      {project.name}
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="cv-project-icon">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                        <polyline points="15 3 21 3 21 9"></polyline>
                        <line x1="10" y1="14" x2="21" y2="3"></line>
                      </svg>
                    </a>
                  </div>
                  <p className="cv-project-desc">{renderTextWithBold(project.description)}</p>
                  {project.tech && project.tech.length > 0 && (
                    <div className="cv-project-tech">
                      {project.tech.map((tech, index) => (
                        <span key={index} className="cv-project-tag">{tech}</span>
                      ))}
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </section>

          <section className="cv-section">
            <h3 className="cv-section-title">Hobbies</h3>
            <p className="cv-text">{cvData.hobbies}</p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default CVPage;
