import fs from 'fs/promises';
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function buildKb() {
  const kbPath = path.join(process.cwd(), 'KB');
  const publicPath = path.join(process.cwd(), 'public');
  const publicKbPath = path.join(publicPath, 'KB');
  
  console.log(`[Build] A processar a pasta KB: ${kbPath}`);
  
  if (!existsSync(publicPath)) {
    await fs.mkdir(publicPath, { recursive: true });
  }

  if (!existsSync(kbPath)) {
    console.warn(`[Build] Aviso: Pasta KB não encontrada.`);
    await fs.writeFile(path.join(publicPath, 'kb-data.json'), JSON.stringify([]));
    return;
  }

  // Copia os ficheiros para public/KB para poderem ser descarregados pelos utilizadores
  if (!existsSync(publicKbPath)) {
    await fs.mkdir(publicKbPath, { recursive: true });
  }

  const files = await fs.readdir(kbPath);
  console.log(`[Build] Encontrados ${files.length} ficheiros na pasta KB.`);
  
  const supportedFiles = files.filter(f => f.endsWith('.md') || f.endsWith('.txt') || f.endsWith('.pdf'));
  
  const kbData = [];
  for (const filename of supportedFiles) {
    try {
      const filePath = path.join(kbPath, filename);
      const publicFilePath = path.join(publicKbPath, filename);
      
      // Copiar ficheiro
      await fs.copyFile(filePath, publicFilePath);

      const stats = await fs.stat(filePath);
      let content = "";
      const type = path.extname(filename).toLowerCase();

      if (type === '.pdf') {
         const dataBuffer = readFileSync(filePath);
         if (dataBuffer.length > 0) {
            try {
              // Silenciar os avisos chatos do pdf-parse
              const originalWarn = console.warn;
              console.warn = () => {};
              
              const pdfParser = typeof pdf === 'function' ? pdf : pdf.default;
              if (typeof pdfParser === 'function') {
                const data = await pdfParser(dataBuffer);
                content = data.text || "";
              }
              console.warn = originalWarn;
            } catch (err) {
              console.error(`[Build] Erro no PDF ${filename}:`, err.message);
              content = `[Erro ao extrair texto do PDF: ${filename}]`;
            }
         } else {
             content = `[O PDF ${filename} está vazio]`;
         }
      } else {
         content = await fs.readFile(filePath, 'utf-8');
      }

      kbData.push({
        name: filename,
        content: content,
        size: stats.size,
        type: type,
        downloadUrl: `/KB/${filename}`
      });
      console.log(`[Build] Processado: ${filename}`);
    } catch (err) {
      console.error(`[Build] Erro ao processar ${filename}:`, err);
    }
  }
  
  await fs.writeFile(path.join(publicPath, 'kb-data.json'), JSON.stringify(kbData));
  console.log(`[Build] kb-data.json gerado com sucesso com ${kbData.length} ficheiros.`);
}

buildKb().catch(console.error);
