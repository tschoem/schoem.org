import React from 'react';
import { motion } from 'framer-motion';
import '../styles/Hero.css';

const Hero = () => {
    return (
        <section className="hero">
            <div className="hero-content">
                <motion.h1
                    initial={{ opacity: 0, y: 100 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, ease: [0.6, 0.05, -0.01, 0.9] }}
                    className="hero-title"
                >
                    Engineering.<br />
                    Adventure.<br />
                    <span className="hero-highlight">Innovation.</span>
                </motion.h1>
                <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5, duration: 0.8 }}
                    className="hero-subtitle"
                >
                    From Dunkirk to Dar es Salaam, a journey of code and sails.
                </motion.p>
            </div>
            <div className="hero-scroll-indicator">
                <span>Scroll to explore</span>
            </div>
        </section>
    );
};

export default Hero;
