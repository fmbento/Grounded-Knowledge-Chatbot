import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2, Trash2, FileText, Upload, X, CheckCircle2, AlertCircle, Info, Book, Clock, Image, Database, Globe } from 'lucide-react';
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
  const findRelevantContext = (query: string, files: KBFile[], maxChars: number = 1800000) => {
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

  const orchestrateByKeywords = (input: string) => {
    const lowerInput = input.toLowerCase();
    
    // Occupancy keywords
    if (lowerInput.includes("ocupação") || lowerInput.includes("lotado") || lowerInput.includes("cheia") || lowerInput.includes("vazia") || lowerInput.includes("pessoas") || lowerInput.includes("lugar") || lowerInput.includes("estudantes") || lowerInput.includes("occupancy") || lowerInput.includes("full") || lowerInput.includes("busy") || lowerInput.includes("crowded") || lowerInput.includes("people")) {
      let biblioteca = "BibUA";
      if (lowerInput.includes("mediateca")) biblioteca = "Mediateca";
      else if (lowerInput.includes("isca")) biblioteca = "ISCA";
      else if (lowerInput.includes("esan") || lowerInput.includes("oliveira")) biblioteca = "ESAN";
      else if (lowerInput.includes("estga") || lowerInput.includes("águeda")) biblioteca = "ESTGA";
      
      return { intent: "getLibraryOccupancy", language: "PT", parameters: { biblioteca } };
    }
    
    // Weather keywords
    if (lowerInput.includes("tempo") || lowerInput.includes("clima") || lowerInput.includes("chuva") || lowerInput.includes("sol") || lowerInput.includes("temperatura") || lowerInput.includes("meteo") || lowerInput.includes("weather") || lowerInput.includes("rain") || lowerInput.includes("sun") || lowerInput.includes("temperature")) {
      let biblioteca = "BibUA";
      if (lowerInput.includes("águeda") || lowerInput.includes("estga")) biblioteca = "ESTGA";
      else if (lowerInput.includes("oliveira") || lowerInput.includes("esan")) biblioteca = "ESAN";
      
      return { intent: "getWeather", language: "PT", parameters: { biblioteca } };
    }
    
    // Events keywords
    if (lowerInput.includes("evento") || lowerInput.includes("exposição") || lowerInput.includes("workshop") || lowerInput.includes("agenda") || lowerInput.includes("atividade") || lowerInput.includes("event") || lowerInput.includes("exhibition") || lowerInput.includes("activity")) {
      return { intent: "getLibraryEvents", language: "PT", parameters: {} };
    }
    
    // No direct match
    return null;
  };

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

    const executeTool = async (name: string, args: any) => {
      if (name === "getLibraryOccupancy") {
        const bib = args.biblioteca || 'BibUA';
        const url = `https://script.google.com/macros/s/AKfycbx5wRnGBHyq9JRYDXYPBlu2I1fSFDOb_zF7NVhqAQKuMnPMf4Oc6IXsW033LsdT0Kwo/exec?sheet=${bib}`;
        let retryCount = 0;
        while (true) {
          try {
            const response = await fetch(url);
            if (response.status === 429) {
              retryCount++;
              if (retryCount >= 3) return "De momento não é possível obter os dados de ocupação devido a excesso de tráfego. Por favor, tente mais tarde.";
              await sleep(5000);
              continue;
            }
            return await response.text();
          } catch (error: any) {
            if (error.message?.includes("429") && retryCount < 3) {
              retryCount++;
              await sleep(5000);
              continue;
            }
            return `Error: ${error.message}`;
          }
        }
      }

      if (name === "searchOPAC") {
        const { query, idx } = args;
        const url = `/api/opac-search?q=${encodeURIComponent(query)}&idx=${idx || 'Kw'}`;
        try {
          const response = await fetch(url);
          if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
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
          if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
          const data = await response.json();
          return JSON.stringify(data);
        } catch (error: any) {
          return `Erro ao pesquisar no Scopus: ${error.message}`;
        }
      }

      if (name === "getLibraryEvents") {
        try {
          const response = await fetch('/api/ua-events');
          if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
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
          if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
          const data = await response.json();
          return JSON.stringify(data);
        } catch (error: any) {
          return `Erro ao obter o tempo: ${error.message}`;
        }
      }
      return "Unknown tool";
    };

    const isToolRelatedQuery = (intent: string) => {
      return ["getLibraryOccupancy", "searchOPAC", "searchScopus", "getLibraryEvents", "getWeather"].includes(intent);
    };

    const GEMINI_MODELS = (import.meta as any).env.VITE_GEMINI_MODELS?.split(',') || ["gemini-3.1-flash-lite-preview", "gemini-3-flash-preview", "gemini-2.5-flash-preview-12-2025"];
    const apiKey = (import.meta as any).env.VITE_GEMINI_API_KEY || (process as any).env.GEMINI_API_KEY;
    const ai = new GoogleGenAI({ apiKey });

    try {
      // 1. Intent Interpretation (Orchestration)
      let strategy: any = null;
      let orchestrationModelUsed = "";

      // Step 1: Keyword-based matching first
      strategy = orchestrateByKeywords(input);
      if (strategy) {
        orchestrationModelUsed = "Keywords (Direct Match)";
      }

      // Step 2: Recurse to orchestration model if no direct keyword match
      if (!strategy) {
        const orchestrationPrompt = `
          You are the Orchestrator for SALInA, the Virtual Assistant of the University of Aveiro Libraries.
          Analyze the user query and return a JSON strategy.

          JSON structure:
          {
            "intent": "getLibraryOccupancy" | "searchOPAC" | "searchScopus" | "getLibraryEvents" | "getWeather" | "searchKB",
            "language": "PT" | "EN" | "ES" | "FR" | "DE",
            "parameters": {
              "biblioteca": "BibUA" | "Mediateca" | "ISCA" | "ESAN" | "ESTGA", // For occupancy/weather
              "query": "string", // For OPAC, Scopus, KB
              "idx": "Kw" | "ti" | "au" | "su" // For OPAC
            }
          }

          Intents:
          - getLibraryOccupancy: Questions about how many people are in the library, if it's full, or busy.
          - searchOPAC: Search for books, authors, or subjects in the library catalog.
          - searchScopus: Search for scientific articles, research papers, or journals.
          - getLibraryEvents: Questions about exhibitions, workshops, or cultural events at the library.
          - getWeather: Questions about the weather in Aveiro, Águeda, or Oliveira de Azeméis.
          - searchKB: General information about the library, schedules, rules, services, or any other topic not covered by tools.

          Translation Rules:
          - searchOPAC: If the user's query is NOT in Portuguese, you MUST translate the terms to Portuguese. The "query" parameter MUST be the translated version in Portuguese.
          - searchScopus: If the user's query is NOT in English, you MUST translate it to English and combine both versions. The "query" parameter MUST follow this EXACT format: "(TITLE-ABS-KEY(original terms)) OR (TITLE-ABS-KEY(english terms))". Inside each TITLE-ABS-KEY, multiple words MUST be joined with AND. 
            Example for "aquecimento global": "(TITLE-ABS-KEY(aquecimento AND global)) OR (TITLE-ABS-KEY(global AND warming))"
            Example for "inteligência artificial": "(TITLE-ABS-KEY(inteligência AND artificial)) OR (TITLE-ABS-KEY(artificial AND intelligence))"
          - searchScopus (English query): If the query is already in English, just wrap it in TITLE-ABS-KEY and join multiple words with AND. Example: "TITLE-ABS-KEY(global AND warming)".

          Language Detection: Identify the language of the question (PT, EN, ES, FR, DE).

          Default to 'searchKB' and 'PT' if unsure.
        `;

        const envOrchestrationModels = import.meta.env.VITE_ORCHESTRATION_MODELS;
        const orchestrationModels = envOrchestrationModels 
          ? envOrchestrationModels.split(',').map((m: string) => m.trim())
          : ["gemini-2.5-flash-lite", "gemini-2.5-flash"];
        
        for (let i = 0; i < orchestrationModels.length; i++) {
          const modelName = orchestrationModels[i];
          try {
            const orchestrationResponse = await ai.models.generateContent({
              model: modelName,
              contents: [{ role: 'user', parts: [{ text: input }] }],
              config: {
                systemInstruction: orchestrationPrompt,
                responseMimeType: "application/json",
                temperature: 0.1,
              }
            });
            strategy = JSON.parse(orchestrationResponse.text || "{}");
            orchestrationModelUsed = modelName;
            break;
          } catch (err: any) {
            const isRetryable = err.message?.includes("429") || err.message?.includes("503");
            console.error(`Orchestration failed with ${modelName}:`, err);
            
            if (isRetryable && i < orchestrationModels.length - 1) {
              console.warn(`Model ${modelName} failed (${err.message}), trying fallback ${orchestrationModels[i+1]}...`);
              continue;
            }
            break;
          }
        }
      }

      // Step 3: Final fallback to RAG (Knowledge Base) if both failed
      if (!strategy || !strategy.intent) {
        console.warn("Using Knowledge Base (RAG) as final fallback...");
        strategy = { intent: "searchKB", language: "PT", parameters: { query: input } };
        orchestrationModelUsed = "RAG Fallback";
      }

      const { intent, language = 'PT', parameters = {} } = strategy;

      // 2. Action Execution
      let context = "";
      if (intent === "searchKB") {
        context = findRelevantContext(parameters.query || input, kbFiles);
      } else {
        context = await executeTool(intent, parameters);
        // Smart RAG: Conditionally skip KB context retrieval for tool-related queries to save tokens
        if (!isToolRelatedQuery(intent)) {
          context += "\n\n" + findRelevantContext(parameters.query || input, kbFiles);
        }
      }

      // 3. Final Generation
      const finalSystemPrompt = `
        ${baseSystemPrompt}
        
        STRICT INSTRUCTION: Respond in the detected language: ${language.toUpperCase()}.
        
        REGRAS DE FORMATAÇÃO E CITAÇÃO:
        1. Se usar informação da Base de Conhecimento, cite a URL ou link de PDF.
        2. NUNCA forneça links diretos para ficheiros .md ou .txt.
        3. Se a fonte for PDF, use o formato: [Nome](Link) (PDF).
        4. No final da resposta, se houver fontes, use obrigatoriamente o cabeçalho "Fonte, onde saber mais:".
        
        MAPEAMENTO DE BIBLIOTECAS:
        - BibUA: Biblioteca Central / Campus de Santiago.
        - Mediateca: Mediateca.
        - ISCA: Biblioteca do ISCA-UA.
        - ESAN: Biblioteca da ESAN (Oliveira de Azeméis).
        - ESTGA: Biblioteca da ESTGA (Águeda).

        REGRAS PARA OPAC:
        - Mostre no máximo 5 resultados (título, autor, ano).
        - Forneça sempre o link para a lista completa no OPAC: https://opac.ua.pt/cgi-bin/koha/opac-search.pl?q=${encodeURIComponent(parameters.query || input)}&idx=${parameters.idx || 'Kw'}

        REGRAS PARA SCOPUS:
        - Mostre no máximo 5 resultados (título, autores, publicação, ano, link).

        CONTEXTO RECUPERADO:
        ${context || "Nenhum contexto adicional encontrado."}
      `;

      let finalResponseText = "";
      let finalModelUsed = GEMINI_MODELS[0];

      for (const modelName of GEMINI_MODELS) {
        try {
          const finalResponse = await ai.models.generateContent({
            model: modelName,
            contents: [{ role: 'user', parts: [{ text: input }] }],
            config: {
              systemInstruction: finalSystemPrompt,
              temperature: 0.7,
            }
          });
          finalResponseText = finalResponse.text || "Desculpe, não consegui gerar uma resposta.";
          finalModelUsed = modelName;

          // Log usage
          const usage = finalResponse.usageMetadata;
          if (usage) {
            fetch('/api/log-usage', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                api: `SALInA Final Gen - ${modelName}`, 
                message: input,
                inputTokens: usage.promptTokenCount,
                outputTokens: usage.candidatesTokenCount
              })
            }).catch(err => console.warn('Failed to log usage:', err));
          }
          break;
        } catch (err: any) {
          if (err.message?.includes("429") || err.message?.includes("503")) {
            console.warn(`Model ${modelName} failed (${err.message}) during final generation, trying next...`);
            continue;
          }
          throw err;
        }
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
          ? { ...msg, content: `Erro ao processar resposta: ${err.message}. Por favor, tente novamente.` }
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
                  <p className="text-gray-500 max-w-2xl mx-auto text-sm">
                    Pesquise no catálogo das Bibliotecas UA, artigos na Scopus, a vasta base de conhecimento dos Serviços de Referência e Formação dos SBIDM, consulte a ocupação das bibliotecas, a agenda cultural, e muito mais...
                  </p>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl w-full px-4">
                  {[
                    { label: "livros nas bibliotecas", query: "Obras sobre acidificação oceânica, pf.", icon: Book },
                    { label: "artigos na Scopus", query: "artigos sobre aquecimento global", icon: FileText },
                    { label: "empréstimo", query: "A minha tia pode devolver os meus empréstimos?", icon: Clock },
                    { label: "exposições", query: "Exposições, que temos?", icon: Image },
                    { label: "write a DMP", query: "Help me write a DMP", icon: Database },
                    { label: "(...)", query: "Où se situe l'UA?", icon: Globe },
                  ].map((shortcut, i) => (
                    <button
                      key={i}
                      onClick={() => setInput(shortcut.query)}
                      className="flex items-center justify-between px-4 py-3 bg-white border border-black/5 text-gray-600 rounded-xl shadow-sm hover:bg-gray-50 transition-all text-left group"
                    >
                      <div className="flex items-center gap-3">
                        <shortcut.icon size={14} className="text-emerald-500 shrink-0" />
                        <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">{shortcut.label}</span>
                      </div>
                      <span className="text-sm text-gray-400 group-hover:text-gray-600 transition-colors">→</span>
                    </button>
                  ))}
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
              Grounded + Real-Time UA Libraries + <a href="https://github.com/fmbento/Grounded-Knowledge-Chatbot" target="_blank" rel="noopener noreferrer" className="hover:text-emerald-600 transition-colors underline underline-offset-2">100% Open Source</a>
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}
