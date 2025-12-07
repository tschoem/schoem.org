import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ScatterChart, Scatter, ZAxis, CartesianGrid } from 'recharts';
import discogsData from '../data/discogsData.json';

import '../styles/MusicPage.css';

const MusicPage = () => {
    // State for filtering
    const [filter, setFilter] = useState(null); // { type: 'year' | 'added' | 'style' | 'genre', value: number | string }
    // State for sorting
    const [sortBy, setSortBy] = useState('added-desc'); // format: 'field-direction'
    // State for Spotify player modal
    const [selectedAlbum, setSelectedAlbum] = useState(null); // Album to play in modal

    // Helper: Determine which dataset to use for a chart
    // If the chart controls the current filter, show ALL data (to let user switch).
    // Otherwise, show FILTERED data (to show insights).
    const getChartDataSrc = (filterType) => {
        return (filter?.type === filterType) ? discogsData : filteredRecords;
    };

    // --- Data Filtering Logic (Global) ---
    const filteredRecords = useMemo(() => {
        if (!filter) return discogsData;

        return discogsData.filter(item => {
            if (filter.type === 'year') return item.year === filter.value;
            if (filter.type === 'added') return new Date(item.added).getFullYear() === filter.value;
            if (filter.type === 'style') return item.styles && item.styles.includes(filter.value);
            if (filter.type === 'genre') return item.genres && item.genres.includes(filter.value);
            return true;
        });
    }, [filter]);

    // --- Data Sorting Logic ---
    const sortedRecords = useMemo(() => {
        const [field, direction] = sortBy.split('-');
        const sorted = [...filteredRecords];

        sorted.sort((a, b) => {
            let aVal, bVal;

            switch (field) {
                case 'artist':
                    aVal = a.artists.toLowerCase();
                    bVal = b.artists.toLowerCase();
                    break;
                case 'added':
                    aVal = new Date(a.added).getTime();
                    bVal = new Date(b.added).getTime();
                    break;
                case 'year':
                    aVal = a.year || 0;
                    bVal = b.year || 0;
                    break;
                case 'title':
                    aVal = a.title.toLowerCase();
                    bVal = b.title.toLowerCase();
                    break;
                default:
                    return 0;
            }

            if (aVal < bVal) return direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return direction === 'asc' ? 1 : -1;
            return 0;
        });

        return sorted;
    }, [filteredRecords, sortBy]);

    // 1. Process Data for Spider Chart (Genres)
    const genreData = useMemo(() => {
        const sourceData = getChartDataSrc('genre');
        const counts = {};
        sourceData.forEach(item => {
            item.genres.forEach(genre => {
                counts[genre] = (counts[genre] || 0) + 1;
            });
        });

        // Always show top 8 of the FULL dataset structure to maintain shape stability, 
        // OR distinct top 8 of current view.
        // Dashboard approach: It's usually better to keep the axes stable if possible, 
        // but dynamic is cooler for seeing what's in the selection. 
        // Let's do dynamic but stable sort.
        return Object.keys(counts)
            .map(key => ({ subject: key, A: counts[key], fullMark: 100 }))
            .sort((a, b) => b.A - a.A)
            .slice(0, 12);
    }, [filteredRecords, filter]);

    // 2. Process Data for Timeline (Years)
    const yearData = useMemo(() => {
        const sourceData = getChartDataSrc('year');
        const counts = {};
        sourceData.forEach(item => {
            const year = item.year;
            if (year && year > 1950) {
                counts[year] = (counts[year] || 0) + 1;
            }
        });

        return Object.keys(counts)
            .sort()
            .map(year => ({ year: parseInt(year), count: counts[year] }));
    }, [filteredRecords, filter]);

    // 3. Process Data for Styles (Bubble Chart)
    const styleData = useMemo(() => {
        const sourceData = getChartDataSrc('style');
        const stats = {};

        sourceData.forEach(item => {
            if (item.styles && item.year > 1950) {
                item.styles.forEach(style => {
                    if (!stats[style]) {
                        stats[style] = { count: 0, totalYear: 0 };
                    }
                    stats[style].count += 1;
                    stats[style].totalYear += item.year;
                });
            }
        });

        return Object.keys(stats)
            .map(style => ({
                styleLabel: style,
                x: Math.round(stats[style].totalYear / stats[style].count),
                y: stats[style].count,
                z: stats[style].count
            }))
            .sort((a, b) => b.y - a.y)
            .slice(0, 20);
    }, [filteredRecords, filter]);

    // 4. Process Data for Acquisition Timeline
    const acquisitionData = useMemo(() => {
        const sourceData = getChartDataSrc('added');
        const counts = {};
        sourceData.forEach(item => {
            if (item.added) {
                const year = new Date(item.added).getFullYear();
                counts[year] = (counts[year] || 0) + 1;
            }
        });

        return Object.keys(counts)
            .sort()
            .map(year => ({ year: parseInt(year), count: counts[year] }));
    }, [filteredRecords, filter]);


    // Handlers
    const handleYearClick = (data) => {
        if (data && data.activePayload) setFilter({ type: 'year', value: data.activePayload[0].payload.year });
    };

    const handleAcquisitionClick = (data) => {
        if (data && data.activePayload) setFilter({ type: 'added', value: data.activePayload[0].payload.year });
    };

    const handleStyleClick = (node) => {
        setFilter({ type: 'style', value: node.styleLabel });
    };

    // Improved Genre Tick with dynamic width
    const renderCustomGenreTick = ({ payload, x, y, textAnchor, stroke, radius }) => {
        const isSelected = filter?.type === 'genre' && filter?.value === payload.value;
        const textLength = payload.value.length;
        const width = Math.max(70, textLength * 8 + 20); // Dynamic width approx
        const xOffset = textAnchor === 'end' ? -width + 10 : textAnchor === 'start' ? -10 : -width / 2;

        const handleClick = (e) => {
            e.stopPropagation();
            if (isSelected) {
                setFilter(null);
            } else {
                setFilter({ type: 'genre', value: payload.value });
            }
        };

        return (
            <g className="recharts-layer recharts-polar-angle-axis-tick genre-axis-tick" onClick={handleClick} style={{ cursor: 'pointer' }}>
                <rect
                    x={x + xOffset}
                    y={y - 12}
                    width={width}
                    height={24}
                    rx="12"
                    fill={isSelected ? "var(--accent-color)" : "rgba(255,255,255,0.1)"}
                    stroke={isSelected ? "none" : "rgba(255,255,255,0.2)"}
                    className="genre-tick-rect" // Helper class for CSS
                />
                <text
                    radius={radius}
                    stroke={stroke}
                    x={x + xOffset + width / 2} // Center text in rect
                    y={y}
                    className="recharts-text recharts-polar-angle-axis-tick-value"
                    textAnchor="middle" // Always center text within the rect
                    fill={isSelected ? "#000" : "#ccc"}
                    fontSize="11"
                    fontWeight={isSelected ? "bold" : "normal"}
                    dy={4}
                >
                    <tspan dy="4px">{payload.value}</tspan>
                </text>
            </g>
        );
    };

    // Radar Chart Dot Handler
    const handleGenreDotClick = (data) => {
        if (data && data.payload) {
            const clickedGenre = data.payload.subject;
            if (filter?.type === 'genre' && filter?.value === clickedGenre) {
                setFilter(null);
            } else {
                setFilter({ type: 'genre', value: clickedGenre });
            }
        }
    };

    // Custom Dot for Radar Chart (Invisible but clickable)
    const renderGenreDot = (props) => {
        const { cx, cy, payload } = props;
        return (
            <circle
                key={`dot-${payload.subject}`}
                cx={cx}
                cy={cy}
                r={10} // Larger hit area
                fill="transparent"
                stroke="none"
                style={{ cursor: 'pointer' }}
                onClick={(e) => {
                    e.stopPropagation();
                    handleGenreDotClick({ payload });
                }}
            />
        );
    };

    // Stats
    const totalItems = filteredRecords.length;
    // Calculate distinct artists in the CURRENT view
    const distinctArtists = new Set(filteredRecords.flatMap(item => item.artists.split(', '))).size;

    const CustomTooltip = ({ active, payload }) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            return (
                <div className="custom-tooltip" style={{ backgroundColor: '#111', border: '1px solid #333', padding: '10px', borderRadius: '4px', maxWidth: '200px' }}>
                    <p style={{ color: '#fff', fontWeight: 'bold', marginBottom: '4px' }}>{data.styleLabel || data.year || data.subject}</p>
                    <p style={{ color: '#ccc', fontSize: '0.9rem' }}>Count: {data.count || data.y || data.A}</p>
                    {data.x && <p style={{ color: '#888', fontSize: '0.8rem' }}>Avg Year: {data.x}</p>}
                    <p style={{ color: '#5d5dff', fontSize: '0.8rem', marginTop: '5px', fontWeight: 'bold' }}>Tap dot/label to Filter</p>
                </div>
            );
        }
        return null;
    };

    // Generic Handler for Chart Clicks (Radar)
    // This catches clicks anywhere on the chart while a slice is active
    const handleRadarClick = (data) => {
        if (data && data.activePayload && data.activePayload.length > 0) {
            const payload = data.activePayload[0].payload;
            // logic matches handleGenreDotClick
            const clickedGenre = payload.subject;
            if (filter?.type === 'genre' && filter?.value === clickedGenre) {
                setFilter(null);
            } else {
                setFilter({ type: 'genre', value: clickedGenre });
            }
        }
    };

    return (
        <div className="music-page">


            <header className="music-header">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8 }}
                >
                    <h1 className="music-title">Vinyl Collection</h1>
                    <h2 className="music-subtitle">
                        {filter ? (
                            <span>Filtered: <span style={{ color: '#fff' }}>{filter.value}</span> ({totalItems})</span>
                        ) : (
                            <span>Data-driven journey through {totalItems} records.</span>
                        )}
                    </h2>
                    <p className="music-desc" style={{ maxWidth: '800px', margin: '0 auto 2rem auto' }}>
                        An important part of my love of music is to actually purchase physical copies of the albums I love. I re-started collecting in 2018, hence the low volume, and I don't buy many albums, but they all represent something special to me. Have a look at the collection and interact with the widgets to filter out the records. You can even play 30 seconds previews of the tracks to experience some of my favourite sounds.
                        <br />
                        {filter && (
                            <button
                                onClick={() => setFilter(null)}
                                className="reset-filter-btn"
                                style={{
                                    marginTop: '1rem',
                                    background: 'rgba(255,255,255,0.1)',
                                    border: '1px solid white',
                                    color: 'white',
                                    padding: '0.5rem 1.5rem',
                                    borderRadius: '30px',
                                    cursor: 'pointer',
                                    fontSize: '0.9rem',
                                    transition: 'all 0.2s'
                                }}
                            >
                                Clear Filter ✕
                            </button>
                        )}
                    </p>
                    <a
                        href="https://www.discogs.com/user/tomschoem/collection"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="discogs-btn"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <circle cx="12" cy="12" r="3"></circle>
                        </svg>
                        View on Discogs
                    </a>
                </motion.div>
            </header>

            {/* Visualizations Container */}
            <div className="music-charts-container">
                {/* Spider Chart - Genres */}
                <motion.div
                    className="chart-card"
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                >
                    <h3 className="chart-title">Genre Distribution</h3>
                    <div className="chart-wrapper genre-chart-wrapper">
                        <ResponsiveContainer width="100%" height={320}>
                            <RadarChart onClick={handleRadarClick} cx="50%" cy="50%" outerRadius="65%" data={genreData}>
                                <PolarGrid stroke="#444" />
                                <PolarAngleAxis
                                    dataKey="subject"
                                    tick={renderCustomGenreTick}
                                />
                                <PolarRadiusAxis angle={30} domain={[0, 'dataMax + 2']} tick={false} axisLine={false} />
                                <Radar
                                    name="Records"
                                    dataKey="A"
                                    stroke="#5d5dff"
                                    strokeWidth={3}
                                    fill="#5d5dff"
                                    fillOpacity={filter?.type === 'genre' ? 0.2 : 0.5}
                                    isAnimationActive={true}
                                    activeDot={{ r: 6, fill: '#fff', stroke: '#5d5dff', strokeWidth: 2, cursor: 'pointer' }}
                                />
                                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                            </RadarChart>
                        </ResponsiveContainer>
                    </div>
                </motion.div>

                {/* Bubble Chart - Styles */}
                <motion.div
                    className="chart-card"
                    initial={{ opacity: 0, x: 20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.2 }}
                >
                    <h3 className="chart-title">Style Bubbles (Era vs Popularity)</h3>
                    <div className="chart-wrapper" style={{ cursor: 'pointer' }}>
                        <ResponsiveContainer width="100%" height={300}>
                            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
                                <CartesianGrid stroke="#333" strokeDasharray="3 3" />
                                <XAxis type="number" dataKey="x" name="Avg Year" domain={['auto', 'auto']} tick={{ fill: '#888', fontSize: 10 }} unit="" />
                                <YAxis type="number" dataKey="y" name="Count" tick={{ fill: '#888', fontSize: 10 }} unit="" />
                                <ZAxis type="number" dataKey="z" range={[60, 400]} name="Count" />
                                <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3' }} />
                                <Scatter
                                    name="Styles"
                                    data={styleData}
                                    fill="#00ff9d"
                                    onClick={handleStyleClick}
                                >
                                    {styleData.map((entry, index) => (
                                        <Cell
                                            key={`cell-${index}`}
                                            fill={filter?.type === 'style' && filter?.value === entry.styleLabel ? '#fff' : 'rgba(0, 255, 157, 0.6)'}
                                        />
                                    ))}
                                </Scatter>
                            </ScatterChart>
                        </ResponsiveContainer>
                    </div>
                </motion.div>

                {/* Bar Chart - Release Year Timeline */}
                <motion.div
                    className="chart-card"
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.3 }}
                >
                    <h3 className="chart-title">Release Timeline</h3>
                    <div className="chart-wrapper" style={{ cursor: 'pointer' }}>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={yearData} onClick={handleYearClick}>
                                <XAxis dataKey="year" tick={{ fill: '#888', fontSize: 10 }} />
                                <YAxis hide />
                                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                                <Bar dataKey="count" fill="#4a00e0" radius={[4, 4, 0, 0]}>
                                    {yearData.map((entry, index) => (
                                        <Cell
                                            key={`cell-${index}`}
                                            fill={filter?.type === 'year' && filter?.value === entry.year ? '#fff' : `hsl(${240 + (index * 2)}, 70%, 60%)`}
                                            opacity={filter && filter.type !== 'year' ? 0.5 : 1}
                                        />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </motion.div>

                {/* Bar Chart - Acquisition Timeline */}
                <motion.div
                    className="chart-card"
                    initial={{ opacity: 0, x: 20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.4 }}
                >
                    <h3 className="chart-title">Acquisition Timeline</h3>
                    <div className="chart-wrapper" style={{ cursor: 'pointer' }}>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={acquisitionData} onClick={handleAcquisitionClick}>
                                <XAxis dataKey="year" tick={{ fill: '#888', fontSize: 10 }} />
                                <YAxis hide />
                                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                                <Bar dataKey="count" fill="#ff0080" radius={[4, 4, 0, 0]}>
                                    {acquisitionData.map((entry, index) => (
                                        <Cell
                                            key={`cell-${index}`}
                                            fill={filter?.type === 'added' && filter?.value === entry.year ? '#fff' : `hsl(${320 + (index * 5)}, 70%, 60%)`}
                                            opacity={filter && filter.type !== 'added' ? 0.5 : 1}
                                            cursor="pointer"
                                        />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </motion.div>
            </div>

            {/* Collection Grid */}
            <section className="collection-section">
                <div className="collection-header" style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                    <h3 className="section-title center" style={{ margin: 0, borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px', flex: '1 1 auto' }}>
                        Collection View
                    </h3>

                    {/* Sort Selector */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <label htmlFor="sort-select" style={{ color: '#888', fontSize: '0.9rem', whiteSpace: 'nowrap' }}>
                            Sort by:
                        </label>
                        <select
                            id="sort-select"
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                            style={{
                                background: 'rgba(255, 255, 255, 0.05)',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                borderRadius: '8px',
                                color: 'white',
                                padding: '0.5rem 1rem',
                                fontSize: '0.9rem',
                                cursor: 'pointer',
                                outline: 'none',
                                transition: 'border-color 0.2s'
                            }}
                            onMouseEnter={(e) => e.target.style.borderColor = 'rgba(255, 255, 255, 0.3)'}
                            onMouseLeave={(e) => e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)'}
                        >
                            <option value="added-desc" style={{ background: '#111' }}>Date Added (Newest)</option>
                            <option value="added-asc" style={{ background: '#111' }}>Date Added (Oldest)</option>
                            <option value="year-desc" style={{ background: '#111' }}>Release Year (Newest)</option>
                            <option value="year-asc" style={{ background: '#111' }}>Release Year (Oldest)</option>
                            <option value="artist-asc" style={{ background: '#111' }}>Artist (A-Z)</option>
                            <option value="artist-desc" style={{ background: '#111' }}>Artist (Z-A)</option>
                            <option value="title-asc" style={{ background: '#111' }}>Album Name (A-Z)</option>
                            <option value="title-desc" style={{ background: '#111' }}>Album Name (Z-A)</option>
                        </select>
                    </div>
                </div>

                <div className="collection-grid">
                    {sortedRecords.map((item) => (
                        <div
                            key={item.id}
                            className="record-card"
                        >
                            <div className="record-cover-container">
                                {item.cover_image ? (
                                    <img src={item.cover_image} alt={item.title} className="record-cover" loading="lazy" />
                                ) : (
                                    <div className="record-placeholder">No Cover</div>
                                )}
                                <div className="record-overlay">
                                    <span className="record-year">{item.year}</span>
                                </div>
                                {item.spotify_id && (
                                    <button
                                        className="spotify-play-btn"
                                        onClick={() => setSelectedAlbum(item)}
                                        aria-label="Play on Spotify"
                                        title="Play on Spotify"
                                    >
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M8 5v14l11-7z" />
                                        </svg>
                                    </button>
                                )}
                            </div>
                            <div className="record-info">
                                <h4 className="record-title">{item.title}</h4>
                                <p className="record-artist">{item.artists}</p>
                                <div className="record-genres">
                                    {item.styles && item.styles.slice(0, 2).map((s, i) => (
                                        <span key={i} className="record-genre-tag" onClick={() => setFilter({ type: 'style', value: s })} style={{ cursor: 'pointer' }}>{s}</span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ))}
                    {filteredRecords.length === 0 && (
                        <div style={{ textAlign: 'center', gridColumn: '1 / -1', padding: '4rem', color: '#888' }}>
                            No records found for this selection.
                        </div>
                    )}
                </div>
            </section>

            {/* Spotify Player Modal */}
            <AnimatePresence>
                {selectedAlbum && (
                    <motion.div
                        className="spotify-modal-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setSelectedAlbum(null)}
                    >
                        <motion.div
                            className="spotify-modal-content"
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <button
                                className="spotify-modal-close"
                                onClick={() => setSelectedAlbum(null)}
                                aria-label="Close"
                            >
                                ✕
                            </button>
                            <h3 className="spotify-modal-title">{selectedAlbum.title}</h3>
                            <p className="spotify-modal-artist">{selectedAlbum.artists}</p>

                            <iframe
                                src={`https://open.spotify.com/embed/album/${selectedAlbum.spotify_id}?utm_source=generator&theme=0`}
                                width="100%"
                                height="380"
                                frameBorder="0"
                                allowFullScreen
                                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                                loading="lazy"
                                title={`Spotify player for ${selectedAlbum.title}`}
                            />

                            <p className="spotify-modal-note">
                                🎵 Powered by Spotify · 30-second previews available to all users
                            </p>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default MusicPage;
