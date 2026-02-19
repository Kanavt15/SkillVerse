import React, { useEffect, useRef, useState, useCallback } from 'react';

const FRAME_COUNT = 240;
const FRAME_PATHS = Array.from(
    { length: FRAME_COUNT },
    (_, i) => `/animated-section/ezgif-frame-${String(i + 1).padStart(3, '0')}.jpg`
);

const ScrollAnimation = () => {
    const containerRef = useRef(null);
    const canvasRef = useRef(null);
    const imagesRef = useRef(new Array(FRAME_COUNT).fill(null));
    const loadedSetRef = useRef(new Set());
    const currentFrameRef = useRef(0);
    const rafRef = useRef(null);
    const [loadProgress, setLoadProgress] = useState(0);
    const [firstBatchReady, setFirstBatchReady] = useState(false);

    // Draw a specific frame onto the canvas
    const drawFrame = useCallback((frameIndex) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const img = imagesRef.current[frameIndex];
        if (!img || !img.complete || !img.naturalWidth) return;

        const ctx = canvas.getContext('2d');
        const parent = canvas.parentElement;
        if (!parent) return;

        const dpr = window.devicePixelRatio || 1;
        const displayWidth = parent.clientWidth;
        const displayHeight = parent.clientHeight;

        // Only resize canvas when dimensions actually change
        if (canvas.width !== displayWidth * dpr || canvas.height !== displayHeight * dpr) {
            canvas.width = displayWidth * dpr;
            canvas.height = displayHeight * dpr;
            canvas.style.width = displayWidth + 'px';
            canvas.style.height = displayHeight + 'px';
            ctx.scale(dpr, dpr);
        }

        // Draw image with object-fit: cover behavior
        const imgRatio = img.naturalWidth / img.naturalHeight;
        const canvasRatio = displayWidth / displayHeight;

        let drawWidth, drawHeight, offsetX, offsetY;
        if (canvasRatio > imgRatio) {
            drawWidth = displayWidth;
            drawHeight = displayWidth / imgRatio;
            offsetX = 0;
            offsetY = (displayHeight - drawHeight) / 2;
        } else {
            drawHeight = displayHeight;
            drawWidth = displayHeight * imgRatio;
            offsetX = (displayWidth - drawWidth) / 2;
            offsetY = 0;
        }

        ctx.clearRect(0, 0, displayWidth, displayHeight);
        ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
    }, []);

    // Progressive image loading: prioritize first 30 frames, then load the rest
    useEffect(() => {
        let cancelled = false;

        const loadImage = (index) => {
            return new Promise((resolve) => {
                if (imagesRef.current[index]) {
                    resolve();
                    return;
                }
                const img = new Image();
                img.src = FRAME_PATHS[index];
                img.onload = () => {
                    if (!cancelled) {
                        imagesRef.current[index] = img;
                        loadedSetRef.current.add(index);
                        resolve();
                    }
                };
                img.onerror = () => resolve(); // Skip failed frames
            });
        };

        const loadBatch = async (indices, batchSize = 10) => {
            for (let i = 0; i < indices.length; i += batchSize) {
                if (cancelled) return;
                const batch = indices.slice(i, i + batchSize);
                await Promise.all(batch.map(loadImage));
                if (!cancelled) {
                    setLoadProgress(loadedSetRef.current.size / FRAME_COUNT);
                }
            }
        };

        const loadAll = async () => {
            // Phase 1: Load first 30 frames quickly (the opening of the animation)
            const firstBatch = Array.from({ length: 30 }, (_, i) => i);
            await loadBatch(firstBatch, 10);
            if (!cancelled) {
                setFirstBatchReady(true);
                drawFrame(0); // Draw first frame immediately
            }

            // Phase 2: Load remaining frames
            const remaining = Array.from({ length: FRAME_COUNT - 30 }, (_, i) => i + 30);
            await loadBatch(remaining, 15);
        };

        loadAll();

        return () => { cancelled = true; };
    }, [drawFrame]);

    // Scroll-driven frame rendering
    useEffect(() => {
        const handleScroll = () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
            rafRef.current = requestAnimationFrame(() => {
                const container = containerRef.current;
                if (!container) return;

                const rect = container.getBoundingClientRect();
                const viewportHeight = window.innerHeight;
                const scrollableDistance = rect.height - viewportHeight;
                const scrolled = -rect.top;
                const progress = Math.max(0, Math.min(1, scrolled / scrollableDistance));

                // Map progress to frame index
                const targetFrame = Math.min(
                    FRAME_COUNT - 1,
                    Math.round(progress * (FRAME_COUNT - 1))
                );

                // Find the closest loaded frame to the target
                let frameToShow = targetFrame;
                if (!imagesRef.current[targetFrame]) {
                    // Search nearby frames
                    for (let offset = 1; offset < 10; offset++) {
                        if (imagesRef.current[targetFrame - offset]) {
                            frameToShow = targetFrame - offset;
                            break;
                        }
                        if (imagesRef.current[targetFrame + offset]) {
                            frameToShow = targetFrame + offset;
                            break;
                        }
                    }
                }

                if (frameToShow !== currentFrameRef.current && imagesRef.current[frameToShow]) {
                    currentFrameRef.current = frameToShow;
                    drawFrame(frameToShow);
                }
            });
        };

        const handleResize = () => {
            // Force canvas resize and redraw on window resize
            const canvas = canvasRef.current;
            if (canvas) {
                canvas.width = 0; // Force recalculation
            }
            drawFrame(currentFrameRef.current);
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        window.addEventListener('resize', handleResize, { passive: true });
        handleScroll(); // Initial position

        return () => {
            window.removeEventListener('scroll', handleScroll);
            window.removeEventListener('resize', handleResize);
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, [drawFrame]);

    const isLoading = !firstBatchReady;
    const loadPercent = Math.round(loadProgress * 100);

    return (
        <section
            ref={containerRef}
            className="relative"
            style={{ height: '400vh' }} /* 8 sec of video = needs generous scroll room */
        >
            <div className="sticky top-0 h-screen w-full overflow-hidden bg-[#050810]">
                {/* Loading state */}
                {isLoading && (
                    <div className="absolute inset-0 flex items-center justify-center z-20">
                        <div className="flex flex-col items-center gap-4">
                            <div className="w-12 h-12 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
                            <span className="text-cyan-400/70 text-sm font-medium">
                                Loading animation...
                            </span>
                            <div className="w-48 h-1 bg-white/10 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-cyan-500 rounded-full transition-all duration-300"
                                    style={{ width: `${loadPercent}%` }}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* Canvas for frame rendering */}
                <canvas
                    ref={canvasRef}
                    className="absolute inset-0 w-full h-full"
                    style={{
                        opacity: isLoading ? 0 : 1,
                        transition: 'opacity 0.6s ease',
                    }}
                />

                {/* Subtle vignette overlay */}
                <div
                    className="absolute inset-0 pointer-events-none z-10"
                    style={{
                        background: 'radial-gradient(ellipse at center, transparent 50%, rgba(5,8,16,0.5) 100%)',
                    }}
                />

                {/* Top gradient blend with hero above */}
                <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-[#0a0e1a] to-transparent pointer-events-none z-10" />
                {/* Bottom gradient blend with section below */}
                <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#0a0e1a] to-transparent pointer-events-none z-10" />

                {/* Background loading indicator (shows when first batch is loaded but not all frames) */}
                {firstBatchReady && loadProgress < 1 && (
                    <div className="absolute bottom-8 right-8 z-20 flex items-center gap-2 bg-black/40 backdrop-blur-sm rounded-full px-3 py-1.5">
                        <div className="w-3 h-3 border border-cyan-500/50 border-t-cyan-400 rounded-full animate-spin" />
                        <span className="text-cyan-400/50 text-xs">{loadPercent}%</span>
                    </div>
                )}
            </div>
        </section>
    );
};

export default ScrollAnimation;
