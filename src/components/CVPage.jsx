import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cvData } from '../data/cvData';
import '../styles/CVPage.css';


const CVPage = () => {
    const [currentSlide, setCurrentSlide] = useState(0);

    // Auto-advance slides
    useEffect(() => {
        if (!cvData.profile.slideshowImages || cvData.profile.slideshowImages.length === 0) return;
        const timer = setInterval(() => {
            setCurrentSlide((prev) => (prev + 1) % cvData.profile.slideshowImages.length);
        }, 4000);
        return () => clearInterval(timer);
    }, []);

    return (
        <div className="cv-page">

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
                        <p className="cv-summary">{cvData.profile.summary}</p>

                        <div className="cv-actions">
                            {cvData.profile.cvLink && (
                                <a href={cvData.profile.cvLink} download target="_blank" rel="noopener noreferrer" className="cv-btn primary">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="btn-icon">
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                        <polyline points="7 10 12 15 17 10"></polyline>
                                        <line x1="12" y1="15" x2="12" y2="3"></line>
                                    </svg>
                                    Download CV
                                </a>
                            )}
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
                                    {job.logo && <img src={job.logo} alt={`${job.company} logo`} className="cv-job-logo" />}

                                    <div className="cv-job-header">
                                        <div className="cv-job-period">{job.period}</div>
                                        <h4 className="cv-job-role">{job.role}</h4>
                                        <div className="cv-job-company">{job.company}</div>
                                    </div>
                                    <div className="cv-job-desc">
                                        {job.description.map((para, i) => (
                                            <p key={i}>{para}</p>
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
                                    {edu.details && <div className="cv-education-details">{edu.details}</div>}
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
                        <h3 className="cv-section-title">Hobbies</h3>
                        <p className="cv-text">{cvData.hobbies}</p>
                    </section>
                </div>
            </div>
        </div>
    );
};

export default CVPage;
