import React from 'react';
import { leadershipData } from '../data/leadershipData';
import '../styles/LeadershipPage.css';


const LeadershipPage = () => {
    return (
        <div className="leadership-page">

            <header className="leadership-header">
                <div
                    className="leadership-intro"
                >
                    <h1 className="leadership-title">{leadershipData.intro.title}</h1>
                    <h2 className="leadership-subtitle">{leadershipData.intro.subtitle}</h2>
                    <p className="leadership-desc">{leadershipData.intro.description}</p>
                </div>
            </header>

            {/* Principles Grid */}
            <div className="principles-grid">
                {leadershipData.sections.map((section, sectionIndex) => (
                    <section
                        key={sectionIndex}
                        className={`principle-group ${section.type}`}
                    >
                        <h3 className="section-title">{section.title}</h3>
                        <div className="principle-items">
                            {section.items.map((item, itemIndex) => (
                                <div
                                    key={itemIndex}
                                    className="principle-card"
                                >
                                    <h4 className="principle-card-title">{item.title}</h4>
                                    <p className="principle-card-text">{item.text}</p>
                                </div>
                            ))}
                        </div>
                    </section>
                ))}
            </div>

            {/* Influences Section */}
            <section className="influences-section">
                <h3
                    className="section-title center"
                >
                    Leadership Influences
                </h3>
                <div className="influences-grid">
                    {leadershipData.influences.map((influence, index) => {
                        const CardWrapper = influence.link ? 'a' : 'div';
                        const wrapperProps = influence.link ? {
                            href: influence.link,
                            target: '_blank',
                            rel: 'noopener noreferrer',
                            style: { textDecoration: 'none', color: 'inherit', borderColor: influence.color }
                        } : {
                            style: { borderColor: influence.color }
                        };

                        return (
                            <CardWrapper
                                key={index}
                                className="influence-card"
                                {...wrapperProps}
                            >
                                <div className="influence-image-container">
                                    <img src={influence.image} alt={influence.title} className="influence-image" />
                                </div>
                                <div className="influence-content">
                                    <span className="influence-type" style={{ color: influence.color }}>{influence.type}</span>
                                    <h4 className="influence-title">{influence.title}</h4>
                                    {influence.author && <p className="influence-author">{influence.author}</p>}
                                </div>
                            </CardWrapper>
                        );
                    })}
                </div>
            </section>

            {/* About Section */}
            <section className="about-section">
                <h3 className="section-title">{leadershipData.about.title}</h3>
                <div className="about-items">
                    {leadershipData.about.items.map((item, index) => (
                        <div
                            key={index}
                            className="about-item"
                        >
                            <h4 className="about-item-title">{item.title}</h4>
                            <p className="about-item-text">{item.text}</p>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
};

export default LeadershipPage;
