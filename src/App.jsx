import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import ScrollToTop from './components/ScrollToTop';
import Home from './components/Home';
import MapPage from './components/MapPage';
import CVPage from './components/CVPage';
import LeadershipPage from './components/LeadershipPage';

import ContactPage from './components/ContactPage';
import MusicPage from './components/MusicPage';

function App() {
  return (
    <Router>
      <ScrollToTop />
      <div className="app-container">
        <Navbar />

        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/cv" element={<CVPage />} />
          <Route path="/leadership" element={<LeadershipPage />} />
          <Route path="/music" element={<MusicPage />} />
          <Route path="/contact" element={<ContactPage />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
