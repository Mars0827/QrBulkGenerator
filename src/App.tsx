/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo } from "react";
import { 
  QrCode, 
  Download, 
  Trash2, 
  Plus, 
  FileArchive, 
  Info,
  Settings,
  LayoutGrid,
  AlertCircle,
  X,
  ArrowRight,
  Sparkles,
  Zap,
  Layers,
  CheckCircle2,
  Palette,
  MessageSquare,
  Send,
  Mail,
  GripVertical,
  Type
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import QRCode from "qrcode";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface Column {
  id: string;
  label: string;
  values: string;
}

interface TemplateBlock {
  id: string;
  type: 'column' | 'text' | 'newline' | 'space';
  value: string;
}

interface QRCodeItem {
  id: string;
  data: string;
  filename: string;
  qrDataUrl: string;
}

type QRStyle = "black-on-white" | "white-on-black" | "white-transparent";

function SortableBlock({ id, block, onRemove, onUpdate }: { id: string, block: TemplateBlock, onRemove: (id: string) => void, onUpdate: (id: string, value: string) => void, key?: string }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
  };

  const getIcon = () => {
    switch (block.type) {
      case 'column': return <Layers className="w-3 h-3" />;
      case 'space': return <span className="text-[10px] font-bold">SP</span>;
      case 'newline': return <ArrowRight className="w-3 h-3 rotate-90" />;
      case 'text': return <Type className="w-3 h-3" />;
      default: return null;
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 px-3 py-2 bg-white border rounded-xl shadow-sm transition-all ${
        isDragging ? "border-zinc-900 shadow-xl scale-105 opacity-50" : "border-zinc-200 hover:border-zinc-300"
      }`}
    >
      <div {...attributes} {...listeners} className="p-1 bg-zinc-50 rounded-md text-zinc-400 cursor-grab active:cursor-grabbing">
        <GripVertical className="w-3 h-3" />
      </div>
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <div className="p-1 bg-zinc-100 rounded text-zinc-600">
          {getIcon()}
        </div>
        {block.type === 'text' ? (
          <input 
            type="text"
            value={block.value}
            onChange={(e) => onUpdate(id, e.target.value)}
            className="text-xs font-bold text-zinc-700 bg-transparent border-none p-0 focus:ring-0 w-full"
            placeholder="Edit text..."
          />
        ) : (
          <span className="text-xs font-bold text-zinc-700 truncate">
            {block.value}
          </span>
        )}
      </div>
      <button 
        onClick={() => onRemove(id)}
        className="p-1 text-zinc-300 hover:text-red-500 transition-colors"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

export default function App() {
  const [view, setView] = useState<"landing" | "app">("landing");
  
  // Configuration State
  const [columns, setColumns] = useState<Column[]>([
    { id: "1", label: "Name", values: "" },
    { id: "2", label: "ID", values: "" }
  ]);
  const [filenameTemplate, setFilenameTemplate] = useState("{{Name}}_QR");
  const [qrStyle, setQrStyle] = useState<QRStyle>("black-on-white");
  const [templateBlocks, setTemplateBlocks] = useState<TemplateBlock[]>([
    { id: 'initial-1', type: 'column', value: 'Name' },
    { id: 'initial-2', type: 'space', value: 'Space' },
    { id: 'initial-3', type: 'column', value: 'ID' }
  ]);
  
  // Suggestion State
  const [suggestion, setSuggestion] = useState("");
  const [showSuggestionForm, setShowSuggestionForm] = useState(false);

  // Session State
  const [qrItems, setQrItems] = useState<QRCodeItem[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setTemplateBlocks((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const addBlock = (type: TemplateBlock['type'], value: string) => {
    const newId = Math.random().toString(36).substr(2, 9);
    setTemplateBlocks([...templateBlocks, { id: newId, type, value }]);
  };

  const removeBlock = (id: string) => {
    setTemplateBlocks(templateBlocks.filter(b => b.id !== id));
  };

  const updateBlock = (id: string, value: string) => {
    setTemplateBlocks(templateBlocks.map(b => b.id === id ? { ...b, value } : b));
  };

  const addColumn = () => {
    const newId = Math.random().toString(36).substr(2, 9);
    setColumns([...columns, { id: newId, label: `Column ${columns.length + 1}`, values: "" }]);
  };

  const removeColumn = (id: string) => {
    if (columns.length <= 1) return;
    setColumns(columns.filter(c => c.id !== id));
  };

  const updateColumn = (id: string, field: keyof Column, value: string) => {
    setColumns(columns.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  const generateSession = async () => {
    setError(null);
    setWarning(null);
    setIsGenerating(true);
    
    const parsedColumns = columns.map(col => ({
      ...col,
      list: col.values.split("\n").map(v => v.trim()).filter(v => v !== "")
    }));

    const lengths = parsedColumns.map(c => c.list.length);
    const maxLength = Math.max(...lengths);

    if (maxLength === 0) {
      setError("Please enter data in at least one column.");
      setIsGenerating(false);
      return;
    }

    if (new Set(lengths).size > 1) {
      setWarning("Column lengths do not match. Some QR codes may have missing data.");
    }

    try {
      const newItems: QRCodeItem[] = [];

      // QR Color Mapping
      let darkColor = "#000000";
      let lightColor = "#FFFFFF";

      if (qrStyle === "white-on-black") {
        darkColor = "#FFFFFF";
        lightColor = "#000000";
      } else if (qrStyle === "white-transparent") {
        darkColor = "#FFFFFF";
        lightColor = "#00000000";
      }

      for (let i = 0; i < maxLength; i++) {
        const rowData: Record<string, string> = {};
        parsedColumns.forEach(col => {
          rowData[col.label] = col.list[i] || "";
        });

        let qrContent = "";
        templateBlocks.forEach(block => {
          if (block.type === 'column') {
            qrContent += rowData[block.value] || "";
          } else if (block.type === 'space') {
            qrContent += " ";
          } else if (block.type === 'newline') {
            qrContent += "\n";
          } else if (block.type === 'text') {
            qrContent += block.value;
          }
        });

        let filename = filenameTemplate;
        parsedColumns.forEach(col => {
          const placeholder = new RegExp(`{{${col.label}}}`, "g");
          filename = filename.replace(placeholder, rowData[col.label]);
        });

        // Implementing specific settings from Python snippet:
        // version=1, error_correction=L, box_size=10 (handled by width), border=4
        const dataUrl = await QRCode.toDataURL(qrContent, {
          errorCorrectionLevel: 'L',
          margin: 4,
          width: 400,
          color: {
            dark: darkColor,
            light: lightColor,
          },
        });

        newItems.push({
          id: Math.random().toString(36).substr(2, 9),
          data: qrContent,
          filename: filename || `QR_${i + 1}`,
          qrDataUrl: dataUrl,
        });

        if (i % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }

      setQrItems(newItems);
    } catch (err) {
      console.error(err);
      setError("Failed to generate QR codes. Check your templates and data.");
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadIndividual = (item: QRCodeItem) => {
    const link = document.createElement("a");
    link.href = item.qrDataUrl;
    link.download = `${item.filename.replace(/[^a-z0-9]/gi, '_')}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadZip = async () => {
    if (qrItems.length === 0) return;

    const zip = new JSZip();
    const folder = zip.folder("QR_Codes");

    qrItems.forEach((item) => {
      const base64Data = item.qrDataUrl.split(",")[1];
      folder?.file(`${item.filename.replace(/[^a-z0-9]/gi, '_')}.png`, base64Data, { base64: true });
    });

    const content = await zip.generateAsync({ type: "blob" });
    saveAs(content, "QR_Session_Export.zip");
  };

  const Footer = () => (
    <footer className="border-t border-zinc-100 py-12 px-8 text-center space-y-4">
      <div className="flex flex-col items-center gap-2">
        <p className="text-zinc-400 text-sm">
          Created by <span className="font-bold text-zinc-900">Mars L. Benitez</span>
        </p>
        <button 
          onClick={() => setShowSuggestionForm(true)}
          className="text-xs font-bold text-zinc-400 hover:text-zinc-900 transition-colors flex items-center gap-1.5"
        >
          <MessageSquare className="w-3 h-3" />
          Have a suggestion?
        </button>
      </div>
      <p className="text-zinc-300 text-[10px] uppercase tracking-widest">© {new Date().getFullYear()} QR Session Manager</p>
    </footer>
  );

  const SuggestionModal = () => (
    <AnimatePresence>
      {showSuggestionForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowSuggestionForm(false)}
            className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl overflow-hidden"
          >
            <div className="p-8 space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-zinc-100 rounded-xl">
                    <Mail className="w-5 h-5 text-zinc-900" />
                  </div>
                  <h3 className="text-xl font-bold text-zinc-900">Send Suggestion</h3>
                </div>
                <button onClick={() => setShowSuggestionForm(false)} className="p-2 hover:bg-zinc-100 rounded-full transition-colors">
                  <X className="w-5 h-5 text-zinc-400" />
                </button>
              </div>
              
              <div className="space-y-4">
                <p className="text-sm text-zinc-500 leading-relaxed">
                  Your feedback helps improve this tool. Your suggestion will be sent directly to Mars L. Benitez.
                </p>
                <textarea 
                  value={suggestion}
                  onChange={(e) => setSuggestion(e.target.value)}
                  className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl text-sm focus:outline-none focus:ring-4 focus:ring-zinc-900/5 focus:border-zinc-900 transition-all resize-none"
                  rows={5}
                  placeholder="Write your suggestion here..."
                />
              </div>

              <button 
                className="w-full py-4 bg-zinc-900 text-white rounded-2xl font-bold text-sm hover:bg-zinc-800 transition-all flex items-center justify-center gap-2 shadow-xl shadow-zinc-200"
                onClick={() => {
                  alert("Thank you! Suggestions are currently UI only, but Mars will see this soon.");
                  setShowSuggestionForm(false);
                  setSuggestion("");
                }}
              >
                <Send className="w-4 h-4" />
                Send Suggestion
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  if (view === "landing") {
    return (
      <div className="min-h-screen bg-white text-zinc-900 font-sans selection:bg-zinc-900 selection:text-white">
        <SuggestionModal />
        <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-md border-b border-zinc-100 px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-zinc-900 rounded-xl shadow-lg shadow-zinc-200">
              <QrCode className="w-6 h-6 text-white" />
            </div>
            <span className="font-bold text-xl tracking-tight">QR Session</span>
          </div>
          <button 
            onClick={() => setView("app")}
            className="px-6 py-2.5 bg-zinc-900 text-white rounded-full font-semibold text-sm hover:bg-zinc-800 transition-all active:scale-95 flex items-center gap-2 shadow-xl shadow-zinc-200"
          >
            Launch App
            <ArrowRight className="w-4 h-4" />
          </button>
        </nav>

        <main className="pt-40 pb-20 px-8 max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-20 items-center">
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              className="space-y-8"
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-zinc-100 rounded-full text-zinc-600 text-xs font-bold uppercase tracking-widest">
                <Sparkles className="w-3 h-3" />
                <span>Next-Gen QR Generation</span>
              </div>
              <h1 className="text-7xl font-bold tracking-tight leading-[1.1] text-zinc-900">
                Bulk QR codes, <br />
                <span className="text-zinc-400 italic font-serif">dynamically</span> mapped.
              </h1>
              <p className="text-xl text-zinc-500 leading-relaxed max-w-lg">
                The ultimate tool for high-volume QR generation. Map dynamic data columns, apply custom templates, and export entire sessions in seconds.
              </p>
              <div className="flex items-center gap-4 pt-4">
                <button 
                  onClick={() => setView("app")}
                  className="px-8 py-4 bg-zinc-900 text-white rounded-2xl font-bold text-lg hover:bg-zinc-800 transition-all active:scale-95 flex items-center gap-3 shadow-2xl shadow-zinc-300"
                >
                  Start New Session
                  <ArrowRight className="w-5 h-5" />
                </button>
                <div className="px-6 py-4 border border-zinc-200 rounded-2xl font-semibold text-zinc-600">
                  Free & Open Source
                </div>
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="relative"
            >
              <div className="aspect-square bg-zinc-50 rounded-[4rem] border border-zinc-100 p-12 flex items-center justify-center relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-zinc-100/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                <QrCode className="w-64 h-64 text-zinc-200 absolute -bottom-10 -right-10 rotate-12" />
                <div className="relative z-10 grid grid-cols-2 gap-6">
                  {[1, 2, 3, 4].map((i) => (
                    <motion.div 
                      key={i}
                      animate={{ 
                        y: [0, -10, 0],
                      }}
                      transition={{ 
                        duration: 4, 
                        repeat: Infinity, 
                        delay: i * 0.5,
                        ease: "easeInOut"
                      }}
                      className="w-32 h-32 bg-white rounded-3xl shadow-2xl shadow-zinc-200 border border-zinc-100 p-4 flex items-center justify-center"
                    >
                      <QrCode className="w-full h-full text-zinc-900" />
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mt-40">
            {[
              { icon: Zap, title: "Instant Generation", desc: "Process hundreds of QR codes in seconds with our optimized async engine." },
              { icon: Layers, title: "Dynamic Mapping", desc: "Add unlimited data columns and map them to custom content templates." },
              { icon: FileArchive, title: "Bulk Export", desc: "Download individual PNGs or bundle your entire session into a single ZIP." }
            ].map((f, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="p-8 bg-zinc-50 rounded-[2.5rem] border border-zinc-100 space-y-4"
              >
                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-zinc-100">
                  <f.icon className="w-6 h-6 text-zinc-900" />
                </div>
                <h3 className="text-xl font-bold text-zinc-900">{f.title}</h3>
                <p className="text-zinc-500 leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </main>

        <Footer />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-zinc-50 text-zinc-900 font-sans selection:bg-zinc-900 selection:text-white">
      <SuggestionModal />
      {/* Sidebar */}
      <aside className="w-96 border-r border-zinc-200 bg-white flex flex-col shadow-sm overflow-hidden">
        <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setView("landing")}>
            <div className="p-2 bg-zinc-900 rounded-lg">
              <QrCode className="w-5 h-5 text-white" />
            </div>
            <h1 className="font-bold text-lg tracking-tight">QR Session</h1>
          </div>
          <button 
            onClick={() => setView("landing")}
            className="p-2 hover:bg-zinc-100 rounded-lg transition-colors text-zinc-400"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-hide">
          {/* Filename Template */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-400 uppercase tracking-[0.2em]">
              <Settings className="w-3 h-3" />
              <span>Filename Template</span>
            </div>
            <div className="space-y-1.5">
              <input 
                type="text" 
                value={filenameTemplate}
                onChange={(e) => setFilenameTemplate(e.target.value)}
                className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-4 focus:ring-zinc-900/5 focus:border-zinc-900 transition-all"
                placeholder="{{Name}}_QR"
              />
              <p className="text-[10px] text-zinc-400">Use {"{{ColumnName}}"} as placeholders</p>
            </div>
          </div>

          {/* QR Style Selection */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-400 uppercase tracking-[0.2em]">
              <Palette className="w-3 h-3" />
              <span>QR Style</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "black-on-white", label: "Classic", bg: "bg-white", dot: "bg-black" },
                { id: "white-on-black", label: "Inverted", bg: "bg-black", dot: "bg-white" },
                { id: "white-transparent", label: "Glass", bg: "bg-zinc-100", dot: "bg-white", border: "border-zinc-200" }
              ].map((style) => (
                <button
                  key={style.id}
                  onClick={() => setQrStyle(style.id as QRStyle)}
                  className={`p-3 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${
                    qrStyle === style.id ? "border-zinc-900 bg-zinc-50" : "border-zinc-100 hover:border-zinc-200"
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg ${style.bg} ${style.border || ""} flex items-center justify-center shadow-sm`}>
                    <div className={`w-4 h-4 rounded-sm ${style.dot}`} />
                  </div>
                  <span className="text-[10px] font-bold text-zinc-600">{style.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Dynamic Columns */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-400 uppercase tracking-[0.2em]">
                <LayoutGrid className="w-3 h-3" />
                <span>Data Columns</span>
              </div>
              <button 
                onClick={addColumn}
                className="p-1.5 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors text-zinc-600"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-6">
              <AnimatePresence mode="popLayout">
                {columns.map((col) => (
                  <motion.div 
                    key={col.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100 space-y-3 relative group"
                  >
                    <div className="flex items-center gap-2">
                      <input 
                        type="text"
                        value={col.label}
                        onChange={(e) => updateColumn(col.id, "label", e.target.value)}
                        className="bg-transparent border-none p-0 text-xs font-bold text-zinc-900 focus:ring-0 w-full"
                        placeholder="Column Label"
                      />
                      {columns.length > 1 && (
                        <button 
                          onClick={() => removeColumn(col.id)}
                          className="p-1 text-zinc-300 hover:text-red-500 transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <textarea 
                      value={col.values}
                      onChange={(e) => updateColumn(col.id, "values", e.target.value)}
                      rows={4}
                      className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-zinc-900/5 focus:border-zinc-900 transition-all resize-none scrollbar-hide"
                      placeholder={`Paste ${col.label}s here...`}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>

          {/* Content Template Builder */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-400 uppercase tracking-[0.2em]">
              <Sparkles className="w-3 h-3" />
              <span>Content Template Builder</span>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-zinc-100/50 border border-zinc-200 rounded-2xl min-h-[100px] space-y-2">
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={templateBlocks.map(b => b.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-2">
                      {templateBlocks.map((block) => (
                        <SortableBlock 
                          key={block.id} 
                          id={block.id} 
                          block={block} 
                          onRemove={removeBlock} 
                          onUpdate={updateBlock}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
                {templateBlocks.length === 0 && (
                  <div className="h-full flex items-center justify-center py-4">
                    <p className="text-[10px] font-bold text-zinc-300 uppercase tracking-widest">Empty Template</p>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Add Blocks</p>
                <div className="flex flex-wrap gap-2">
                  {columns.map(col => (
                    <button
                      key={col.id}
                      onClick={() => addBlock('column', col.label)}
                      className="px-3 py-1.5 bg-white border border-zinc-200 rounded-lg text-[10px] font-bold text-zinc-600 hover:border-zinc-900 hover:text-zinc-900 transition-all flex items-center gap-1.5"
                    >
                      <Layers className="w-3 h-3" />
                      {col.label}
                    </button>
                  ))}
                  <button
                    onClick={() => addBlock('space', 'Space')}
                    className="px-3 py-1.5 bg-white border border-zinc-200 rounded-lg text-[10px] font-bold text-zinc-600 hover:border-zinc-900 hover:text-zinc-900 transition-all flex items-center gap-1.5"
                  >
                    <span className="w-3 h-3 flex items-center justify-center">_</span>
                    Space
                  </button>
                  <button
                    onClick={() => addBlock('newline', 'New Line')}
                    className="px-3 py-1.5 bg-white border border-zinc-200 rounded-lg text-[10px] font-bold text-zinc-600 hover:border-zinc-900 hover:text-zinc-900 transition-all flex items-center gap-1.5"
                  >
                    <ArrowRight className="w-3 h-3 rotate-90" />
                    New Line
                  </button>
                  <button
                    onClick={() => addBlock('text', 'Custom Text')}
                    className="px-3 py-1.5 bg-white border border-zinc-200 rounded-lg text-[10px] font-bold text-zinc-600 hover:border-zinc-900 hover:text-zinc-900 transition-all flex items-center gap-1.5"
                  >
                    <Type className="w-3 h-3" />
                    Text
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-zinc-100 bg-white">
          <button 
            onClick={generateSession}
            disabled={isGenerating}
            className="w-full py-4 bg-zinc-900 text-white rounded-2xl font-bold text-sm hover:bg-zinc-800 active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-zinc-200"
          >
            {isGenerating ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Sparkles className="w-5 h-5" />
            )}
            Generate Session
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-20 border-b border-zinc-200 bg-white px-10 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <h2 className="font-bold text-zinc-900 text-lg">Session Results</h2>
            {qrItems.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-1 bg-zinc-100 text-zinc-600 text-xs font-bold rounded-full">
                <CheckCircle2 className="w-3 h-3" />
                {qrItems.length} Codes Generated
              </div>
            )}
          </div>

          <div className="flex items-center gap-4">
            {qrItems.length > 0 && (
              <>
                <button 
                  onClick={() => setQrItems([])}
                  className="px-5 py-2.5 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-xl text-sm font-bold transition-all flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Clear
                </button>
                <button 
                  onClick={downloadZip}
                  className="px-6 py-2.5 bg-zinc-900 text-white rounded-xl text-sm font-bold hover:bg-zinc-800 active:scale-[0.98] transition-all flex items-center gap-2 shadow-xl shadow-zinc-200"
                >
                  <FileArchive className="w-4 h-4" />
                  Download ZIP
                </button>
              </>
            )}
          </div>
        </header>

        {/* Canvas Area */}
        <div className="flex-1 overflow-y-auto p-10 bg-zinc-50/50 flex flex-col">
          <div className="flex-1">
            <AnimatePresence>
              {error && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mb-8 p-5 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-4 text-red-600 shadow-sm"
                >
                  <AlertCircle className="w-6 h-6 shrink-0" />
                  <div className="text-sm">
                    <p className="font-bold text-base">Generation Error</p>
                    <p className="opacity-90 mt-1">{error}</p>
                  </div>
                </motion.div>
              )}

              {warning && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mb-8 p-5 bg-amber-50 border border-amber-100 rounded-2xl flex items-start gap-4 text-amber-700 shadow-sm"
                >
                  <Info className="w-6 h-6 shrink-0" />
                  <div className="text-sm">
                    <p className="font-bold text-base">Data Warning</p>
                    <p className="opacity-90 mt-1">{warning}</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {qrItems.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-8">
                <AnimatePresence mode="popLayout">
                  {qrItems.map((item, index) => (
                    <motion.div
                      key={item.id}
                      layout
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ delay: index * 0.01 }}
                      className="group bg-white border border-zinc-200 rounded-[2.5rem] p-6 shadow-sm hover:shadow-2xl hover:shadow-zinc-200 hover:border-zinc-300 transition-all duration-500"
                    >
                      <div className={`aspect-square rounded-[2rem] overflow-hidden flex items-center justify-center mb-6 border border-zinc-100 transition-colors ${
                        qrStyle === "white-on-black" ? "bg-black" : "bg-zinc-50 group-hover:bg-white"
                      }`}>
                        <img 
                          src={item.qrDataUrl} 
                          alt={item.filename}
                          className="w-full h-full p-4"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <div className="space-y-4">
                        <div className="px-1">
                          <p className="text-[10px] font-bold text-zinc-300 uppercase tracking-[0.2em] mb-1">Filename</p>
                          <p className="text-sm font-bold text-zinc-900 truncate" title={item.filename}>
                            {item.filename}
                          </p>
                        </div>
                        <button 
                          onClick={() => downloadIndividual(item)}
                          className="w-full py-3 bg-zinc-50 text-zinc-900 rounded-2xl text-xs font-bold hover:bg-zinc-900 hover:text-white transition-all flex items-center justify-center gap-2 group-hover:shadow-lg group-hover:shadow-zinc-100"
                        >
                          <Download className="w-4 h-4" />
                          Download PNG
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-8 py-20">
                <div className="w-32 h-32 bg-white rounded-[3rem] flex items-center justify-center shadow-2xl shadow-zinc-200 border border-zinc-100">
                  <QrCode className="w-16 h-16 text-zinc-200" />
                </div>
                <div className="max-w-md space-y-3">
                  <h3 className="text-2xl font-bold text-zinc-900">Ready to Generate</h3>
                  <p className="text-zinc-500 leading-relaxed">
                    Configure your templates and paste your bulk data in the sidebar. We'll handle the mapping and generation instantly.
                  </p>
                </div>
              </div>
            )}
          </div>
          <Footer />
        </div>
      </main>
    </div>
  );
}
