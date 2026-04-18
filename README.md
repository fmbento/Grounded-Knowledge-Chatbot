# 🤖 Grounded-Knowledge-Chatbot

## 📋 Overview

**Grounded-Knowledge-Chatbot** is an intelligent, **100% Open Source** conversational AI system powered by **Google's Gemini API** with intelligent fallback model switching. It provides reliable, knowledge-base-grounded responses by integrating with multiple academic and research APIs for real-time data retrieval.

The system features:
- 🖼️ **Image Support** in responses with polished Markdown rendering
- 🔄 **Smart Retry Logic** for empty or "not found" responses
- 📧 **Direct Support Fallback** to Reference Service email
- 🧠 **Google Gemini Integration** with multiple model fallbacks (Gemini 3 Flash, 2.5 Flash, etc.)
- 📚 Multi-source knowledge base support (PDF, Markdown, Text files)
- 🌓 **Dark Mode** support with manual toggle
- 🌐 **Multilingual UI** (Portuguese/English) with real-time switching
- 🔗 Integration with academic search APIs (OPAC, Scopus)
- 🎓 Real-time university events aggregation
- 🌦️ Weather API integration
- 📊 Smart RAG (Retrieval-Augmented Generation) for token optimization
- 🎯 Tool-based function calling for real-time data access
- 🔄 Automatic model fallback on rate limits
- 📱 Responsive React frontend with Tailwind CSS
- 🐳 Docker support for easy deployment
- 🔐 Full TypeScript support with type safety
- 🔓 **100% Open Source** (MIT Licensed)
- 🎨 **Enhanced UI** with Lucide icons and responsive layouts

---
<table>
  <tr>
    <td><img src="https://github.com/user-attachments/assets/ec3e48a6-c6cc-40e6-a59b-077eaf719021" width="100%" alt="image" /></td>
    <td><img src="https://github.com/user-attachments/assets/966288ef-351e-4f97-bf12-0cac019bb252" width="100%" alt="image" /></td>
  </tr>
  <tr>
    <td><img src="https://github.com/user-attachments/assets/382b95da-8ba5-4664-a5d4-446ab3f628b1" width="100%" alt="image" /></td>
    <td><img src="https://github.com/user-attachments/assets/31af7fc0-8f75-48f7-a1f8-69d0cb9066d6" width="100%" alt="image" /></td>
  </tr>
</table>
---

## 🚀 Quick Start

### Prerequisites

- **Node.js** (v16 or higher)
- **npm** (v7 or higher)
- **Google Gemini API Key** (required)
- **Docker & Docker Compose** (optional, for containerized deployment)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/fmbento/Grounded-Knowledge-Chatbot.git
   cd Grounded-Knowledge-Chatbot
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` with your configuration (see [Configuration](#-configuration) section)

4. **Run the application:**

   **Development mode:**
   ```bash
   npm run dev
   ```

   **Production build:**
   ```bash
   npm run build
   npm run start
   ```

The application will be available at `http://localhost:3000`

---

## 🐳 Docker Deployment

### Using Docker Compose

1. **Build and run containers:**
   ```bash
   docker-compose up --build
   ```

2. **Access the application:**
   - Application: `http://localhost:3000`

### Configuration with Docker

Modify the `.env` file before running `docker-compose up`:

```bash
docker-compose up --build -d
```

---

## ⚙️ Configuration

Create a `.env` file in the root directory with the following variables:

```env
# Gemini Models Fallback List (comma-separated)
# The application will try models in order, switching automatically on rate limits
VITE_GEMINI_MODELS="gemini-3-flash-preview,gemini-2.5-flash,gemini-2.5-flash-lite-preview,gemini-3.1-flash-lite-preview"
GEMINI_API_KEY="YOUR_GEMINI_API_KEY"

# IAEDU API Key (optional, for fallback)
IAEDU_API_KEY="sk-usr-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
IAEDU_ENDPOINT="https://api.iaedu.pt/agent-chat//api/v1/agent/xxxxxxxxxxxxxxxxxxxx/stream"
IAEDU_CHANNEL_ID="xxxxxxxxxxxxxxxxxxxxxxxx"
IAEDU_THREAD_ID="xxxxxxxxxxxxxxxxxxxxxxx"
IAEDU_USER_INFO='{"name": "Your Bot Name"}'

# Academic APIs
SCOPUS_API_KEY="your-scopus-api-key"

# Timely API Key (UA Events)
TIMELY_API_KEY="your-timely-api-key"
```

**Important:** 
- **GEMINI_API_KEY** is required for the chatbot to function
- Get your API key from [Google AI Studio](https://aistudio.google.com/)
- The `VITE_GEMINI_MODELS` environment variable defines the fallback order - models are tried in order if rate limits are encountered
- IAEDU credentials are optional and only used if `useIAEDU` flag is set to `true` in the code
- Knowledge base files should be placed in the `KB/` directory

---

## 📁 Project Structure

```
Grounded-Knowledge-Chatbot/
├── src/
│   ├── App.tsx          # Main React application with Gemini integration
│   ├── main.tsx         # React entry point
│   └── index.css        # Global styles
├── KB/                  # Knowledge base directory (PDFs, Markdown, Text)
├── server.ts            # Express backend server with API endpoints
├── index.html           # HTML template
├── package.json         # Dependencies
├── tsconfig.json        # TypeScript configuration
├── vite.config.ts       # Vite configuration
├── docker-compose.yml   # Docker Compose configuration
├── Dockerfile           # Docker image definition
├── .env.example         # Environment variables template
└── metadata.json        # Application metadata
```

---

## 🛠️ Available Scripts

```bash
# Development server with hot reload
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Clean build artifacts
npm run clean

# Type checking
npm run lint
```

---

## 📚 Knowledge Base (KB)

The chatbot uses a local knowledge base to ground its responses. Supported file formats:

- **PDF files** (.pdf) - Automatically parsed and indexed
- **Markdown files** (.md) - For structured documentation
- **Text files** (.txt) - Plain text content
- **System Prompt** (system_prompt.txt) - Custom system prompt for the AI (optional)

### Adding Knowledge Base Files

1. Create a `KB/` directory in the project root (if not exists)
2. Place your files in the `KB/` directory
3. Optionally create a `system_prompt.txt` file to customize the bot's personality
4. Restart the server to index new files
5. Files are accessible via `/api/kb` endpoint and `/kb-files/{filename}` for downloads

### Smart RAG (Retrieval-Augmented Generation)

The system uses intelligent context selection to:
- Score documents based on keyword matching
- Prioritize relevant files to stay within Gemini's token limits (250k free tier limit)
- Skip knowledge base context for tool-related queries (occupancy, weather, etc.) to optimize tokens
- Automatically remove KB context after tool activation to avoid interference

---

## 🤖 Gemini Integration & Model Fallback Strategy

The application uses Google's Gemini API with an intelligent fallback mechanism:

1. **Primary Model**: `gemini-3-flash-preview` (latest preview model)
2. **Fallback Models**: Automatically tries alternative models if rate limits are hit
3. **Automatic Switching**: When a 429 (rate limit) error occurs, the system immediately switches to the next model in the list
4. **Cost Optimization**: Uses pricing from Gemini Flash models (Input: $0.075/1M tokens, Output: $0.30/1M tokens)
5. **Usage Logging**: Tracks token usage and estimated costs for each request

### Available Gemini Models

- `gemini-3-flash-preview` - Latest preview release
- `gemini-2.5-flash` - Latest stable Flash model
- `gemini-2.5-flash-lite-preview` - Lightweight preview
- `gemini-3.1-flash-lite-preview` - Latest lite preview

---

## 🌐 API Endpoints

### Health & Status
- `GET /api/health` - Health check endpoint

### Knowledge Base
- `GET /api/kb` - List all KB files with content
- `GET /kb-files/{filename}` - Download KB file

### Academic Search APIs (Proxies)
- `GET /api/opac-search?q={query}&idx={index}` - Search University of Aveiro OPAC
- `GET /api/scopus-search?q={query}` - Search Scopus academic database
- `GET /api/ua-events` - Fetch University of Aveiro events

### Real-Time Data
- `getLibraryOccupancy` (Tool) - Get current library occupancy via Google Sheets
- `getWeather` (Tool) - Get weather data from Open-Meteo API

### Chat & Logging
- `POST /api/log-usage` - Log API usage metrics and costs

---

## 🎯 Tool Integration

The chatbot can call these tools automatically based on user queries:

### 1. **getLibraryOccupancy**
```typescript
// Triggered by keywords: ocupação, pessoas, cheio, vazio, lotado, quantos, lotação, movimento
// Gets real-time library occupancy from Google Sheets
{
  "biblioteca": "BibUA" | "Mediateca" | "ISCA" | "ESAN" | "ESTGA"
}
```

### 2. **searchOPAC**
```typescript
// Triggered by keywords: livro, pesquisar, biblioteca, opac, autor, título, assunto
// Searches the OPAC catalog
{
  "query": "search terms",
  "idx": "Kw" | "ti" | "au" | "su",  // Keyword, Title, Author, Subject
  "lng": "pt" | "en"
}
```

### 3. **searchScopus**
```typescript
// Triggered by keywords: artigo, científico, revista, journal, scopus, paper, publicação
// Searches scientific articles
{
  "query": "search equation"
}
```

### 4. **getLibraryEvents**
```typescript
// Triggered by keywords: exposição, exhibition, workshop, evento, agenda, cultural
// Gets university events
{}
```

### 5. **getWeather**
```typescript
// Triggered by keywords: tempo, clima, chuva, sol, temperatura, onde fica
// Gets weather data
{
  "biblioteca": "BibUA" | "Mediateca" | "ISCA" | "ESAN" | "ESTGA"
}
```

---

## 🎨 Technology Stack

### Frontend
- **React 19** - Modern UI framework
- **Vite** - Lightning-fast build tool
- **Tailwind CSS 4** - Utility-first styling
- **Lucide React** - Icon library
- **Motion** - Animation library
- **React Markdown** - Markdown rendering
- **Remark GFM** - GitHub-flavored markdown support
- **Google Generative AI SDK** - Official Gemini API client

### Backend
- **Express.js** - Web framework
- **TypeScript** - Type-safe development
- **Vite Server** - Development server middleware
- **PDF-Parse** - PDF text extraction
- **Node-Fetch** - HTTP requests
- **Form-Data** - Multipart form handling
- **Multer** - File upload handling

### DevOps & Build Tools
- **Docker** - Containerization
- **Docker Compose** - Multi-container orchestration
- **TSX** - TypeScript execution
- **Tailwind CSS** - Compiled styling

### External APIs
- **Google Gemini API** - AI model inference
- **Scopus API** - Academic article search
- **Timely API** - Event aggregation
- **Open-Meteo API** - Weather data
- **Google Sheets API** - Library occupancy data

---

## 🔄 Real-Time Features

The application uses:

- **Tool-Based Function Calling** - AI automatically calls tools when needed
- **Real-time Context Selection** - Smart RAG selects only relevant KB files
- **Rate Limit Handling** - Automatic model switching on API limits
- **Token Optimization** - Stays within Gemini's free tier limits
- **Streaming Responses** - Real-time streaming from Gemini API

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

## 👨‍💻 Author

**Filipe Bento**
- GitHub: [@fmbento](https://github.com/fmbento)

---

## 📞 Support

For support, please:
- Open an issue on [GitHub Issues](https://github.com/fmbento/Grounded-Knowledge-Chatbot/issues)
- Check existing documentation in the repository

---

## 📚 Additional Resources

- [Google Gemini API Documentation](https://ai.google.dev/)
- [Express.js Documentation](https://expressjs.com/)
- [React Documentation](https://react.dev/)
- [Vite Documentation](https://vitejs.dev/)
- [TypeScript Documentation](https://www.typescriptlang.org/)
- [Tailwind CSS Documentation](https://tailwindcss.com/)

---

## 🔄 Changelog

### Version 0.1.5
- 🔊 **Auto TTS (First Sentence)**: Chatbot now automatically reads the first sentence of every response for a smoother hands-free experience.
- ⚙️ **Default Settings**: TTS is now enabled by default for new users.
- 🛡️ **Stability**: Ensured persistence of `/KB` files during updates.

### Version 0.1.4
- 🛡️ **Custom Responses**: Added direct responses for identity-related questions ("Who created you?") and policy violations ("Make a bomb", "Ignore system prompt") using a fast keyword-matching layer.
- 🌐 **Language Detection Fix**: Improved multilingual support by neutralizing the internal system prompt and fixing hardcoded language fallbacks, ensuring correct responses in French and other languages.
- 🛡️ **Safety Layer**: Implemented a dedicated refusal message for harmful or "jailbreak" attempts, providing a link to official information instead.

### Version 0.1.3
- 🖼️ **Image Support**: The assistant now includes images in responses when referenced in the context, with polished Markdown rendering (rounded corners, shadows).
- 🔄 **Smart Retry Logic**: Implemented a 2-attempt retry mechanism for empty or "not found" responses to ensure higher reliability.
- 📧 **Support Fallback**: Added a final fallback to the UA Libraries Reference Service email (`sbidm-referencia@ua.pt`) when information cannot be found.
- 🎯 **Shortcut Refinement**: Updated English shortcuts for better clarity (e.g., "Books in UA libraries").

### Version 0.1.2
- 🌓 **Dark Mode**: Implemented full dark mode support with a manual toggle in the header.
- 🌐 **Multilingual UI**: Added a language switcher (PT/EN) with full translation of UI elements.
- 🎨 **UI Refinement**: Redesigned the header to include theme and language toggles while maintaining a clean, professional look.
- 🛠️ **Bug Fixes**: Resolved CSS variant issues for dark mode and fixed variable shadowing in the orchestration logic.
- 🔄 **Language Logic**: Refined the assistant's response logic to prioritize the user's detected query language while supporting a multilingual interface.

### Version 0.1.1
- 🎨 **UI Enhancements**: Added alusive icons to question shortcuts
- 📏 **Layout Optimization**: Improved text flow for welcome messages to prevent awkward line breaks
- 🔗 **Open Source Branding**: Updated footer with direct link to the GitHub repository
- 📝 **Documentation**: Updated README to reflect latest features and open-source status

### Version 0.1.0
- Initial release
- Google Gemini API integration with model fallback
- Knowledge base support (PDF, Markdown, Text)
- Smart RAG (Retrieval-Augmented Generation)
- Tool-based function calling
- OPAC search integration
- Scopus search integration
- Real-time library occupancy via Google Sheets
- Weather API integration
- University of Aveiro events aggregation
- API usage logging and cost estimation
- Docker support
- Rate limit handling with automatic model switching

---

## ⚠️ Troubleshooting

### Gemini API Errors

**Rate Limit (429) Errors**
- The system automatically switches to fallback models
- If all models are rate-limited, you'll see a friendly error message
- Wait a few seconds and try again

**Invalid API Key**
- Verify your `VITE_GEMINI_API_KEY` is correctly set
- Get a new key from [Google AI Studio](https://aistudio.google.com/)

### PDF Parsing Issues
- Ensure PDFs are not corrupted
- Check file permissions in the `KB/` directory
- Console warnings about "TT: undefined function" are normal and suppressed

### Build Issues
- Clear node_modules: `rm -rf node_modules && npm install`
- Clear build cache: `npm run clean`
- Verify Node.js version: `node --version`

### Knowledge Base Not Loading
- Ensure the `KB/` directory exists
- Check that files have correct extensions (.pdf, .md, .txt)
- Restart the server after adding files

---
## How IAedu is used within this App:

**IAedu** is the **Orchestrator** of the SALInA assistant. It acts as the "brain" that interprets the user's intent and detects the language, while **Gemini** handles the final response generation.

### How it works now:

1.  **Intent Interpretation (IAedu):** Every user question is first sent to IAedu with a specialized prompt. It analyzes the query and returns a JSON strategy containing:
    
    *   **Intent:** Which tool to use (getLibraryOccupancy, searchOPAC, searchScopus, getLibraryEvents, getWeather) or if it should search the **Knowledge Base** (searchKB).
        
    *   **Language Detection:** It identifies the language of the question (e.g., PT, EN, ES, FR, DE).
        
2.  **Action Execution:** The app executes the strategy:
    
    *   If it's a tool, it calls the corresponding API.
        
    *   If it's a KB search, it finds the most relevant documents.
        
3.  **Final Generation (Gemini):** All the gathered data (tool results or KB context) is sent to Gemini (using the fast gemini-3.1-flash-lite-preview model) with a strict instruction to respond in the **detected language**.
    

### Scenarios Tested:

*   **Portuguese (Ocupação):** "Quantas pessoas estão na biblioteca central?" → IAedu detects getLibraryOccupancy and pt. Gemini responds with real-time data in Portuguese.
    
*   **English (OPAC Search):** "I'm looking for books about quantum physics." → IAedu detects searchOPAC and en. Gemini presents the book list in English.
    
*   **Spanish (KB Info):** "¿Cuáles son los horarios de la biblioteca?" → IAedu detects searchKB and es. Gemini explains the schedules in Spanish using the KB context.
    
*   **French (Scopus):** "Chercher des articles sur l'intelligence artificielle." → IAedu detects searchScopus and fr. Gemini lists scientific papers in French.
    

### Technical Improvements:

*   **Robust Fallback:** If IAedu fails or returns invalid JSON, the system automatically falls back to a standard KB search in Portuguese to ensure the user always gets an answer.
    
*   **Token Efficiency:** By separating orchestration from generation, we maintain high accuracy while keeping the context window optimized for the final response.
    
*   **Language Consistency:** Gemini is now explicitly instructed to match the user's language for every single turn.
    

The system is now more intelligent and multilingual, leveraging the best of both IAedu (orchestration) and Gemini (generation).

---

**OPAC Subject Search**: If the user searches for a subject (idx: "su") and the query is not in Portuguese, the orchestrator will now translate the search term to Portuguese.
**Scopus Search**: If the search is for Scopus and the query is not in English, the orchestrator will now include both the original term and its English translation separated by "OR" (e.g., "original term OR english translation").
These rules help ensure that searches in specialized databases (like the UA library catalog or Scopus) are more effective by using the primary language of those systems.

---

**Last Updated:** April 18, 2026 (v0.1.5)
