import React, { useEffect, useRef } from 'react';
import type { GroundingBox } from '../lib/api';

interface GroundingOverlayProps {
    boxes: GroundingBox[];
    visible: boolean;
    highlightedId: string | null;
    imageDims: { width: number, height: number, left: number, top: number } | null;
}

export const GroundingOverlay: React.FC<GroundingOverlayProps> = ({
    boxes,
    visible,
    highlightedId,
    imageDims
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !imageDims || !visible) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Filter boxes: if something is highlighted, ONLY show that one.
        const displayedBoxes = highlightedId
            ? boxes.filter(box => box.id === highlightedId)
            : boxes;

        displayedBoxes.forEach((box) => {
            // Find its original index in the full boxes array for the label
            const originalIndex = boxes.findIndex(b => b.id === box.id);

            const x = (box.box.x1 / 1000) * imageDims.width;
            const y = (box.box.y1 / 1000) * imageDims.height;
            const w = ((box.box.x2 - box.box.x1) / 1000) * imageDims.width;
            const h = ((box.box.y2 - box.box.y1) / 1000) * imageDims.height;
            const isHighlighted = highlightedId === box.id;

            // Styles
            ctx.lineWidth = isHighlighted ? 1.5 : 1;
            ctx.strokeStyle = isHighlighted ? '#facc15' : '#22c55e'; // yellow-400 : green-500
            ctx.fillStyle = isHighlighted ? 'rgba(250, 204, 21, 0.4)' : 'rgba(34, 197, 94, 0.1)';

            // Draw Box
            ctx.beginPath();
            ctx.rect(x, y, w, h);
            ctx.fill();
            ctx.stroke();

            // Draw Label
            const labelText = `${originalIndex + 1}`;
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

    if (!visible) return null;

    return (
        <div
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
