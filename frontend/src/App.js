import React, { useState } from 'react';
import axios from 'axios';

const EXPORTS = [
  { label: 'PDF', endpoint: '/export/pdf', ext: 'pdf' },
  { label: 'Markdown', endpoint: '/export/markdown', ext: 'md' },
  { label: 'JSON', endpoint: '/export/json', ext: 'json' },
];

function App() {
  const [file, setFile] = useState(null);
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [processingStatus, setProcessingStatus] = useState('');
  const [taskId, setTaskId] = useState(null);
  const [exporting, setExporting] = useState('');
  const [exportError, setExportError] = useState('');

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
    setResponse(null);
  };

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setUploadProgress(0);
    setProcessingProgress(0);
    setProcessingStatus('');
    setTaskId(null);
    setResponse(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await axios.post('http://localhost:8000/upload-audio/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(percent);
          }
        },
      });
      if (res.data.task_id) {
        setTaskId(res.data.task_id);
        pollProgress(res.data.task_id);
      } else {
        let errorMsg = 'No task_id returned from backend.';
        setResponse({ error: errorMsg });
        setLoading(false);
      }
    } catch (err) {
      let errorMsg = err?.response?.data?.error || err?.message || JSON.stringify(err);
      setResponse({ error: errorMsg });
      setLoading(false);
    }
    setUploadProgress(0);
  };

  // Poll backend for processing progress
  const pollProgress = async (taskId) => {
    setProcessingProgress(0);
    setProcessingStatus('Queued');
    let pollInterval = 300;
    let finished = false;
    while (!finished) {
      try {
        const res = await axios.get(`http://localhost:8000/progress/${taskId}`);
        setProcessingProgress(res.data.progress || 0);
        setProcessingStatus(res.data.status || '');
        if (res.data.error) {
          let errorMsg = res.data.error;
          setResponse({ error: errorMsg });
          setLoading(false);
          finished = true;
        } else if (res.data.progress === 100 && res.data.result) {
          setResponse(res.data.result);
          setLoading(false);
          finished = true;
        } else {
          await new Promise(r => setTimeout(r, pollInterval));
        }
      } catch (err) {
        let errorMsg = err?.response?.data?.error || err?.message || JSON.stringify(err);
        setResponse({ error: errorMsg });
        setLoading(false);
        finished = true;
      }
    }
  };

  const handleExport = async (type) => {
    setExporting(type);
    setExportError('');
    try {
      const exportInfo = EXPORTS.find(e => e.ext === type);
      const res = await axios.get(`http://localhost:8000${exportInfo.endpoint}`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `meeting_summary.${exportInfo.ext}`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
    } catch (err) {
      setExportError('Export failed. Try processing a meeting first.');
    }
    setExporting('');
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(120deg,#f0f4ff 0%,#eaf6fb 100%)', padding: 0 }}>
      <div style={{ maxWidth: 900, margin: 'auto', padding: '40px 20px' }}>
        <div style={{ background: '#fff', borderRadius: 18, boxShadow: '0 4px 32px #c5d8f7a0', padding: 36, marginTop: 40 }}>
          <h1 style={{ textAlign: 'center', fontWeight: 800, fontSize: 34, color: '#2a3b5d', letterSpacing: 1, marginBottom: 8 }}>Meeting Transcription Tool <span role="img" aria-label="note">📝</span></h1>
          <p style={{ textAlign: 'center', color: '#5f6b7a', marginBottom: 32, fontSize: 18 }}>
            Upload your meeting audio, get an instant transcript, actionable insights, and export beautiful summaries.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, justifyContent: 'center', marginBottom: 24 }}>
            <input type="file" accept="audio/*" onChange={handleFileChange} style={{ fontSize: 16, padding: 6 }} />
            <button
              onClick={handleUpload}
              disabled={!file || loading}
              style={{
                background: '#3b7ddd', color: '#fff', border: 'none', borderRadius: 6, padding: '10px 22px', fontWeight: 600, fontSize: 16, cursor: !file || loading ? 'not-allowed' : 'pointer', boxShadow: '0 2px 8px #e0e7ff', transition: '0.2s',
              }}
            >
              {loading ? 'Processing...' : 'Upload Audio'}
            </button>
          </div>

          {/* Subtle, Professional Progress Bar Section with Spinner */}
          {(loading || processingProgress > 0) && (
            <div style={{ margin: '26px 0', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 13 }}>
              {/* Spinner */}
              {(loading || (processingProgress > 0 && processingProgress < 100)) && (
                <div style={{ marginBottom: 14 }}>
                  <svg width="28" height="28" viewBox="0 0 40 40" style={{ display: 'block', margin: '0 auto' }}>
                    <circle cx="20" cy="20" r="16" fill="none" stroke="#4c7edb33" strokeWidth="4" />
                    <circle cx="20" cy="20" r="16" fill="none" stroke="#4c7edb" strokeWidth="4" strokeLinecap="round" strokeDasharray="80 40" strokeDashoffset="0">
                      <animateTransform attributeName="transform" type="rotate" from="0 20 20" to="360 20 20" dur="0.9s" repeatCount="indefinite" />
                    </circle>
                  </svg>
                </div>
              )}
              {/* Upload Progress */}
              {uploadProgress > 0 && uploadProgress < 100 && (
                <div style={{ width: 320, height: 10, background: '#f4f6fa', borderRadius: 6, border: '1px solid #e0e7ef', overflow: 'hidden', marginBottom: 10, position: 'relative' }}>
                  <div style={{
                    width: `${uploadProgress}%`, height: '100%',
                    background: 'linear-gradient(90deg, #4c7edb 0%, #b5cbe8 100%)',
                    borderRadius: 6,
                    transition: 'width 0.5s cubic-bezier(0.4,0,0.2,1)',
                  }} />
                  <span style={{
                    position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
                    color: '#29436b', fontWeight: 500, fontSize: 13, letterSpacing: 0.5,
                  }}>{uploadProgress}%</span>
                </div>
              )}
              {/* Processing Progress */}
              {processingProgress > 0 && (
                <div style={{ width: 320, height: 12, background: '#f4f6fa', borderRadius: 6, border: '1px solid #e0e7ef', overflow: 'hidden', position: 'relative' }}>
                  <div style={{
                    width: `${processingProgress}%`, height: '100%',
                    background: 'linear-gradient(90deg, #4c7edb 0%, #b5cbe8 100%)',
                    borderRadius: 6,
                    transition: 'width 0.5s cubic-bezier(0.4,0,0.2,1)',
                  }} />
                  <span style={{
                    position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
                    color: '#29436b', fontWeight: 500, fontSize: 13, letterSpacing: 0.5,
                  }}>{processingStatus ? `${processingStatus} ` : ''}{processingProgress}%</span>
                </div>
              )}
            </div>
          )}

          {response?.error && (
            <div style={{ color: '#d32f2f', background: '#fff3f2', border: '1px solid #f9c0c0', padding: 12, borderRadius: 8, margin: '18px 0', fontWeight: 600, textAlign: 'center' }}>
              Error: {typeof response.error === 'string' ? response.error : JSON.stringify(response.error)}
            </div>
          )}
          {response && !response.error && (
            <>
              {/* Export Buttons */}
              <div style={{ display: 'flex', gap: 16, justifyContent: 'flex-end', marginBottom: 10 }}>
                {EXPORTS.map(exp => (
                  <button
                    key={exp.ext}
                    onClick={() => handleExport(exp.ext)}
                    disabled={!!exporting}
                    style={{
                      background: exporting === exp.ext ? '#b9c9e8' : '#3b7ddd',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 6,
                      padding: '8px 18px',
                      fontWeight: 600,
                      fontSize: 15,
                      cursor: exporting ? 'not-allowed' : 'pointer',
                      boxShadow: '0 2px 8px #e0e7ff',
                      transition: '0.2s',
                    }}
                  >
                    {exporting === exp.ext ? `Exporting ${exp.label}...` : `Export as ${exp.label}`}
                  </button>
                ))}
              </div>
              {exportError && (
                <div style={{ color: '#d32f2f', background: '#fff3f2', border: '1px solid #f9c0c0', padding: 10, borderRadius: 7, marginBottom: 8, textAlign: 'center' }}>{exportError}</div>
              )}
              <div style={{ borderTop: '1.5px solid #e0e7ff', margin: '18px 0 0 0' }} />
              <section style={{ marginTop: 30 }}>
                <h2 style={{ color: '#2a3b5d', fontWeight: 700, fontSize: 24, marginBottom: 10 }}>Executive Summary</h2>
                <div style={{ background: '#e8f4ff', padding: 16, borderRadius: 8, fontSize: 17, color: '#2a3b5d', whiteSpace: 'pre-wrap' }}>{response.summary}</div>
              </section>
              <section style={{ marginTop: 32 }}>
                <h2 style={{ color: '#2a3b5d', fontWeight: 700, fontSize: 22, marginBottom: 8 }}>Key Discussion Points</h2>
                <ul style={{ fontSize: 16, color: '#3b4a63', paddingLeft: 22 }}>
                  {response.key_points && response.key_points.length > 0 ? (
                    response.key_points.map((pt, i) => <li key={i}>{pt}</li>)
                  ) : (
                    <li>No key points extracted.</li>
                  )}
                </ul>
              </section>
              <section style={{ marginTop: 32 }}>
                <h2 style={{ color: '#2a3b5d', fontWeight: 700, fontSize: 22, marginBottom: 8 }}>Action Items</h2>
                <ul style={{ fontSize: 16, color: '#3b4a63', paddingLeft: 22 }}>
                  {response.action_items && response.action_items.length > 0 ? (
                    response.action_items.map((item, i) => <li key={i}>{item}</li>)
                  ) : (
                    <li>No action items extracted.</li>
                  )}
                </ul>
              </section>
              <section style={{ marginTop: 32, marginBottom: 10 }}>
                <h2 style={{ color: '#2a3b5d', fontWeight: 700, fontSize: 22, marginBottom: 8 }}>Full Transcript</h2>
                <div style={{ background: '#f8f8f8', padding: 14, borderRadius: 8, fontSize: 15, color: '#333', whiteSpace: 'pre-wrap', border: '1px solid #e0e7ff' }}>{response.transcript}</div>
              </section>
            </>
          )}
        </div>
        <footer style={{ textAlign: 'center', marginTop: 50, color: '#8fa2c2', fontSize: 15 }}>
          &copy; {new Date().getFullYear()} Meeting Transcription Tool &mdash; <span style={{ color: '#3b7ddd' }}>Cascade AI</span>
        </footer>
      </div>
    </div>
  );
}

export default App;
