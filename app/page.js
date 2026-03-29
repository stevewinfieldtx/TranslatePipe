'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

// ─── Language config ───────────────────────────────────────────────
// Speechmatics translation works to/from English for most pairs.
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
  title: {
    fontSize: '2.4rem',
    fontWeight: 200,
    letterSpacing: '0.15em',
    textTransform: 'uppercase',
    color: '#ffffff',
    marginBottom: '4px',
  },
  subtitle: {
    fontSize: '0.85rem',
    color: '#666',
    letterSpacing: '0.3em',
    textTransform: 'uppercase',
    marginBottom: '48px',
  },
  container: {
    width: '100%',
    maxWidth: '800px',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  directionHint: {
    textAlign: 'center',
    fontSize: '0.8rem',
    color: '#666',
    marginTop: '-8px',
  },
  langRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    justifyContent: 'center',
  },
  langLabel: {
    fontSize: '0.65rem',
    textTransform: 'uppercase',
    letterSpacing: '0.15em',
    color: '#555',
    textAlign: 'center',
    marginBottom: '4px',
  },
  select: {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '12px',
    color: '#fff',
    padding: '14px 20px',
    fontSize: '1rem',
    minWidth: '200px',
    cursor: 'pointer',
    outline: 'none',
    transition: 'border-color 0.2s',
  },
  swapBtn: {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '50%',
    width: '48px',
    height: '48px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    fontSize: '1.3rem',
    color: '#aaa',
    transition: 'all 0.2s',
    flexShrink: 0,
  },
  micBtn: (active) => ({
    width: '120px',
    height: '120px',
    borderRadius: '50%',
    border: active ? '3px solid #22c55e' : '3px solid rgba(255,255,255,0.15)',
    background: active
      ? 'radial-gradient(circle, rgba(34,197,94,0.25) 0%, rgba(34,197,94,0.05) 70%)'
      : 'radial-gradient(circle, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 70%)',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px',
    transition: 'all 0.3s ease',
    margin: '20px auto',
    boxShadow: active ? '0 0 40px rgba(34,197,94,0.2)' : 'none',
  }),
  micIcon: { fontSize: '2.2rem' },
  micLabel: {
    fontSize: '0.65rem',
    textTransform: 'uppercase',
    letterSpacing: '0.15em',
    color: '#888',
  },
  transcript: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '16px',
    padding: '24px',
    minHeight: '180px',
    maxHeight: '400px',
    overflowY: 'auto',
  },
  transcriptHeader: {
    fontSize: '0.7rem',
    textTransform: 'uppercase',
    letterSpacing: '0.2em',
    color: '#555',
    marginBottom: '12px',
  },
  originalText: {
    color: '#888',
    fontSize: '0.9rem',
    lineHeight: 1.6,
    marginBottom: '4px',
    fontStyle: 'italic',
  },
  translatedText: {
    color: '#fff',
    fontSize: '1.15rem',
    lineHeight: 1.6,
    marginBottom: '16px',
    paddingBottom: '16px',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
  },
  status: {
    textAlign: 'center',
    fontSize: '0.8rem',
    color: '#555',
    marginTop: '12px',
  },
  speakingIndicator: {
    display: 'inline-block',
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: '#22c55e',
    marginRight: '8px',
    animation: 'pulse 1s infinite',
  },
  autoSpeakToggle: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    marginTop: '8px',
  },
  toggle: (on) => ({
    width: '44px',
    height: '24px',
    borderRadius: '12px',
    background: on ? '#22c55e' : 'rgba(255,255,255,0.1)',
    cursor: 'pointer',
    position: 'relative',
    transition: 'background 0.2s',
    border: 'none',
    padding: 0,
  }),
  toggleKnob: (on) => ({
    position: 'absolute',
    top: '3px',
    left: on ? '23px' : '3px',
    width: '18px',
    height: '18px',
    borderRadius: '50%',
    background: '#fff',
    transition: 'left 0.2s',
  }),
  toggleLabel: {
    fontSize: '0.75rem',
    color: '#777',
    letterSpacing: '0.05em',
  },
};

export default function TranslatePipe() {
  const [speakLang, setSpeakLang] = useState('en');    // language you SPEAK
  const [hearLang, setHearLang] = useState('vi');      // language you HEAR (translation output)
  const [isListening, setIsListening] = useState(false);
  const [entries, setEntries] = useState([]);
  const [partial, setPartial] = useState('');
  const [status, setStatus] = useState('Pick your languages and tap the mic');
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const wsRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const audioContextRef = useRef(null);
  const processorRef = useRef(null);
  const ttsQueueRef = useRef([]);
  const isSpeakingRef = useRef(false);
  const transcriptEndRef = useRef(null);
  const lastOriginalRef = useRef('');

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

  // ─── Start ──────────────────────────────────────────────────────
  const startListening = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, sampleRate: 16000, echoCancellation: true, noiseSuppression: true },
      });
      mediaStreamRef.current = stream;

      setStatus('Getting auth token...');
      const tokenRes = await fetch('/api/speechmatics-token', { method: 'POST' });
      const tokenData = await tokenRes.json();
      if (!tokenData.key_value) {
        setStatus(`Auth failed: ${tokenData.error || 'no token'}`);
        stream.getTracks().forEach(t => t.stop());
        return;
      }

      // Connect WebSocket with source language in the URL path
      setStatus('Connecting...');
      const wsUrl = `wss://eu2.rt.speechmatics.com/v2/${speakLang}?jwt=${tokenData.key_value}`;
      console.log('Connecting to:', wsUrl.replace(tokenData.key_value, 'JWT_REDACTED'));
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket open, sending StartRecognition');
        const config = {
          message: 'StartRecognition',
          audio_format: {
            type: 'raw',
            encoding: 'pcm_f32le',
            sample_rate: 16000,
          },
          transcription_config: {
            language: speakLang,
            operating_point: 'enhanced',
            enable_partials: true,
            max_delay: 2,
          },
          translation_config: {
            target_languages: [hearLang],
            enable_partials: true,
          },
        };
        console.log('Config:', JSON.stringify(config, null, 2));
        ws.send(JSON.stringify(config));
      };

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        console.log('SM msg:', msg.message, msg.language || '');

        switch (msg.message) {
          case 'RecognitionStarted':
            setStatus(`Listening — speak ${LANGUAGES.find(l => l.code === speakLang)?.label || speakLang}`);
            setIsListening(true);
            startAudioPipeline(stream, ws);
            break;

          case 'AddPartialTranscript': {
            const text = msg.metadata?.transcript ||
              msg.results?.map(r => r.alternatives?.[0]?.content || '').join(' ') || '';
            if (text.trim()) setPartial(`[hearing] ${text.trim()}`);
            break;
          }

          case 'AddTranscript': {
            const text = msg.metadata?.transcript ||
              msg.results?.map(r => r.alternatives?.[0]?.content || '').join(' ') || '';
            if (text.trim()) {
              lastOriginalRef.current = text.trim();
              setPartial('');
            }
            break;
          }

          case 'AddPartialTranslation': {
            const pt = msg.results?.map(r => r.content).join(' ') || '';
            if (pt.trim()) setPartial(`→ ${pt.trim()}`);
            break;
          }

          case 'AddTranslation': {
            const translated = msg.results?.map(r => r.content).join(' ') || '';
            if (translated.trim()) {
              setPartial('');
              const original = lastOriginalRef.current || '...';
              setEntries(prev => [...prev, {
                original,
                translated: translated.trim(),
                lang: msg.language || hearLang,
              }]);
              speakText(translated.trim(), msg.language || hearLang);
              lastOriginalRef.current = '';
            }
            break;
          }

          case 'Error':
            console.error('SM Error:', JSON.stringify(msg));
            setStatus(`Error: ${msg.reason || msg.type || JSON.stringify(msg)}`);
            break;

          case 'EndOfTranscript':
            setStatus('Session ended');
            break;

          case 'AudioAdded':
          case 'Info':
            break; // ignore

          default:
            console.log('Unhandled SM message:', msg.message);
        }
      };

      ws.onerror = (err) => {
        console.error('WS error:', err);
        setStatus('Connection error — check console');
        stopListening();
      };

      ws.onclose = (event) => {
        console.log('WS closed:', event.code, event.reason);
        setStatus(`Disconnected (${event.code})`);
        setIsListening(false);
      };
    } catch (err) {
      console.error('Start error:', err);
      setStatus(`Error: ${err.message}`);
    }
  }, [speakLang, hearLang, speakText]);

  // ─── Audio pipeline ─────────────────────────────────────────────
  const startAudioPipeline = useCallback((stream, ws) => {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
    audioContextRef.current = audioContext;
    const source = audioContext.createMediaStreamSource(stream);
    const processor = audioContext.createScriptProcessor(4096, 1, 1);
    processorRef.current = processor;

    processor.onaudioprocess = (e) => {
      if (ws.readyState === WebSocket.OPEN) {
        const inputData = e.inputBuffer.getChannelData(0);
        ws.send(new Float32Array(inputData).buffer);
      }
    };
    source.connect(processor);
    processor.connect(audioContext.destination);
  }, []);

  // ─── Stop ───────────────────────────────────────────────────────
  const stopListening = useCallback(() => {
    if (wsRef.current) {
      try {
        if (wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ message: 'EndOfStream' }));
        }
        wsRef.current.close();
      } catch (e) { /* ignore */ }
      wsRef.current = null;
    }
    if (processorRef.current) { processorRef.current.disconnect(); processorRef.current = null; }
    if (audioContextRef.current) { audioContextRef.current.close().catch(() => {}); audioContextRef.current = null; }
    if (mediaStreamRef.current) { mediaStreamRef.current.getTracks().forEach(t => t.stop()); mediaStreamRef.current = null; }
    setIsListening(false);
    setPartial('');
    setStatus('Stopped — tap mic to restart');
  }, []);

  const swapLangs = () => {
    if (isListening) return;
    setSpeakLang(hearLang);
    setHearLang(speakLang);
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
            <div style={styles.langLabel}>I speak</div>
            <select style={styles.select} value={speakLang} onChange={(e) => setSpeakLang(e.target.value)} disabled={isListening}>
              {LANGUAGES.filter(l => l.code !== hearLang).map(l => (
                <option key={l.code} value={l.code}>{l.flag}  {l.label}</option>
              ))}
            </select>
          </div>

          <button style={styles.swapBtn} onClick={swapLangs} disabled={isListening} title="Swap languages">⇄</button>

          <div>
            <div style={styles.langLabel}>Translate to</div>
            <select style={styles.select} value={hearLang} onChange={(e) => setHearLang(e.target.value)} disabled={isListening}>
              {LANGUAGES.filter(l => l.code !== speakLang).map(l => (
                <option key={l.code} value={l.code}>{l.flag}  {l.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={styles.directionHint}>
          Speak {LANGUAGES.find(l => l.code === speakLang)?.label} → hear {LANGUAGES.find(l => l.code === hearLang)?.label}
        </div>

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
            <p style={{ color: '#444', fontStyle: 'italic', fontSize: '0.9rem' }}>Translations will appear here...</p>
          )}
          {entries.map((entry, i) => (
            <div key={i}>
              <div style={styles.originalText}>{entry.original}</div>
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
