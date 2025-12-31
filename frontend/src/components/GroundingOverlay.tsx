import React, { useEffect, useState, useRef } from 'react';
import type { GroundingBox } from '../lib/api';

interface GroundingOverlayProps {
    boxes: GroundingBox[];
    imageUrl: string;
    visible: boolean;
    highlightedId: string | null;
}

export const GroundingOverlay: React.FC<GroundingOverlayProps> = ({
    boxes,
    imageUrl,
    visible,
    highlightedId
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [imageDims, setImageDims] = useState<{ width: number, height: number, left: number, top: number } | null>(null);

    const updateDims = () => {
        if (!containerRef.current) return;

        const container = containerRef.current;
        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;

        if (containerWidth === 0 || containerHeight === 0) return;

        const img = new Image();
        img.src = imageUrl;

        const process = () => {
            const imgWidth = img.naturalWidth;
            const imgHeight = img.naturalHeight;

            const containerAspect = containerWidth / containerHeight;
            const imgAspect = imgWidth / imgHeight;

            let renderedWidth, renderedHeight, left, top;

            if (imgAspect > containerAspect) {
                renderedWidth = containerWidth;
                renderedHeight = containerWidth / imgAspect;
                left = 0;
                top = (containerHeight - renderedHeight) / 2;
            } else {
                renderedHeight = containerHeight;
                renderedWidth = containerHeight * imgAspect;
                top = 0;
                left = (containerWidth - renderedWidth) / 2;
            }

            setImageDims({ width: renderedWidth, height: renderedHeight, left, top });
        };

        if (img.complete) {
            process();
        } else {
            img.onload = process;
        }
    };

    useEffect(() => {
        updateDims();

        const observer = new ResizeObserver(() => {
            // Using requestAnimationFrame to avoid "ResizeObserver loop limit exceeded"
            window.requestAnimationFrame(updateDims);
        });

        if (containerRef.current) {
            observer.observe(containerRef.current);
        }

        window.addEventListener('resize', updateDims);
        return () => {
            observer.disconnect();
            window.removeEventListener('resize', updateDims);
        };
    }, [imageUrl]);

    useEffect(() => {
        console.log('GroundingOverlay Debug:', { visible, boxesCount: boxes.length, imageDims, imageUrl });
    }, [visible, boxes, imageDims, imageUrl]);

    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !imageDims || !visible) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        boxes.forEach((box, index) => {
            const x = (box.box.x1 / 1000) * imageDims.width;
            const y = (box.box.y1 / 1000) * imageDims.height;
            const w = ((box.box.x2 - box.box.x1) / 1000) * imageDims.width;
            const h = ((box.box.y2 - box.box.y1) / 1000) * imageDims.height;
            const isHighlighted = highlightedId === box.id;

            // Styles
            ctx.lineWidth = isHighlighted ? 3 : 2;
            ctx.strokeStyle = isHighlighted ? '#facc15' : '#22c55e'; // yellow-400 : green-500
            ctx.fillStyle = isHighlighted ? 'rgba(250, 204, 21, 0.2)' : 'rgba(34, 197, 94, 0.1)';

            // Draw Box
            ctx.beginPath();
            ctx.rect(x, y, w, h);
            ctx.fill();
            ctx.stroke();

            // Draw Label
            const labelText = `${index + 1}`;
            ctx.font = 'bold 10px sans-serif';
            const textMetrics = ctx.measureText(labelText);
            const textWidth = textMetrics.width;
            const textHeight = 14;
            const padding = 4;

            const labelBgColor = isHighlighted ? '#facc15' : '#16a34a'; // yellow-400 : green-600
            const labelTextColor = isHighlighted ? '#000000' : '#ffffff';

            ctx.fillStyle = labelBgColor;
            ctx.fillRect(x, y - textHeight, textWidth + padding * 2, textHeight);

            ctx.fillStyle = labelTextColor;
            ctx.fillText(labelText, x + padding, y - 4);
        });

    }, [boxes, imageDims, visible, highlightedId]);

    // If visible but no dims, render invisible to measure.
    // If not visible, return null.
    if (!visible) return null;

    return (
        <div
            ref={containerRef}
            className="absolute inset-0 pointer-events-none z-10 overflow-hidden"
            style={{ visibility: imageDims ? 'visible' : 'hidden' }}
        >
            {/* Anchor for Connection Line */}
            {highlightedId && imageDims && (() => {
                const box = boxes.find(b => b.id === highlightedId);
                if (!box) return null;

                const x = (box.box.x1 / 1000) * imageDims.width + imageDims.left;
                const y = (box.box.y1 / 1000) * imageDims.height + imageDims.top;
                const w = ((box.box.x2 - box.box.x1) / 1000) * imageDims.width;
                const h = ((box.box.y2 - box.box.y1) / 1000) * imageDims.height;

                return (
                    <div
                        id={`box-highlighted-${box.id}`}
                        style={{
                            position: 'absolute',
                            left: x,
                            top: y,
                            width: w,
                            height: h,
                            pointerEvents: 'none',
                            visibility: 'hidden'
                        }}
                    />
                );
            })()}

            {imageDims && (
                <canvas
                    ref={canvasRef}
                    width={imageDims.width}
                    height={imageDims.height}
                    style={{
                        position: 'absolute',
                        left: imageDims.left,
                        top: imageDims.top,
                        pointerEvents: 'none'
                    }}
                />
            )}
        </div>
    );
};
