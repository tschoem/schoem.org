import React, { useEffect, useRef, useState } from 'react';
import { motion, useInView, useScroll, useTransform } from 'framer-motion';
import '../styles/Timeline.css';

const ImageSequence = ({ images, itemRef }) => {
    const { scrollYProgress } = useScroll({
        target: itemRef,
        offset: ["start end", "end start"]
    });

    if (!images || images.length === 0) return null;

    return (
        <div className="timeline-image-container">
            {images.map((src, index) => {
                // Calculate the segment of scroll where this image should be visible
                // We want transitions.
                // Simple logic: Divide scroll progress (0 to 1) by number of images.
                // E.g. 2 images: [0, 0.5] -> Img 1, [0.5, 1] -> Img 2.

                const length = images.length;
                const segment = 1 / length;
                const start = index * segment;
                const end = start + segment;

                // Ensure crossfade
                const opacity = useTransform(
                    scrollYProgress,
                    [start - 0.1, start, end, end + 0.1],
                    [0, 1, 1, 0]
                );

                // First image should be visible from start
                const isFirst = index === 0;
                const opacityFirst = useTransform(
                    scrollYProgress,
                    [0, end, end + 0.1],
                    [1, 1, 0]
                );

                // Last image should stay visible until end
                const isLast = index === length - 1;
                const opacityLast = useTransform(
                    scrollYProgress,
                    [start - 0.1, start, 1],
                    [0, 1, 1]
                );

                // Pick the right opacity logic
                const finalOpacity = length === 1 ? 1 :
                    isFirst ? opacityFirst :
                        isLast ? opacityLast : opacity;

                return (
                    <motion.img
                        key={index}
                        src={src}
                        alt={`Event image ${index + 1}`}
                        className="timeline-image"
                        style={{
                            opacity: finalOpacity,
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            zIndex: length - index
                        }}
                    />
                );
            })}
        </div>
    );
};

const TimelineItem = ({ event, onActive }) => {
    const ref = useRef(null);
    const isInView = useInView(ref, { margin: "-50% 0px -50% 0px" });

    useEffect(() => {
        if (isInView) {
            onActive(event);
        }
    }, [isInView, event, onActive]);

    return (
        <div ref={ref} className="timeline-item">
            <motion.div
                className="timeline-content"
                initial={{ opacity: 0, x: -50 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6 }}
            >
                <span className="timeline-year">{event.year}</span>
                <h2 className="timeline-title">{event.title}</h2>
                <p className="timeline-description">{event.description}</p>

                <ImageSequence images={event.images} itemRef={ref} />
            </motion.div>
        </div>
    );
};

const Timeline = ({ events, onActiveEventChange }) => {
    return (
        <div className="timeline-container">
            {events.map((event) => (
                <TimelineItem
                    key={event.id}
                    event={event}
                    onActive={onActiveEventChange}
                />
            ))}
            <div className="timeline-spacer"></div>
        </div>
    );
};

export default Timeline;
