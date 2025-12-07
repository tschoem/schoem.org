import React, { useState } from 'react';
import LifeMap from './LifeMap';
import Timeline from './Timeline';
import { lifeEvents } from '../data/lifeEvents';
import '../styles/LifeMap.css';

import '../styles/MapPage.css';

const MapPage = () => {
    const [activeEvent, setActiveEvent] = useState(lifeEvents[0]);

    return (
        <div className="map-page">
            <section id="map" className="map-section">
                <Timeline events={lifeEvents} onActiveEventChange={setActiveEvent} />
                <LifeMap activeEvent={activeEvent} />
            </section>
        </div>
    );
};

export default MapPage;
