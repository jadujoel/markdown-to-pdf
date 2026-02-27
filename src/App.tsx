import { useState, useRef, useEffect } from "react";
import "./index.css";

type Format = "pdf" | "png";
type InputTab = "paste" | "upload";
type Tab = InputTab | "settings";
type ConversionSource =
  | { tab: "upload"; file: File }
  | { tab: "paste"; markdown: string };

type ConvertedBundle = {
  sourceKey: string;
  pdf: Blob;
  png: Blob;
};

export function App() {
  const PDF_IMAGE_SPLIT_SETTING_KEY = "pdf.preventImageSplit";
  const [tab, setTab] = useState<Tab>("paste");
  const [lastInputTab, setLastInputTab] = useState<InputTab>("paste");
  const [markdown, setMarkdown] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [format, setFormat] = useState<Format>("pdf");
  const [preventImageSplit, setPreventImageSplit] = useState(() => {
    if (typeof window === "undefined") {
      return true;
    }

    const saved = window.localStorage.getItem(PDF_IMAGE_SPLIT_SETTING_KEY);
    return saved === null ? true : saved === "true";
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [convertedBundle, setConvertedBundle] = useState<ConvertedBundle | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    window.localStorage.setItem(PDF_IMAGE_SPLIT_SETTING_KEY, preventImageSplit ? "true" : "false");
  }, [preventImageSplit]);

  const activeInputTab = tab === "settings" ? lastInputTab : tab;
  const hasContent = activeInputTab === "paste" ? markdown.trim().length > 0 : file !== null;

  const setInputTab = (nextTab: InputTab) => {
    setTab(nextTab);
    setLastInputTab(nextTab);
  };

  const getSourceKey = (source: ConversionSource) => {
    if (source.tab === "upload") {
      return `${source.file.name}:${source.file.size}:${source.file.lastModified}:preventSplit=${preventImageSplit}`;
    }
    return `paste:${source.markdown}:preventSplit=${preventImageSplit}`;
  };

  const createConversionSource = (uploadFile?: File): ConversionSource | null => {
    if (activeInputTab === "upload") {
      const sourceFile = uploadFile ?? file;
      if (!sourceFile) {
        return null;
      }
      return { tab: "upload", file: sourceFile };
    }

    if (!markdown.trim()) {
      return null;
    }

    return { tab: "paste", markdown };
  };

  const convertToBlob = async (source: ConversionSource, outputFormat: Format): Promise<Blob> => {
    const formData = new FormData();
    formData.set("format", outputFormat);
    formData.set("preventImageSplit", preventImageSplit ? "true" : "false");

    if (source.tab === "upload") {
      formData.set("file", source.file);
    } else {
      formData.set("markdown", source.markdown);
    }

    const res = await fetch("/api/convert", {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const json = await res.json();
      throw new Error(json.error || "Conversion failed");
    }

    return res.blob();
  };

  const convertBothFormats = async (source: ConversionSource): Promise<ConvertedBundle | null> => {
    setLoading(true);
    setError("");

    try {
      const [pdfBlob, pngBlob] = await Promise.all([
        convertToBlob(source, "pdf"),
        convertToBlob(source, "png"),
      ]);

      const bundle: ConvertedBundle = {
        sourceKey: getSourceKey(source),
        pdf: pdfBlob,
        png: pngBlob,
      };
      setConvertedBundle(bundle);
      return bundle;
    } catch (err: any) {
      setError(err.message || "Something went wrong");
      return null;
    } finally {
      setLoading(false);
    }
  };

  const requestSingleConversion = async (): Promise<Blob | null> => {
    const source = createConversionSource();
    if (!source) {
      setError("Please provide markdown content");
      return null;
    }

    if (convertedBundle && convertedBundle.sourceKey === getSourceKey(source)) {
      return format === "pdf" ? convertedBundle.pdf : convertedBundle.png;
    }

    setLoading(true);
    setError("");

    try {
      return await convertToBlob(source, format);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
      return null;
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && (droppedFile.name.endsWith(".md") || droppedFile.name.endsWith(".markdown") || droppedFile.type === "text/markdown" || droppedFile.type === "text/plain")) {
      setFile(droppedFile);
      setError("");
      setConvertedBundle(null);
      void convertBothFormats({ tab: "upload", file: droppedFile });
    } else {
      setError("Please drop a markdown (.md) file");
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setError("");
      setConvertedBundle(null);
      void convertBothFormats({ tab: "upload", file: selected });
    }
  };

  const getDownloadBaseName = (source: ConversionSource) => {
    if (source.tab === "upload") {
      const fileName = source.file.name.trim();
      const lastDotIndex = fileName.lastIndexOf(".");
      if (lastDotIndex > 0) {
        return fileName.slice(0, lastDotIndex);
      }
      if (fileName.length > 0) {
        return fileName;
      }
    }

    return "document";
  };

  const downloadBlob = (blob: Blob, extension: Format, baseName: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${baseName}.${extension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownload = async () => {
    const source = createConversionSource();
    if (!source) {
      setError("Please provide markdown content");
      return;
    }

    const sourceKey = getSourceKey(source);
    const bundle =
      convertedBundle && convertedBundle.sourceKey === sourceKey
        ? convertedBundle
        : await convertBothFormats(source);

    if (!bundle) {
      return;
    }

    const baseName = getDownloadBaseName(source);
    downloadBlob(bundle.pdf, "pdf", baseName);
    downloadBlob(bundle.png, "png", baseName);
  };

  const handlePreview = async () => {
    const blob = await requestSingleConversion();
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
            onClick={() => setInputTab("paste")}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            Paste Markdown
          </button>
          <button
            className={`tab ${tab === "upload" ? "active" : ""}`}
            onClick={() => setInputTab("upload")}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Upload File
          </button>
          <button
            className={`tab ${tab === "settings" ? "active" : ""}`}
            onClick={() => setTab("settings")}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 1v2" />
              <path d="M12 21v2" />
              <path d="M4.22 4.22l1.42 1.42" />
              <path d="M18.36 18.36l1.42 1.42" />
              <path d="M1 12h2" />
              <path d="M21 12h2" />
              <path d="M4.22 19.78l1.42-1.42" />
              <path d="M18.36 5.64l1.42-1.42" />
            </svg>
            Settings
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
                setConvertedBundle(null);
              }}
              spellCheck={false}
            />
          ) : tab === "upload" ? (
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
                    onClick={(e) => { e.stopPropagation(); setFile(null); setConvertedBundle(null); }}
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
          ) : (
            <div className="settings-panel">
              <h3>PDF Settings</h3>
              <label className="settings-toggle">
                <input
                  type="checkbox"
                  checked={preventImageSplit}
                  onChange={(e) => {
                    setPreventImageSplit(e.target.checked);
                    setConvertedBundle(null);
                  }}
                />
                <span>Keep large images on a single PDF page</span>
              </label>
              <p className="settings-help">
                When enabled, large images are scaled to fit one page to avoid splitting.
              </p>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="controls">
          <div className="format-picker">
            <span className="format-label">Preview format:</span>
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
                  Download PDF &amp; PNG
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
