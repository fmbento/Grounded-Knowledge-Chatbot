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

  // KB files endpoint
  app.get('/api/kb', async (req, res) => {
    const kbPath = path.join(__dirname, 'KB');
    
    if (!existsSync(kbPath)) {
      return res.json([]);
    }

    try {
      const files = await fs.readdir(kbPath);
      const supportedFiles = files.filter(f => f.endsWith('.md') || f.endsWith('.txt') || f.endsWith('.pdf'));
      
      const kbData = await Promise.all(supportedFiles.map(async (filename) => {
        const filePath = path.join(kbPath, filename);
        const stats = await fs.stat(filePath);
        let content = "";
        const type = path.extname(filename).toLowerCase();

        if (type === '.pdf') {
          try {
            const dataBuffer = readFileSync(filePath);
            const data = await pdf(dataBuffer);
            content = data.text;
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
      }));
      
      res.json(kbData);
    } catch (error) {
      console.error('Error reading KB directory:', error);
      res.status(500).json({ error: 'Failed to read KB files' });
    }
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
