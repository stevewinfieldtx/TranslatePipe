'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

// ─── Language config ───────────────────────────────────────────────
// Speechmatics translation works to/from English. For non-English pairs,
// we'd need a pivot through English (future enhancement).
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
  langRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    justifyContent: 'center',
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
  micIcon: {
    fontSize: '2.2rem',
  },
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
    marginBottom: '8px',
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
  // ─── State ──────────────────────────────────────────────────────
  const [langA, setLangA] = useState('en');
  const [langB, setLangB] = useState('vi');
  const [isListening, setIsListening] = useState(false);
  const [entries, setEntries] = useState([]); // { original, translated, lang }
  const [partial, setPartial] = useState('');
  const [status, setStatus] = useState('Select languages and tap the mic');
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const wsRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const audioContextRef = useRef(null);
  const processorRef = useRef(null);
  const ttsQueueRef = useRef([]);
  const isSpeakingRef = useRef(false);
  const transcriptEndRef = useRef(null);

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries, partial]);

  // ─── TTS Queue ──────────────────────────────────────────────────
  const speakText = useCallback(async (text, targetLang) => {
    if (!autoSpeak || !text.trim()) return;

    ttsQueueRef.current.push({ text, targetLang });
    if (isSpeakingRef.current) return; // already processing queue

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
        console.error('TTS playback error:', err);
      }
    }

    isSpeakingRef.current = false;
    setIsSpeaking(false);
  }, [autoSpeak]);

  // ─── Start listening ────────────────────────────────────────────
  const startListening = useCallback(async () => {
    try {
      // 1. Get mic access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      mediaStreamRef.current = stream;

      // 2. Get Speechmatics temp token
      setStatus('Getting auth token...');
      const tokenRes = await fetch('/api/speechmatics-token', { method: 'POST' });
      const tokenData = await tokenRes.json();
      if (!tokenData.key_value) {
        setStatus('Auth failed — check SPEECHMATICS_API_KEY');
        stream.getTracks().forEach(t => t.stop());
        return;
      }

      // 3. Determine source language and target
      // Speechmatics transcribes in the source language and translates to target(s)
      // The user speaks Language A, we transcribe in A, translate to B
      // OR they speak Language B, we transcribe in B, translate to A
      // We use 'auto' for language detection so it handles both directions
      const sourceLang = 'auto';
      const targetLangs = [langA, langB]; // translate to both — we'll figure out which is "other"

      // 4. Connect WebSocket
      setStatus('Connecting to Speechmatics...');
      const wsUrl = `wss://eu2.rt.speechmatics.com/v2?jwt=${tokenData.key_value}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        // Send StartRecognition
        ws.send(JSON.stringify({
          message: 'StartRecognition',
          audio_format: {
            type: 'raw',
            encoding: 'pcm_f32le',
            sample_rate: 16000,
          },
          transcription_config: {
            language: sourceLang,
            operating_point: 'enhanced',
            enable_partials: true,
            max_delay: 2,
          },
          translation_config: {
            target_languages: targetLangs,
            enable_partials: true,
          },
        }));
      };

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);

        switch (msg.message) {
          case 'RecognitionStarted':
            setStatus('Listening — speak now');
            setIsListening(true);
            startAudioPipeline(stream, ws);
            break;

          case 'AddPartialTranscript': {
            const text = msg.metadata?.transcript || msg.results?.map(r =>
              r.alternatives?.[0]?.content || ''
            ).join(' ') || '';
            if (text.trim()) setPartial(text.trim());
            break;
          }

          case 'AddTranscript': {
            const text = msg.metadata?.transcript || msg.results?.map(r =>
              r.alternatives?.[0]?.content || ''
            ).join(' ') || '';
            if (text.trim()) {
              setPartial('');
              // We'll wait for the translation to pair it
            }
            break;
          }

          case 'AddPartialTranslation': {
            // Show partial translation as preview
            const partialTrans = msg.results?.map(r => r.content).join(' ') || '';
            if (partialTrans.trim()) {
              setPartial(partialTrans.trim());
            }
            break;
          }

          case 'AddTranslation': {
            // This is the final translation — the money event
            const translated = msg.results?.map(r => r.content).join(' ') || '';
            const transLang = msg.language; // which language this translation is in

            if (translated.trim()) {
              setPartial('');

              // Figure out which direction: if translated language matches langA,
              // then speaker was speaking langB (and vice versa)
              const spokenLang = transLang === langA ? langB : langA;
              const targetLang = transLang;

              // Only show translations that are in the "other" language
              // (skip the one that matches the spoken language)
              if (transLang !== spokenLang) {
                setEntries(prev => [...prev, {
                  original: `[${LANGUAGES.find(l => l.code === spokenLang)?.label || spokenLang}]`,
                  translated: translated.trim(),
                  lang: targetLang,
                }]);

                // Speak it
                speakText(translated.trim(), targetLang);
              }
            }
            break;
          }

          case 'Error':
            console.error('Speechmatics error:', msg);
            setStatus(`Error: ${msg.reason || msg.type || 'Unknown'}`);
            break;

          case 'EndOfTranscript':
            setStatus('Session ended');
            break;
        }
      };

      ws.onerror = (err) => {
        console.error('WebSocket error:', err);
        setStatus('Connection error — try again');
        stopListening();
      };

      ws.onclose = (event) => {
        console.log('WebSocket closed:', event.code, event.reason);
        if (isListening) {
          setStatus('Connection closed');
          setIsListening(false);
        }
      };

    } catch (err) {
      console.error('Start error:', err);
      setStatus(`Error: ${err.message}`);
    }
  }, [langA, langB, speakText, isListening]);

  // ─── Audio pipeline ─────────────────────────────────────────────
  const startAudioPipeline = useCallback((stream, ws) => {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)({
      sampleRate: 16000,
    });
    audioContextRef.current = audioContext;

    const source = audioContext.createMediaStreamSource(stream);

    // ScriptProcessor to capture PCM chunks
    const processor = audioContext.createScriptProcessor(4096, 1, 1);
    processorRef.current = processor;

    processor.onaudioprocess = (e) => {
      if (ws.readyState === WebSocket.OPEN) {
        const inputData = e.inputBuffer.getChannelData(0);
        // Send as raw float32 PCM
        const buffer = new Float32Array(inputData);
        ws.send(buffer.buffer);
      }
    };

    source.connect(processor);
    processor.connect(audioContext.destination);
  }, []);

  // ─── Stop listening ─────────────────────────────────────────────
  const stopListening = useCallback(() => {
    // Close WebSocket
    if (wsRef.current) {
      try {
        if (wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ message: 'EndOfStream' }));
        }
        wsRef.current.close();
      } catch (e) { /* ignore */ }
      wsRef.current = null;
    }

    // Stop audio
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
    }

    setIsListening(false);
    setPartial('');
    setStatus('Stopped — tap mic to restart');
  }, []);

  // ─── Swap languages ─────────────────────────────────────────────
  const swapLangs = () => {
    if (isListening) return; // don't swap while active
    setLangA(langB);
    setLangB(langA);
  };

  // ─── Render ─────────────────────────────────────────────────────
  return (
    <div style={styles.page}>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        select option { background: #1a1a2e; color: #fff; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
      `}</style>

      <h1 style={styles.title}>TranslatePipe</h1>
      <p style={styles.subtitle}>Pure voice translation — no AI conversation</p>

      <div style={styles.container}>
        {/* Language selectors */}
        <div style={styles.langRow}>
          <select
            style={styles.select}
            value={langA}
            onChange={(e) => setLangA(e.target.value)}
            disabled={isListening}
          >
            {LANGUAGES.filter(l => l.code !== langB).map(l => (
              <option key={l.code} value={l.code}>
                {l.flag}  {l.label}
              </option>
            ))}
          </select>

          <button
            style={styles.swapBtn}
            onClick={swapLangs}
            disabled={isListening}
            title="Swap languages"
          >
            ⇄
          </button>

          <select
            style={styles.select}
            value={langB}
            onChange={(e) => setLangB(e.target.value)}
            disabled={isListening}
          >
            {LANGUAGES.filter(l => l.code !== langA).map(l => (
              <option key={l.code} value={l.code}>
                {l.flag}  {l.label}
              </option>
            ))}
          </select>
        </div>

        {/* Mic button */}
        <button
          style={styles.micBtn(isListening)}
          onClick={isListening ? stopListening : startListening}
        >
          <span style={styles.micIcon}>{isListening ? '⏹' : '🎤'}</span>
          <span style={styles.micLabel}>{isListening ? 'Stop' : 'Translate'}</span>
        </button>

        {/* Auto-speak toggle */}
        <div style={styles.autoSpeakToggle}>
          <span style={styles.toggleLabel}>Auto-speak translations</span>
          <button
            style={styles.toggle(autoSpeak)}
            onClick={() => setAutoSpeak(!autoSpeak)}
          >
            <div style={styles.toggleKnob(autoSpeak)} />
          </button>
          {isSpeaking && <span style={styles.speakingIndicator} />}
        </div>

        {/* Transcript area */}
        <div style={styles.transcript}>
          <div style={styles.transcriptHeader}>Translation Feed</div>

          {entries.length === 0 && !partial && (
            <p style={{ color: '#444', fontStyle: 'italic', fontSize: '0.9rem' }}>
              Translations will appear here...
            </p>
          )}

          {entries.map((entry, i) => (
            <div key={i}>
              <div style={styles.originalText}>{entry.original}</div>
              <div style={styles.translatedText}>{entry.translated}</div>
            </div>
          ))}

          {partial && (
            <div style={{ color: '#666', fontSize: '0.95rem', fontStyle: 'italic' }}>
              {partial}...
            </div>
          )}

          <div ref={transcriptEndRef} />
        </div>

        {/* Status */}
        <div style={styles.status}>{status}</div>
      </div>
    </div>
  );
}
