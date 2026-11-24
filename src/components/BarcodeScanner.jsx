import { useState, useEffect, useRef } from 'react'

// Scanner codes barres - capture photo puis analyse
export default function BarcodeScanner({ onResult, onClose }) {
  const videoRef  = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const [ready, setReady]           = useState(false)
  const [scanning, setScanning]     = useState(false)
  const [errorType, setErrorType]   = useState('')
  const [manualCode, setManualCode] = useState('')
  const [hint, setHint]             = useState('')

  useEffect(() => {
    startCamera()
    return function() {
      if (streamRef.current) streamRef.current.getTracks().forEach(function(t) { t.stop() })
    }
  }, [])

  async function startCamera() {
    try {
      var stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }
      })
      streamRef.current = stream
      var video = videoRef.current
      if (!video) return
      video.srcObject = stream
      video.play()
      video.oncanplay = function() { setReady(true) }
    } catch(e) {
      if (e.name === 'NotAllowedError') setErrorType('PERMISSION_DENIED')
      else setErrorType('OTHER')
    }
  }

  // L'utilisateur appuie sur le bouton -> on capture une image et on analyse
  async function captureAndScan() {
    var video = videoRef.current
    var canvas = canvasRef.current
    if (!video || !canvas) return
    setScanning(true)
    setHint('')

    // Capturer le frame actuel en haute resolution
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    var ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0)

    // Essai 1 : BarcodeDetector natif
    if ('BarcodeDetector' in window) {
      try {
        var detector = new window.BarcodeDetector({
          formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code']
        })
        var results = await detector.detect(canvas)
        if (results && results.length > 0) {
          stopAndReturn(results[0].rawValue)
          return
        }
      } catch(e) {}
    }

    // Essai 2 : envoyer l'image a Open Food Facts via leur API scan
    // (pas possible directement, mais on peut essayer via un service tiers)

    // Essai 3 : lire les pixels et chercher manuellement via API externe
    // On convertit le canvas en blob et on appelle quagga via worker
    try {
      var blob = await new Promise(function(res) { canvas.toBlob(res, 'image/jpeg', 0.95) })
      var url = URL.createObjectURL(blob)

      // Charger Quagga si pas dispo
      if (!window.Quagga) {
        await new Promise(function(res, rej) {
          var s = document.createElement('script')
          s.src = 'https://cdnjs.cloudflare.com/ajax/libs/quagga/0.12.1/quagga.min.js'
          s.onload = res; s.onerror = rej
          document.head.appendChild(s)
        })
      }

      await new Promise(function(resolve) {
        window.Quagga.decodeSingle({
          decoder: { readers: ['ean_reader', 'ean_8_reader', 'upc_reader', 'upc_e_reader', 'code_128_reader'] },
          locate: true,
          src: url
        }, function(result) {
          URL.revokeObjectURL(url)
          if (result && result.codeResult && result.codeResult.code) {
            stopAndReturn(result.codeResult.code)
          } else {
            setHint('Code non detecte. Rapproche-toi et reessaie.')
            setScanning(false)
          }
          resolve()
        })
      })
    } catch(e) {
      setHint('Erreur. Essaie la saisie manuelle.')
      setScanning(false)
    }
  }

  function stopAndReturn(code) {
    if (streamRef.current) streamRef.current.getTracks().forEach(function(t) { t.stop() })
    onResult(code)
  }

  function submitManual() {
    if (manualCode.length >= 8) {
      if (streamRef.current) streamRef.current.getTracks().forEach(function(t) { t.stop() })
      onResult(manualCode)
    }
  }

  if (errorType) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
        <div style={{ background: 'white', borderRadius: '16px', padding: '1.5rem', width: '100%', maxWidth: '400px', textAlign: 'center' }}>
          <div style={{ fontSize: '36px', marginBottom: '12px' }}>🔒</div>
          <div style={{ fontSize: '15px', fontWeight: '500', marginBottom: '8px' }}>Permission camera refusee</div>
          <div style={{ fontSize: '13px', color: '#666', marginBottom: '16px', lineHeight: 1.6 }}>
            Dans Chrome : icone cadenas dans la barre adresse → Camera → Autoriser.
          </div>
          <div style={{ fontSize: '13px', fontWeight: '500', marginBottom: '8px' }}>Ou saisis le code manuellement :</div>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <input autoFocus value={manualCode} onChange={e => setManualCode(e.target.value.replace(/\D/g, ''))}
              onKeyDown={e => e.key === 'Enter' && submitManual()} placeholder="3017620422003" maxLength={14}
              style={{ flex: 1, padding: '10px', border: '0.5px solid #ddd', borderRadius: '8px', fontSize: '15px', outline: 'none', fontFamily: 'monospace', textAlign: 'center' }} />
          </div>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
            <button onClick={submitManual} disabled={manualCode.length < 8}
              style={{ padding: '10px 18px', background: '#1D9E75', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '500', opacity: manualCode.length < 8 ? 0.5 : 1 }}>
              Rechercher
            </button>
            <button onClick={onClose} style={{ padding: '10px 14px', background: 'none', border: '0.5px solid #ddd', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', color: '#555' }}>
              Annuler
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', display: 'flex', flexDirection: 'column', zIndex: 100 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'rgba(0,0,0,0.6)' }}>
        <div style={{ color: 'white', fontSize: '15px', fontWeight: '500' }}>Scanner un code barres</div>
        <button onClick={() => { if (streamRef.current) streamRef.current.getTracks().forEach(function(t) { t.stop() }); onClose() }}
          style={{ background: 'none', border: 'none', color: 'white', fontSize: '24px', cursor: 'pointer' }}>x</button>
      </div>

      <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
        <video ref={videoRef} playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        <canvas ref={canvasRef} style={{ display: 'none' }} />

        {/* Cadre de visee */}
        {ready && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <div style={{ width: '260px', height: '120px', position: 'relative' }}>
              <div style={{ position: 'absolute', inset: 0, boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)' }} />
              <div style={{ position: 'absolute', top: 0, left: 0, width: '28px', height: '28px', borderTop: '3px solid #1D9E75', borderLeft: '3px solid #1D9E75' }} />
              <div style={{ position: 'absolute', top: 0, right: 0, width: '28px', height: '28px', borderTop: '3px solid #1D9E75', borderRight: '3px solid #1D9E75' }} />
              <div style={{ position: 'absolute', bottom: 0, left: 0, width: '28px', height: '28px', borderBottom: '3px solid #1D9E75', borderLeft: '3px solid #1D9E75' }} />
              <div style={{ position: 'absolute', bottom: 0, right: 0, width: '28px', height: '28px', borderBottom: '3px solid #1D9E75', borderRight: '3px solid #1D9E75' }} />
              <div style={{ position: 'absolute', top: '50%', left: '5%', right: '5%', height: '2px', background: 'rgba(29,158,117,0.8)', transform: 'translateY(-50%)' }} />
            </div>
          </div>
        )}

        {!ready && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ color: 'white', fontSize: '14px' }}>Demarrage...</div>
          </div>
        )}
      </div>

      {/* Bouton capture + hint */}
      <div style={{ background: 'rgba(0,0,0,0.85)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center' }}>
        {hint && <div style={{ color: '#EF9F27', fontSize: '12px', textAlign: 'center' }}>{hint}</div>}

        <button onClick={captureAndScan} disabled={!ready || scanning}
          style={{ width: '64px', height: '64px', borderRadius: '50%', background: scanning ? '#888' : '#1D9E75', border: '4px solid white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>
          {scanning ? '⏳' : '📷'}
        </button>
        <div style={{ color: '#aaa', fontSize: '12px' }}>
          {scanning ? 'Analyse en cours...' : 'Appuie pour scanner'}
        </div>

        <div style={{ display: 'flex', gap: '8px', width: '100%', alignItems: 'center' }}>
          <input value={manualCode} onChange={e => setManualCode(e.target.value.replace(/\D/g, ''))}
            onKeyDown={e => e.key === 'Enter' && submitManual()}
            placeholder="Ou saisir le code..." maxLength={14}
            style={{ flex: 1, padding: '8px 12px', border: 'none', borderRadius: '8px', fontSize: '13px', outline: 'none', fontFamily: 'monospace', background: 'rgba(255,255,255,0.15)', color: 'white' }} />
          <button onClick={submitManual} disabled={manualCode.length < 8}
            style={{ padding: '8px 14px', background: '#1D9E75', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '500', opacity: manualCode.length < 8 ? 0.4 : 1 }}>
            OK
          </button>
        </div>
      </div>
    </div>
  )
}
