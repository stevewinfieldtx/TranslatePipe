'use client';

import { useState, useRef } from 'react';

// Dead simple test: one mic, one Speechmatics session, text on screen.
// No volume gate, no TTS, no dual sessions, no fancy UI.
// If this doesn't produce transcripts, the problem is fundamental.

export default function TestPage() {
  const [status, setStatus] = useState('Click Start to test');
  const [transcript, setTranscript] = useState('');
  const [logs, setLogs] = useState([]);
  const wsRef = useRef(null);
  const mediaRef = useRef(null);
  const ctxRef = useRef(null);
  const procRef = useRef(null);
  const [running, setRunning] = useState(false);

  const log = (msg) => {
    console.log(msg);
    setLogs(prev => [`${new Date().toLocaleTimeString()} ${msg}`, ...prev].slice(0, 50));
  };

  const start = async () => {
    try {
      // 1. Get mic
      log('[1] Requesting microphone...');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, sampleRate: 16000, echoCancellation: true, noiseSuppression: true },
      });
      mediaRef.current = stream;
      log('[1] Mic acquired');

      // 2. Get token
      log('[2] Fetching Speechmatics token...');
      const tokenRes = await fetch('/api/speechmatics-token');
      const tokenData = await tokenRes.json();
      if (!tokenData.key_value) {
        log(`[2] TOKEN FAILED: ${JSON.stringify(tokenData)}`);
        setStatus('Token failed');
        return;
      }
      log(`[2] Token received (${tokenData.key_value.substring(0, 20)}...)`);

      // 3. Open ONE WebSocket to Speechmatics
      log('[3] Connecting to Speechmatics (en)...');
      const ws = new WebSocket(`wss://eu2.rt.speechmatics.com/v2/en?jwt=${tokenData.key_value}`);
      wsRef.current = ws;

      ws.onopen = () => {
        log('[3] WebSocket OPEN - sending StartRecognition');
        ws.send(JSON.stringify({
          message: 'StartRecognition',
          audio_format: { type: 'raw', encoding: 'pcm_f32le', sample_rate: 16000 },
          transcription_config: {
            language: 'en',
            operating_point: 'enhanced',
            enable_partials: true,
            max_delay: 2.0,
          },
        }));
      };

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        log(`[SM] ${msg.message}`);

        if (msg.message === 'RecognitionStarted') {
          log('[4] RecognitionStarted - starting audio pipeline (NO volume gate)');
          setStatus('LISTENING - speak now!');
          setRunning(true);
          startAudio(stream, ws);
        }
        if (msg.message === 'AddPartialTranscript') {
          const text = msg.metadata?.transcript || '';
          if (text.trim()) setTranscript(text.trim());
        }
        if (msg.message === 'AddTranscript') {
          const text = msg.metadata?.transcript || msg.results?.map(r => r.alternatives?.[0]?.content || '').join(' ') || '';
          if (text.trim()) {
            log(`[TRANSCRIPT] "${text.trim()}"`);
            setTranscript(prev => prev + '\n>> ' + text.trim());
          }
        }
        if (msg.message === 'Error') {
          log(`[SM ERROR] ${JSON.stringify(msg)}`);
        }
      };

      ws.onerror = (e) => log(`[WS ERROR] ${e.type}`);
      ws.onclose = (e) => log(`[WS CLOSED] code=${e.code} reason=${e.reason}`);

    } catch (err) {
      log(`[ERROR] ${err.message}`);
      setStatus(`Error: ${err.message}`);
    }
  };

  const startAudio = (stream, ws) => {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
    ctxRef.current = audioContext;
    const source = audioContext.createMediaStreamSource(stream);
    const processor = audioContext.createScriptProcessor(4096, 1, 1);
    procRef.current = processor;

    let chunkCount = 0;

    processor.onaudioprocess = (e) => {
      if (ws.readyState !== WebSocket.OPEN) return;

      const inputData = e.inputBuffer.getChannelData(0);

      // NO VOLUME GATE - send everything
      const copy = new Float32Array(inputData.length);
      copy.set(inputData);
      ws.send(copy.buffer);

      chunkCount++;
      if (chunkCount % 30 === 0) {
        let sum = 0;
        for (let i = 0; i < inputData.length; i++) sum += inputData[i] * inputData[i];
        const rms = Math.sqrt(sum / inputData.length);
        log(`[AUDIO] Sent ${chunkCount} chunks, rms=${rms.toFixed(4)}, bytes=${copy.buffer.byteLength}`);
      }
    };

    source.connect(processor);
    processor.connect(audioContext.destination);
    log('[4] Audio pipeline running - sending ALL audio (no filter)');
  };

  const stop = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ message: 'EndOfStream' }));
      wsRef.current.close();
    }
    if (procRef.current) procRef.current.disconnect();
    if (ctxRef.current) ctxRef.current.close().catch(() => {});
    if (mediaRef.current) mediaRef.current.getTracks().forEach(t => t.stop());
    setRunning(false);
    setStatus('Stopped');
    log('[STOPPED]');
  };

  return (
    <div style={{ padding: '40px', fontFamily: 'monospace', background: '#111', color: '#eee', minHeight: '100vh' }}>
      <h1 style={{ color: '#22c55e' }}>TranslatePipe - Bare Metal Test</h1>
      <p style={{ color: '#888' }}>One mic, one Speechmatics session, text on screen. No volume gate, no TTS, no dual sessions.</p>

      <div style={{ margin: '20px 0' }}>
        <button
          onClick={running ? stop : start}
          style={{
            padding: '16px 32px', fontSize: '1.2rem', cursor: 'pointer',
            background: running ? '#ef4444' : '#22c55e', color: '#fff',
            border: 'none', borderRadius: '8px', fontWeight: 'bold',
          }}
        >
          {running ? 'STOP' : 'START TEST'}
        </button>
        <span style={{ marginLeft: '16px', color: '#888' }}>{status}</span>
      </div>

      <div style={{ background: '#1a1a2e', padding: '20px', borderRadius: '8px', marginBottom: '20px', minHeight: '100px', whiteSpace: 'pre-wrap', fontSize: '1.1rem', lineHeight: 1.6 }}>
        <div style={{ color: '#555', fontSize: '0.8rem', marginBottom: '8px' }}>TRANSCRIPT:</div>
        {transcript || '(waiting for speech...)'}
      </div>

      <div style={{ background: '#0a0a1a', padding: '16px', borderRadius: '8px', maxHeight: '300px', overflowY: 'auto', fontSize: '0.75rem', lineHeight: 1.8 }}>
        <div style={{ color: '#555', marginBottom: '8px' }}>DEBUG LOG:</div>
        {logs.map((l, i) => (
          <div key={i} style={{ color: l.includes('ERROR') ? '#ef4444' : l.includes('TRANSCRIPT') ? '#22c55e' : '#666' }}>{l}</div>
        ))}
      </div>
    </div>
  );
}
