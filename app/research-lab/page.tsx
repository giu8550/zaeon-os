"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { useSession } from "next-auth/react";
import Image from "next/image";
import "@/src/i18n";

// --- IMPORTS ---
import { Navbar } from "@/components/main/navbar";
import { Mic, MicOff } from "lucide-react";

// --- ICONS ---
import {
    PlusIcon, ChevronRightIcon, BookmarkIcon,
    VideoCameraIcon, ClipboardIcon, SparklesIcon, TrashIcon,
    PaperAirplaneIcon, UserCircleIcon,
    ArrowPathIcon, CommandLineIcon, HeartIcon, CalculatorIcon,
    ArrowDownTrayIcon, PlayIcon,
    RocketLaunchIcon, XMarkIcon, ArrowsRightLeftIcon,
    BookOpenIcon, DocumentTextIcon, PlayCircleIcon,
    EyeIcon, PowerIcon, BeakerIcon, ChatBubbleLeftRightIcon, ClipboardDocumentIcon,
    DocumentChartBarIcon, CheckBadgeIcon,
    LanguageIcon
} from "@heroicons/react/24/outline";

// --- COMPONENTS ---
import ResearchCardPDF from "@/components/ui/ResearchCardPDF";

// --- TYPES ---
interface StudyDoc { id: string; title: string; url: string; file?: File; }
interface VideoItem { id: string; youtubeId: string; }
interface CitationNote { id: string; text: string; }

// --- UTILS ---
const generateSafeId = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

// --- SUB-COMPONENTS ---
const IosLoader = ({ status }: { status: string }) => (
    <div className="flex flex-col items-center justify-center space-y-4 py-4">
        <div className="relative w-8 h-8">
            {[...Array(8)].map((_, i) => (
                <motion.div
                    key={i}
                    className="absolute w-[2px] h-[8px] bg-black dark:bg-white rounded-full"
                    style={{ left: "50%", top: "30%", transformOrigin: "50% 180%", rotate: i * 45 }}
                    animate={{ opacity: [0.1, 1, 0.1] }}
                    transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.1 }}
                />
            ))}
        </div>
        <span className="text-[10px] font-black text-black dark:text-white uppercase tracking-[0.2em] animate-pulse">{status}</span>
    </div>
);

const ActionButton = ({ icon: Icon, label, onClick, colorClass = "text-black dark:text-white hover:text-cyan-500" }: any) => (
    <div className="group relative flex flex-col items-center z-[50]">
        <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onClick(e); }}
            className={`p-2 bg-slate-100 dark:bg-white/10 border border-slate-300 dark:border-white/20 rounded-full transition-all ${colorClass}`}
        >
            <Icon className="w-4 h-4" />
        </button>
        <span className="absolute -top-8 scale-0 group-hover:scale-100 transition-all bg-black dark:bg-white text-white dark:text-black text-[9px] px-2 py-1 rounded font-bold uppercase whitespace-nowrap z-[100] shadow-xl pointer-events-none">
            {label}
        </span>
    </div>
);

// 🔥 CHAT BUBBLE REDESENHADO (Avatar + Nome na Esquerda)
const ChatBubble = ({ role, text, agentName, agentImg, userImg }: { role: string, text: string, agentName: string, agentImg: string, userImg?: string | null }) => {
    const isUser = role === 'user';
    return (
        <div className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'} mb-6`}>
            {!isUser && (
                <div className="flex flex-col items-start gap-1.5 mr-3 max-w-[85%]">
                    <div className="flex items-center gap-2 px-1">
                        <div className="w-7 h-7 rounded-full overflow-hidden border border-slate-300 dark:border-white/20 shadow-sm flex items-center justify-center bg-white dark:bg-black shrink-0">
                            <img src={agentImg} alt={agentName} className="w-full h-full object-cover" onError={(e) => (e.currentTarget.src = `https://ui-avatars.com/api/?name=${agentName}&background=random`)} />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">{agentName}</span>
                    </div>
                    <div className="p-4 rounded-2xl rounded-tl-sm text-[13px] md:text-[14px] leading-relaxed shadow-sm font-medium bg-slate-100 dark:bg-white/10 text-black dark:text-white border border-slate-300 dark:border-white/20">
                        {text}
                    </div>
                </div>
            )}
            {isUser && (
                <div className="flex items-end gap-2 max-w-[85%]">
                    <div className="p-4 rounded-2xl rounded-tr-sm text-[13px] md:text-[14px] leading-relaxed shadow-sm w-fit font-medium bg-cyan-600 text-white">
                        {text}
                    </div>
                    <div className="w-7 h-7 rounded-full overflow-hidden shrink-0 border border-slate-300 dark:border-white/20 shadow-sm flex items-center justify-center bg-white dark:bg-black mb-1">
                        {userImg ? <img src={userImg} alt="User" className="w-full h-full object-cover" /> : <UserCircleIcon className="w-5 h-5 text-black dark:text-white" />}
                    </div>
                </div>
            )}
        </div>
    );
};

// 🔥 COMPONENTE DE INPUT UNIFICADO (COM VOZ)
const ChatInput = ({ value, onChange, onSend, isTyping, placeholder, lang = 'pt-BR' }: any) => {
    const [isListening, setIsListening] = useState(false);
    const recognitionRef = useRef<any>(null);

    useEffect(() => {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (SpeechRecognition) {
            recognitionRef.current = new SpeechRecognition();
            recognitionRef.current.continuous = true;
            recognitionRef.current.interimResults = true;
            recognitionRef.current.lang = lang;

            recognitionRef.current.onresult = (event: any) => {
                let transcript = "";
                for (let i = event.resultIndex; i < event.results.length; i++) {
                    transcript += event.results[i][0].transcript;
                }
                onChange(transcript);
            };

            recognitionRef.current.onerror = () => setIsListening(false);
            recognitionRef.current.onend = () => setIsListening(false);
        }
    }, [lang, onChange]);

    const toggleListening = () => {
        if (isListening) {
            recognitionRef.current?.stop();
            setIsListening(false);
        } else {
            onChange("");
            recognitionRef.current?.start();
            setIsListening(true);
        }
    };

    const handleSendClick = () => {
        if (isListening) toggleListening();
        onSend();
    };

    return (
        <div className="flex flex-col gap-2 w-full mt-2">
            <AnimatePresence>
                {isListening && (
                    <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex justify-center items-center gap-2 mb-1">
                        <span className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-pulse" />
                        <span className="text-[9px] font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-tighter">Ouvindo...</span>
                    </motion.div>
                )}
            </AnimatePresence>
            <div className="flex items-center gap-2 bg-white dark:bg-black/60 rounded-full border border-slate-300 dark:border-white/20 p-1.5 pl-4 focus-within:ring-2 focus-within:ring-cyan-500/30 transition-all shadow-sm">
                <input
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendClick()}
                    disabled={isTyping}
                    placeholder={isListening ? "Fale agora..." : placeholder}
                    className="flex-1 bg-transparent border-none outline-none text-[13px] text-black dark:text-white placeholder:text-slate-400"
                />
                <button onClick={toggleListening} disabled={isTyping} className={`w-9 h-9 rounded-full flex items-center justify-center transition-all shrink-0 ${isListening ? "bg-red-500/20 text-red-500 shadow-[0_0_10px_rgba(239,68,68,0.3)]" : "bg-slate-100 dark:bg-white/10 text-slate-500 hover:text-cyan-500"}`}>
                    {isListening ? <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1 }}><MicOff size={14} /></motion.div> : <Mic size={14} />}
                </button>
                <button onClick={handleSendClick} disabled={isTyping || !value.trim()} className="w-9 h-9 rounded-full bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white flex items-center justify-center shrink-0 transition-colors shadow-sm">
                    <PaperAirplaneIcon className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};

export default function HomeworkPage({ isEmbedded = false }: { isEmbedded?: boolean }) {
    const { t } = useTranslation();
    const { data: session, status } = useSession();

    // --- CORE STATES ---
    const [mounted, setMounted] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isChatLeft, setIsChatLeft] = useState(false);
    const [isFocusMode, setIsFocusMode] = useState(false);
    const [activeSection, setActiveSection] = useState<"pdf" | "scribe" | "examiner" | "videos" | "doc" | null>(null);

    // --- NOTIFICATION STATE ---
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const toastTimerRef = useRef<NodeJS.Timeout | null>(null);

    // --- WORK STATES ---
    const [workType, setWorkType] = useState<"Artigo" | "Relatório" | "TCC" | null>(null);
    const [isWorkTypeMenuOpen, setIsWorkTypeMenuOpen] = useState(false);
    const [docTitle, setDocTitle] = useState("minha_pesquisa.pdf");
    const [docContent, setDocContent] = useState("");
    const [activeProject, setActiveProject] = useState<any>(null);

    // --- DATA STATES ---
    const [studyFiles, setStudyFiles] = useState<StudyDoc[]>([]);
    const [pendingUpload, setPendingUpload] = useState<File | null>(null);
    const [videos, setVideos] = useState<VideoItem[]>([]);
    const [activeFileContext, setActiveFileContext] = useState<string | null>(null);
    const [processingFileId, setProcessingFileId] = useState<string | null>(null);
    const [activePdfTab, setActivePdfTab] = useState<"chat" | "citations">("chat");

    const [savedCitations, setSavedCitations] = useState<CitationNote[]>([]);
    const [citationContent, setCitationContent] = useState<string | null>(null);
    const [activeCitationText, setActiveCitationText] = useState<string | null>(null);

    // 🔥 ESTADOS CONTROLADOS PARA OS PROMPTS (Para a voz funcionar perfeitamente)
    const [pdfPrompt, setPdfPrompt] = useState("");
    const [scribePrompt, setScribePrompt] = useState("");
    const [examinerPrompt, setExaminerPrompt] = useState("");

    const [pdfChatHistory, setPdfChatHistory] = useState<{ role: 'ai' | 'user', text: string }[]>([]);
    const [specialistChatHistory, setSpecialistChatHistory] = useState<{
        scribe: { role: 'ai' | 'user', text: string }[],
        examiner: { role: 'ai' | 'user', text: string }[]
    }>({ scribe: [], examiner: [] });

    // --- LOADING & ACTION STATES ---
    const [isPdfTyping, setIsPdfTyping] = useState(false);
    const [isScribeTyping, setIsScribeTyping] = useState(false);
    const [isExaminerTyping, setIsExaminerTyping] = useState(false);
    const [isCitationTyping, setIsCitationTyping] = useState(false);
    const [isSystemProcessing, setIsSystemProcessing] = useState(false);
    const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");

    // --- MODALS ---
    const [isPublishOpen, setIsPublishOpen] = useState(false);
    const [publishFormat, setPublishFormat] = useState<"pdf" | "docx" | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const pdfChatRef = useRef<HTMLDivElement>(null);
    const scribeChatRef = useRef<HTMLDivElement>(null);
    const examinerChatRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setMounted(true);
        if (typeof window !== 'undefined') {
            const savedProject = localStorage.getItem('zaeon_active_project');
            if (savedProject) {
                try {
                    const parsed = JSON.parse(savedProject);
                    setActiveProject(parsed);
                } catch (e) { console.error(e); }
            }
        }
    }, []);

    useEffect(() => { if (pdfChatRef.current) pdfChatRef.current.scrollTo({ top: pdfChatRef.current.scrollHeight, behavior: 'smooth' }); }, [pdfChatHistory, isPdfTyping, activePdfTab]);
    useEffect(() => { if (scribeChatRef.current) scribeChatRef.current.scrollTo({ top: scribeChatRef.current.scrollHeight, behavior: 'smooth' }); }, [specialistChatHistory.scribe, isScribeTyping]);
    useEffect(() => { if (examinerChatRef.current) examinerChatRef.current.scrollTo({ top: examinerChatRef.current.scrollHeight, behavior: 'smooth' }); }, [specialistChatHistory.examiner, isExaminerTyping]);

    const toggleFocusMode = () => {
        const newMode = !isFocusMode;
        setIsFocusMode(newMode);
        if (typeof window !== 'undefined') {
            const event = new CustomEvent('zaeon-focus-mode', { detail: newMode });
            window.dispatchEvent(event);
        }
    };

    const showToast = (msg: string) => {
        setToastMessage(msg);
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        toastTimerRef.current = setTimeout(() => setToastMessage(null), 3000);
    };

    const handleFiles = (files: FileList | null) => {
        if (!files || files.length === 0) return;
        const pdfFiles = Array.from(files).filter(f => f.type === 'application/pdf');
        if (pdfFiles.length > 0) {
            setPendingUpload(pdfFiles[0]);
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const confirmUpload = () => {
        if (!pendingUpload) return;
        const newFile = {
            id: generateSafeId(), title: pendingUpload.name, url: URL.createObjectURL(pendingUpload), file: pendingUpload
        };
        setStudyFiles(prev => [...prev, newFile]);
        setPendingUpload(null);
    };

    const fileToBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve((reader.result as string).split(',')[1]);
            reader.onerror = error => reject(error);
        });
    };

    const buildSystemContext = () => {
        let ctx = "";
        if (activeProject) ctx += `[ACTIVE PROJECT]: ${JSON.stringify(activeProject)}\n`;
        if (workType) ctx += `[TARGET WORK TYPE]: User is writing a ${workType.toUpperCase()}.\n`;
        return ctx;
    };

    // 🔥 FETCH CORRECTO PARA O RESUMO DO PDF
    const handlePlayDocument = async (doc: StudyDoc) => {
        if (!doc.file || isPdfTyping || processingFileId) return;
        setProcessingFileId(doc.id);
        setIsPdfTyping(true);
        setActiveSection('pdf');
        try {
            const base64Data = await fileToBase64(doc.file);
            setActiveFileContext(base64Data);
            const response = await fetch('/api/chat', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: `Analise o documento "${doc.title}" e gere um resumo.`,
                    agent: "aura",
                    fileData: base64Data,
                    systemContext: buildSystemContext()
                })
            });
            const data = await response.json();
            if (data.text) setPdfChatHistory([{ role: 'ai', text: data.text }]);
        } catch (e) { showToast("Erro ao processar o PDF."); } finally { setIsPdfTyping(false); setProcessingFileId(null); }
    };

    // 🔥 FETCH CORRECTO PARA CHAT AURA
    const handlePdfQuestion = async () => {
        if (!pdfPrompt.trim() || !activeFileContext) return;
        const currentPrompt = pdfPrompt;
        setPdfPrompt("");
        setPdfChatHistory(prev => [...prev, { role: 'user', text: currentPrompt }]);
        setIsPdfTyping(true);

        try {
            const historyForGemini = pdfChatHistory.map(m => ({
                role: m.role === 'ai' ? 'model' : 'user',
                parts: [{ text: m.text }]
            }));

            const response = await fetch('/api/chat', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: currentPrompt,
                    agent: "aura",
                    fileData: activeFileContext,
                    history: historyForGemini,
                    systemContext: buildSystemContext()
                })
            });
            const data = await response.json();
            if (data.text) setPdfChatHistory(prev => [...prev, { role: 'ai', text: data.text }]);
        } catch (e) { console.error(e); showToast("Falha de conexão."); } finally { setIsPdfTyping(false); }
    };

    const handleGenerateCitations = async () => {
        if (!activeFileContext) return;
        setIsCitationTyping(true);
        try {
            const response = await fetch('/api/chat', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: "Gere 3 citações ABNT", agent: 'scholar', fileData: activeFileContext })
            });
            const data = await response.json();
            if (data.text) setCitationContent(data.text);
        } catch (e) { console.error(e); } finally { setIsCitationTyping(false); }
    };

    const handleSaveCitation = () => {
        if (!citationContent) return;
        const newCit: CitationNote = { id: generateSafeId(), text: citationContent };
        setSavedCitations(prev => [...prev, newCit]);
        setCitationContent(null);
        setActiveCitationText(citationContent);
        showToast("Citação salva na base de dados.");
    };

    // 🔥 FETCH CORRECTO PARA SCRIBE / EXAMINER
    const handleSpecialistQuery = async (specialistType: 'scribe' | 'examiner', inputVal: string) => {
        if (!inputVal.trim()) return;
        const isScribe = specialistType === 'scribe';
        if (isScribe) { setIsScribeTyping(true); setScribePrompt(""); }
        else { setIsExaminerTyping(true); setExaminerPrompt(""); }

        setSpecialistChatHistory(prev => ({ ...prev, [specialistType]: [...prev[specialistType], { role: 'user', text: inputVal }] }));

        try {
            const currentHistory = specialistChatHistory[specialistType];
            const historyForGemini = currentHistory.map(m => ({
                role: m.role === 'ai' ? 'model' : 'user',
                parts: [{ text: m.text }]
            }));

            const response = await fetch('/api/chat', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: inputVal,
                    agent: specialistType,
                    fileData: specialistType === 'examiner' ? activeFileContext : null,
                    history: historyForGemini,
                    systemContext: buildSystemContext()
                })
            });
            const data = await response.json();

            if (data.text) {
                setSpecialistChatHistory(prev => ({ ...prev, [specialistType]: [...prev[specialistType], { role: 'ai', text: data.text }] }));
            }
        } catch (e) {
            console.error(e); showToast("Falha de conexão.");
        } finally {
            if (isScribe) setIsScribeTyping(false); else setIsExaminerTyping(false);
        }
    };

    const copyToClipboard = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            showToast("Copiado para a área de transferência!");
        } catch (err) { console.error(err); }
    };

    const handlePasteVideo = async () => {
        try {
            const text = await navigator.clipboard.readText();
            const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
            const match = text.match(regex);
            if (match && match[1]) setVideos(prev => [{ id: generateSafeId(), youtubeId: match[1] }, ...prev]);
        } catch (err) { console.error(err); }
    };

    const handleSaveWorkspace = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (saveState === "saving") return;

        setSaveState("saving");
        try {
            const payload = {
                userId: session?.user?.email || "anonymous_user",
                workTitle: docTitle,
                workContent: docContent,
                workType: workType,
                citations: JSON.stringify(savedCitations)
            };

            await fetch('/api/workspace', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            setSaveState("saved");
            setTimeout(() => setSaveState("idle"), 2500);
        } catch (error) {
            console.error(error);
            setSaveState("idle");
            showToast("Erro ao salvar progresso.");
        }
    };

    const handlePublish = async () => {
        if (!publishFormat) return;
        setIsSystemProcessing(true);
        try {
            const blob = new Blob([docContent], { type: publishFormat === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${docTitle.replace(/\s+/g, '_')}.${publishFormat === 'pdf' ? 'pdf' : 'docx'}`;
            a.click();
            URL.revokeObjectURL(url);
            setIsPublishOpen(false);
            setPublishFormat(null);
            showToast("Documento publicado com sucesso.");
        } catch (e) { console.error(e); } finally { setIsSystemProcessing(false); }
    };

    const getCardStyle = (sectionName: string) => {
        const isActive = activeSection === sectionName;
        return `transition-all duration-300 border-2 ${isActive ? 'border-cyan-500 ring-4 ring-cyan-500/10' : 'border-slate-300 dark:border-white/10'} bg-white dark:bg-[#0f172a] shadow-xl`;
    };

    if (!mounted || status === "loading") return <div className="w-full h-full flex items-center justify-center bg-slate-100"><IosLoader status="INICIANDO..." /></div>;

    return (
        <div className={`relative transition-all duration-500 overflow-hidden flex font-sans w-full bg-slate-100 dark:bg-[#030014]
            ${isEmbedded ? 'h-full' : 'h-screen'}
            ${!isEmbedded ? (isFocusMode ? 'pt-4' : 'pt-[100px]') : ''}
        `}>

            {/* NOTIFICAÇÃO FLUTUANTE (TOAST) */}
            <AnimatePresence>
                {toastMessage && (
                    <motion.div
                        initial={{ opacity: 0, y: 50, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.9 }}
                        className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[9999] bg-black dark:bg-white text-white dark:text-black px-6 py-3 rounded-full shadow-2xl text-[11px] font-bold tracking-widest flex items-center gap-3 border border-slate-800 dark:border-slate-200"
                    >
                        <CheckBadgeIcon className="w-4 h-4 text-emerald-400 dark:text-emerald-600" />
                        {toastMessage}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Navbar — apenas fora do modo embutido */}
            {!isEmbedded && (
                <AnimatePresence>
                    {!isFocusMode && (
                        <motion.div initial={{ opacity: 0, y: -50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -100 }} className="absolute top-0 left-0 w-full z-50">
                            <Navbar />
                        </motion.div>
                    )}
                </AnimatePresence>
            )}

            {/* SIDEBAR ULTRA-FINA — oculta quando embutido (workstation provê a navegação) */}
            {!isEmbedded && (
                <motion.nav
                    onMouseEnter={() => setIsSidebarOpen(true)}
                    onMouseLeave={() => setIsSidebarOpen(false)}
                    animate={{ width: isSidebarOpen ? 180 : 54 }}
                    className={`fixed left-4 z-[550] flex flex-col py-6 rounded-[24px] border shadow-2xl bg-white dark:bg-[#0a0a0a] border-slate-300 dark:border-white/10 overflow-hidden transition-all duration-500 ${isFocusMode ? 'top-4 h-[calc(100vh-32px)]' : 'top-[100px] h-[calc(100vh-140px)]'}`}
                >
                    <div className="flex flex-col gap-4 px-2.5">
                        <button onClick={() => setIsChatLeft(!isChatLeft)} className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 text-black dark:text-white group">
                            <ArrowsRightLeftIcon className="w-5 h-5 shrink-0 group-hover:text-cyan-500" />
                            {isSidebarOpen && <span className="text-[10px] font-black uppercase whitespace-nowrap">Layout</span>}
                        </button>
                        <button onClick={toggleFocusMode} className={`flex items-center gap-3 p-2 rounded-xl ${isFocusMode ? 'bg-cyan-500 text-white shadow-md' : 'text-black dark:text-white hover:bg-slate-100'}`}>
                            {isFocusMode ? <EyeIcon className="w-5 h-5" /> : <PowerIcon className="w-5 h-5" />}
                            {isSidebarOpen && <span className="text-[10px] font-black uppercase">Foco</span>}
                        </button>
                    </div>
                </motion.nav>
            )}

            <main className={`flex-1 flex gap-8 p-6 ${!isEmbedded ? 'pl-[80px]' : ''} h-full overflow-hidden`}>

                {/* COLUNA 1: ESTUDO (PDF + SCRIBE + QUIZ) */}
                <div className={`w-1/2 h-full flex flex-col gap-8 overflow-y-auto custom-scrollbar pb-32 pr-2 ${isChatLeft ? 'order-first' : 'order-last'}`}>
                    <input type="file" ref={fileInputRef} className="hidden" accept="application/pdf" multiple onChange={(e) => handleFiles(e.target.files)} />

                    {/* CHAT COM PDF & CITAÇÕES */}
                    <section onClick={() => setActiveSection('pdf')} className={`p-6 rounded-[32px] shrink-0 ${getCardStyle('pdf')}`}>
                        <div className="flex items-center gap-4 mb-6">
                            <span className="bg-black dark:bg-white text-white dark:text-black text-[11px] font-black px-5 py-2 rounded-full uppercase tracking-widest flex items-center gap-2 shadow-md">
                                <BookOpenIcon className="w-4 h-4" /> Biblioteca
                            </span>
                            <div className="ml-auto">
                                <ActionButton icon={PlusIcon} label="Adicionar PDF" onClick={() => fileInputRef.current?.click()} colorClass="text-black dark:text-white hover:text-cyan-500" />
                            </div>
                        </div>

                        <div className="bg-slate-100 dark:bg-white/5 rounded-2xl p-4 mb-6 border border-slate-300 dark:border-white/10">
                            <div className="flex gap-4 overflow-x-auto pb-2 custom-scrollbar items-center min-h-[150px]">
                                {studyFiles.length === 0 && <span className="text-xs text-black dark:text-white font-medium italic">Arraste PDFs ou adicione-os no botão +.</span>}
                                {studyFiles.map(doc => (
                                    <div key={doc.id} className="w-[180px] shrink-0 transition-transform hover:-translate-y-1">
                                        <ResearchCardPDF title={doc.title} fileUrl={doc.url} isProcessing={processingFileId === doc.id} onDelete={() => setStudyFiles(prev => prev.filter(f => f.id !== doc.id))} onPlay={() => handlePlayDocument(doc)} />
                                    </div>
                                ))}
                            </div>
                        </div>

                        {activeFileContext && (
                            <div className="border-t border-slate-300 dark:border-white/20 pt-6">
                                <div className="flex p-1.5 bg-slate-200 dark:bg-white/10 rounded-xl w-fit mb-6 border border-slate-300 dark:border-white/20 shadow-inner">
                                    <button onClick={() => setActivePdfTab('chat')} className={`px-6 py-2.5 rounded-lg text-[11px] font-black uppercase transition-all ${activePdfTab === 'chat' ? 'bg-white text-cyan-600 shadow-md' : 'text-black dark:text-white hover:bg-white/50'}`}>Chat</button>
                                    <button onClick={() => setActivePdfTab('citations')} className={`px-6 py-2.5 rounded-lg text-[11px] font-black uppercase transition-all ${activePdfTab === 'citations' ? 'bg-white text-purple-600 shadow-md' : 'text-black dark:text-white hover:bg-white/50'}`}>Citações</button>
                                </div>

                                {activePdfTab === 'chat' ? (
                                    <div className="flex flex-col gap-2">
                                        <div ref={pdfChatRef} className="h-[250px] overflow-y-auto bg-slate-50 dark:bg-black/50 p-5 rounded-2xl border border-slate-300 dark:border-white/10 shadow-inner custom-scrollbar">
                                            {pdfChatHistory.length === 0 && <span className="text-black dark:text-white text-xs font-medium italic">Nenhum resumo gerado.</span>}
                                            {pdfChatHistory.map((msg, i) => <ChatBubble key={i} role={msg.role} text={msg.text} agentName="Aura" agentImg="/agents/aura.png" userImg={session?.user?.image} />)}
                                            {isPdfTyping && <div className="text-[10px] font-bold animate-pulse text-cyan-600 ml-12">Aura está a analisar...</div>}
                                        </div>
                                        <ChatInput
                                            value={pdfPrompt}
                                            onChange={setPdfPrompt}
                                            onSend={handlePdfQuestion}
                                            isTyping={isPdfTyping}
                                            placeholder="Pergunte ao PDF..."
                                        />
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-4">
                                        <div className="flex items-center gap-4 mb-2">
                                            <span className="text-black dark:text-white text-[12px] font-black uppercase">Base de Citações</span>
                                            <button onClick={handleGenerateCitations} className="px-5 py-2.5 bg-black dark:bg-white text-white dark:text-black rounded-full text-[10px] font-black uppercase shadow-md flex items-center gap-2"><SparklesIcon className="w-3.5 h-3.5" /> Extrair do PDF</button>
                                            {citationContent && <button onClick={handleSaveCitation} className="p-3 bg-emerald-100 rounded-full shadow-md"><BookmarkIcon className="w-4 h-4 text-emerald-600" /></button>}
                                        </div>
                                        <div className="flex gap-3 overflow-x-auto p-4 bg-slate-50 dark:bg-black rounded-2xl shadow-inner border border-slate-300 dark:border-white/10 min-h-[90px]">
                                            {savedCitations.length === 0 && <span className="text-xs text-black dark:text-white font-medium italic m-auto">Nenhuma citação salva.</span>}
                                            {savedCitations.map(cit => <div key={cit.id} onClick={() => setActiveCitationText(cit.text)} className="w-12 h-12 bg-yellow-200 rounded-xl flex items-center justify-center cursor-pointer shadow-md border border-yellow-400 hover:-translate-y-1 transition-transform"><DocumentTextIcon className="w-5 h-5 text-yellow-800" /></div>)}
                                        </div>
                                        <div className="p-5 bg-slate-100 dark:bg-white/5 rounded-2xl border border-slate-300 dark:border-white/20 min-h-[120px] relative">
                                            <p className="text-sm font-medium text-black dark:text-white whitespace-pre-wrap">{activeCitationText || citationContent || "Visualize citações aqui..."}</p>
                                            {(activeCitationText || citationContent) && <button onClick={() => copyToClipboard(activeCitationText || citationContent || "")} className="absolute top-3 right-3 p-2 bg-white dark:bg-black border border-slate-300 rounded-lg shadow-md"><ClipboardDocumentIcon className="w-4 h-4 text-black dark:text-white" /></button>}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </section>

                    {/* SCRIBE CHAT */}
                    <section onClick={() => setActiveSection('scribe')} className={`flex flex-col h-[480px] shrink-0 rounded-[32px] overflow-hidden ${getCardStyle('scribe')}`}>
                        <div className="p-5 border-b border-slate-300 dark:border-white/10 bg-slate-50 dark:bg-white/5 flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase text-purple-700 dark:text-purple-400 tracking-widest border border-purple-300 px-4 py-1.5 rounded-full bg-purple-100 dark:bg-purple-900/30">Escritor Acadêmico</span>
                            <div className="w-10 h-10 rounded-full border border-slate-300 shadow-sm overflow-hidden"><img src="/agents/scribe.png" className="w-full h-full object-cover" /></div>
                        </div>
                        <div ref={scribeChatRef} className="flex-1 p-6 overflow-y-auto space-y-4 custom-scrollbar bg-white dark:bg-[#0f172a]/50">
                            {specialistChatHistory.scribe.length === 0 && <span className="text-sm text-black dark:text-white font-medium italic flex items-center justify-center h-full text-center px-4">Peça ao Scribe para reescrever e refinar seus textos.</span>}
                            {specialistChatHistory.scribe.map((msg, i) => <ChatBubble key={i} role={msg.role} text={msg.text} agentName="Scribe" agentImg="/agents/scribe.png" userImg={session?.user?.image} />)}
                            {isScribeTyping && <div className="text-[11px] text-purple-600 font-black uppercase tracking-widest animate-pulse ml-12">Scribe está a redigir...</div>}
                        </div>
                        <div className="p-4 bg-slate-50 dark:bg-black border-t border-slate-300 dark:border-white/10">
                            <ChatInput
                                value={scribePrompt}
                                onChange={setScribePrompt}
                                onSend={() => handleSpecialistQuery('scribe', scribePrompt)}
                                isTyping={isScribeTyping}
                                placeholder="Dite ou escreva o seu rascunho..."
                            />
                        </div>
                    </section>

                    {/* QUIZ CHAT */}
                    <section onClick={() => setActiveSection('examiner')} className={`flex flex-col h-[480px] shrink-0 rounded-[32px] overflow-hidden ${getCardStyle('examiner')}`}>
                        <div className="p-5 border-b border-slate-300 dark:border-white/10 bg-slate-50 dark:bg-white/5 flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase text-orange-700 dark:text-orange-400 tracking-widest border border-orange-300 px-4 py-1.5 rounded-full bg-orange-100 dark:bg-orange-900/30">Testador de Conhecimento</span>
                            <div className="w-10 h-10 rounded-full border border-slate-300 shadow-sm overflow-hidden"><img src="/agents/examiner.png" className="w-full h-full object-cover" /></div>
                        </div>
                        <div ref={examinerChatRef} className="flex-1 p-6 overflow-y-auto space-y-4 custom-scrollbar bg-white dark:bg-[#0f172a]/50">
                            {specialistChatHistory.examiner.length === 0 && <span className="text-sm text-black dark:text-white font-medium italic flex items-center justify-center h-full text-center px-4">Peça ao Examiner para testar seu conhecimento sobre o PDF.</span>}
                            {specialistChatHistory.examiner.map((msg, i) => <ChatBubble key={i} role={msg.role} text={msg.text} agentName="Examiner" agentImg="/agents/examiner.png" userImg={session?.user?.image} />)}
                            {isExaminerTyping && <div className="text-[11px] text-orange-600 font-black uppercase tracking-widest animate-pulse ml-12">Examiner está a avaliar...</div>}
                        </div>
                        <div className="p-4 bg-slate-50 dark:bg-black border-t border-slate-300 dark:border-white/10">
                            <ChatInput
                                value={examinerPrompt}
                                onChange={setExaminerPrompt}
                                onSend={() => handleSpecialistQuery('examiner', examinerPrompt)}
                                isTyping={isExaminerTyping}
                                placeholder="Fale ou escreva a sua resposta..."
                            />
                        </div>
                    </section>

                    {/* VIDEOS */}
                    <section onClick={() => setActiveSection('videos')} className={`p-6 rounded-[32px] shrink-0 ${getCardStyle('videos')}`}>
                        <div className="flex items-center gap-4 mb-6">
                            <span className="bg-black dark:bg-white text-white dark:text-black text-[11px] font-bold px-5 py-2 rounded-full uppercase tracking-widest flex items-center gap-2 shadow-md">
                                <VideoCameraIcon className="w-4 h-4" /> Apoio Audiovisual
                            </span>
                            <div className="ml-auto">
                                <ActionButton icon={ClipboardIcon} label="Colar Link" onClick={handlePasteVideo} />
                            </div>
                        </div>
                        <div className="flex flex-row gap-6 overflow-x-auto pb-4 pt-2 min-h-[220px] custom-scrollbar">
                            {videos.length === 0 && <span className="text-sm text-black dark:text-white font-medium italic m-auto">Cole links do YouTube para referências visuais.</span>}
                            {videos.map(vid => (
                                <div key={vid.id} className="flex-shrink-0 w-[360px] h-[200px] bg-slate-200 dark:bg-black rounded-[24px] overflow-hidden shadow-md relative group/vid border border-slate-300 dark:border-white/10">
                                    <iframe width="100%" height="100%" src={`https://www.youtube.com/embed/${vid.youtubeId}`} frameBorder="0" allowFullScreen />
                                    <button onClick={(e) => { e.stopPropagation(); setVideos(prev => prev.filter(v => v.id !== vid.id)); }} className="absolute top-3 right-3 p-3 bg-black dark:bg-white text-white dark:text-black rounded-xl opacity-0 group-hover/vid:opacity-100 transition-opacity hover:scale-105 shadow-xl"><TrashIcon className="w-5 h-5" /></button>
                                </div>
                            ))}
                        </div>
                    </section>
                </div>

                {/* COLUNA 2: FOLHA A4 (MÓDULO INTEIRO É A FOLHA) */}
                <div onClick={() => setActiveSection('doc')} className={`w-1/2 flex flex-col h-[calc(100vh-140px)] rounded-[32px] shadow-2xl transition-all border-4 ${activeSection === 'doc' ? 'border-cyan-500 ring-8 ring-cyan-500/10' : 'border-white dark:border-[#0f172a]'} ${!isChatLeft ? 'order-first' : 'order-last'} bg-white dark:bg-[#0f172a] overflow-hidden`}>

                    {/* CABEÇALHO DA FOLHA */}
                    <div className="h-20 flex items-center px-10 shrink-0 border-b border-slate-100 dark:border-white/5 bg-transparent">
                        <DocumentTextIcon className="w-6 h-6 text-black dark:text-white mr-4" />
                        <input value={docTitle} onChange={(e) => setDocTitle(e.target.value)} className="bg-transparent text-black dark:text-white text-2xl font-black focus:outline-none w-full placeholder:text-slate-300" />
                    </div>

                    {/* ÁREA DE TEXTO DA FOLHA */}
                    <div className="flex-1 p-12 md:p-16 overflow-y-auto custom-scrollbar">
                        <textarea
                            value={docContent} onChange={(e) => setDocContent(e.target.value)}
                            className="w-full h-full resize-none outline-none bg-transparent text-[17px] leading-loose text-black dark:text-white placeholder:text-slate-400 font-serif"
                            placeholder="Sua pesquisa começa aqui..."
                        />
                    </div>

                    {/* RODAPÉ DA FOLHA (AÇÕES) */}
                    <div className="p-6 flex justify-between items-center px-10 bg-slate-50/50 dark:bg-black/20 border-t border-slate-100 dark:border-white/5">
                        <div className="relative">
                            <button onClick={(e) => { e.stopPropagation(); setIsWorkTypeMenuOpen(!isWorkTypeMenuOpen); }} className="px-6 py-2.5 rounded-full text-[11px] font-black transition-all flex items-center gap-2 border-2 border-blue-500 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30">
                                <SparklesIcon className="w-4 h-4" /> {workType || 'Definir Trabalho'}
                            </button>
                            <AnimatePresence>{isWorkTypeMenuOpen && (
                                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="absolute bottom-full mb-4 left-0 bg-white dark:bg-black border-2 border-slate-200 dark:border-white/20 rounded-2xl shadow-2xl w-44 overflow-hidden z-[200]">
                                    {["Artigo", "Relatório", "TCC"].map(type => <div key={type} onClick={(e) => { e.stopPropagation(); setWorkType(type as any); setIsWorkTypeMenuOpen(false); }} className="px-5 py-4 text-[11px] font-black uppercase text-black dark:text-white hover:bg-slate-50 dark:hover:bg-white/10 cursor-pointer">{type}</div>)}
                                </motion.div>
                            )}</AnimatePresence>
                        </div>

                        <div className="flex gap-3">
                            {/* BOTÃO SALVAR MINIMALISTA SEM MODAL */}
                            <button onClick={handleSaveWorkspace} disabled={saveState === "saving"} className="px-6 py-2.5 rounded-full text-[11px] font-black flex items-center gap-2 border-2 border-black dark:border-white text-black dark:text-white hover:bg-slate-100 dark:hover:bg-white/10 uppercase tracking-widest transition-colors w-[120px] justify-center">
                                {saveState === "saving" ? (
                                    <><ArrowPathIcon className="w-4 h-4 animate-spin" /> ...</>
                                ) : saveState === "saved" ? (
                                    <><CheckBadgeIcon className="w-4 h-4 text-emerald-500" /> Salvo</>
                                ) : (
                                    <><ArrowDownTrayIcon className="w-4 h-4" /> Salvar</>
                                )}
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); setIsPublishOpen(true); }} className="px-8 py-2.5 rounded-full text-[11px] font-black flex items-center gap-2 bg-black dark:bg-white text-white dark:text-black hover:scale-105 transition-all uppercase tracking-widest shadow-xl">Publicar</button>
                        </div>
                    </div>
                </div>
            </main>

            {/* MODALS - CONFIRMAR PREVIEW PDF */}
            <AnimatePresence>
                {pendingUpload && (
                    <div className="fixed inset-0 z-[700] flex items-center justify-center p-6">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setPendingUpload(null)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="relative w-full max-w-4xl bg-white dark:bg-[#0a0a0a] rounded-[32px] overflow-hidden shadow-2xl border border-slate-200 dark:border-white/10 flex flex-col h-[80vh]">
                            <div className="p-6 border-b border-slate-100 dark:border-white/5 flex justify-between items-center bg-slate-50 dark:bg-white/5">
                                <div>
                                    <h3 className="text-lg font-black text-black dark:text-white">Previsão do Documento</h3>
                                    <p className="text-xs font-medium text-slate-500">{pendingUpload.name}</p>
                                </div>
                                <button onClick={() => setPendingUpload(null)} className="p-2 bg-slate-200 dark:bg-white/10 rounded-full hover:bg-slate-300 dark:hover:bg-white/20 transition-colors"><XMarkIcon className="w-5 h-5 text-black dark:text-white" /></button>
                            </div>
                            <div className="flex-1 bg-slate-200 dark:bg-black/50 p-4 overflow-hidden">
                                <iframe src={URL.createObjectURL(pendingUpload)} className="w-full h-full rounded-xl border border-slate-300 dark:border-white/10" />
                            </div>
                            <div className="p-6 bg-white dark:bg-[#0a0a0a] border-t border-slate-100 dark:border-white/5 flex justify-end gap-4">
                                <button onClick={() => setPendingUpload(null)} className="px-6 py-3 rounded-full text-xs font-black border-2 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 uppercase tracking-widest transition-colors">Cancelar</button>
                                <button onClick={confirmUpload} className="px-8 py-3 rounded-full text-xs font-black bg-black dark:bg-white text-white dark:text-black hover:scale-105 uppercase tracking-widest shadow-xl transition-all">Confirmar Upload</button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* MODALS - PUBLICAR */}
            <AnimatePresence>
                {isPublishOpen && (
                    <div className="fixed inset-0 z-[600] flex items-center justify-center p-6">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => { setIsPublishOpen(false); setPublishFormat(null); }} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
                        <motion.div initial={{ opacity: 0, scale: 0.9, y: 40 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 40 }} className="relative w-full max-w-md bg-white dark:bg-black rounded-[32px] p-10 shadow-2xl border-4 border-black dark:border-white">
                            <h3 className="text-2xl font-black text-black dark:text-white mb-2">Publicar {workType || 'Trabalho'}</h3>
                            <p className="text-sm font-bold text-slate-500 mb-6">Escolha o formato:</p>
                            <div className="flex flex-col gap-3 mb-6">
                                {(["pdf", "docx"] as const).map(fmt => (
                                    <button key={fmt} onClick={() => setPublishFormat(fmt)} className={`w-full py-4 px-5 rounded-2xl text-sm font-black border-2 transition-all flex items-center justify-between uppercase tracking-wider ${publishFormat === fmt ? 'border-cyan-500 text-cyan-600 bg-cyan-50 dark:bg-cyan-900/30' : 'border-slate-200 dark:border-white/20 text-black dark:text-white hover:border-black dark:hover:border-white'}`}>
                                        <span>{fmt === 'pdf' ? 'PDF (Adobe)' : 'DOCX (Word)'}</span>
                                        {publishFormat === fmt && <CheckBadgeIcon className="w-6 h-6 text-cyan-600" />}
                                    </button>
                                ))}
                            </div>
                            <button onClick={handlePublish} disabled={!publishFormat || isSystemProcessing} className="w-full bg-black dark:bg-white text-white dark:text-black font-black py-4 rounded-2xl transition-all uppercase tracking-widest text-sm disabled:opacity-50 flex items-center justify-center gap-2 hover:scale-[1.02]">
                                {isSystemProcessing ? <IosLoader status="Exportando" /> : <><ArrowDownTrayIcon className="w-5 h-5" /> Iniciar Download</>}
                            </button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}