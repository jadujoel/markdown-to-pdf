import { useState, useCallback, useRef } from "react";
import "./index.css";

type Format = "pdf" | "png";
type Tab = "paste" | "upload";

export function App() {
  const [tab, setTab] = useState<Tab>("paste");
  const [markdown, setMarkdown] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [format, setFormat] = useState<Format>("pdf");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasContent = tab === "paste" ? markdown.trim().length > 0 : file !== null;

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && (droppedFile.name.endsWith(".md") || droppedFile.name.endsWith(".markdown") || droppedFile.type === "text/markdown" || droppedFile.type === "text/plain")) {
      setFile(droppedFile);
      setError("");
    } else {
      setError("Please drop a markdown (.md) file");
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setError("");
    }
  };

  const requestConversion = async (): Promise<Blob | null> => {
    setLoading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.set("format", format);

      if (tab === "upload" && file) {
        formData.set("file", file);
      } else if (tab === "paste" && markdown.trim()) {
        formData.set("markdown", markdown);
      } else {
        setError("Please provide markdown content");
        return null;
      }

      const res = await fetch("/api/convert", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Conversion failed");
      }

      return await res.blob();
    } catch (err: any) {
      setError(err.message || "Something went wrong");
      return null;
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    const blob = await requestConversion();
    if (!blob) {
      return;
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `document.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handlePreview = async () => {
    const blob = await requestConversion();
    if (!blob) {
      return;
    }

    const url = URL.createObjectURL(blob);
    const previewWindow = window.open(url, "_blank", "noopener,noreferrer");
    if (!previewWindow) {
      setError("Preview was blocked by your browser. Please allow pop-ups and try again.");
      URL.revokeObjectURL(url);
      return;
    }

    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  return (
    <div className="container">
      <header className="header">
        <div className="logo-mark">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
        </div>
        <h1>Markdown to PDF / PNG</h1>
        <p className="subtitle">Upload or paste your markdown and get a beautifully formatted document</p>
      </header>

      <main className="main">
        {/* Tab switcher */}
        <div className="tabs">
          <button
            className={`tab ${tab === "paste" ? "active" : ""}`}
            onClick={() => setTab("paste")}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            Paste Markdown
          </button>
          <button
            className={`tab ${tab === "upload" ? "active" : ""}`}
            onClick={() => setTab("upload")}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Upload File
          </button>
        </div>

        {/* Content area */}
        <div className="content-area">
          {tab === "paste" ? (
            <textarea
              className="editor"
              placeholder={`# Hello World\n\nStart typing your markdown here...\n\n## Features\n- **Bold** and *italic* text\n- Code blocks with syntax highlighting\n- Tables, lists, and more`}
              value={markdown}
              onChange={(e) => {
                setMarkdown(e.target.value);
                setError("");
              }}
              spellCheck={false}
            />
          ) : (
            <div
              className={`dropzone ${dragOver ? "drag-over" : ""} ${file ? "has-file" : ""}`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".md,.markdown,text/markdown,text/plain"
                onChange={handleFileSelect}
                hidden
              />
              {file ? (
                <div className="file-info">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <path d="M9 15l2 2 4-4" />
                  </svg>
                  <span className="file-name">{file.name}</span>
                  <span className="file-size">{(file.size / 1024).toFixed(1)} KB</span>
                  <button
                    className="remove-file"
                    onClick={(e) => { e.stopPropagation(); setFile(null); }}
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div className="drop-prompt">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  <span className="drop-text">Drop your .md file here</span>
                  <span className="drop-subtext">or click to browse</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="controls">
          <div className="format-picker">
            <span className="format-label">Output format:</span>
            <div className="format-options">
              <button
                className={`format-btn ${format === "pdf" ? "active" : ""}`}
                onClick={() => setFormat("pdf")}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                PDF
              </button>
              <button
                className={`format-btn ${format === "png" ? "active" : ""}`}
                onClick={() => setFormat("png")}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
                PNG
              </button>
            </div>
          </div>

          <div className="action-buttons">
            <button
              className="preview-btn"
              onClick={handlePreview}
              disabled={loading || !hasContent}
            >
              {loading ? (
                <>
                  <span className="spinner" />
                  Converting...
                </>
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                  Preview
                </>
              )}
            </button>

            <button
              className="convert-btn"
              onClick={handleDownload}
              disabled={loading || !hasContent}
            >
              {loading ? (
                <>
                  <span className="spinner" />
                  Converting...
                </>
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Convert &amp; Download
                </>
              )}
            </button>
          </div>
        </div>

        {error && (
          <div className="error">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
            {error}
          </div>
        )}
      </main>

      <footer className="footer">
      </footer>
    </div>
  );
}

export default App;
