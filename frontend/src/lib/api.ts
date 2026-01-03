import axios from 'axios';

const OLLAMA_API_URL = 'http://localhost:11434/api/generate';
const MODEL_NAME = 'deepseek-ocr';

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

async function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const result = reader.result as string;
            // Remove the data:image/...;base64, prefix
            resolve(result.split(',')[1]);
        };
        reader.onerror = error => reject(error);
    });
}

export async function performOCR(file: File, prompt: string): Promise<OCRResult> {
    const base64Image = await fileToBase64(file);

    const response = await axios.post(OLLAMA_API_URL, {
        model: MODEL_NAME,
        prompt: prompt,
        images: [base64Image],
        stream: false
    });

    return {
        text: response.data.response,
        done: response.data.done
    };
}

export function parseGrounding(text: string): GroundingBox[] {
    const boxes: GroundingBox[] = [];
    const matchedRanges: [number, number][] = [];

    const addBox = (match: RegExpExecArray, type: string, textContent: string, coordsStr: string, fullMatch: string) => {
        const start = match.index;
        const end = match.index + match[0].length;

        // Check if this range overlaps with any already matched range
        if (matchedRanges.some(([s, e]) => (start < e && end > s))) {
            return;
        }

        try {
            const coords = JSON.parse(coordsStr);
            // Handle both [[y1,x1,y2,x2]] and [y1,x1,y2,x2] variants
            const flatCoords = (Array.isArray(coords) && Array.isArray(coords[0])) ? coords : [coords];

            flatCoords.forEach((c: number[], i: number) => {
                if (Array.isArray(c) && c.length === 4) {
                    // Check if there's additional content after the tags (like table HTML)
                    let finalText = textContent || 'Located Item';

                    // Look for content immediately after the closing tag
                    const afterTagPos = end;
                    const remainingText = text.substring(afterTagPos);

                    // Check if there's a table or other structured content following
                    const tableMatch = remainingText.match(/^(\s*\n)?(<table>[\s\S]*?<\/table>)/);
                    if (tableMatch) {
                        finalText = tableMatch[2]; // Use the table HTML as the text
                    }

                    boxes.push({
                        id: `${type}-${start}-${i}`,
                        text: finalText,
                        // Try standard [x1, y1, x2, y2] format
                        box: { x1: c[0], y1: c[1], x2: c[2], y2: c[3] },
                        raw: fullMatch
                    });
                }
            });
            matchedRanges.push([start, end]);
        } catch (e) {
            console.error('Failed to parse coords:', coordsStr, e);
        }
    };

    // 1. Full tags: <|ref|>text<|/ref|><|det|>[[coords]]<|/det|>
    const refDetWithClosingRegex = /<\|ref\|>(.*?)<\|\/ref\|><\|det\|>(\[\[.*?\]\])<\|\/det\|>/g;
    let match;
    while ((match = refDetWithClosingRegex.exec(text)) !== null) {
        addBox(match, 'ref-closing', match[1], match[2], match[0]);
    }

    // 2. Half tags (legacy): <|ref|>text<|det|>[[coords]]
    const refDetRegex = /<\|ref\|>(.*?)<\|det\|>(\[\[.*?\]\])/g;
    while ((match = refDetRegex.exec(text)) !== null) {
        addBox(match, 'ref', match[1], match[2], match[0]);
    }

    // 3. Partial closing: [[coords]]<|/det|>
    const closingDetRegex = /(\[\[.*?\]\])<\|\/det\|>/g;
    while ((match = closingDetRegex.exec(text)) !== null) {
        addBox(match, 'closing-det', 'Located Item', match[1], match[0]);
    }

    // 4. Standalone coords: [[coords]]
    const standaloneRegex = /\[\[\d+,\s*\d+,\s*\d+,\s*\d+\]\]/g;
    while ((match = standaloneRegex.exec(text)) !== null) {
        addBox(match, 'standalone', 'Located Item', match[0], match[0]);
    }

    // Sort boxes by their appearance in text to keep numbering intuitive
    return boxes.sort((a, b) => {
        const indexA = parseInt(a.id.split('-')[1]);
        const indexB = parseInt(b.id.split('-')[1]);
        return indexA - indexB;
    });
}

export const OCR_PROMPTS = {
    grounding: '<|grounding|>Given the layout of the image.',
    free_ocr: 'Free OCR.',
    parse_figure: 'Parse the figure.',
    extract_text: 'Extract the text in the image.',
    markdown: '<|grounding|>Convert the document to markdown.',
};
