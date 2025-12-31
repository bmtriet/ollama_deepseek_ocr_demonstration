import React, { useEffect, useState } from 'react';

interface ConnectionLineProps {
    fromId: string | null;
    toId: string | null;
    visible: boolean;
    color?: string;
}

export const ConnectionLine: React.FC<ConnectionLineProps> = ({
    fromId,
    toId,
    visible,
    color = '#ef4444' // red-500
}) => {
    const [path, setPath] = useState<string>('');

    useEffect(() => {
        let animationFrameId: number;

        const updatePath = () => {
            if (!visible || !fromId || !toId) {
                setPath('');
                return;
            }

            const fromEl = document.getElementById(fromId);
            const toEl = document.getElementById(toId);

            if (!fromEl || !toEl) {
                setPath('');
                return;
            }

            const fromRect = fromEl.getBoundingClientRect();
            const toRect = toEl.getBoundingClientRect();

            // Determine relative positions
            const isTextOnRight = fromRect.left > toRect.right;

            // Start from the appropriate side of the text chip
            const startX = isTextOnRight ? fromRect.left : fromRect.right;
            const startY = fromRect.top + fromRect.height / 2;

            // User requested: "bottom-right corner of the bounding box"
            // Start arrow at bottom-right
            const endX = toRect.right;
            const endY = toRect.bottom;

            // Control points for Bezier curve
            // Make a smooth curve. If text is on right, curve out to the left then to the box.
            const dist = Math.abs(endX - startX);

            const cp1X = isTextOnRight
                ? startX - dist * 0.5  // If on right, pull control point LEFT
                : startX + dist * 0.5; // If on left, pull control point RIGHT

            const cp1Y = startY;

            // Improved curve for bottom-right target
            const newPath = `M ${startX},${startY} C ${cp1X},${cp1Y} ${cp1X},${endY} ${endX},${endY}`;
            setPath(newPath);

            animationFrameId = requestAnimationFrame(updatePath);
        };

        if (visible) {
            updatePath();
        } else {
            setPath('');
        }

        return () => {
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
        };
    }, [fromId, toId, visible]);

    if (!visible || !path) return null;

    return (
        <svg
            className="fixed inset-0 pointer-events-none z-50 overflow-visible"
            style={{ width: '100vw', height: '100vh' }}
        >
            <defs>
                <marker
                    id="arrowhead"
                    markerWidth="10"
                    markerHeight="7"
                    refX="9"
                    refY="3.5"
                    orient="auto"
                >
                    <polygon points="0 0, 10 3.5, 0 7" fill={color} />
                </marker>
            </defs>
            <path
                d={path}
                stroke={color}
                strokeWidth="2"
                fill="none"
                markerEnd="url(#arrowhead)"
                className="drop-shadow-md"
            />
        </svg>
    );
};
