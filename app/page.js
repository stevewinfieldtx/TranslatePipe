'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

// ─── Language config ───────────────────────────────────────────────
const LANGUAGES = [
  { code: 'en', label: 'English',    flag: '🇺🇸' },
  { code: 'vi', label: 'Vietnamese', flag: '🇻🇳' },
  { code: 'es', label: 'Spanish',    flag: '🇪🇸' },
  { code: 'fr', label: 'French',     flag: '🇫🇷' },
  { code: 'de', label: 'German',     flag: '🇩🇪' },
  { code: 'ja', label: 'Japanese',   flag: '🇯🇵' },
  { code: 'ko', label: 'Korean',     flag: '🇰🇷' },
  { code: 'zh', label: 'Chinese',    flag: '🇨🇳' },
  { code: 'pt', label: 'Portuguese', flag: '🇧🇷' },
  { code: 'th', label: 'Thai',       flag: '🇹🇭' },
  { code: 'hi', label: 'Hindi',      flag: '🇮🇳' },
];

const getLangLabel = (code) => LANGUAGES.find(l => l.code === code)?.label || code;

// ─── Styles ────────────────────────────────────────────────────────
const styles = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(145deg, #0a0a0f 0%, #12121f 50%, #0a0f1a 100%)',
    color: '#e0e0e0',
    fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '40px 20px',
  },
  title: { fontSize: '2.4rem', fontWeight: 200, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#ffffff', marginBottom: '4px' },
  subtitle: { fontSize: '0.85rem', color: '#666', letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: '48px' },
  container: { width: '100%', maxWidth: '800px', display: 'flex', flexDirection: 'column', gap: '24px' },
  langRow: { display: 'flex', alignItems: 'center', gap: '16px', justifyContent: 'center' },
  langLabel: { fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.15em', color: '#555', textAlign: 'center', marginBottom: '4px' },
  select: {
    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '12px', color: '#fff', padding: '14px 20px', fontSize: '1rem',
    minWidth: '200px', cursor: 'pointer', outline: 'none',
  },
  swapBtn: {
    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '50%', width: '48px', height: '48px', display: 'flex',
    alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
    fontSize: '1.3rem', color: '#aaa', flexShrink: 0,
  },
  micBtn: (active) => ({
    width: '120px', height: '120px', borderRadius: '50%',
    border: active ? '3px solid #22c55e' : '3px solid rgba(255,255,255,0.15)',
    background: active
      ? 'radial-gradient(circle, rgba(34,197,94,0.25) 0%, rgba(34,197,94,0.05) 70%)'
      : 'radial-gradient(circle, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 70%)',
    cursor: 'pointer', display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', gap: '4px',
    transition: 'all 0.3s ease', margin: '20px auto',
    boxShadow: active ? '0 0 40px rgba(34,197,94,0.2)' : 'none',
  }),
  micIcon: { fontSize: '2.2rem' },
  micLabel: { fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.15em', color: '#888' },
  transcript: {
    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '16px', padding: '24px', minHeight: '180px', maxHeight: '400px', overflowY: 'auto',
  },
  transcriptHeader: { fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.2em', color: '#555', marginBottom: '12px' },
  originalText: { color: '#888', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '4px', fontStyle: 'italic' },
  translatedText: { color: '#fff', fontSize: '1.15rem', lineHeight: 1.6, marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.04)' },
  status: { textAlign: 'center', fontSize: '0.8rem', color: '#555', marginTop: '12px' },
  speakingIndicator: { display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e', marginRight: '8px', animation: 'pulse 1s infinite' },
  autoSpeakToggle: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginTop: '8px' },
  toggle: (on) => ({ width: '44px', height: '24px', borderRadius: '12px', background: on ? '#22c55e' : 'rgba(255,255,255,0.1)', cursor: 'pointer', position: 'relative', border: 'none', padding: 0 }),
  toggleKnob: (on) => ({ position: 'absolute', top: '3px', left: on ? '23px' : '3px', width: '18px', height: '18px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }),
  toggleLabel: { fontSize: '0.75rem', color: '#777', letterSpacing: '0.05em' },
  dualIndicator: {
    display: 'flex', justifyContent: 'center', gap: '32px', padding: '8px 0',
  },
  channelDot: (active) => ({
    display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: active ? '#22c55e' : '#444',
  }),
  dot: (active) => ({
    width: '8px', height: '8px', borderRadius: '50%',
    background: active ? '#22c55e' : '#333',
    animation: active ? 'pulse 1s infinite' : 'none',
  }),
};

// ─── Helper: create one Speechmatics WebSocket session ────────────
function createSmSession({ jwt, sourceLang, targetLang, onTranslation, onPartial, onStatus, onError }) {
  const wsUrl = `wss://eu2.rt.speechmatics.com/v2/${sourceLang}?jwt=${jwt}`;
  const ws = new WebSocket(wsUrl);
  let lastOriginal = '';

  ws.onopen = () => {
    ws.send(JSON.stringify({
      message: 'StartRecognition',
      audio_format: { type: 'raw', encoding: 'pcm_f32le', sample_rate: 16000 },
      transcription_config: {
        language: sourceLang,
        operating_point: 'enhanced',
        enable_partials: true,
        max_delay: 2,
      },
      translation_config: {
        target_languages: [targetLang],
        enable_partials: true,
      },
    }));
  };

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    switch (msg.message) {
      case 'RecognitionStarted':
        onStatus(`${getLangLabel(sourceLang)} channel ready`);
        break;
      case 'AddPartialTranscript': {
        const text = msg.metadata?.transcript || msg.results?.map(r => r.alternatives?.[0]?.content || '').join(' ') || '';
        if (text.trim()) onPartial(`[${getLangLabel(sourceLang)}] ${text.trim()}`);
        break;
      }
      case 'AddTranscript': {
        const text = msg.metadata?.transcript || msg.results?.map(r => r.alternatives?.[0]?.content || '').join(' ') || '';
        if (text.trim()) lastOriginal = text.trim();
        break;
      }
      case 'AddPartialTranslation': {
        const pt = msg.results?.map(r => r.content).join(' ') || '';
        if (pt.trim()) onPartial(`→ ${pt.trim()}`);
        break;
      }
      case 'AddTranslation': {
        const translated = msg.results?.map(r => r.content).join(' ') || '';
        if (translated.trim()) {
          onTranslation({
            original: lastOriginal || '...',
            translated: translated.trim(),
            sourceLang,
            targetLang: msg.language || targetLang,
          });
          lastOriginal = '';
        }
        break;
      }
      case 'Error':
        console.error(`SM Error (${sourceLang}):`, msg);
        onError(`${getLangLabel(sourceLang)}: ${msg.reason || msg.type || 'error'}`);
        break;
    }
  };

  ws.onerror = () => onError(`${getLangLabel(sourceLang)} connection error`);
  ws.onclose = (e) => console.log(`WS ${sourceLang} closed:`, e.code, e.reason);

  return ws;
}

export default function TranslatePipe() {
  const [langA, setLangA] = useState('en');
  const [langB, setLangB] = useState('vi');
  const [isListening, setIsListening] = useState(false);
  const [entries, setEntries] = useState([]);
  const [partial, setPartial] = useState('');
  const [status, setStatus] = useState('Pick languages and tap the mic');
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [channelAActive, setChannelAActive] = useState(false);
  const [channelBActive, setChannelBActive] = useState(false);

  const wsARef = useRef(null);   // Session A: listens for langA, translates to langB
  const wsBRef = useRef(null);   // Session B: listens for langB, translates to langA
  const mediaStreamRef = useRef(null);
  const audioContextRef = useRef(null);
  const processorRef = useRef(null);
  const ttsQueueRef = useRef([]);
  const isSpeakingRef = useRef(false);
  const transcriptEndRef = useRef(null);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries, partial]);

  // ─── TTS Queue ──────────────────────────────────────────────────
  const speakText = useCallback(async (text, targetLang) => {
    if (!autoSpeak || !text.trim()) return;
    ttsQueueRef.current.push({ text, targetLang });
    if (isSpeakingRef.current) return;

    while (ttsQueueRef.current.length > 0) {
      isSpeakingRef.current = true;
      setIsSpeaking(true);
      const { text: t, targetLang: lang } = ttsQueueRef.current.shift();
      try {
        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: t, language: lang }),
        });
        if (res.ok) {
          const audioBlob = await res.blob();
          const url = URL.createObjectURL(audioBlob);
          const audio = new Audio(url);
          await new Promise((resolve) => {
            audio.onended = resolve;
            audio.onerror = resolve;
            audio.play().catch(resolve);
          });
          URL.revokeObjectURL(url);
        }
      } catch (err) {
        console.error('TTS error:', err);
      }
    }
    isSpeakingRef.current = false;
    setIsSpeaking(false);
  }, [autoSpeak]);

  // ─── Start: opens TWO Speechmatics sessions ────────────────────
  const startListening = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, sampleRate: 16000, echoCancellation: true, noiseSuppression: true },
      });
      mediaStreamRef.current = stream;

      // Get token
      setStatus('Getting auth token...');
      const tokenRes = await fetch('/api/speechmatics-token', { method: 'POST' });
      const tokenData = await tokenRes.json();
      if (!tokenData.key_value) {
        setStatus(`Auth failed: ${tokenData.error || 'no token'}`);
        stream.getTracks().forEach(t => t.stop());
        return;
      }

      setStatus('Opening dual channels...');

      const handleTranslation = (entry) => {
        setPartial('');
        setEntries(prev => [...prev, entry]);
        speakText(entry.translated, entry.targetLang);
      };

      // Session A: listens for langA → translates to langB
      const wsA = createSmSession({
        jwt: tokenData.key_value,
        sourceLang: langA,
        targetLang: langB,
        onTranslation: handleTranslation,
        onPartial: setPartial,
        onStatus: (s) => { setChannelAActive(true); setStatus(s); },
        onError: (e) => setStatus(e),
      });
      wsARef.current = wsA;

      // Session B: listens for langB → translates to langA
      const wsB = createSmSession({
        jwt: tokenData.key_value,
        sourceLang: langB,
        targetLang: langA,
        onTranslation: handleTranslation,
        onPartial: setPartial,
        onStatus: (s) => { setChannelBActive(true); setStatus(s); },
        onError: (e) => setStatus(e),
      });
      wsBRef.current = wsB;

      // Wait for both to open, then start audio pipeline
      let readyCount = 0;
      const checkReady = () => {
        readyCount++;
        if (readyCount >= 2) {
          setIsListening(true);
          setStatus(`Listening for ${getLangLabel(langA)} and ${getLangLabel(langB)}`);
          startAudioPipeline(stream);
        }
      };

      // Override onopen to track readiness (after StartRecognition is sent by createSmSession)
      const origOpenA = wsA.onopen;
      wsA.onopen = (e) => { origOpenA?.(e); checkReady(); };
      const origOpenB = wsB.onopen;
      wsB.onopen = (e) => { origOpenB?.(e); checkReady(); };

    } catch (err) {
      console.error('Start error:', err);
      setStatus(`Error: ${err.message}`);
    }
  }, [langA, langB, speakText]);

  // ─── Audio pipeline: sends same mic audio to BOTH WebSockets ───
  const startAudioPipeline = useCallback((stream) => {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
    audioContextRef.current = audioContext;
    const source = audioContext.createMediaStreamSource(stream);
    const processor = audioContext.createScriptProcessor(4096, 1, 1);
    processorRef.current = processor;

    processor.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0);
      const buffer = new Float32Array(inputData).buffer;

      // Send to BOTH sessions — each one only recognizes its own language
      // and ignores audio in the other language
      if (wsARef.current?.readyState === WebSocket.OPEN) {
        wsARef.current.send(buffer.slice(0)); // clone the buffer
      }
      if (wsBRef.current?.readyState === WebSocket.OPEN) {
        wsBRef.current.send(buffer.slice(0)); // clone the buffer
      }
    };

    source.connect(processor);
    processor.connect(audioContext.destination);
  }, []);

  // ─── Stop ───────────────────────────────────────────────────────
  const stopListening = useCallback(() => {
    [wsARef, wsBRef].forEach(ref => {
      if (ref.current) {
        try {
          if (ref.current.readyState === WebSocket.OPEN) {
            ref.current.send(JSON.stringify({ message: 'EndOfStream' }));
          }
          ref.current.close();
        } catch (e) { /* ignore */ }
        ref.current = null;
      }
    });

    if (processorRef.current) { processorRef.current.disconnect(); processorRef.current = null; }
    if (audioContextRef.current) { audioContextRef.current.close().catch(() => {}); audioContextRef.current = null; }
    if (mediaStreamRef.current) { mediaStreamRef.current.getTracks().forEach(t => t.stop()); mediaStreamRef.current = null; }

    setIsListening(false);
    setChannelAActive(false);
    setChannelBActive(false);
    setPartial('');
    setStatus('Stopped — tap mic to restart');
  }, []);

  const swapLangs = () => {
    if (isListening) return;
    setLangA(langB);
    setLangB(langA);
  };

  return (
    <div style={styles.page}>
      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        select option { background: #1a1a2e; color: #fff; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
      `}</style>

      <h1 style={styles.title}>TranslatePipe</h1>
      <p style={styles.subtitle}>Pure voice translation — no AI conversation</p>

      <div style={styles.container}>
        <div style={styles.langRow}>
          <div>
            <div style={styles.langLabel}>Language A</div>
            <select style={styles.select} value={langA} onChange={(e) => setLangA(e.target.value)} disabled={isListening}>
              {LANGUAGES.filter(l => l.code !== langB).map(l => (
                <option key={l.code} value={l.code}>{l.flag}  {l.label}</option>
              ))}
            </select>
          </div>

          <button style={styles.swapBtn} onClick={swapLangs} disabled={isListening} title="Swap">⇄</button>

          <div>
            <div style={styles.langLabel}>Language B</div>
            <select style={styles.select} value={langB} onChange={(e) => setLangB(e.target.value)} disabled={isListening}>
              {LANGUAGES.filter(l => l.code !== langA).map(l => (
                <option key={l.code} value={l.code}>{l.flag}  {l.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Dual channel indicator */}
        {isListening && (
          <div style={styles.dualIndicator}>
            <div style={styles.channelDot(channelAActive)}>
              <div style={styles.dot(channelAActive)} />
              {getLangLabel(langA)} listener
            </div>
            <div style={styles.channelDot(channelBActive)}>
              <div style={styles.dot(channelBActive)} />
              {getLangLabel(langB)} listener
            </div>
          </div>
        )}

        <button style={styles.micBtn(isListening)} onClick={isListening ? stopListening : startListening}>
          <span style={styles.micIcon}>{isListening ? '⏹' : '🎤'}</span>
          <span style={styles.micLabel}>{isListening ? 'Stop' : 'Translate'}</span>
        </button>

        <div style={styles.autoSpeakToggle}>
          <span style={styles.toggleLabel}>Auto-speak translations</span>
          <button style={styles.toggle(autoSpeak)} onClick={() => setAutoSpeak(!autoSpeak)}>
            <div style={styles.toggleKnob(autoSpeak)} />
          </button>
          {isSpeaking && <span style={styles.speakingIndicator} />}
        </div>

        <div style={styles.transcript}>
          <div style={styles.transcriptHeader}>Translation Feed</div>
          {entries.length === 0 && !partial && (
            <p style={{ color: '#444', fontStyle: 'italic', fontSize: '0.9rem' }}>
              Speak in either language — translations appear here
            </p>
          )}
          {entries.map((entry, i) => (
            <div key={i}>
              <div style={styles.originalText}>[{getLangLabel(entry.sourceLang)}] {entry.original}</div>
              <div style={styles.translatedText}>{entry.translated}</div>
            </div>
          ))}
          {partial && (
            <div style={{ color: '#666', fontSize: '0.95rem', fontStyle: 'italic' }}>{partial}...</div>
          )}
          <div ref={transcriptEndRef} />
        </div>

        <div style={styles.status}>{status}</div>
      </div>
    </div>
  );
}
