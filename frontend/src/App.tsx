import { useState, useMemo, useEffect, useCallback } from 'react';
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
  ChevronsLeft,
  ChevronsRight,
  Columns,
  Edit3,
  X,
  RotateCcw,
  ChevronUp,
  ChevronDown
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { ImageUploader } from './components/ImageUploader';
import { useI18n } from './lib/i18n';
import { performOCR, OCR_PROMPTS, parseGrounding, type GroundingBox } from './lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import { ConnectionLine } from './components/ConnectionLine';

// Helper function to decode HTML entities
const decodeHtmlEntities = (text: string): string => {
  const textarea = document.createElement('textarea');
  textarea.innerHTML = text;
  return textarea.value;
};

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
  const [focusedBoxId, setFocusedBoxId] = useState<{ id: string, ts: number } | null>(null);
  const [renderedBoxIds, setRenderedBoxIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [locateKeyword, setLocateKeyword] = useState('');
  const [layoutMode, setLayoutMode] = useState<'split' | 'image' | 'result'>('split');
  const [customPrompts, setCustomPrompts] = useState<Record<string, string>>({});
  const [editingTask, setEditingTask] = useState<string | null>(null);
  const [editPromptValue, setEditPromptValue] = useState('');

  // Load custom prompts from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('deepseek-custom-prompts');
    if (saved) {
      try {
        setCustomPrompts(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load custom prompts:', e);
      }
    }
  }, []);

  // Scroll to focused item
  useEffect(() => {
    if (focusedBoxId) {
      const element = document.getElementById(`text-chip-container-${focusedBoxId.id}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }, [focusedBoxId]);

  // Save custom prompts to localStorage
  const saveCustomPrompt = (taskId: string, prompt: string) => {
    const updated = { ...customPrompts, [taskId]: prompt };
    setCustomPrompts(updated);
    localStorage.setItem('deepseek-custom-prompts', JSON.stringify(updated));
  };

  const resetPrompt = (taskId: string) => {
    const updated = { ...customPrompts };
    delete updated[taskId];
    setCustomPrompts(updated);
    localStorage.setItem('deepseek-custom-prompts', JSON.stringify(updated));
  };

  const getPrompt = (taskId: keyof typeof OCR_PROMPTS): string => {
    return customPrompts[taskId] || OCR_PROMPTS[taskId];
  };

  const clearImage = useCallback(() => {
    setSelectedFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setResult('');
    setBoxes([]);
    setError(null);
    setLayoutMode('split');
  }, [previewUrl]);

  const handleImageSelect = (file: File) => {
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setResult('');
    setBoxes([]);
    setError(null);
  };

  const handleLocate = async () => {
    if (!selectedFile || !locateKeyword.trim()) return;

    setLoading(true);
    setResult('');
    setBoxes([]);
    setError(null);

    const prompt = `<|grounding|>Locate <|ref|>${locateKeyword}<|/ref|> in the image.`;

    try {
      const response = await performOCR(selectedFile, prompt);
      setResult(response.text);

      const parsedBoxes = parseGrounding(response.text);
      setBoxes(parsedBoxes);

      // Main switch for the whole result display
      if (response.text.includes('<table')) {
        setShowHtml(false); // Default to Section View when tables exist
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleOCR = async (task: keyof typeof OCR_PROMPTS) => {
    if (!selectedFile) return;

    setLoading(true);
    setResult('');
    setBoxes([]);
    setError(null);

    try {
      const response = await performOCR(selectedFile, getPrompt(task));
      setResult(response.text);

      const parsedBoxes = parseGrounding(response.text);
      setBoxes(parsedBoxes);

      // Default to "Section View" (showHtml = false) when grounding boxes are present
      if (parsedBoxes.length > 0) {
        setShowHtml(false);
      }
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

  const handleNavigate = (direction: 'up' | 'down') => {
    if (boxes.length === 0) return;

    let currentIndex = -1;
    if (highlightedId) {
      currentIndex = boxes.findIndex(b => b.id === highlightedId);
    } else if (focusedBoxId) {
      currentIndex = boxes.findIndex(b => b.id === focusedBoxId.id);
    }

    let nextIndex;
    if (direction === 'up') {
      nextIndex = currentIndex <= 0 ? boxes.length - 1 : currentIndex - 1;
    } else {
      nextIndex = currentIndex >= boxes.length - 1 ? 0 : currentIndex + 1;
    }

    const nextBox = boxes[nextIndex];
    setHighlightedId(nextBox.id);
    setFocusedBoxId({ id: nextBox.id, ts: Date.now() });
  };

  const renderResult = useMemo(() => {
    if (!result) return null;

    const regex = /(<\|ref\|>.*?<\|\/ref\|><\|det\|>\[\[.*?\]\]<\|\/det\|>|<\|ref\|>.*?<\|det\|>\[\[.*?\]\]|\[\[.*?\]\]<\|\/det\|>|\[\[\d+,\s*\d+,\s*\d+,\s*\d+\]\])/g;
    const parts = result.split(regex);

    return (
      <div className="flex flex-col gap-1">
        {parts.map((part, i) => {
          const matchingBoxes = boxes.filter(b => b.raw === part);

          if (matchingBoxes.length > 0) {
            return (
              <div key={`group-${i}`} className="flex flex-col gap-1">
                {matchingBoxes.map((box) => {
                  const boxIndex = boxes.indexOf(box) + 1;
                  const isHighlighted = highlightedId === box.id;
                  const text = box.text.toLowerCase();
                  const isTable = text.includes('<table') || text.includes('&lt;table');
                  const isRendered = renderedBoxIds.has(box.id);

                  const toggleRender = (e: React.MouseEvent) => {
                    e.stopPropagation();
                    setRenderedBoxIds(prev => {
                      const next = new Set(prev);
                      if (next.has(box.id)) next.delete(box.id);
                      else next.add(box.id);
                      return next;
                    });
                  };

                  return (
                    <div
                      key={box.id}
                      id={`text-chip-container-${box.id}`}
                      className={`flex flex-col gap-2 p-2 rounded-xl transition-all duration-300 ${isHighlighted ? 'bg-primary-500/5 ring-1 ring-primary-500/20 shadow-lg shadow-primary-500/5' : ''}`}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          id={`text-chip-${box.id}`}
                          onMouseEnter={() => setHighlightedId(box.id)}
                          onMouseLeave={() => setHighlightedId(null)}
                          onClick={() => setFocusedBoxId({ id: box.id, ts: Date.now() })}
                          className={`
                            inline-flex items-center gap-1 px-1.5 py-0.5 rounded cursor-pointer transition-all duration-200 font-sans active:scale-95
                            ${isHighlighted
                              ? 'bg-yellow-400 text-black shadow-lg shadow-yellow-400/20'
                              : 'bg-green-500/20 text-green-300 hover:bg-green-500/40 border border-green-500/30'}
                          `}
                        >
                          <span className="text-[10px] font-bold opacity-80">{boxIndex}</span>
                          <span className="font-medium text-[13px]">
                            {isTable ? 'Table Output' : box.text}
                          </span>
                        </span>

                        {isTable && (
                          <button
                            onClick={toggleRender}
                            className={`text-[10px] px-2 py-0.5 rounded border transition-all h-6 flex items-center gap-1 font-bold uppercase tracking-wider
                              ${isRendered
                                ? 'bg-primary-500/20 border-primary-500/40 text-primary-300 hover:bg-primary-500/30'
                                : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'}`}
                          >
                            {isRendered ? <FileText size={12} /> : <FileCode size={12} />}
                            {isRendered ? t.hide_table : t.render_table}
                          </button>
                        )}
                      </div>

                      {isTable && isRendered && (
                        <div className="transition-all duration-300">
                          <div className="prose-custom prose-invert max-w-none overflow-x-auto bg-slate-900/50 rounded-lg border border-white/5 p-4 shadow-inner ring-1 ring-white/5">
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              rehypePlugins={[rehypeRaw]}
                            >
                              {decodeHtmlEntities(box.text)}
                            </ReactMarkdown>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          }
          return <span key={i} className="whitespace-pre-wrap px-2 text-slate-400 text-sm italic">{part}</span>;
        })}
      </div>
    );
  }, [result, boxes, highlightedId, renderedBoxIds]);

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

      {/* Prompt Editor Modal */}
      <AnimatePresence>
        {editingTask && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-white/10 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col"
            >
              <div className="flex items-center justify-between p-6 border-b border-white/10">
                <div>
                  <h3 className="text-lg font-bold text-white">Edit Prompt</h3>
                  <p className="text-sm text-slate-400 mt-1">
                    Customize the prompt for {tasks.find(t => t.id === editingTask)?.label}
                  </p>
                </div>
                <button
                  onClick={() => setEditingTask(null)}
                  className="p-2 rounded-lg hover:bg-white/5 transition-colors"
                >
                  <X size={20} className="text-slate-400" />
                </button>
              </div>

              <div className="flex-grow overflow-y-auto p-6 space-y-4">
                <textarea
                  value={editPromptValue}
                  onChange={(e) => setEditPromptValue(e.target.value)}
                  className="w-full h-32 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-primary-500/50 focus:bg-primary-500/5 transition-all resize-none font-mono text-sm"
                  placeholder="Enter your custom prompt..."
                />
                <div className="bg-slate-800/50 border border-white/5 rounded-xl p-4">
                  <p className="text-xs text-slate-400 mb-2">Default Prompt:</p>
                  <code className="text-xs text-slate-300 font-mono">
                    {OCR_PROMPTS[editingTask as keyof typeof OCR_PROMPTS]}
                  </code>
                </div>
              </div>

              <div className="flex items-center justify-between p-6 border-t border-white/10 bg-slate-950/50">
                <button
                  onClick={() => {
                    resetPrompt(editingTask);
                    setEditPromptValue(OCR_PROMPTS[editingTask as keyof typeof OCR_PROMPTS]);
                  }}
                  className="btn-secondary text-sm py-2 px-4 flex items-center gap-2"
                >
                  <RotateCcw size={14} />
                  Reset
                </button>
                <div className="flex gap-2">
                  <button onClick={() => setEditingTask(null)} className="btn-secondary text-sm py-2 px-4">Cancel</button>
                  <button
                    onClick={() => {
                      saveCustomPrompt(editingTask, editPromptValue);
                      setEditingTask(null);
                    }}
                    className="bg-primary-500 hover:bg-primary-600 text-white font-medium text-sm py-2 px-4 rounded-xl transition-colors"
                  >
                    Save
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary-600/20 rounded-full blur-[120px] -z-10 animate-pulse" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/10 rounded-full blur-[120px] -z-10" />

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
            <button onClick={toggleLang} className="btn-secondary text-sm py-1.5">
              <Languages size={16} />
              {lang === 'en' ? '繁體中文' : 'English'}
            </button>
            <a href="https://ollama.com/library/deepseek-ocr" target="_blank" rel="noreferrer" className="text-slate-400 hover:text-white transition-colors">
              <Github size={20} />
            </a>
          </div>
        </div>
      </nav>

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
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className={`flex flex-col gap-4 h-full min-h-0 ${layoutMode === 'result' ? 'hidden lg:hidden' : ''}`}
          >
            <div className="glass-card flex-grow relative overflow-hidden flex flex-col bg-slate-900/30 border border-white/10 rounded-2xl">
              <ImageUploader
                onImageSelect={handleImageSelect}
                selectedImage={previewUrl}
                onClear={clearImage}
                boxes={boxes}
                showBoxes={showBoxes}
                highlightedId={highlightedId}
                focusedBoxId={focusedBoxId}
              />
              {boxes.length > 0 && (
                <div className="absolute bottom-4 left-4 flex gap-2 z-30">
                  <button onClick={() => setShowBoxes(!showBoxes)} className="btn-secondary blur-none backdrop-blur-md bg-slate-900/80 text-xs py-1.5">
                    {showBoxes ? <EyeOff size={14} /> : <Eye size={14} />}
                    {showBoxes ? 'Hide Labels' : 'Show Labels'}
                  </button>
                </div>
              )}
            </div>

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
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-9 pr-3 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-primary-500/50 focus:bg-primary-500/5 transition-all disabled:opacity-50"
                  />
                </div>
                <button onClick={handleLocate} disabled={!selectedFile || loading || !locateKeyword.trim()} className="btn-secondary whitespace-nowrap px-4 py-2 hover:bg-primary-500/20">
                  {t.locate_btn}
                </button>
              </div>

              <div className="grid grid-cols-5 gap-2">
                {tasks.map((task) => (
                  <div key={task.id} className="relative group/task">
                    <button
                      disabled={!selectedFile || loading}
                      onClick={() => handleOCR(task.id as any)}
                      className={`w-full flex flex-col items-center justify-center p-2 rounded-xl border transition-all duration-300 gap-1 bg-white/5 border-white/10 hover:border-primary-500/50 hover:bg-primary-500/10 group ${!selectedFile ? 'opacity-50 cursor-not-allowed' : 'hover:scale-[1.02] active:scale-95'}`}
                    >
                      <task.icon className={`w-5 h-5 ${!selectedFile ? 'text-slate-500' : 'text-primary-400 group-hover:text-primary-300'}`} />
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 group-hover:text-slate-200 hidden sm:block">{task.label}</span>
                    </button>
                    <button onClick={() => { setEditingTask(task.id); setEditPromptValue(getPrompt(task.id as any)); }} className="absolute -top-1 -right-1 p-1 rounded-md bg-slate-800 border border-white/10 opacity-0 group-hover/task:opacity-100 transition-opacity hover:bg-slate-700">
                      <Edit3 size={12} className="text-slate-400" />
                    </button>
                    {customPrompts[task.id] && <div className="absolute -top-1 -left-1 w-2 h-2 bg-primary-500 rounded-full" />}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          <div className="hidden lg:flex flex-col items-center justify-center gap-4">
            <button onClick={() => setLayoutMode('image')} className={`p-2 rounded-lg transition-all ${layoutMode === 'image' ? 'bg-primary-500 text-white shadow-lg' : 'bg-white/5 text-slate-400'}`}><ChevronsRight size={18} /></button>
            <button onClick={() => setLayoutMode('split')} className={`p-2 rounded-lg transition-all ${layoutMode === 'split' ? 'bg-primary-500/80 text-white' : 'bg-white/5 text-slate-400'}`}><Columns size={18} /></button>
            <button onClick={() => setLayoutMode('result')} className={`p-2 rounded-lg transition-all ${layoutMode === 'result' ? 'bg-primary-500 text-white shadow-lg' : 'bg-white/5 text-slate-400'}`}><ChevronsLeft size={18} /></button>
          </div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className={`h-full flex flex-col min-h-0 ${layoutMode === 'image' ? 'hidden lg:hidden' : ''}`}
          >
            <div className="glass-card flex-grow flex flex-col relative overflow-hidden bg-slate-900/50 border border-white/10 rounded-2xl">
              <div className="flex items-center justify-between border-b border-white/10 p-4 shrink-0 bg-slate-950/30">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-primary-500/10 text-primary-400"><FileText size={16} /></div>
                  <h3 className="font-bold text-white text-sm">{t.result}</h3>
                </div>
                <div className="flex items-center gap-2">
                  {result && (
                    <button
                      onClick={() => setShowHtml(!showHtml)}
                      className={`btn-secondary py-1 px-2.5 text-xs transition-colors ${showHtml ? 'bg-primary-500/20 border-primary-500/40 text-primary-300' : ''}`}
                    >
                      {showHtml ? <LayoutTemplate size={14} /> : <FileCode size={14} />}
                      {showHtml ? 'Switch to Section View' : 'Switch to Raw Output'}
                    </button>
                  )}
                  {boxes.length > 0 && !showHtml && (
                    <div className="flex items-center gap-1 border-l border-white/10 pl-2">
                      <button onClick={() => handleNavigate('up')} className="p-1.5 rounded-lg bg-white/5 text-slate-400 hover:text-white transition-all"><ChevronUp size={16} /></button>
                      <button onClick={() => handleNavigate('down')} className="p-1.5 rounded-lg bg-white/5 text-slate-400 hover:text-white transition-all"><ChevronDown size={16} /></button>
                    </div>
                  )}
                  {result && (
                    <button onClick={copyToClipboard} className="btn-secondary py-1 px-2.5 text-xs">
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
                  <div className={`animate-fade-in ${showHtml ? 'text-sm font-mono text-slate-300 whitespace-pre-wrap break-all p-2' : ''}`}>
                    {showHtml ? (
                      <div className="bg-black/20 rounded-lg p-4 border border-white/5 ring-1 ring-white/5">
                        {result}
                      </div>
                    ) : (
                      renderResult
                    )}
                  </div>
                ) : error ? (
                  <div className="text-red-400 p-4 border border-red-500/20 bg-red-500/5 rounded-lg flex items-center gap-2"><span className="font-bold">!</span> {error}</div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-4 opacity-50">
                    <div className="p-4 border-2 border-dashed border-slate-700 rounded-full"><Scan size={32} /></div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  );
}

export default App;
