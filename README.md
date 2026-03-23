# 🤖 Grounded-Knowledge-Chatbot

## 📋 Overview

**Grounded-Knowledge-Chatbot** is an intelligent conversational AI system designed to provide reliable, knowledge-base-grounded responses. It integrates with multiple academic and research APIs, supports PDF knowledge base ingestion, and leverages the IAEDU AI platform for advanced natural language understanding.

The system features:
- 📚 Multi-source knowledge base support (PDF, Markdown, Text files)
- 🔗 Integration with academic search APIs (OPAC, Scopus)
- 🎓 University of Aveiro event aggregation
- 🤖 AI-powered responses via IAEDU integration
- 📊 API usage logging and cost estimation
- 🌐 Real-time streaming responses
- 📱 Responsive React frontend
- 🐳 Docker support for easy deployment
- 🔄 Full TypeScript support with type safety

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** (v16 or higher)
- **npm** (v7 or higher)
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
# Server
NODE_ENV=development
PORT=3000

# IAEDU API Configuration
IAEDU_ENDPOINT=https://api.iaedu.pt/v1/chat
IAEDU_API_KEY=your-iaedu-api-key
IAEDU_CHANNEL_ID=your-channel-id
IAEDU_THREAD_ID=your-thread-id
IAEDU_USER_INFO={"name":"Your Bot Name"}

# Academic APIs
SCOPUS_API_KEY=your-scopus-api-key
TIMELY_API_KEY=your-timely-api-key

# Google Generative AI (optional)
GOOGLE_GENAI_API_KEY=your-google-genai-key
```

**Important:** 
- IAEDU credentials are required for chat functionality
- Scopus and Timely API keys enable academic search and event features
- Knowledge base files should be placed in the `KB/` directory

---

## 📁 Project Structure

```
Grounded-Knowledge-Chatbot/
├── src/
│   ├── App.tsx          # Main React application component
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

## 📚 Knowledge Base

The chatbot uses a local knowledge base to ground its responses. Supported file formats:

- **PDF files** (.pdf) - Automatically parsed and indexed
- **Markdown files** (.md) - For structured documentation
- **Text files** (.txt) - Plain text content

### Adding Knowledge Base Files

1. Create a `KB/` directory in the project root (if not exists)
2. Place your files in the `KB/` directory
3. Restart the server to index new files
4. Files are accessible via `/api/kb` endpoint and `/kb-files/{filename}` for downloads

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

### Chat & AI
- `POST /api/chat` - Send message to IAEDU chatbot with streaming response
- `POST /api/log-usage` - Log API usage metrics and costs

### Request/Response Examples

**Chat Request:**
```json
{
  "message": "What are the latest research trends in AI?",
  "history": [],
  "systemInstruction": "You are a knowledgeable librarian assistant"
}
```

**Chat Response:** Streamed text chunks
```
The latest research trends in AI...
```

**KB Files Request:**
```
GET /api/kb
```

**KB Files Response:**
```json
[
  {
    "name": "document.pdf",
    "content": "...",
    "size": 1024,
    "type": ".pdf",
    "downloadUrl": "/kb-files/document.pdf"
  }
]
```

---

## 🔄 Real-Time Features

The application uses **streaming responses** for:

- **Chat responses** - Real-time token streaming from IAEDU API
- **API proxying** - Seamless integration with external academic databases
- **Event aggregation** - Live university events fetching

---

## 🎨 Technology Stack

### Frontend
- **React 19** - Modern UI framework
- **Vite** - Lightning-fast build tool
- **Tailwind CSS** - Utility-first styling
- **Lucide React** - Icon library
- **Motion** - Animation library
- **React Markdown** - Markdown rendering
- **Remark GFM** - GitHub-flavored markdown support

### Backend
- **Express.js** - Web framework
- **TypeScript** - Type-safe development
- **Vite Server** - Development server middleware
- **PDF-Parse** - PDF text extraction
- **Node-Fetch** - HTTP requests
- **Form-Data** - Multipart form handling
- **Multer** - File upload handling
- **Google GenAI** - AI integration support

### DevOps & Build Tools
- **Docker** - Containerization
- **Docker Compose** - Multi-container orchestration
- **TSX** - TypeScript execution
- **Tailwind CSS** - Compiled styling

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

- [Express.js Documentation](https://expressjs.com/)
- [React Documentation](https://react.dev/)
- [Vite Documentation](https://vitejs.dev/)
- [TypeScript Documentation](https://www.typescriptlang.org/)
- [Tailwind CSS Documentation](https://tailwindcss.com/)

---

## 🔄 Changelog

### Version 0.1.0
- Initial release
- Knowledge base integration (PDF, MD, TXT)
- OPAC search proxy
- Scopus search integration
- University of Aveiro events API
- IAEDU chatbot integration
- API usage logging
- Docker support

---

## ⚠️ Troubleshooting

### PDF Parsing Issues
- Ensure PDFs are not corrupted
- Check file permissions in the `KB/` directory
- Console warnings about "TT: undefined function" are normal and suppressed

### API Connection Errors
- Verify all required environment variables are set
- Check API keys and endpoints are correct
- Ensure network connectivity to external services

### Build Issues
- Clear node_modules: `rm -rf node_modules && npm install`
- Clear build cache: `npm run clean`
- Verify Node.js version: `node --version`

---

**Last Updated:** March 23, 2026
