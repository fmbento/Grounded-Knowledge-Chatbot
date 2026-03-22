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

    // Use Smart RAG to stay under the 250k token limit of the Free Tier
    // Skip context if it's a tool-related query (e.g., library occupancy) to save tokens and avoid interference
    const isToolRelatedQuery = (text: string) => {
      const occupancyKeywords = ['ocupação', 'pessoas', 'cheio', 'vazio', 'lotado', 'quantos', 'lotação', 'movimento'];
      const opacKeywords = ['livro', 'pesquisar', 'biblioteca', 'opac', 'autor', 'título', 'assunto', 'sobre', 'por', 'obra', 'catálogo'];
      const scopusKeywords = ['artigo', 'científico', 'revista', 'journal', 'scopus', 'recurso eletrónico', 'base de dados', 'paper', 'publicação'];
      const lowerText = text.toLowerCase();
      return occupancyKeywords.some(kw => lowerText.includes(kw)) || 
             opacKeywords.some(kw => lowerText.includes(kw)) ||
             scopusKeywords.some(kw => lowerText.includes(kw));
    };

    const shouldSkipContext = isToolRelatedQuery(input);
    const relevantContext = shouldSkipContext ? "" : findRelevantContext(input, kbFiles);

    const userHistoryText = messages
      .filter(m => m.role === 'user')
      .map(m => `- ${m.content}`)
      .join('\n');

    const systemInstruction = `
      ${baseSystemPrompt}
      
      REGRAS ADICIONAIS DE FUNCIONAMENTO:
      1. Para perguntas sobre a ocupação das bibliotecas da UA (quantas pessoas, se está cheio/vazio), use a ferramenta 'getLibraryOccupancy'.
      2. Para pesquisar livros, autores ou assuntos no catálogo das bibliotecas da UA, use a ferramenta 'searchOPAC'.
      3. Para pesquisar artigos científicos, revistas ou recursos eletrónicos, use a ferramenta 'searchScopus'.
      4. CITAÇÃO DE FONTE: Sempre que usar informação de um ficheiro da base de conhecimento, você DEVE extrair a URL ou o link de ficheiro (ex: PDF) que indica de onde essa informação foi obtida originalmente. 
      5. PROIBIÇÃO DE LINKS INTERNOS: Você NUNCA deve fornecer links diretos para os ficheiros .md ou .txt da base de conhecimento (ex: não use links como 'system_prompt.txt' ou '_FAQs_varias.md'). Use apenas as URLs externas ou links de PDFs encontrados DENTRO desses documentos.
      6. FORMATO DE LINK: Escreva as fontes no final da sua resposta, precedidas por uma linha em branco e pelo texto "Fonte, onde saber mais:". Se houver apenas uma fonte, escreva: "Fonte, onde saber mais: [Nome da Fonte](URL)". Se houver múltiplas fontes únicas, liste-as numa lista não ordenada (bullet points) logo abaixo do texto "Fonte, onde saber mais:". Garanta que cada URL seja listada apenas uma vez e que seja clicável.
      7. PDFS: Se a fonte for um ficheiro PDF, use o link de download fornecido no cabeçalho do ficheiro (ex: /kb-files/nome.pdf) e adicione " (PDF)" logo após o link. Exemplo: [Guia.pdf](/kb-files/Guia.pdf) (PDF).
      
      MAPEAMENTO DE BIBLIOTECAS para 'getLibraryOccupancy':
      - BibUA: Biblioteca Central / Campus / UA.
      - Mediateca: Mediateca.
      - ISCA: ISCA, ISCA-UA ou Domingos Cravo.
      - ESAN: ESAN ou Escola Superior Aveiro-Norte.
      - ESTGA: ESTGA ou Escola Superior de Tecnologia e Gestão de Águeda.

      REGRAS PARA 'searchOPAC':
      - 'query': Termos de pesquisa extraídos da pergunta.
      - 'idx': Campo de pesquisa. 
        - "Kw" (Keyword): Valor padrão se não mencionar título, autor ou assunto, ou se parecer uma referência bibliográfica (ex: "R.A. Serway, Physics...").
        - "ti" (Title): Se mencionar pesquisa por título.
        - "au" (Author): Se mencionar Autor/es ou pesquisa por um nome.
        - "su" (Subject): Se mencionar pesquisa por assunto ou "sobre" algo.
      - 'lng': Idioma da pergunta (padrão "pt").
      - TRADUÇÃO CRÍTICA: Se 'idx' for "su", você DEVE traduzir os termos de pesquisa para Português Europeu (pt-PT) antes de chamar a ferramenta.
      - APRESENTAÇÃO DE RESULTADOS: Mostre no máximo 5 resultados. Para cada resultado, inclua o título, autor e ano, se disponíveis.
      - LINK PARA LISTA COMPLETA: No final da resposta, forneça sempre o link para a lista completa no OPAC: https://opac.ua.pt/cgi-bin/koha/opac-search.pl?q=[query_escaped]&idx=[idx]&sort_by=relevance (substitua [query_escaped] pelos termos de pesquisa com espaços e caracteres especiais codificados para URL, e [idx] pelo valor usado).

      REGRAS PARA 'searchScopus':
      - 'query': Construa uma equação de pesquisa baseada na consulta do utilizador (ex: termos chave).
      - APRESENTAÇÃO DE RESULTADOS: Mostre no máximo 5 resultados. Para cada resultado, inclua o título, autores, publicação, ano e link.
      - LINK PARA LISTA COMPLETA: No final da resposta, forneça sempre o link para a lista completa no Scopus que será devolvido pela ferramenta.
      
      HISTÓRICO DE PERGUNTAS ANTERIORES DO UTILIZADOR (PARA CONTEXTO):
      ${userHistoryText || "Nenhuma pergunta anterior."}
      
      BASE DE CONHECIMENTO (CONTEXTO RELEVANTE):
      ${relevantContext || (shouldSkipContext ? "(Contexto de ficheiros omitido para focar nos dados da ferramenta em tempo real)" : "Nenhum documento relevante encontrado para esta consulta.")}
    `;

    try {
      // Check if we should use Gemini directly (Frontend) or go through the proxy (IAEDU)
      const useIAEDU = false; // Set to true if IAEDU is preferred
      let apiName = useIAEDU ? "IAEDU (Server Proxy)" : "Gemini (Direct Frontend)";

      if (!useIAEDU) {
        // DIRECT GEMINI CALL (Frontend) - As per System Prompt
        const ai = new GoogleGenAI({ apiKey: (import.meta as any).env.VITE_GEMINI_API_KEY || (process as any).env.GEMINI_API_KEY });
        
        // Load fallback models from env or use default list
        const envModels = (import.meta as any).env.VITE_GEMINI_MODELS;
        const fallbackModels = envModels 
          ? envModels.split(',').map((m: string) => m.trim())
          : [
              "gemini-3-flash-preview",
              "gemini-2.5-flash",
              "gemini-2.5-flash-lite-preview",
              "gemini-3.1-flash-lite-preview"
            ];
        let currentModelIndex = 0;

        const libraryOccupancyTool = {
          name: "getLibraryOccupancy",
          parameters: {
            type: "OBJECT",
            description: "Retrieves the last count of users in one of the UA Libraries. Use for queries about load, how many people, if it's busy or quiet. NOT for opening hours.",
            properties: {
              biblioteca: {
                type: "STRING",
                description: "The library identifier: BibUA (Main/Campus), Mediateca, ISCA, ESAN, or ESTGA.",
                enum: ["BibUA", "Mediateca", "ISCA", "ESAN", "ESTGA"]
              },
            },
            required: ["biblioteca"],
          },
        };

        const searchOPACTool = {
          name: "searchOPAC",
          parameters: {
            type: "OBJECT",
            description: "Searches the UA Libraries OPAC (Online Public Access Catalog). Use for finding books, authors, or subjects in the library collection.",
            properties: {
              query: {
                type: "STRING",
                description: "The search terms extracted from the user query. If searching by subject (idx='su'), these terms must be in European Portuguese."
              },
              idx: {
                type: "STRING",
                description: "The search field: 'Kw' (keyword/default), 'ti' (title), 'au' (author), 'su' (subject/about).",
                enum: ["Kw", "ti", "au", "su"]
              },
              lng: {
                type: "STRING",
                description: "The language of the user's original question (e.g., 'pt', 'en')."
              }
            },
            required: ["query", "idx", "lng"],
          },
        };

        const searchScopusTool = {
          name: "searchScopus",
          parameters: {
            type: "OBJECT",
            description: "Searches articles and electronic resources via the Scopus API. Use for queries about scientific articles, journals, or research papers.",
            properties: {
              query: {
                type: "STRING",
                description: "The search equation/keywords for Scopus search (e.g., 'artificial intelligence AND education')."
              }
            },
            required: ["query"],
          },
        };

        const executeTool = async (name: string, args: any) => {
          if (name === "getLibraryOccupancy") {
            const bib = args.biblioteca;
            const url = `https://script.google.com/macros/s/AKfycbx5wRnGBHyq9JRYDXYPBlu2I1fSFDOb_zF7NVhqAQKuMnPMf4Oc6IXsW033LsdT0Kwo/exec?sheet=${bib}`;
            let retryCount = 0;
            while (true) {
              try {
                const response = await fetch(url);
                if (response.status === 429) {
                  retryCount++;
                  if (retryCount >= 3) {
                    return "De momento não é possível obter os dados de ocupação devido a excesso de tráfego. Por favor, tente mais tarde.";
                  }
                  console.warn(`Rate limit hit on tool (attempt ${retryCount}), retrying in 5s...`);
                  await sleep(5000);
                  continue;
                }
                return await response.text();
              } catch (error: any) {
                const errorMsg = error.message?.toLowerCase() || "";
                if (errorMsg.includes("429")) {
                  retryCount++;
                  if (retryCount >= 3) {
                    return "De momento não é possível obter os dados de ocupação devido a excesso de tráfego. Por favor, tente mais tarde.";
                  }
                  await sleep(5000);
                  continue;
                }
                return `Error: ${error.message}`;
              }
            }
          }

          if (name === "searchOPAC") {
            const { query, idx } = args;
            const url = `/api/opac-search?q=${encodeURIComponent(query)}&idx=${idx}`;
            try {
              const response = await fetch(url);
              if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
              const data = await response.json();
              return JSON.stringify(data);
            } catch (error: any) {
              console.error("Error fetching OPAC search:", error);
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
              console.error("Error fetching Scopus search:", error);
              return `Erro ao pesquisar no Scopus: ${error.message}`;
            }
          }

          return "Unknown tool";
        };

        let currentContents = [
          { role: 'user', parts: [{ text: input }] }
        ];

        let finalResponseText = "";
        let currentSystemInstruction = systemInstruction;

        while (true) {
          let response;
          const currentModel = fallbackModels[currentModelIndex];
          try {
            response = await ai.models.generateContent({
              model: currentModel,
              contents: currentContents as any,
              config: {
                systemInstruction: currentSystemInstruction,
                temperature: 0.1,
                tools: [{ functionDeclarations: [libraryOccupancyTool as any, searchOPACTool as any, searchScopusTool as any] }],
              }
            });
          } catch (error: any) {
            // Check for rate limit (429) or similar transient errors
            const errorMsg = error.message?.toLowerCase() || "";
            if (errorMsg.includes("429") || errorMsg.includes("quota") || errorMsg.includes("rate limit") || errorMsg.includes("too many requests")) {
              // Try next model immediately if available
              if (currentModelIndex < fallbackModels.length - 1) {
                currentModelIndex++;
                console.warn(`Rate limit hit on ${currentModel}. Switching immediately to fallback model: ${fallbackModels[currentModelIndex]}`);
                continue;
              }
              finalResponseText = "De momento não é possível responder à questão devido a excesso de tráfego em todos os modelos disponíveis. Por favor, tente novamente mais tarde.";
              break;
            }
            throw error; // Re-throw if it's not a rate limit error
          }

          const candidate = response.candidates[0];
          const functionCalls = response.functionCalls;

          if (functionCalls && functionCalls.length > 0) {
            const toolResults = [];
            for (const fc of functionCalls) {
              const result = await executeTool(fc.name, fc.args);
              toolResults.push({
                functionResponse: {
                  name: fc.name,
                  response: { result }
                }
              });
            }
            
            // Remove KB context for subsequent turns if a tool was used, as per user requirement
            if (currentSystemInstruction.includes("BASE DE CONHECIMENTO (CONTEXTO RELEVANTE):")) {
              currentSystemInstruction = currentSystemInstruction.split("BASE DE CONHECIMENTO (CONTEXTO RELEVANTE):")[0] + 
                "\nBASE DE CONHECIMENTO:\n(Contexto de ficheiros removido após ativação de ferramenta)";
            }

            currentContents.push(candidate.content as any);
            currentContents.push({ role: 'user', parts: toolResults } as any);
            continue;
          }

          finalResponseText = response.text || "";
          
          // Log usage with tokens and cost
          const usage = response.usageMetadata;
          if (usage) {
            const inputTokens = usage.promptTokenCount;
            const outputTokens = usage.candidatesTokenCount;
            // Gemini 1.5 Flash Pricing (approximate for Gemini 3 Flash Preview)
            // Input: $0.075 / 1M tokens
            // Output: $0.30 / 1M tokens
            const cost = (inputTokens * 0.000000075) + (outputTokens * 0.0000003);
            const costEstimate = cost.toFixed(6);

            fetch('/api/log-usage', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                api: `${apiName} - ${currentModel}`, 
                message: input,
                inputTokens,
                outputTokens,
                costEstimate
              })
            }).catch(err => console.warn('Failed to log usage to server:', err));
          }

          break;
        }

        setMessages(prev => prev.map(msg => 
          msg.id === assistantMessageId 
            ? { ...msg, content: finalResponseText }
            : msg
        ));

      } else {
        // PROXY CALL (IAEDU)
        let response;
        let retryCount = 0;
        while (true) {
          response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              message: input,
              systemInstruction: systemInstruction,
              history: []
            }),
          });

          if (response.status === 429) {
            retryCount++;
            if (retryCount >= 3) {
              setMessages(prev => prev.map(msg => 
                msg.id === assistantMessageId 
                  ? { ...msg, content: "De momento não é possível responder à questão devido a excesso de tráfego. Por favor, tente novamente mais tarde." }
                  : msg
              ));
              setIsLoading(false);
              return;
            }
            console.warn(`Rate limit hit on proxy (attempt ${retryCount}), retrying in 5s...`);
            await sleep(5000);
            continue;
          }
          break;
        }

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Erro na resposta do servidor');
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error('ReadableStream não suportado pelo navegador');

        // Log initial usage for proxy (tokens not available in stream yet)
        fetch('/api/log-usage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ api: apiName, message: input })
        }).catch(err => console.warn('Failed to log usage to server:', err));

        const decoder = new TextDecoder();
        let accumulatedContent = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          accumulatedContent += chunk;

          setMessages(prev => prev.map(msg => 
            msg.id === assistantMessageId 
              ? { ...msg, content: accumulatedContent }
              : msg
          ));
        }
      }

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
              <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white shadow-sm">
                <Bot size={24} />
              </div>
              <div>
                <h1 className="font-semibold text-lg tracking-tight">Grounded Chatbot</h1>
                <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-widest">Base de Conhecimento + Real-Time</p>
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
                <div className="w-24 h-24 bg-white rounded-[2.5rem] shadow-xl flex items-center justify-center text-emerald-600 mb-2 border border-black/5">
                  <Bot size={48} />
                </div>
                <div className="space-y-2">
                  <h2 className="text-3xl font-light text-gray-800">Como posso ajudar?</h2>
                  <p className="text-gray-500 max-w-md mx-auto text-sm">
                    Carregue seus arquivos .md ou pergunte sobre a ocupação das bibliotecas da UA em tempo real.
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
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${
                      message.role === 'user' ? 'bg-emerald-100 text-emerald-700' : 'bg-white text-gray-600 border border-black/5'
                    }`}>
                      {message.role === 'user' ? <User size={20} /> : <Bot size={20} />}
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
