import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import '../styles/Home.css';


const Home = () => {
    return (
        <div className="home-container">

            <div className="home-content">
                <div>
                    <motion.h1
                        className="home-title"
                        initial={{ opacity: 0, y: 50 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                    >
                        Hello, I'm <br />
                        <span className="home-name">Thomas.</span>
                    </motion.h1>
                    <motion.p
                        className="home-intro"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2, duration: 0.8, ease: "easeOut" }}
                    >
                        Engineer. Sailor. Mélomane.
                    </motion.p>
                </div>

                <div className="home-sections">
                    {/* CV Section */}
                    <Link to="/cv" className="section-card">
                        <span className="section-number">01</span>
                        <h2 className="section-title">Resume / CV</h2>
                        <p className="section-desc">Professional experience & skills.</p>
                        <div className="section-arrow">→</div>
                    </Link>

                    {/* Leadership Section */}
                    <Link to="/leadership" className="section-card">
                        <span className="section-number">02</span>
                        <h2 className="section-title">Leadership</h2>
                        <p className="section-desc">Guide to Thomas & Principles.</p>
                        <div className="section-arrow">→</div>
                    </Link>

                    {/* Map Section */}
                    <Link to="/map" className="section-card">
                        <span className="section-number">03</span>
                        <h2 className="section-title">Life Map</h2>
                        <p className="section-desc">A visual journey through my history.</p>
                        <div className="section-arrow">→</div>
                    </Link>

                    {/* Music Section */}
                    <Link to="/music" className="section-card">
                        <span className="section-number">04</span>
                        <h2 className="section-title">Music</h2>
                        <p className="section-desc">My vinyl collection & genres.</p>
                        <div className="section-arrow">→</div>
                    </Link>
                </div>

                <motion.div
                    className="home-socials"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4, duration: 0.8 }}
                >
                    <a href="https://www.linkedin.com/in/tomschoem/" className="social-link" target="_blank" rel="noopener noreferrer">LinkedIn</a>
                    <a href="https://github.com/tschoem" className="social-link" target="_blank" rel="noopener noreferrer">GitHub</a>
                    <Link to="/contact" className="social-link">Email</Link>
                </motion.div>
            </div>
        </div>
    );
};

export default Home;
