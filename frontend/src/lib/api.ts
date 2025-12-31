import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000';

export interface OCRResult {
    text: string;
    processed_image?: string; // Base64 encoded image with boxes
    done: boolean;
}

export interface BoundingBox {
    y1: number;
    x1: number;
    y2: number;
    x2: number;
}

export interface GroundingBox {
    id: string;
    text: string;
    box: BoundingBox;
    raw: string; // The original tag string
}

export async function performOCR(file: File, prompt: string): Promise<OCRResult> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('prompt', prompt);

    const response = await axios.post(`${API_BASE_URL}/ocr`, formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    });

    return response.data;
}

export function parseGrounding(text: string): GroundingBox[] {
    const boxes: GroundingBox[] = [];

    // Pattern 1: With closing tags: <|ref|>text<|/ref|><|det|>[[coords]]<|/det|>
    const refDetWithClosingRegex = /<\|ref\|>(.*?)<\|\/ref\|><\|det\|>(\[\[.*?\]\])<\|\/det\|>/g;
    let match: RegExpExecArray | null;

    while ((match = refDetWithClosingRegex.exec(text)) !== null) {
        const currentMatch = match;
        try {
            const coords = JSON.parse(currentMatch[2]);
            if (Array.isArray(coords)) {
                const flatCoords = Array.isArray(coords[0]) ? coords : [coords];
                flatCoords.forEach((c: number[], i: number) => {
                    if (c.length === 4) {
                        boxes.push({
                            id: `ref-closing-${currentMatch.index}-${i}`,
                            text: currentMatch[1] || 'Object',
                            // Swapped to [x1, y1, x2, y2]
                            box: { x1: c[0], y1: c[1], x2: c[2], y2: c[3] },
                            raw: currentMatch[0]
                        });
                    }
                });
            }
        } catch (e) { }
    }

    // Pattern 2: Without closing tags (legacy): <|ref|>text<|det|>[[coords]]
    const refDetRegex = /<\|ref\|>(.*?)<\|det\|>(\[\[.*?\]\])/g;
    while ((match = refDetRegex.exec(text)) !== null) {
        const currentMatch = match;
        try {
            const coords = JSON.parse(currentMatch[2]);
            if (Array.isArray(coords)) {
                const flatCoords = Array.isArray(coords[0]) ? coords : [coords];
                flatCoords.forEach((c: number[], i: number) => {
                    if (c.length === 4) {
                        boxes.push({
                            id: `ref-${currentMatch.index}-${i}`,
                            text: currentMatch[1] || 'Object',
                            // Swapped to [x1, y1, x2, y2]
                            box: { x1: c[0], y1: c[1], x2: c[2], y2: c[3] },
                            raw: currentMatch[0]
                        });
                    }
                });
            }
        } catch (e) { }
    }

    // Pattern 3: Broken/Standalone but with closing det: [[coords]]<|/det|>
    const closingDetRegex = /(\[\[.*?\]\])<\|\/det\|>/g;
    while ((match = closingDetRegex.exec(text)) !== null) {
        const currentMatch = match;
        try {
            const parsed = JSON.parse(currentMatch[1]);
            const flatCoords = (Array.isArray(parsed) && Array.isArray(parsed[0])) ? parsed : [parsed];

            flatCoords.forEach((coords: number[], idx: number) => {
                if (Array.isArray(coords) && coords.length === 4) {
                    boxes.push({
                        id: `closing-det-${currentMatch.index}-${idx}`,
                        text: 'Located Item',
                        // Swapped to [x1, y1, x2, y2]
                        box: { x1: coords[0], y1: coords[1], x2: coords[2], y2: coords[3] },
                        raw: currentMatch[0] // Captures including <|/det|>
                    });
                }
            });
        } catch (e) { }
    }

    const standaloneRegex = /\[\[\d+,\s*\d+,\s*\d+,\s*\d+\]\](?!<\|\/det\|>)/g; // Negative lookahead to avoid double counting
    while ((match = standaloneRegex.exec(text)) !== null) {
        const currentMatch = match;
        try {
            const parsed = JSON.parse(currentMatch[0]);
            const coords = Array.isArray(parsed[0]) ? parsed[0] : parsed;
            if (Array.isArray(coords) && coords.length === 4) {
                // Check dupes
                const exists = boxes.some(b =>
                    b.box.x1 === coords[0] && b.box.y1 === coords[1] &&
                    b.box.x2 === coords[2] && b.box.y2 === coords[3]
                );

                if (!exists) {
                    boxes.push({
                        id: `standalone-${currentMatch.index}`,
                        text: 'Located Item',
                        // Swapped to [x1, y1, x2, y2]
                        box: { x1: coords[0], y1: coords[1], x2: coords[2], y2: coords[3] },
                        raw: currentMatch[0]
                    });
                }
            }
        } catch (e) { }
    }

    return boxes;
}

export const OCR_PROMPTS = {
    grounding: '<|grounding|>Given the layout of the image.',
    free_ocr: 'Free OCR.',
    parse_figure: 'Parse the figure.',
    extract_text: 'Extract the text in the image.',
    markdown: '<|grounding|>Convert the document to markdown.',
};
