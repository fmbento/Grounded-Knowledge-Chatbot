import express from 'express';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import { existsSync, readFileSync } from 'fs';
import { createRequire } from 'module';
import { GoogleGenAI } from "@google/genai";
import fetch from 'node-fetch';
import FormData from 'form-data';

const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // OPAC Search proxy
  app.get('/api/opac-search', async (req, res) => {
    const { q, idx } = req.query;
    if (!q) return res.status(400).json({ error: 'Query parameter "q" is required' });
    
    const url = `https://salina.web.ua.pt/utils/opac.php?q=${encodeURIComponent(q as string)}&idx=${idx || 'Kw'}`;
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error("Error fetching OPAC search:", error);
      res.status(500).json({ error: 'Failed to fetch OPAC results', details: error.message });
    }
  });

  // Scopus Search proxy
  app.get('/api/scopus-search', async (req, res) => {
    const { q } = req.query;
    if (!q) return res.status(400).json({ error: 'Query parameter "q" is required' });

    let scopusQuery = q as string;
    // If the query doesn't already have field specifiers, wrap it in TITLE-ABS-KEY
    if (!scopusQuery.includes('TITLE-ABS-KEY(') && !scopusQuery.includes('TITLE(') && !scopusQuery.includes('ABS(') && !scopusQuery.includes('KEY(')) {
      scopusQuery = `TITLE-ABS-KEY(${scopusQuery})`;
    }

    const apiKey = process.env.SCOPUS_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Scopus API key not configured on server' });
    }

    const baseApiUrl = "https://api.elsevier.com/content/search/scopus";
    const encodedQuery = encodeURIComponent(scopusQuery);
    const apiParams = `query=${encodedQuery}&sort=-relevancy&apiKey=${apiKey}&count=5&start=0`;
    const apiUrl = `${baseApiUrl}?${apiParams}`;

    // Full results page URL - Scopus UI handles the full query in the 's' parameter
    const fullResultsUrl = `https://www.scopus.com/results/results.uri?sort=rel-f&src=s&sid=&sot=b&sdt=b&sl=16&s=${encodedQuery}%23`;

    try {
      const response = await fetch(apiUrl, {
        headers: { Accept: "application/json" }
      });

      if (!response.ok) {
        return res.status(response.status).json({
          error: `HTTP error: ${response.status} ${response.statusText}`,
          fullResultsUrl: fullResultsUrl
        });
      }

      const data = await response.json();
      const results = data["search-results"]?.entry || [];
      const totalResults = data["search-results"]?.["opensearch:totalResults"] || "0";

      // Process results
      const formattedResults = results.map((item: any) => {
        // Extract Scopus ID from eid (e.g., "2-s2.0-85123456789" -> "85123456789")
        const scopusId = item.eid ? item.eid.replace("2-s2.0-", "") : null;
        // Convert API link to Scopus inward link
        const link = scopusId
          ? `https://www.scopus.com/inward/record.uri?partnerID=HzOxMe3b&scp=${scopusId}&origin=inward`
          : item["prism:url"] || "No link available";

        return {
          title: item["dc:title"] || "No title available",
          authors: item["dc:creator"] || "No authors listed",
          publication: item["prism:publicationName"] || "No publication info",
          year: item["prism:coverDate"] ? item["prism:coverDate"].substring(0, 4) : "No year",
          link: link
        };
      });

      res.json({
        totalResults: parseInt(totalResults),
        results: formattedResults,
        fullResultsUrl: fullResultsUrl
      });
    } catch (error: any) {
      console.error("Error fetching Scopus search:", error);
      res.status(500).json({ error: 'Failed to fetch Scopus results', details: error.message, fullResultsUrl });
    }
  });

  // UA Libraries Events proxy
  app.get('/api/ua-events', async (req, res) => {
    const apiKey = process.env.TIMELY_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Timely API key not configured on server' });
    }

    const url = 'https://timelyapp.time.ly/api/calendars/54744400/events?tags=677656875&timezone=Europe/Lisbon&per_page=12&page=1';
    const options = {
      method: 'GET',
      headers: {
        'accept': 'application/json, text/plain, */*',
        'x-api-key': apiKey,
        'Referer': 'https://agenda.ua.pt/',
      }
    };

    try {
      const response = await fetch(url, options);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const jsonResponse = await response.json();

      const items = jsonResponse.data && jsonResponse.data.items ? jsonResponse.data.items : [];
      const total = jsonResponse.data && jsonResponse.data.total ? jsonResponse.data.total : 0;

      const events: any = {};
      items.forEach((item: any, index: number) => {
        const eventKey = `event${index + 1}`;
        const venue = item.taxonomies && item.taxonomies.taxonomy_venue && item.taxonomies.taxonomy_venue[0] ? item.taxonomies.taxonomy_venue[0] : {};

        events[eventKey] = {
          title: item.title || '',
          start_utc_datetime: item.start_utc_datetime || '',
          end_datetime: item.end_datetime || '',
          cost_type: item.cost_type || null,
          image: item.images && item.images[0] && item.images[0].sizes && item.images[0].sizes.full && item.images[0].sizes.full.url ? item.images[0].sizes.full.url : '',
          description_short: item.description_short || '',
          venue: {
            title: venue.title || '',
            address: venue.address || '',
            city: venue.city || '',
            country: venue.country || '',
            postal_code: venue.postal_code || '',
            geo_location: venue.geo_location || ''
          },
          canonical_url: item.canonical_url || ''
        };
      });

      res.json({
        total: total,
        events: events,
        all_events_url: 'https://www.ua.pt/pt/agenda'
      });
    } catch (error: any) {
      console.error("Error fetching UA events:", error);
      res.status(500).json({ error: 'Failed to fetch UA events', details: error.message });
    }
  });

  // KB files endpoint
  app.get('/api/kb', async (req, res) => {
    const kbPath = path.join(__dirname, 'KB');
    console.log(`[KB] Lendo diretório: ${kbPath}`);
    
    if (!existsSync(kbPath)) {
      console.warn(`[KB] Aviso: Diretório ${kbPath} não encontrado.`);
      return res.json([]);
    }

    try {
      const files = await fs.readdir(kbPath);
      console.log(`[KB] Encontrados ${files.length} arquivos totais.`);
      const supportedFiles = files.filter(f => f.endsWith('.md') || f.endsWith('.txt') || f.endsWith('.pdf'));
      console.log(`[KB] Processando ${supportedFiles.length} arquivos suportados.`);
      
      const kbData = await Promise.all(supportedFiles.map(async (filename) => {
        try {
          const filePath = path.join(kbPath, filename);
          const stats = await fs.stat(filePath);
          let content = "";
          const type = path.extname(filename).toLowerCase();

          if (type === '.pdf') {
            try {
              const dataBuffer = readFileSync(filePath);
              if (dataBuffer.length === 0) {
                content = `[O PDF ${filename} está vazio]`;
              } else {
                const originalWarn = console.warn;
                const originalLog = console.log;
                console.warn = (...args: any[]) => {
                  if (typeof args[0] === 'string' && (args[0].includes('TT:') || args[0].includes('Warning:'))) return;
                  originalWarn(...args);
                };
                console.log = (...args: any[]) => {
                  if (typeof args[0] === 'string' && (args[0].includes('TT:') || args[0].includes('Warning:'))) return;
                  originalLog(...args);
                };

                try {
                  const pdfParser = typeof pdf === 'function' ? pdf : (pdf as any).default;
                  if (typeof pdfParser === 'function') {
                    const data = await pdfParser(dataBuffer);
                    content = data.text || "";
                  } else {
                    content = `[Erro: pdf-parse não disponível para ${filename}]`;
                  }
                } finally {
                  console.warn = originalWarn;
                  console.log = originalLog;
                }
              }
            } catch (err) {
              console.error(`Error parsing PDF ${filename}:`, err);
              content = `[Erro ao extrair texto do PDF: ${filename}]`;
            }
          } else {
            content = await fs.readFile(filePath, 'utf-8');
          }

          return {
            name: filename,
            content: content,
            size: stats.size,
            type: type,
            downloadUrl: `/kb-files/${filename}`
          };
        } catch (err) {
          console.error(`Error processing file ${filename}:`, err);
          return null;
        }
      }));
      
      res.json(kbData.filter(item => item !== null));
    } catch (error) {
      console.error('Error reading KB directory:', error);
      res.status(500).json({ error: 'Failed to read KB files' });
    }
  });

  // Debug endpoint for KB
  app.get('/api/debug-kb', async (req, res) => {
    const kbPath = path.join(__dirname, 'KB');
    const exists = existsSync(kbPath);
    let files: string[] = [];
    if (exists) {
      files = await fs.readdir(kbPath);
    }
    res.json({
      dirname: __dirname,
      kbPath,
      exists,
      fileCount: files.length,
      files: files.slice(0, 50) // Limit to 50 for safety
    });
  });

  // API usage logging endpoint
  app.post('/api/log-usage', (req, res) => {
    const { api, message, inputTokens, outputTokens, costEstimate } = req.body;
    let logMsg = `[API USAGE] Prompt: "${message?.substring(0, 50)}..." | API: ${api}`;
    
    if (inputTokens !== undefined) {
      logMsg += ` | Tokens: In=${inputTokens}, Out=${outputTokens} | Est. Cost: $${costEstimate}`;
    }
    
    console.log(logMsg);
    res.status(204).end();
  });

  // Chat endpoint with detailed logging
  app.post('/api/chat', async (req, res) => {
    const { message, history, systemInstruction } = req.body;
    
    // This is already logged by /api/log-usage from frontend, 
    // but we keep a specific server-side trace for the proxy execution.
    console.log(`[SERVER PROXY] Executing IAEDU request for: "${message.substring(0, 50)}..."`);

    const endpoint = process.env.IAEDU_ENDPOINT;
    const apiKey = process.env.IAEDU_API_KEY;

    if (!endpoint || !apiKey) {
      console.error('[IAEDU] Erro: IAEDU_ENDPOINT ou IAEDU_API_KEY não configurados.');
      return res.status(500).json({ error: 'IAEDU não configurada no servidor.' });
    }

    try {
      // Clean up endpoint URL (remove potential double slashes except for protocol)
      const cleanEndpoint = endpoint.replace(/([^:]\/)\/+/g, "$1");
      console.log(`[IAEDU] Chamando endpoint: ${cleanEndpoint}`);
      
      let userInfo: any = { name: "Salina UA" };
      if (process.env.IAEDU_USER_INFO) {
        try {
          const parsed = JSON.parse(process.env.IAEDU_USER_INFO);
          if (parsed && typeof parsed === 'object') {
            userInfo = { ...userInfo, ...parsed };
          }
        } catch (e) {
          console.warn('[IAEDU] Aviso: IAEDU_USER_INFO não é um JSON válido, usando nome padrão: Salina UA.');
        }
      }

      const formData = new FormData();
      formData.append("message", message);
      formData.append("channel_id", process.env.IAEDU_CHANNEL_ID || "");
      formData.append("thread_id", process.env.IAEDU_THREAD_ID || "");
      formData.append("user_info", JSON.stringify(userInfo));
      
      if (systemInstruction) {
        formData.append("system_instruction", systemInstruction);
      }

      console.log(`[IAEDU] Enviando FormData para ${cleanEndpoint}...`);

      const response = await fetch(cleanEndpoint, {
        method: 'POST',
        headers: {
          ...formData.getHeaders(),
          'x-api-key': apiKey
        },
        body: formData
      });

      if (response.ok) {
        console.log('[IAEDU] Resposta recebida, iniciando stream para o cliente...');
        
        // Set headers for streaming
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Transfer-Encoding', 'chunked');

        const stream = response.body;
        let buffer = '';

        stream.on('data', (chunk: Buffer) => {
          buffer += chunk.toString();
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const json = JSON.parse(line);
              if (json.type === 'token' && json.content) {
                res.write(json.content);
              }
            } catch (e) {
              console.warn('[IAEDU] Erro ao processar linha do stream:', line.substring(0, 50));
            }
          }
        });

        stream.on('end', () => {
          res.end();
        });

        stream.on('error', (err: Error) => {
          console.error('[IAEDU] Erro no stream:', err.message);
          if (!res.headersSent) {
            res.status(500).json({ error: 'Erro no stream da IAEDU' });
          } else {
            res.end();
          }
        });

        return;
      } else {
        const errorText = await response.text();
        console.error(`[IAEDU] ERRO DETALHADO: ${errorText}`);
        return res.status(response.status).json({ 
          error: `Erro na API IAEDU: ${response.statusText}`,
          details: errorText,
          api: 'https://api.iaedu.pt'
        });
      }
    } catch (error: any) {
      console.error(`[IAEDU] Erro de conexão/processamento: ${error.message}`);
      return res.status(500).json({ 
        error: 'Erro ao processar resposta via IAEDU',
        details: error.message,
        api: 'https://api.iaedu.pt'
      });
    }
  });

  // Serve KB files for download
  app.use('/kb-files', express.static(path.join(__dirname, 'KB')));

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
