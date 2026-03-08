"use client";

import React, { useState, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  UploadCloud, 
  FileText, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Scale, 
  Sparkles,
  RefreshCw,
  ChevronRight
} from "lucide-react";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);
  const [error, setError] = useState("");
  
  const [rewriteState, setRewriteState] = useState<Record<string, { loading: boolean; output: string; error: string }>>({});
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type === "application/pdf") {
        setFile(droppedFile);
        setAnalysis(null);
        setError("");
      } else {
        setError("Please upload a valid PDF file.");
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setAnalysis(null);
      setError("");
    }
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setLoading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error("Failed to analyze document.");
      }

      const data = await res.json();
      setAnalysis(data);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const handleRewrite = async (sentence: string) => {
    setRewriteState(prev => ({
      ...prev,
      [sentence]: { loading: true, output: "", error: "" }
    }));

    try {
      const res = await fetch("/api/rewrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sentence })
      });

      if (!res.ok) throw new Error("Failed to rewrite sentence.");
      const data = await res.json();

      setRewriteState(prev => ({
        ...prev,
        [sentence]: { loading: false, output: data.rewritten, error: "" }
      }));
    } catch (err: any) {
      setRewriteState(prev => ({
        ...prev,
        [sentence]: { loading: false, output: "", error: err.message || "Error" }
      }));
    }
  };

  return (
    <div className="min-h-screen p-6 md:p-12 lg:p-24 selection:bg-blue-500/30">
      <div className="max-w-6xl mx-auto space-y-12">
        
        {/* Header Section */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center space-y-4"
        >
          <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-blue-500/10 text-blue-500 mb-4">
            <Scale className="w-8 h-8" />
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight">
            Read<span className="text-gradient">Right</span>
          </h1>
          <p className="text-lg md:text-xl text-[var(--foreground)] opacity-70 max-w-2xl mx-auto">
            Instantly analyze legal risks, understand complex language, and rewrite confusing clauses into plain English.
          </p>
        </motion.div>

        {/* Upload Section */}
        <AnimatePresence mode="wait">
          {!analysis && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95, height: 0 }}
              className="max-w-2xl mx-auto"
            >
              <div 
                className={`
                  relative overflow-hidden rounded-3xl border-2 border-dashed transition-all duration-300
                  ${isDragActive ? 'border-blue-500 bg-blue-500/5' : 'border-[var(--card-border)] bg-[var(--card-bg)] hover:border-blue-500/50 hover:bg-black/5 dark:hover:bg-white/5'}
                  ${file ? 'border-green-500/50 bg-green-500/5' : ''}
                `}
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
              >
                <div className="p-12 text-center space-y-6 flex flex-col items-center">
                  <div className="p-4 rounded-full bg-[var(--background)] shadow-sm border border-[var(--border-subtle)]">
                    {file ? (
                      <FileText className="w-10 h-10 text-green-500" />
                    ) : (
                      <UploadCloud className="w-10 h-10 text-[var(--foreground)] opacity-50" />
                    )}
                  </div>
                  
                  <div>
                    <h3 className="text-xl font-semibold">
                      {file ? file.name : "Upload your contract"}
                    </h3>
                    <p className="text-sm opacity-60 mt-2">
                      {file ? "Ready to analyze" : "Drag and drop your PDF here, or click to browse"}
                    </p>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/pdf"
                    onChange={handleChange}
                    className="hidden"
                  />

                  <div className="flex gap-4">
                    {!file && (
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="px-6 py-3 rounded-full bg-[var(--foreground)] text-[var(--background)] font-medium hover:opacity-90 transition-opacity"
                      >
                        Select PDF
                      </button>
                    )}
                    
                    {file && (
                      <button 
                        onClick={handleAnalyze}
                        disabled={loading}
                        className="flex items-center gap-2 px-8 py-3 rounded-full bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors disabled:opacity-70"
                      >
                        {loading ? (
                          <>
                            <RefreshCw className="w-5 h-5 animate-spin" />
                            Analyzing...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-5 h-5" />
                            Analyze Document
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {error && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-4 p-4 rounded-2xl bg-red-500/10 text-red-500 border border-red-500/20 text-center text-sm font-medium"
                >
                  {error}
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results Section */}
        <AnimatePresence>
          {analysis && (
            <motion.div 
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8"
            >
              {/* Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-[var(--card-bg)] border border-[var(--card-border)]">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-blue-500" />
                  <span className="font-medium text-sm md:text-base truncate max-w-[200px] md:max-w-md">
                    {file?.name}
                  </span>
                </div>
                <button 
                  onClick={() => { setAnalysis(null); setFile(null); }}
                  className="px-4 py-2 text-sm font-medium rounded-full hover:bg-[var(--background)] transition-colors border border-[var(--border-subtle)]"
                >
                  Analyze Another
                </button>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard 
                  title="Reading Grade Level" 
                  value={analysis.grade_level.toFixed(1)} 
                  Icon={Scale} 
                  color="text-blue-500"
                />
                <MetricCard 
                  title="Est. Read Time" 
                  value={`${analysis.reading_time_minutes.toFixed(1)}m`} 
                  Icon={Clock} 
                  color="text-green-500"
                />
                <MetricCard 
                  title="Total Sentences" 
                  value={analysis.total_sentences} 
                  Icon={FileText} 
                  color="text-purple-500"
                />
                <MetricCard 
                  title="Avg Risk Score" 
                  value={analysis.average_risk_score.toFixed(2)} 
                  Icon={AlertTriangle} 
                  color={analysis.average_risk_score > 1.5 ? "text-red-500" : "text-yellow-500"}
                />
              </div>

              {/* Hotspots Section */}
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold flex items-center gap-2">
                    <AlertTriangle className="w-6 h-6 text-yellow-500" />
                    Top Risk Hotspots
                  </h2>
                  <p className="opacity-60 mt-1">Sentences flagged for confusing or overly aggressive legal language.</p>
                </div>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {analysis.top_risk_sentences.map((sentenceObj: any, idx: number) => {
                    const state = rewriteState[sentenceObj.sentence];
                    return (
                      <motion.div 
                        key={idx}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: idx * 0.1 }}
                        className="flex flex-col rounded-3xl bg-[var(--card-bg)] border border-[var(--card-border)] overflow-hidden hover:shadow-xl transition-shadow duration-300"
                      >
                        <div className="p-6 flex-grow space-y-4">
                          <div className="flex justify-between items-start">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-red-500/10 text-red-500 border border-red-500/20">
                              Risk Score: {sentenceObj.score}
                            </span>
                          </div>
                          <p className="text-sm leading-relaxed opacity-90 line-clamp-6">
                            {sentenceObj.sentence}
                          </p>
                        </div>
                        
                        <div className="p-4 bg-[var(--background)] border-t border-[var(--border-subtle)]">
                          {state?.output ? (
                            <div className="space-y-2">
                              <div className="text-xs font-bold uppercase tracking-wider text-green-500 flex items-center gap-1">
                                <CheckCircle2 className="w-4 h-4" /> Plain English
                              </div>
                              <p className="text-sm font-medium">{state.output}</p>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleRewrite(sentenceObj.sentence)}
                              disabled={state?.loading}
                              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 font-semibold text-sm transition-colors disabled:opacity-50"
                            >
                              {state?.loading ? (
                                <RefreshCw className="w-4 h-4 animate-spin" />
                              ) : (
                                <>
                                  <Sparkles className="w-4 h-4" /> Rewrite
                                </>
                              )}
                            </button>
                          )}
                          {state?.error && (
                            <div className="mt-2 text-xs text-red-500">{state.error}</div>
                          )}
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              </div>

            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}

function MetricCard({ title, value, Icon, color }: { title: string, value: string | number, Icon: any, color: string }) {
  return (
    <div className="p-6 rounded-3xl bg-[var(--card-bg)] border border-[var(--card-border)] flex flex-col gap-4 relative overflow-hidden group hover:border-[var(--primary)] transition-colors">
      <div className={`p-3 rounded-2xl w-fit ${color.replace('text-', 'bg-').replace('500', '500/10')}`}>
        <Icon className={`w-6 h-6 ${color}`} />
      </div>
      <div>
        <div className="text-3xl font-black tracking-tight">{value}</div>
        <div className="text-sm opacity-60 font-medium mt-1">{title}</div>
      </div>
      <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity transform group-hover:scale-110 duration-500">
        <Icon className="w-32 h-32" />
      </div>
    </div>
  );
}
