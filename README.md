<div align="center" style="border-bottom: none">
    <h1>
        <img src="docs/MIA%20Meeting%20Intelligence%20Dashboard.png" style="border-radius: 10px;" alt="MIA Banner" />
        <br>
        MIA - Meeting Intelligence & Action Engine
    </h1>
    <p>
        <b>Turn every meeting into clear insights and real actions. Built entirely for your local machine.</b>
    </p>
</div>

---

## 🚀 Introduction

Welcome to **MIA (Meeting Intelligence & Action Engine)**! We built this application to solve a critical problem: taking meeting notes without compromising data privacy. 

Cloud-based meeting transcription tools send highly sensitive conversations to third-party servers, creating significant privacy risks. **MIA runs entirely locally on your machine.** It captures your meeting audio, transcribes it in real-time, and generates intelligent summaries—all without your audio ever leaving your device.

## 🛠️ How It Works

MIA operates in a seamless, three-step pipeline:

1. **Audio Capture**: Using cross-platform native APIs, MIA captures both your microphone input and system audio simultaneously. It intelligently mixes them with professional loudness normalization to prevent distortion.
2. **Real-time Transcription**: The captured audio is streamed into our local AI transcription engine (Whisper or Parakeet). The speech is transcribed into text in real-time right before your eyes.
3. **Speaker Diarization**: The captured audio is analyzed by a local neural network to distinguish between different speakers. It identifies participants, isolates audio samples, and assigns names directly to the transcript in a fully offline pipeline.
4. **AI Summarization**: Once the meeting ends, the transcript is passed to a Large Language Model (LLM) which analyzes the text, extracts key action items, and formats a clean, comprehensive summary.

## 🧠 Models & Libraries Used

We engineered MIA using a modern, highly optimized technology stack to ensure it runs efficiently on consumer hardware.

### AI Models (Local & Cloud Options)
* **Transcription Models**: 
  * **Whisper** (by OpenAI): Integrated directly for highly accurate, offline speech-to-text.
  * **Parakeet** (by NVIDIA): Converted to ONNX format for lightning-fast transcription.
* **Speaker Diarization Models**:
  * **Pyannote**: We use a highly optimized, 512-dimensional ONNX-based embedding model running via `ort` to uniquely cluster and fingerprint meeting participants with zero cloud dependencies.
* **Summarization Models**:
  * **Ollama (Local)**: We support connecting to your local Ollama instance for 100% offline, private summarization using models like Llama 3 or Mistral.
  * **Cloud APIs**: Support for custom OpenAI endpoints, Claude, Groq, and OpenRouter for users who prefer cloud-powered summaries.

### Core Technology Stack
* **App Framework**: **Tauri (v2)** - Allows us to build a lightweight, cross-platform desktop application using web technologies for the UI and Rust for the heavy lifting.
* **Frontend**: 
  * **Next.js 14** & **React 18**
  * **TailwindCSS** & **Radix UI (shadcn/ui)** for a beautiful, responsive user interface.
  * **BlockNote / Tiptap** for rich-text editing of meeting notes.
* **Backend (Rust)**:
  * `whisper-rs`: Rust bindings for whisper.cpp to run inference locally.
  * `ort` (ONNX Runtime): Powers the fast execution of Parakeet models and the Pyannote speaker diarization engine.
  * `cpal`: Handles cross-platform, low-level audio capture.
  * `ffmpeg` / `symphonia`: Powers high-speed audio decoding, extraction, and slicing.
  * `sqlx` (SQLite): Manages local database storage for your notes and settings.
  * `ebur128` & `nnnoiseless`: Provides professional audio normalization and neural-network-based background noise suppression.

## 💻 Installation & Development Guide

Want to build MIA from source? Follow these steps to get a local development environment running.

### Prerequisites
Ensure you have the following installed on your machine:
* **Node.js** (v18+)
* **pnpm** (Package manager)
* **Rust** (v1.77+ with Cargo)
* **Visual Studio Build Tools** (for Windows C++ compilation requirements)

### 1. Clone & Install Dependencies
First, clone the repository and install the frontend dependencies.
```bash
git clone https://github.com/DhirajK24/Capstone-Meeting-Intelligence-Action-Engine-.git meetily
cd meetily/frontend
pnpm install
```

### 2. Run the Development Server
To launch the app in development mode with hot-reloading:
```bash
pnpm tauri:dev
```
*(Note: Initial compilation of the Rust backend, especially the AI model bindings, may take several minutes.)*

### 3. Build for Production
To create a standalone portable executable (`.exe`) that you can share with others, use the NSIS bundler to avoid global download timeouts:
```bash
pnpm tauri build --bundles nsis
```
Once completed, your executable will be located in:
`frontend/src-tauri/target/release/bundle/nsis/` (or run it directly from `target/release/meetily.exe`).

## ⚡ Hardware Acceleration

MIA is designed to take advantage of your computer's GPU to speed up transcription. Depending on your system, the Rust backend is configured to automatically utilize:
* **macOS**: Apple Metal & CoreML
* **Windows**: CUDA (NVIDIA) or Vulkan (AMD/Intel)
* **Linux**: CUDA or ROCm (HIP)

*For optimal performance on Windows with an NVIDIA GPU, ensure the CUDA Toolkit is installed and build with `cargo build --release --features cuda`.*

## 🔒 Privacy & Data Storage

All data generated by MIA stays strictly on your machine.
* **Recordings**: Temporary audio files are saved locally and automatically cleaned up.
* **Transcripts & Notes**: Stored securely in a local SQLite database in your system's AppData directory.
* **Telemetry**: Zero telemetry, zero analytics tracking.

## 🤝 Contributing & License
This project is open-source and built for the community. Contributions, pull requests, and bug reports are highly encouraged!

**License:** MIT License.
