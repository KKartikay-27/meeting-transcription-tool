# Meeting Transcription Tool 📝

A robust application to transcribe meetings, extract key insights, action items, and generate executive summaries. Supports audio upload/recording, Whisper transcription, LLM-based analysis, and export to PDF/Markdown/JSON.

## Features
- Audio upload/record
- Accurate transcription (Whisper)
- Key point & action item extraction (LLM)
- Executive summaries
- Export: PDF, Markdown, JSON


## Project Structure
- `backend/` — FastAPI backend (Python)
- `frontend/` — React frontend


## Getting Started

### Prerequisites
- Python 3.8+
- Node.js 16+
- npm or yarn
- Google Gemini API Key

## How It Works
1. **Upload/Record Audio**: Upload or record a meeting audio file.
2. **Transcription**: The backend uses OpenAI Whisper to transcribe the audio to text.
3. **Analysis**: The transcript is sent to Google Gemini LLM for extracting key points, action items, and a summary. _(Only the first 500 characters are sent to minimize quota usage.)_
4. **Progress Bar**: Frontend shows smooth progress and buffering spinner during processing.
5. **Export**: Download results as PDF, Markdown, or JSON.
6. **Error Handling**: If Gemini quota is exceeded, a mock response is used for demo and deliverable purposes.

## Setup Instructions

### 1. Clone the repo
```bash
git clone https://github.com/KKartikay-27/meeting-transcription-tool.git
cd meeting-transcription-tool
```

### 2. Backend Setup (FastAPI)
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

- Create a `.env` file in `backend/`:
  ```
  GOOGLE_API_KEY=your_gemini_api_key_here
  ```

### 3. Frontend Setup (React)
```bash
cd frontend
npm install
```

- Access the app at [http://localhost:3000](http://localhost:3000)


## Run Backend & Frontend Together

You can run both backend and frontend with a single command from the root directory:

```bash
npm run dev
```

This uses **concurrently** to start both servers in parallel:
- FastAPI backend (with virtual environment activation)
- React frontend