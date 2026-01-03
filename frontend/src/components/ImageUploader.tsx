import React, { useCallback, useRef, useEffect, useState } from 'react';
import { Upload, X, RotateCcw } from 'lucide-react';
import { useI18n } from '../lib/i18n';
import type { GroundingBox } from '../lib/api';
import { GroundingOverlay } from './GroundingOverlay';

interface ImageUploaderProps {
    onImageSelect: (file: File) => void;
    selectedImage: string | null;
    onClear: () => void;
    boxes?: GroundingBox[];
    showBoxes?: boolean;
    highlightedId?: string | null;
    focusedBoxId?: { id: string, ts: number } | null;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({
    onImageSelect,
    selectedImage,
    onClear,
    boxes = [],
    showBoxes = true,
    highlightedId = null,
    focusedBoxId = null
}) => {
    const { t } = useI18n();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Zoom and Pan State
    const [scale, setScale] = useState(1);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [imageDims, setImageDims] = useState<{ width: number, height: number, left: number, top: number } | null>(null);

    const updateDims = useCallback(() => {
        if (!containerRef.current || !selectedImage) return;

        const container = containerRef.current;
        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;

        if (containerWidth === 0 || containerHeight === 0) return;

        const img = new Image();
        img.src = selectedImage;

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
    }, [selectedImage]);

    useEffect(() => {
        updateDims();
        const observer = new ResizeObserver(() => {
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
    }, [updateDims]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            onImageSelect(e.target.files[0]);
            resetZoom();
        }
    };

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            onImageSelect(e.dataTransfer.files[0]);
            resetZoom();
        }
    }, [onImageSelect]);

    const handlePaste = useCallback((e: ClipboardEvent | React.ClipboardEvent) => {
        e.preventDefault();
        const clipboardData = 'clipboardData' in e ? e.clipboardData : (e as ClipboardEvent).clipboardData;

        if (!clipboardData) return;

        const items = clipboardData.items;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                const file = items[i].getAsFile();
                if (file) {
                    onImageSelect(file);
                    resetZoom();
                    break;
                }
            }
        }
    }, [onImageSelect]);

    const resetZoom = () => {
        setScale(1);
        setPosition({ x: 0, y: 0 });
    };

    // Zoom to Box functionality
    useEffect(() => {
        if (!focusedBoxId || !imageDims || !containerRef.current) return;

        const box = boxes.find(b => b.id === focusedBoxId.id);
        if (!box) return;

        const containerRect = containerRef.current.getBoundingClientRect();
        const viewportWidth = containerRect.width;
        const viewportHeight = containerRect.height;

        // Calculate box center and size in image coordinates
        const boxWidthMapped = ((box.box.x2 - box.box.x1) / 1000) * imageDims.width;
        const boxMidX = (box.box.x1 + box.box.x2) / 2;
        const boxMidY = (box.box.y1 + box.box.y2) / 2;

        // Map to pixel coordinates relative to the image center/position at scale 1
        const centerX = (boxMidX / 1000) * imageDims.width + imageDims.left;
        const centerY = (boxMidY / 1000) * imageDims.height + imageDims.top;

        // Calculate dynamic scale: make the box width fill ~80% of the viewport
        let targetScale = (viewportWidth * 0.8) / boxWidthMapped;

        // Cap the scale to sensible limits (1x to 10x)
        targetScale = Math.min(Math.max(targetScale, 1), 10);

        // At targetScale, we want (centerX, centerY) to be at the center of the viewport
        const newX = (viewportWidth / 2) - targetScale * centerX;
        const newY = (viewportHeight / 2) - targetScale * centerY;

        setScale(targetScale);
        setPosition({ x: newX, y: newY });
    }, [focusedBoxId, imageDims, boxes]);

    const handleWheel = (e: React.WheelEvent) => {
        if (!selectedImage) return;

        const zoomSpeed = 0.001;
        const delta = -e.deltaY;
        const newScale = Math.min(Math.max(scale + delta * zoomSpeed * scale, 1), 10);

        if (newScale === scale) return;

        // Zoom towards cursor
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) {
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            // Calculate point in "image space" before zoom
            const imageX = (mouseX - position.x) / scale;
            const imageY = (mouseY - position.y) / scale;

            // Calculate new position after zoom
            const newX = mouseX - imageX * newScale;
            const newY = mouseY - imageY * newScale;

            setScale(newScale);
            setPosition({ x: newX, y: newY });
        }
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (!selectedImage || scale <= 1) return;
        setIsDragging(true);
        setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging) return;
        setPosition({
            x: e.clientX - dragStart.x,
            y: e.clientY - dragStart.y
        });
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    // Global paste listener
    useEffect(() => {
        const globalPasteHandler = (e: ClipboardEvent) => {
            const activeElement = document.activeElement;
            if (activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA') {
                return;
            }
            handlePaste(e);
        };

        window.addEventListener('paste', globalPasteHandler);
        return () => window.removeEventListener('paste', globalPasteHandler);
    }, [handlePaste]);

    return (
        <div
            onPaste={handlePaste}
            className="w-full h-full flex flex-col"
        >
            {!selectedImage ? (
                <label
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleDrop}
                    className="flex-grow flex flex-col items-center justify-center w-full h-full border-2 border-dashed border-white/20 rounded-2xl cursor-pointer hover:border-primary-500/50 hover:bg-white/5 transition-all group p-8"
                >
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <div className="p-4 rounded-full bg-primary-500/10 mb-4 group-hover:scale-110 transition-transform">
                            <Upload className="w-10 h-10 text-primary-400" />
                        </div>
                        <p className="mb-2 text-lg font-medium text-slate-200">{t.drop_files}</p>
                        <p className="text-sm text-slate-400">{t.paste_hint}</p>
                    </div>
                    <input
                        ref={fileInputRef}
                        type="file"
                        className="hidden"
                        accept="image/*"
                        onChange={handleFileChange}
                    />
                </label>
            ) : (
                <div
                    ref={containerRef}
                    onWheel={handleWheel}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    className={`relative w-full h-full overflow-hidden glass border border-white/10 group flex items-center justify-center bg-black/40 ${scale > 1 ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'}`}
                >
                    <div
                        className="w-full h-full transition-transform duration-300 ease-out will-change-transform"
                        style={{
                            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                            transformOrigin: '0 0'
                        }}
                    >
                        <img
                            src={selectedImage}
                            alt="Preview"
                            className="w-full h-full object-contain bg-slate-900"
                            draggable={false}
                        />
                        <GroundingOverlay
                            boxes={boxes}
                            visible={showBoxes}
                            highlightedId={highlightedId}
                            imageDims={imageDims}
                        />
                    </div>

                    <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                        {scale > 1 && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    resetZoom();
                                }}
                                className="p-2 bg-slate-800/80 hover:bg-slate-700 text-white rounded-full transition-colors shadow-lg border border-white/10"
                                title="Reset Zoom"
                            >
                                <RotateCcw size={20} />
                            </button>
                        )}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onClear();
                            }}
                            className="p-2 bg-red-500/80 hover:bg-red-500 text-white rounded-full transition-colors shadow-lg"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
