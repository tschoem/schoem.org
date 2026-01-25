import React, { useState, useEffect, useMemo } from 'react';

/**
 * Company Logo component with fallback handling
 * Tries multiple logo sources and falls back gracefully
 */
const CompanyLogo = ({ company, logo, className, alt }) => {
  const [currentLogoIndex, setCurrentLogoIndex] = useState(0);
  const [hasError, setHasError] = useState(false);

  // Generate all possible logo sources (memoized)
  const logoSources = useMemo(() => {
    const sources = [];
    
    // Handle placeholder images directly
    if (logo && logo.startsWith('https://placehold.co/')) {
      sources.push(logo);
      return sources;
    }

    // Determine the actual domain for each company
    const getCompanyDomain = () => {
      const companyLower = company.toLowerCase();
      if (companyLower.includes('google')) return 'google.com';
      if (companyLower.includes('facebook')) return 'facebook.com';
      if (companyLower.includes('smartly')) return 'smartly.io';
      if (companyLower.includes('browserstack')) return 'browserstack.com';
      if (companyLower.includes('squad')) return null; // No domain for Squad Digital
      if (companyLower.includes('safari gateway')) return null;
      if (companyLower.includes('tanzania yacht')) return null;
      if (companyLower.includes('micro medical')) return null;
      
      // Try to extract domain from company name
      const domain = companyLower.replace(/\s+/g, '').replace(/\./g, '');
      return `${domain}.com`;
    };

    const domain = getCompanyDomain();

    if (domain) {
      // Try Clearbit directly first (it has CORS headers that should work)
      sources.push(`https://logo.clearbit.com/${domain}`);
      
      // Try Google's favicon service as fallback (very reliable, no CORS issues)
      sources.push(`https://www.google.com/s2/favicons?domain=${domain}&sz=128`);
      
      // Try alternative domain patterns
      if (domain.endsWith('.com')) {
        sources.push(`https://logo.clearbit.com/${domain.replace('.com', '.io')}`);
      }
    }

    // If original logo was provided and not a placeholder, try it
    if (logo && !logo.startsWith('https://placehold.co/')) {
      if (!sources.includes(logo)) {
        sources.unshift(logo); // Try original first
      }
    }

    return sources;
  }, [company, logo]);

  // Reset when company or logo changes
  useEffect(() => {
    setCurrentLogoIndex(0);
    setHasError(false);
  }, [company, logo]);

  const handleError = () => {
    const nextIndex = currentLogoIndex + 1;
    
    if (nextIndex < logoSources.length) {
      // Try next fallback
      console.log(`Logo failed for ${company}, trying fallback ${nextIndex + 1}/${logoSources.length}`);
      setCurrentLogoIndex(nextIndex);
    } else {
      // No more fallbacks, hide logo
      console.warn(`All logo sources failed for ${company}`);
      setHasError(true);
    }
  };

  if (hasError || logoSources.length === 0) {
    return null;
  }

  const currentLogo = logoSources[currentLogoIndex];

  if (!currentLogo) {
    return null;
  }

  return (
    <img
      key={`${company}-${currentLogoIndex}`} // Force re-render when logo changes
      src={currentLogo}
      alt={alt || `${company} logo`}
      className={className}
      onError={handleError}
      onLoad={(e) => {
        // Check if image actually loaded (some APIs return 200 with placeholder)
        if (e.target.naturalWidth === 0 || e.target.naturalHeight === 0) {
          console.warn(`Logo loaded but has zero dimensions for ${company}`);
          handleError();
        }
      }}
    />
  );
};

export default CompanyLogo;
