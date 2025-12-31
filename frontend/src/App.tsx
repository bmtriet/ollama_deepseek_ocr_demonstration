import { useState, useMemo } from 'react';
import {
  Scan,
  FileText,
  BarChart3,
  Languages,
  Copy,
  Check,
  Loader2,
  FileCode,
  Layout,
  Github,
  Eye,
  EyeOff,
  LayoutTemplate,
  Type,
  ChevronsLeft,
  ChevronsRight,
  Columns
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { ImageUploader } from './components/ImageUploader';
import { useI18n } from './lib/i18n';
import { performOCR, OCR_PROMPTS, parseGrounding, type GroundingBox } from './lib/api';
import { motion } from 'framer-motion';
import { ConnectionLine } from './components/ConnectionLine';

function App() {
  const { lang, t, toggleLang } = useI18n();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [result, setResult] = useState<string>('');
  const [boxes, setBoxes] = useState<GroundingBox[]>([]);
  const [showBoxes, setShowBoxes] = useState(true);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showHtml, setShowHtml] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [backendImage, setBackendImage] = useState<string | null>(null);
  const [useBackendImage, setUseBackendImage] = useState(false);
  const [locateKeyword, setLocateKeyword] = useState('');
  const [layoutMode, setLayoutMode] = useState<'split' | 'image' | 'result'>('split');

  const handleImageSelect = (file: File) => {
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setResult('');
    setBoxes([]);
    setError(null);
  };

  // ... clearImage ...

  const handleLocate = async () => {
    if (!selectedFile || !locateKeyword.trim()) return;

    setLoading(true);
    setResult('');
    setBoxes([]);
    setBackendImage(null);
    setError(null);

    const prompt = `<|grounding|>Locate <|ref|>${locateKeyword}<|/ref|> in the image.`;

    try {
      const response = await performOCR(selectedFile, prompt);
      setResult(response.text);

      if (response.processed_image) {
        setBackendImage(`data:image/png;base64,${response.processed_image}`);
      }

      const parsedBoxes = parseGrounding(response.text);
      setBoxes(parsedBoxes);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const clearImage = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setResult('');
    setBoxes([]);
    setBackendImage(null);
    setError(null);
    setLayoutMode('split');
  };

  const handleOCR = async (task: keyof typeof OCR_PROMPTS) => {
    if (!selectedFile) return;

    setLoading(true);
    setResult('');
    setBoxes([]);
    setBackendImage(null);
    setError(null);

    // Auto-switch to result view on mobile or if needed, but keeping split is safer
    if (window.innerWidth < 1024) {
      // logic for mobile if needed
    }

    try {
      const response = await performOCR(selectedFile, OCR_PROMPTS[task]);
      setResult(response.text);

      // Store backend-drawn image if returned
      if (response.processed_image) {
        setBackendImage(`data:image/png;base64,${response.processed_image}`);
      }

      const parsedBoxes = parseGrounding(response.text);
      setBoxes(parsedBoxes);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const renderResult = useMemo(() => {
    if (!result) return null;

    // Pattern for <|ref|>...<|/ref|><|det|>...<|/det|> OR [[...]]<|/det|> OR [[...]]
    // Updated to be more permissive for nested arrays: [[...]]
    const regex = /(<\|ref\|>.*?<\|\/ref\|><\|det\|>\[\[.*?\]\]<\|\/det\|>|\[\[.*?\]\]<\|\/det\|>|\[\[\d+,\s*\d+,\s*\d+,\s*\d+\]\])/g;
    const parts = result.split(regex);

    return parts.map((part, i) => {
      // Find all boxes that map to this raw text segment
      const matchingBoxes = boxes.filter(b => b.raw === part);

      if (matchingBoxes.length > 0) {
        return (
          <span key={`group-${i}`} className="inline-flex flex-wrap gap-1 mx-1 align-middle">
            {matchingBoxes.map((box) => {
              const boxIndex = boxes.indexOf(box) + 1;
              const isHighlighted = highlightedId === box.id;

              return (
                <span
                  key={box.id}
                  id={`text-chip-${box.id}`}
                  onMouseEnter={() => setHighlightedId(box.id)}
                  onMouseLeave={() => setHighlightedId(null)}
                  className={`
                    inline-flex items-center gap-1 px-1.5 py-0.5 rounded cursor-help transition-all duration-200 font-sans
                    ${isHighlighted
                      ? 'bg-yellow-400 text-black shadow-lg shadow-yellow-400/20'
                      : 'bg-green-500/20 text-green-300 hover:bg-green-500/40 border border-green-500/30'}
                  `}
                >
                  <span className="text-[10px] font-bold opacity-80">{boxIndex}</span>
                  <span className="font-medium text-[13px]">{box.text}</span>
                </span>
              );
            })}
          </span>
        );
      }
      return <span key={i} className="whitespace-pre-wrap">{part}</span>;
    });
  }, [result, boxes, highlightedId]);

  const tasks = [
    { id: 'grounding', icon: Layout, label: t.grounding, desc: t.grounding_desc },
    { id: 'free_ocr', icon: Scan, label: t.free_ocr, desc: t.free_ocr_desc },
    { id: 'parse_figure', icon: BarChart3, label: t.parse_figure, desc: t.parse_figure_desc },
    { id: 'extract_text', icon: FileText, label: t.extract_text, desc: t.extract_text_desc },
    { id: 'markdown', icon: FileCode, label: t.markdown, desc: t.markdown_desc },
  ] as const;

  const gridClass = useMemo(() => {
    switch (layoutMode) {
      case 'image': return 'lg:grid-cols-[1fr_auto_0px]';
      case 'result': return 'lg:grid-cols-[0px_auto_1fr]';
      default: return 'lg:grid-cols-[1.2fr_auto_0.8fr]';
    }
  }, [layoutMode]);

  return (
    <div className="h-screen fixed inset-0 flex flex-col overflow-hidden bg-slate-950 font-sans text-slate-200">
      <ConnectionLine
        fromId={highlightedId ? `text-chip-${highlightedId}` : null}
        toId={highlightedId ? `box-highlighted-${highlightedId}` : null}
        visible={!!highlightedId}
      />
      {/* Background Orbs */}
      <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary-600/20 rounded-full blur-[120px] -z-10 animate-pulse" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/10 rounded-full blur-[120px] -z-10" />

      {/* Header */}
      <nav className="border-b border-white/5 bg-slate-950/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex items-center justify-center shadow-lg shadow-primary-500/20">
              <Scan className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold font-['Outfit'] tracking-tight text-white">{t.title}</h1>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                <span className="text-[10px] text-slate-400 font-medium uppercase tracking-widest">Model Online</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={toggleLang}
              className="btn-secondary text-sm py-1.5"
            >
              <Languages size={16} />
              {lang === 'en' ? '繁體中文' : 'English'}
            </button>
            <a href="https://ollama.com/library/deepseek-ocr" target="_blank" rel="noreferrer" className="text-slate-400 hover:text-white transition-colors">
              <Github size={20} />
            </a>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-grow flex flex-col px-4 pb-4 overflow-hidden max-w-none w-full">
        <div className="text-center mb-4">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-2xl font-extrabold text-white bg-clip-text text-transparent bg-gradient-to-b from-white to-slate-400"
          >
            {t.subtitle}
          </motion.h2>
        </div>

        <div className={`flex-grow grid grid-cols-1 ${gridClass} gap-4 h-full min-h-0 items-stretch transition-all duration-300 ease-in-out`}>
          {/* Left Column: Image Area */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className={`flex flex-col gap-4 h-full min-h-0 ${layoutMode === 'result' ? 'hidden lg:hidden' : ''}`}
          >
            <div className="glass-card flex-grow relative overflow-hidden flex flex-col bg-slate-900/30 border border-white/10 rounded-2xl">
              <ImageUploader
                onImageSelect={handleImageSelect}
                selectedImage={useBackendImage && backendImage ? backendImage : previewUrl}
                onClear={clearImage}
                boxes={useBackendImage ? [] : boxes}
                showBoxes={useBackendImage ? false : showBoxes}
                highlightedId={useBackendImage ? null : highlightedId}
              />

              {boxes.length > 0 && (
                <div className="absolute bottom-4 left-4 flex gap-2 z-30">
                  <button
                    onClick={() => setShowBoxes(!showBoxes)}
                    className="btn-secondary blur-none backdrop-blur-md bg-slate-900/80 text-xs py-1.5"
                  >
                    {showBoxes ? <EyeOff size={14} /> : <Eye size={14} />}
                    {showBoxes ? 'Hide Labels' : 'Show Labels'}
                  </button>

                  {backendImage && (
                    <button
                      onClick={() => setUseBackendImage(!useBackendImage)}
                      className={`btn-secondary blur-none backdrop-blur-md text-xs py-1.5 ${useBackendImage ? 'bg-primary-500/20 border-primary-500/40' : 'bg-slate-900/80'}`}
                      title={useBackendImage ? 'Show Interactive Overlay' : 'Show Backend Image'}
                    >
                      <LayoutTemplate size={14} />
                      {useBackendImage ? 'Overlay' : 'Drawn'}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-3 shrink-0">
              <div className="flex gap-2">
                <div className="relative flex-grow group">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Eye className="h-4 w-4 text-slate-500 group-focus-within:text-primary-400 transition-colors" />
                  </div>
                  <input
                    type="text"
                    value={locateKeyword}
                    onChange={(e) => setLocateKeyword(e.target.value)}
                    placeholder={t.locate_placeholder}
                    disabled={!selectedFile || loading}
                    onKeyDown={(e) => e.key === 'Enter' && handleLocate()}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-9 pr-3 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-primary-500/50 focus:bg-primary-500/5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
                <button
                  onClick={handleLocate}
                  disabled={!selectedFile || loading || !locateKeyword.trim()}
                  className="btn-secondary whitespace-nowrap px-4 py-2 hover:bg-primary-500/20 hover:border-primary-500/40 hover:text-primary-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {t.locate_btn}
                </button>
              </div>

              <div className="grid grid-cols-5 gap-2">
                {tasks.map((task) => (
                  <button
                    key={task.id}
                    disabled={!selectedFile || loading}
                    onClick={() => handleOCR(task.id as any)}
                    className={`
                      flex flex-col items-center justify-center p-2 rounded-xl border transition-all duration-300 gap-1
                      ${!selectedFile ? 'opacity-50 cursor-not-allowed border-white/5 bg-white/5' : 'hover:scale-[1.02] active:scale-95'}
                      ${loading ? 'cursor-wait' : ''}
                      bg-white/5 border-white/10 hover:border-primary-500/50 hover:bg-primary-500/10 group
                    `}
                  >
                    <task.icon className={`w-5 h-5 ${!selectedFile ? 'text-slate-500' : 'text-primary-400 group-hover:text-primary-300'}`} />
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 group-hover:text-slate-200 hidden sm:block">{task.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Control Bar */}
          <div className="hidden lg:flex flex-col items-center justify-center gap-4">
            <button
              onClick={() => setLayoutMode('image')}
              className={`p-2 rounded-lg transition-all ${layoutMode === 'image' ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/30' : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'}`}
              title="Maximize Image"
            >
              <ChevronsRight size={18} />
            </button>
            <button
              onClick={() => setLayoutMode('split')}
              className={`p-2 rounded-lg transition-all ${layoutMode === 'split' ? 'bg-primary-500/80 text-white' : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'}`}
              title="Split View"
            >
              <Columns size={18} />
            </button>
            <button
              onClick={() => setLayoutMode('result')}
              className={`p-2 rounded-lg transition-all ${layoutMode === 'result' ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/30' : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'}`}
              title="Maximize Result"
            >
              <ChevronsLeft size={18} />
            </button>
          </div>

          {/* Right Column: Results */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className={`h-full flex flex-col min-h-0 ${layoutMode === 'image' ? 'hidden lg:hidden' : ''}`}
          >
            <div className="glass-card flex-grow flex flex-col relative overflow-hidden bg-slate-900/50 border border-white/10 rounded-2xl">
              <div className="flex items-center justify-between mb-0 border-b border-white/10 p-4 shrink-0 bg-slate-950/30">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-primary-500/10 text-primary-400">
                    <FileText size={16} />
                  </div>
                  <h3 className="font-bold text-white text-sm">{t.result}</h3>
                </div>

                <div className="flex items-center gap-2">
                  {result && (
                    <button
                      onClick={() => setShowHtml(!showHtml)}
                      className={`btn-secondary py-1 px-2.5 text-xs transition-colors ${showHtml ? 'bg-primary-500/20 border-primary-500/40 text-primary-300' : ''}`}
                      title={showHtml ? 'Show Text' : 'Show Preview'}
                    >
                      {showHtml ? <Type size={14} /> : <LayoutTemplate size={14} />}
                      {showHtml ? 'Text' : 'Preview'}
                    </button>
                  )}
                  {result && (
                    <button
                      onClick={copyToClipboard}
                      className="btn-secondary py-1 px-2.5 text-xs"
                    >
                      {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                      {copied ? t.copied : t.copy}
                    </button>
                  )}
                </div>
              </div>

              <div className="flex-grow overflow-auto custom-scrollbar relative p-4">
                {loading ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-slate-900/50 backdrop-blur-sm z-10">
                    <Loader2 className="w-10 h-10 text-primary-500 animate-spin" />
                    <p className="text-primary-400 font-medium animate-pulse">{t.processing}</p>
                  </div>
                ) : result ? (
                  <div className={`animate-fade-in ${showHtml ? 'prose-custom max-w-none' : 'text-sm font-mono text-slate-300 leading-relaxed'}`}>
                    {showHtml ? (
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        rehypePlugins={[rehypeRaw]}
                      >
                        {result.replace(/<\|ref\|>.*?<\|det\|>/g, '')}
                      </ReactMarkdown>
                    ) : (
                      renderResult
                    )}
                  </div>
                ) : error ? (
                  <div className="text-red-400 p-4 border border-red-500/20 bg-red-500/5 rounded-lg flex items-center gap-2">
                    <span className="font-bold">!</span> {error}
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-4 opacity-50">
                    <div className="p-4 border-2 border-dashed border-slate-700 rounded-full">
                      <Scan size={32} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </main>

      {/* Footer - Hidden to maximize space
      <footer className="max-w-7xl mx-auto px-6 py-8 mt-12 border-t border-white/5 text-center">
        <p className="text-slate-500 text-sm">
          Powered by DeepSeek-OCR & Ollama
        </p>
      </footer>
      */}
    </div>
  );
}

export default App;
