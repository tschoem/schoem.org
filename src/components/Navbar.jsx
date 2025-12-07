import { useState } from 'react';
import { Link } from 'react-router-dom';
import '../styles/Navbar.css';

const Navbar = () => {
    const [isOpen, setIsOpen] = useState(false);

    const toggleMenu = () => {
        setIsOpen(!isOpen);
    };

    return (
        <nav className="navbar">
            <Link to="/" className="navbar-brand" onClick={() => setIsOpen(false)}>
                <div className="navbar-name">Thomas Schoemaecker</div>
                <div className="navbar-tagline">Engineer. Sailor. Mélomane</div>
            </Link>

            <button
                className={`navbar-toggle ${isOpen ? 'open' : ''}`}
                onClick={toggleMenu}
                aria-label="Toggle navigation"
            >
                <span className="hamburger-line"></span>
                <span className="hamburger-line"></span>
                <span className="hamburger-line"></span>
            </button>

            <div className={`navbar-menu ${isOpen ? 'active' : ''}`}>
                <Link to="/cv" className="navbar-link" onClick={() => setIsOpen(false)}>CV</Link>
                <Link to="/leadership" className="navbar-link" onClick={() => setIsOpen(false)}>Leadership</Link>
                <Link to="/map" className="navbar-link" onClick={() => setIsOpen(false)}>My Journey</Link>
                <Link to="/music" className="navbar-link" onClick={() => setIsOpen(false)}>Music</Link>
                <Link to="/contact" className="navbar-link" onClick={() => setIsOpen(false)}>Contact</Link>
            </div>
        </nav>
    );
};

export default Navbar;
