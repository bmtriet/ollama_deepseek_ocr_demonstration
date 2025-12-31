import React, { useCallback, useRef, useEffect } from 'react';
import { Upload, X } from 'lucide-react';
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
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({
    onImageSelect,
    selectedImage,
    onClear,
    boxes = [],
    showBoxes = true,
    highlightedId = null
}) => {
    const { t } = useI18n();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            onImageSelect(e.target.files[0]);
        }
    };

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            onImageSelect(e.dataTransfer.files[0]);
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
                    break;
                }
            }
        }
    }, [onImageSelect]);

    // Global paste listener for better reliability
    useEffect(() => {
        const globalPasteHandler = (e: ClipboardEvent) => {
            // Only handle if no input/textarea is focused
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
                <div className="relative w-full h-full overflow-hidden glass border border-white/10 group flex items-center justify-center bg-black/40">
                    <img
                        src={selectedImage}
                        alt="Preview"
                        className="w-full h-full object-contain bg-slate-900"
                    />
                    <GroundingOverlay
                        boxes={boxes}
                        imageUrl={selectedImage}
                        visible={showBoxes}
                        highlightedId={highlightedId}
                    />
                    <button
                        onClick={onClear}
                        className="absolute top-4 right-4 p-2 bg-red-500/80 hover:bg-red-500 text-white rounded-full transition-colors opacity-0 group-hover:opacity-100 shadow-lg z-20"
                    >
                        <X size={20} />
                    </button>
                </div>
            )}
        </div>
    );
};
