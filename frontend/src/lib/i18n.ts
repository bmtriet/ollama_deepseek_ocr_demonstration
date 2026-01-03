import { useState } from 'react';

export type Language = 'en' | 'zh-TW';

const translations = {
    en: {
        title: 'DeepSeek OCR',
        subtitle: 'Extract text, parse figures, and ground layouts with AI',
        drop_files: 'Drop image here or click to upload',
        paste_hint: 'You can also paste an image from clipboard',
        grounding: 'Grounding',
        free_ocr: 'Free OCR',
        parse_figure: 'Parse Figure',
        extract_text: 'Extract Text',
        markdown: 'Markdown',
        processing: 'Processing...',
        result: 'Result',
        copy: 'Copy',
        copied: 'Copied!',
        error: 'Error',
        grounding_desc: 'Given the layout of the image',
        free_ocr_desc: 'Free OCR.',
        parse_figure_desc: 'Parse the figure.',
        extract_text_desc: 'Extract the text in the image.',
        markdown_desc: 'Convert the document to markdown.',
        change_image: 'Change Image',
        locate_object: 'Locate Object',
        locate_placeholder: 'Enter keyword to locate...',
        locate_btn: 'Locate',
        render_table: 'Render as Table',
        hide_table: 'Hide Table',
    },
    'zh-TW': {
        title: 'DeepSeek OCR 助手',
        subtitle: '使用 AI 提取文字、解析圖表並定位佈局',
        drop_files: '拖放圖片至此或點擊上傳',
        paste_hint: '您也可以直接從剪貼簿貼上圖片',
        grounding: '佈局定位',
        free_ocr: '自由 OCR',
        parse_figure: '統計圖表解析',
        extract_text: '提取文字',
        markdown: '轉為 Markdown',
        processing: '處理中...',
        result: '識別結果',
        copy: '複製',
        copied: '已複製！',
        error: '錯誤',
        grounding_desc: '分析圖片佈局',
        free_ocr_desc: '自由 OCR 識別',
        parse_figure_desc: '解析圖表內容',
        extract_text_desc: '提取圖片中的所有文字',
        markdown_desc: '將文件轉換為 Markdown 格式',
        change_image: '更換圖片',
        locate_object: '定位物件',
        locate_placeholder: '輸入關鍵字以定位...',
        locate_btn: '定位',
        render_table: '渲染為表格',
        hide_table: '隱藏表格',
    }
};

export function useI18n() {
    const [lang, setLang] = useState<Language>(() => {
        const saved = localStorage.getItem('lang');
        return (saved as Language) || 'en';
    });

    const t = translations[lang];

    const toggleLang = () => {
        const nextLang = lang === 'en' ? 'zh-TW' : 'en';
        setLang(nextLang);
        localStorage.setItem('lang', nextLang);
    };

    return { lang, t, toggleLang };
}
