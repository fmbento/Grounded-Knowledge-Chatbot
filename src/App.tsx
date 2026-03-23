import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2, Trash2, FileText, Upload, X, CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface KBFile {
  name: string;
  content: string;
  size: number;
  type: string;
  downloadUrl: string;
}

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [kbFiles, setKbFiles] = useState<KBFile[]>([]);
  const [isKbOpen, setIsKbOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const kbInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const fetchKbFiles = async () => {
      try {
        const response = await fetch('/api/kb');
        if (response.ok) {
          const data = await response.json();
          setKbFiles(data);
        }
      } catch (err) {
        console.error('Failed to fetch KB files:', err);
      }
    };
    fetchKbFiles();
  }, []);

  const clearChat = () => {
    setMessages([]);
  };

  const totalKbSize = kbFiles.reduce((acc, file) => acc + file.size, 0);

  // Smart RAG: Find relevant documents to stay within API token limits
  const findRelevantContext = (query: string, files: KBFile[], maxChars: number = 600000) => {
    if (files.length === 0) return "";
    
    const keywords = query.toLowerCase().split(/\W+/).filter(w => w.length > 3);
    
    // Score files based on keyword matches
    const scoredFiles = files
      .filter(f => f.name !== 'system_prompt.txt')
      .map(file => {
        let score = 0;
        const contentLower = file.content.toLowerCase();
        const nameLower = file.name.toLowerCase();
        
        if (keywords.length === 0) {
          // If no keywords, prioritize FAQs or general info
          if (file.name.includes('FAQ') || file.name.includes('sobre_nos')) score = 1;
        } else {
          keywords.forEach(kw => {
            if (contentLower.includes(kw)) score += 1;
            if (nameLower.includes(kw)) score += 5; // Higher weight for filename matches
          });
        }
        
        return { ...file, score };
      })
      .sort((a, b) => b.score - a.score);

    let currentSize = 0;
    const selectedFiles = [];

    for (const file of scoredFiles) {
      if (currentSize + file.content.length > maxChars) break;
      selectedFiles.push(file);
      currentSize += file.content.length;
    }

    return selectedFiles
      .map(f => `--- FILE: ${f.name} (Type: ${f.type}, Download: ${f.downloadUrl}) ---\n${f.content}`)
      .join('\n\n');
  };

  const systemPromptFile = kbFiles.find(f => f.name === 'system_prompt.txt');
  const baseSystemPrompt = systemPromptFile?.content || "Você é Salina, a Assistente Virtual das Bibliotecas da Universidade de Aveiro.";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    setError(null);
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    const assistantMessageId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    }]);

    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    // --- STEP 1: ORCHESTRATION VIA IAEDU ---
    // We use IAedu to interpret the intent and detect the language
    const orchestrateIntent = async (query: string): Promise<{ intent: string, args: any, language: string }> => {
      const orchestratorPrompt = `
        Você é o Orquestrador do SALInA. Sua tarefa é analisar a pergunta do utilizador e decidir a melhor estratégia.
        Responda APENAS em formato JSON válido com a seguinte estrutura:
        {
          "intent": "getLibraryOccupancy" | "searchOPAC" | "searchScopus" | "getLibraryEvents" | "getWeather" | "searchKB",
          "args": { ... },
          "language": "pt" | "en" | "es" | "fr" | "de"
        }

        Regras de Intenção:
        - getLibraryOccupancy: perguntas sobre lotação, ocupação, quantas pessoas, se está cheio/vazio. Args: { "biblioteca": "BibUA" | "Mediateca" | "ISCA" | "ESAN" | "ESTGA" }
        - searchOPAC: pesquisa de livros, autores, títulos ou assuntos no catálogo. Args: { "query": string, "idx": "Kw" | "ti" | "au" | "su" }
        - searchScopus: artigos científicos, journals, bases de dados, papers. Args: { "query": string }
        - getLibraryEvents: exposições, workshops, agenda cultural, eventos. Args: {}
        - getWeather: tempo, clima, meteorologia, localização. Args: { "biblioteca": "BibUA" | "Mediateca" | "ISCA" | "ESAN" | "ESTGA" }
        - searchKB: qualquer outra pergunta sobre as bibliotecas, serviços, horários, multas, ou conversa geral. Args: {}
        
        Nota: Se não tiver certeza, use "searchKB". Detete o idioma da pergunta e coloque no campo "language".
      `;

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: query,
            systemInstruction: orchestratorPrompt,
            history: []
          }),
        });

        if (!response.ok) throw new Error('IAedu Orchestrator failed');

        const reader = response.body?.getReader();
        if (!reader) throw new Error('No reader');
        
        const decoder = new TextDecoder();
        let accumulated = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          accumulated += decoder.decode(value, { stream: true });
        }

        // Try to find JSON in the response (IAedu might wrap it in markdown or text)
        const jsonMatch = accumulated.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
        throw new Error('No JSON found in IAedu response');
      } catch (err) {
        console.warn('IAedu Orchestration failed, falling back to default:', err);
        // Fallback: Default to KB and Portuguese
        return { intent: 'searchKB', args: {}, language: 'pt' };
      }
    };

    const strategy = await orchestrateIntent(input);
    console.log('Orchestration Strategy:', strategy);

    // --- STEP 2: DATA GATHERING ---
    let toolResult = "";
    let relevantContext = "";
    let usedToolName = "";

    const executeTool = async (name: string, args: any) => {
      if (name === "getLibraryOccupancy") {
        const bib = args.biblioteca || "BibUA";
        const url = `https://script.google.com/macros/s/AKfycbx5wRnGBHyq9JRYDXYPBlu2I1fSFDOb_zF7NVhqAQKuMnPMf4Oc6IXsW033LsdT0Kwo/exec?sheet=${bib}`;
        try {
          const response = await fetch(url);
          return await response.text();
        } catch (error: any) {
          return `Error: ${error.message}`;
        }
      }

      if (name === "searchOPAC") {
        const { query, idx } = args;
        const url = `/api/opac-search?q=${encodeURIComponent(query)}&idx=${idx || 'Kw'}`;
        try {
          const response = await fetch(url);
          const data = await response.json();
          return JSON.stringify(data);
        } catch (error: any) {
          return `Erro ao pesquisar no OPAC: ${error.message}`;
        }
      }

      if (name === "searchScopus") {
        const { query } = args;
        const url = `/api/scopus-search?q=${encodeURIComponent(query)}`;
        try {
          const response = await fetch(url);
          const data = await response.json();
          return JSON.stringify(data);
        } catch (error: any) {
          return `Erro ao pesquisar no Scopus: ${error.message}`;
        }
      }

      if (name === "getLibraryEvents") {
        try {
          const response = await fetch('/api/ua-events');
          const data = await response.json();
          return JSON.stringify(data);
        } catch (error: any) {
          return `Erro ao obter a agenda de eventos: ${error.message}`;
        }
      }

      if (name === "getWeather") {
        const bib = args.biblioteca || 'BibUA';
        let latitude = '40.6405', longitude = '-8.6538';
        if (bib === 'ESAN') { latitude = '40.8621'; longitude = '-8.4770'; }
        else if (bib === 'ESTGA') { latitude = '40.5745'; longitude = '-8.4439'; }
        
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`;
        try {
          const response = await fetch(url);
          const data = await response.json();
          return JSON.stringify(data);
        } catch (error: any) {
          return `Erro ao obter o tempo: ${error.message}`;
        }
      }
      return "";
    };

    if (strategy.intent !== 'searchKB') {
      usedToolName = strategy.intent;
      toolResult = await executeTool(strategy.intent, strategy.args);
    } else {
      relevantContext = findRelevantContext(input, kbFiles);
    }

    // --- STEP 3: FINAL GENERATION VIA GEMINI ---
    const userHistoryText = messages
      .filter(m => m.role === 'user')
      .map(m => `- ${m.content}`)
      .join('\n');

    const finalSystemInstruction = `
      ${baseSystemPrompt}
      
      IDIOMA DE RESPOSTA: Você DEVE responder obrigatoriamente no idioma: ${strategy.language.toUpperCase()}.
      
      REGRAS DE FORMATAÇÃO:
      1. Se houver resultados de ferramentas (OPAC, Scopus, Ocupação, Eventos, Tempo), apresente-os de forma clara e organizada.
      2. CITAÇÃO DE FONTE: Sempre que usar informação da base de conhecimento, extraia a URL ou link de PDF original.
      3. PROIBIÇÃO DE LINKS INTERNOS: Nunca forneça links para ficheiros .md ou .txt. Use apenas URLs externas ou links de PDFs.
      4. FORMATO DE FONTE: No final, adicione "Fonte, onde saber mais:" seguido dos links.
      
      DADOS OBTIDOS:
      ${usedToolName ? `RESULTADO DA FERRAMENTA (${usedToolName}):\n${toolResult}` : `CONTEXTO DA BASE DE CONHECIMENTO:\n${relevantContext || "Nenhum documento relevante encontrado."}`}
      
      HISTÓRICO:
      ${userHistoryText || "Nenhuma pergunta anterior."}
    `;

    try {
      const ai = new GoogleGenAI({ apiKey: (import.meta as any).env.VITE_GEMINI_API_KEY || (process as any).env.GEMINI_API_KEY });
      const model = "gemini-3.1-flash-lite-preview"; // Fast and efficient for final generation
      
      const response = await ai.models.generateContent({
        model: model,
        contents: [{ role: 'user', parts: [{ text: input }] }],
        config: {
          systemInstruction: finalSystemInstruction,
          temperature: 0.7,
        }
      });

      const finalResponseText = response.text || "Desculpe, não consegui gerar uma resposta.";
      
      // Log usage
      const usage = response.usageMetadata;
      if (usage) {
        fetch('/api/log-usage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            api: `IAedu Orchestrator + Gemini (${model})`, 
            message: input,
            inputTokens: usage.promptTokenCount,
            outputTokens: usage.candidatesTokenCount,
            costEstimate: ((usage.promptTokenCount * 0.000000075) + (usage.candidatesTokenCount * 0.0000003)).toFixed(6)
          })
        }).catch(() => {});
      }

      setMessages(prev => prev.map(msg => 
        msg.id === assistantMessageId 
          ? { ...msg, content: finalResponseText }
          : msg
      ));

    } catch (err: any) {
      console.error('Chat Error:', err);
      setMessages(prev => prev.map(msg => 
        msg.id === assistantMessageId 
          ? { ...msg, content: `Erro ao processar resposta: ${err.message}. Verifique os logs do servidor para mais detalhes.` }
          : msg
      ));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-[#f5f5f5] font-sans text-[#1a1a1a] overflow-hidden">
      {/* Sidebar / Knowledge Base Panel */}
      <motion.aside 
        initial={false}
        animate={{ width: isKbOpen ? 320 : 0, opacity: isKbOpen ? 1 : 0 }}
        className="bg-white border-r border-black/5 flex flex-col shadow-xl z-20 overflow-hidden"
      >
        <div className="p-6 border-b border-black/5 flex justify-between items-center bg-white sticky top-0">
          <div className="flex items-center gap-2">
            <FileText className="text-emerald-600" size={20} />
            <h2 className="font-semibold text-sm uppercase tracking-wider">Base de Conhecimento</h2>
          </div>
          <button onClick={() => setIsKbOpen(false)} className="p-1 hover:bg-gray-100 rounded-lg">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl space-y-2">
            <div className="flex items-center gap-2 text-emerald-700 font-medium text-xs">
              <Info size={14} />
              <span>Status da Base</span>
            </div>
            <div className="text-[11px] text-emerald-600 space-y-1">
              <p>Arquivos: {kbFiles.length}</p>
              <p>Tamanho total: {(totalKbSize / 1024).toFixed(1)} KB</p>
              <p className="mt-2 italic opacity-70">Carregados da pasta /KB</p>
            </div>
          </div>

          <div className="space-y-2">
            {kbFiles.length === 0 && (
              <p className="text-[11px] text-gray-400 text-center py-8 italic">
                Nenhum documento encontrado na pasta /KB.
              </p>
            )}
            {kbFiles.map((file, idx) => (
              <div key={idx} className="group flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-black/5 hover:border-emerald-200 transition-all">
                <div className="flex items-center gap-2 overflow-hidden">
                  <FileText size={14} className="text-gray-400 shrink-0" />
                  <span className="text-xs truncate font-medium">{file.name}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </motion.aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col relative">
        {/* Header */}
        <header className="bg-white border-b border-black/5 px-6 py-4 flex justify-between items-center shadow-sm z-10">
          <div className="flex items-center gap-3">
            {!isKbOpen && (
              <button 
                onClick={() => setIsKbOpen(true)}
                className="p-2 hover:bg-gray-100 rounded-xl text-gray-500 transition-all relative"
              >
                <FileText size={20} />
                {kbFiles.length > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-emerald-500 rounded-full border-2 border-white"></span>
                )}
              </button>
            )}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm border border-black/5 overflow-hidden">
                <img 
                  src="https://salina.web.ua.pt/ua.png" 
                  alt="UA" 
                  className="w-full h-full object-contain"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div>
                <h1 className="font-semibold text-lg tracking-tight">
                  <span className="text-black">SALInA</span> <span className="text-gray-400 text-sm font-normal">(beta)</span>
                </h1>
                <a 
                  href="https://www.ua.pt/pt/sbidm/salina" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-[10px] text-emerald-600 font-bold uppercase tracking-widest hover:underline block"
                >
                  Assistente IA das Bibliotecas UA v5.0
                </a>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={clearChat}
              className="p-2 hover:bg-gray-100 text-gray-400 hover:text-gray-600 rounded-xl transition-colors"
              title="Limpar conversa"
            >
              <Trash2 size={20} />
            </button>
          </div>
        </header>

        {/* Chat Area */}
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="max-w-3xl mx-auto space-y-6">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-6">
                <div className="w-24 h-24 bg-white rounded-[2.5rem] shadow-xl flex items-center justify-center text-emerald-600 mb-2 border border-black/5 overflow-hidden">
                  <img 
                    src="https://salina.web.ua.pt/salina.png" 
                    alt="Salina" 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="space-y-2">
                  <h2 className="text-3xl font-light text-gray-800">Como posso ajudar?</h2>
                  <p className="text-gray-500 max-w-md mx-auto text-sm">
                    Pesquise no catálogo OPAC, artigos na Scopus, consulte a ocupação das bibliotecas ou a agenda cultural.
                  </p>
                </div>
                
                <div className="flex flex-wrap justify-center gap-3">
                  {kbFiles.length > 0 && (
                    <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-full text-xs font-medium border border-emerald-100">
                      <CheckCircle2 size={14} />
                      {kbFiles.length} documentos carregados da pasta /KB
                    </div>
                  )}
                  <button 
                    onClick={() => setInput("Quantas pessoas estão na Biblioteca Central agora?")}
                    className="flex items-center gap-2 px-6 py-3 bg-white border border-black/5 text-gray-600 rounded-2xl shadow-sm hover:bg-gray-50 transition-all"
                  >
                    <Info size={18} className="text-emerald-500" />
                    Ocupação Real-Time
                  </button>
                </div>
              </div>
            )}

            <AnimatePresence initial={false}>
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`flex gap-4 max-w-[90%] ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm overflow-hidden ${
                      message.role === 'user' ? 'bg-emerald-100 text-emerald-700' : 'bg-white text-gray-600 border border-black/5'
                    }`}>
                      {message.role === 'user' ? (
                        <User size={20} />
                      ) : (
                        <img 
                          src="https://salina.web.ua.pt/salina.png" 
                          alt="Salina" 
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      )}
                    </div>
                    <div className={`space-y-1.5 ${message.role === 'user' ? 'items-end' : 'items-start'}`}>
                      <div className={`p-5 rounded-2xl shadow-sm text-sm leading-relaxed ${
                        message.role === 'user' 
                          ? 'bg-emerald-600 text-white rounded-tr-none' 
                          : 'bg-white text-gray-800 border border-black/5 rounded-tl-none'
                      }`}>
                        <div className="prose prose-sm max-w-none prose-emerald">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              a: ({ node, ...props }) => (
                                <a 
                                  {...props} 
                                  target="_blank" 
                                  rel="noopener noreferrer" 
                                  className="text-blue-600 hover:underline font-medium transition-colors"
                                />
                              )
                            }}
                          >
                            {message.content}
                          </ReactMarkdown>
                        </div>
                        {message.content === '' && isLoading && (
                          <div className="flex items-center gap-2 text-emerald-500">
                            <Loader2 size={18} className="animate-spin" />
                            <span className="text-xs font-medium">Consultando...</span>
                          </div>
                        )}
                      </div>
                      <span className="text-[10px] text-gray-400 px-1">
                        {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            <div ref={messagesEndRef} />
          </div>
        </main>

        {/* Input Area */}
        <footer className="bg-white border-t border-black/5 p-6 z-10">
          <div className="max-w-3xl mx-auto">
            {error && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4 p-3 bg-red-50 border border-red-100 text-red-600 rounded-xl text-xs flex items-center gap-2"
              >
                <AlertCircle size={14} />
                {error}
              </motion.div>
            )}

            <form onSubmit={handleSubmit} className="relative flex items-center gap-3">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Pergunte sobre documentos ou ocupação..."
                  className="w-full bg-[#f8f9fa] border border-black/5 rounded-2xl py-4 px-6 text-sm focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all shadow-inner"
                  disabled={isLoading}
                />
              </div>
              
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className={`p-4 rounded-2xl shadow-lg transition-all flex items-center justify-center ${
                  !input.trim() || isLoading
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-emerald-600 text-white hover:bg-emerald-700 active:scale-95'
                }`}
              >
                {isLoading ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
              </button>
            </form>
            <p className="text-[10px] text-center text-gray-400 mt-4 uppercase tracking-widest font-medium">
              Grounded + Real-Time UA Libraries
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}
