<div align="center">
    <h1>
        🎙️ Privacy-First AI Meeting Assistant
    </h1>
    <p>
        <b>Capture, transcribe, and summarize meetings entirely on your local infrastructure.</b>
    </p>
</div>

---

## 📝 Overview
This is a privacy-first AI meeting assistant that runs entirely on your local machine. It captures your meetings, transcribes them in real-time, and generates summaries, all without sending any sensitive audio data to the cloud. Perfect for professionals who need to maintain complete control over their sensitive information.

## ✨ Features
- **Local First:** All audio processing is done on your machine. No audio data ever leaves your computer.
- **Real-time Transcription:** Get a live transcript of your meeting as it happens using Whisper or Parakeet models.
- **AI-Powered Summaries:** Generate summaries of your meetings using local LLMs via Ollama, or connect to your own endpoints (OpenAI, Claude, etc).
- **Hardware Acceleration:** Supports Metal & CoreML (macOS), CUDA & Vulkan (Windows/Linux) for fast AI processing.
- **Professional Audio Capture:** Captures microphone and system audio simultaneously with intelligent noise suppression.

## 🏗️ Architecture & Tech Stack
This application is built for high performance and cross-platform compatibility:
- **Frontend:** Next.js 14, React 18, TailwindCSS
- **Backend:** Rust & Tauri 2.x
- **Database:** SQLite (via sqlx)
- **AI Engine:** `whisper-rs` (Whisper) & `ort` (ONNX Runtime for Parakeet)

## 🚀 Getting Started (Development)

### Prerequisites
- Node.js (v18+)
- `pnpm`
- Rust & Cargo
- Visual Studio build tools (Windows)

### Installation
1. Install frontend dependencies:
   ```bash
   cd frontend
   pnpm install
   ```

2. Run the development server (CPU mode by default):
   ```bash
   pnpm tauri:dev
   ```

### Building for Production
To build a standalone Windows executable:
```bash
cd frontend
pnpm tauri build --bundles nsis
```
Your compiled `.exe` will be available in `target/release/`.

## 📦 Portable Distribution
To share this app with others without using an installer, create a ZIP file containing these exact files in the same folder:
1. `target/release/meetily.exe`
2. All DLLs from `target/release/` (e.g., `onnxruntime.dll`, `DirectML.dll`)
3. The sidecars from `frontend/src-tauri/binaries/`:
   - `ffmpeg-x86_64-pc-windows-msvc.exe`
   - `llama-helper-x86_64-pc-windows-msvc.exe`

## 🤝 Contributing
Feel free to open issues or submit pull requests if you want to improve this project.

## 📄 License
MIT License
