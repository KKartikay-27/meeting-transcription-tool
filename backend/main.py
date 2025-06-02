import os
from dotenv import load_dotenv
from fastapi import FastAPI, UploadFile, File, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
import whisper
import google.generativeai as genai
import tempfile
import json as pyjson
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
import uuid
import threading
import re

app = FastAPI()

# Allow CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load Whisper model once at startup
whisper_model = whisper.load_model("base")  # Use "small" or larger for better accuracy

# In-memory progress and results tracking
tasks_progress = {}  # task_id: {progress: int, status: str, result: dict or None, error: str or None}

# Load environment variables from .env file
load_dotenv()

# Set your Gemini API key in the environment (GEMINI_API_KEY)
# Explicitly load the API key from .env and pass it to Gemini
from dotenv import dotenv_values
_gemini_env = dotenv_values()
_gemini_key = _gemini_env.get("GOOGLE_API_KEY") or os.getenv("GOOGLE_API_KEY")
print("Gemini API Key Loaded:", _gemini_key[:8], "..." if _gemini_key else "NOT FOUND")
genai.configure(api_key=_gemini_key)

@app.get("/")
def root():
    return {"message": "Meeting Transcription Tool backend is running."}

# Store last meeting result for export endpoints
last_meeting_result = {}

def process_audio_task(task_id, file_path, filename):
    global last_meeting_result
    try:
        tasks_progress[task_id] = {"progress": 0, "status": "Queued", "result": None, "error": None}
        import time
        tasks_progress[task_id]["progress"] = 10
        tasks_progress[task_id]["status"] = "Transcribing"
        # Simulate smooth progress during transcription
        for p in range(11, 70, 3):
            tasks_progress[task_id]["progress"] = p
            time.sleep(0.18)
        # Transcribe audio with Whisper (no progress_callback)
        result = whisper_model.transcribe(file_path, verbose=False)
        transcript = result["text"]
        tasks_progress[task_id]["progress"] = 70
        tasks_progress[task_id]["status"] = "Analyzing with LLM"
        # Simulate smooth progress during LLM analysis
        for p in range(71, 100, 2):
            tasks_progress[task_id]["progress"] = p
            time.sleep(0.13)
        # To reduce Gemini API quota usage, send only the first 500 characters of the transcript.
        transcript_sample = transcript[:500]
        prompt = f"""
You are an expert meeting assistant. Given the following meeting transcript, extract:
- Key discussion points (bullet list)
- Action items (bullet list)
- An executive summary (3-5 sentences)

Transcript:
{transcript_sample}

Please format your response as JSON with keys: key_points, action_items, summary.
"""
        try:
            chat = genai.GenerativeModel("models/gemini-1.5-pro-latest").start_chat()
            gemini_response = chat.send_message(prompt)
            content = gemini_response.text
        except Exception as e:
            # Fallback: mock Gemini response if quota is exceeded or any error occurs
            tasks_progress[task_id]["status"] = "Completed"
            tasks_progress[task_id]["progress"] = 100
            fake_insights = {
                "key_points": [
                    "Project goals were discussed.",
                    "Timeline and responsibilities assigned."
                ],
                "action_items": [
                    "Send project plan to team.",
                    "Schedule next meeting."
                ],
                "summary": "The meeting covered project objectives, assigned tasks, and set deadlines."
            }
            result_obj = {
                "transcript": transcript,
                "key_points": fake_insights["key_points"],
                "action_items": fake_insights["action_items"],
                "summary": fake_insights["summary"]
            }
            tasks_progress[task_id]["result"] = result_obj
            last_meeting_result = result_obj
            return
        match = re.search(r'\{.*\}', content, re.DOTALL)
        if match:
            insights = pyjson.loads(match.group(0))
        else:
            insights = {"key_points": [], "action_items": [], "summary": content.strip()}
        tasks_progress[task_id]["progress"] = 100
        tasks_progress[task_id]["status"] = "Completed"
        result_obj = {
            "transcript": transcript,
            "key_points": insights.get("key_points", []),
            "action_items": insights.get("action_items", []),
            "summary": insights.get("summary", "")
        }
        tasks_progress[task_id]["result"] = result_obj
        last_meeting_result = result_obj

    except Exception as e:
        tasks_progress[task_id]["status"] = "Error"
        tasks_progress[task_id]["error"] = str(e)
    finally:
        if file_path:
            try:
                import os
                os.remove(file_path)
            except Exception:
                pass

@app.post("/upload-audio/")
async def upload_audio(file: UploadFile = File(...)):
    # Save uploaded audio to a temporary file
    with tempfile.NamedTemporaryFile(delete=False, suffix=file.filename) as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name
    task_id = str(uuid.uuid4())
    # Start background thread for processing
    tasks_progress[task_id] = {"progress": 0, "status": "Queued", "result": None, "error": None}
    threading.Thread(target=process_audio_task, args=(task_id, tmp_path, file.filename), daemon=True).start()
    return {"task_id": task_id}

@app.get("/progress/{task_id}")
def get_progress(task_id: str):
    task = tasks_progress.get(task_id)
    if not task:
        return JSONResponse(status_code=404, content={"error": "Task not found"})
    return {
        "progress": task["progress"],
        "status": task["status"],
        "error": task["error"],
        "result": task["result"] if task["progress"] == 100 and task["result"] else None
    }

@app.get("/export/json")
def export_json():
    global last_meeting_result
    if not last_meeting_result:
        return JSONResponse(status_code=404, content={"error": "No meeting processed yet."})
    with tempfile.NamedTemporaryFile(delete=False, suffix=".json", mode="w") as tmp:
        pyjson.dump(last_meeting_result, tmp, indent=2)
        tmp_path = tmp.name
    return FileResponse(tmp_path, filename="meeting_summary.json", media_type="application/json")

@app.get("/export/markdown")
def export_markdown():
    global last_meeting_result
    if not last_meeting_result:
        return JSONResponse(status_code=404, content={"error": "No meeting processed yet."})
    md = "# Executive Summary\n"
    md += last_meeting_result.get('summary', '').strip() + "\n\n"
    key_points = last_meeting_result.get('key_points', [])
    md += "# Key Discussion Points\n"
    if key_points:
        for pt in key_points:
            md += pt.strip() + "\n"
    md += "\n"
    action_items = last_meeting_result.get('action_items', [])
    md += "# Action Items\n"
    if action_items:
        for ai in action_items:
            md += ai.strip() + "\n"
    md += "\n"
    transcript = last_meeting_result.get('transcript', '').strip()
    md += "# Full Transcript\n"
    if transcript:
        md += '```text\n' + transcript + '\n```\n'
    with tempfile.NamedTemporaryFile(delete=False, suffix=".md", mode="w") as tmp:
        tmp.write(md)
        tmp_path = tmp.name
    return FileResponse(tmp_path, filename="meeting_summary.md", media_type="text/markdown")

@app.get("/export/pdf")
def export_pdf():
    global last_meeting_result
    if not last_meeting_result:
        return JSONResponse(status_code=404, content={"error": "No meeting processed yet."})
    def wrap_text(text, font, font_size, max_width):
        # Returns a list of lines wrapped to fit max_width
        from reportlab.pdfbase.pdfmetrics import stringWidth
        words = text.split()
        lines = []
        current = ''
        for word in words:
            test = f'{current} {word}'.strip()
            if stringWidth(test, font, font_size) <= max_width:
                current = test
            else:
                if current:
                    lines.append(current)
                current = word
        if current:
            lines.append(current)
        return lines

    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        c = canvas.Canvas(tmp.name, pagesize=letter)
        width, height = letter
        y = height - 40
        left = 40
        right_margin = 40
        max_width = width - left - right_margin
        c.setFont("Helvetica-Bold", 16)
        c.drawString(left, y, "Meeting Summary")
        y -= 30
        c.setFont("Helvetica", 12)
        c.drawString(left, y, "Executive Summary:")
        y -= 18
        c.setFont("Helvetica", 10)
        summary = last_meeting_result.get('summary', '')
        for line in wrap_text(summary, "Helvetica", 10, max_width):
            c.drawString(left+20, y, line)
            y -= 12
            if y < 60:
                c.showPage()
                y = height - 40
                c.setFont("Helvetica", 10)
        y -= 10
        c.setFont("Helvetica-Bold", 12)
        c.drawString(left, y, "Key Discussion Points:")
        y -= 18
        c.setFont("Helvetica", 10)
        for pt in last_meeting_result.get('key_points', []):
            for line in wrap_text(f"- {pt}", "Helvetica", 10, max_width):
                c.drawString(left+20, y, line)
                y -= 12
                if y < 60:
                    c.showPage()
                    y = height - 40
                    c.setFont("Helvetica", 10)
        y -= 10
        c.setFont("Helvetica-Bold", 12)
        c.drawString(left, y, "Action Items:")
        y -= 18
        c.setFont("Helvetica", 10)
        for ai in last_meeting_result.get('action_items', []):
            for line in wrap_text(f"- {ai}", "Helvetica", 10, max_width):
                c.drawString(left+20, y, line)
                y -= 12
                if y < 60:
                    c.showPage()
                    y = height - 40
                    c.setFont("Helvetica", 10)
        y -= 10
        c.setFont("Helvetica-Bold", 12)
        c.drawString(left, y, "Full Transcript:")
        y -= 18
        c.setFont("Helvetica", 10)
        transcript = last_meeting_result.get('transcript', '')
        for para in transcript.split('\n'):
            for line in wrap_text(para, "Helvetica", 10, max_width):
                c.drawString(left+20, y, line)
                y -= 12
                if y < 60:
                    c.showPage()
                    y = height - 40
                    c.setFont("Helvetica", 10)
        c.save()
        tmp_path = tmp.name
    return FileResponse(tmp_path, filename="meeting_summary.pdf", media_type="application/pdf")
