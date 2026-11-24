import { useState, useEffect, useRef } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import { DecodeHintType, BarcodeFormat } from '@zxing/library'

// Scanner de codes-barres en continu : on pointe la bouteille, ça se déclenche tout seul.
// Deux moteurs en parallèle : le lecteur natif du téléphone (très bon, si dispo) + ZXing (partout).
// Aides : zoom, lampe, mise au point continue, saisie manuelle, et photo d'étiquette si pas de code.
export default function BarcodeScanner({ onResult, onClose, onLabel }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const controlsRef = useRef(null)
  const doneRef = useRef(false)
  const [ready, setReady] = useState(false)
  const [errorType, setErrorType] = useState('')
  const [manualCode, setManualCode] = useState('')
  const [slow, setSlow] = useState(false)
  const [caps, setCaps] = useState({ zoom: null, torch: false })
  const [zoom, setZoom] = useState(1)
  const [torch, setTorch] = useState(false)

  useEffect(function() {
    var timerLent = setTimeout(function() { setSlow(true) }, 7000)
    var boucle = null
    var actif = true

    async function demarrer() {
      try {
        var stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false
        })
        if (!actif) { stream.getTracks().forEach(function(t) { t.stop() }); return }
        streamRef.current = stream
        var video = videoRef.current
        video.srcObject = stream
        video.setAttribute('playsinline', 'true')
        await video.play()
        setReady(true)

        var track = stream.getVideoTracks()[0]
        var c = (track.getCapabilities && track.getCapabilities()) || {}
        try {
          if (c.focusMode && c.focusMode.indexOf('continuous') >= 0) await track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] })
        } catch (e) {}
        setCaps({ zoom: c.zoom ? { min: c.zoom.min, max: Math.min(c.zoom.max, 5), step: c.zoom.step || 0.1 } : null, torch: !!c.torch })

        // Moteur 1 : lecteur natif
        if ('BarcodeDetector' in window) {
          var detector = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'] })
          boucle = setInterval(async function() {
            if (doneRef.current || video.readyState < 2) return
            try {
              var r = await detector.detect(video)
              if (r && r.length) trouve(r[0].rawValue)
            } catch (e) {}
          }, 120)
        }

        // Moteur 2 : ZXing (en continu, mode "essaie fort")
        var hints = new Map()
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E, BarcodeFormat.CODE_128])
        hints.set(DecodeHintType.TRY_HARDER, true)
        var reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 60 })
        controlsRef.current = await reader.decodeFromVideoElement(video, function(result) {
          if (result) trouve(result.getText())
        })
      } catch (e) {
        if (!actif) return
        setErrorType(e && e.name === 'NotAllowedError' ? 'PERMISSION_DENIED' : 'OTHER')
      }
    }

    demarrer()
    return function() {
      actif = false
      clearTimeout(timerLent)
      if (boucle) clearInterval(boucle)
      arreter()
    }
    // eslint-disable-next-line
  }, [])

  function arreter() {
    try { if (controlsRef.current) controlsRef.current.stop() } catch (e) {}
    if (streamRef.current) streamRef.current.getTracks().forEach(function(t) { t.stop() })
  }

  function trouve(code) {
    if (doneRef.current) return
    code = String(code || '').replace(/\D/g, '')
    if (code.length < 8) return
    doneRef.current = true
    try { if (navigator.vibrate) navigator.vibrate(60) } catch (e) {}
    arreter()
    onResult(code)
  }

  function reglerZoom(v) {
    setZoom(v)
    var track = streamRef.current && streamRef.current.getVideoTracks()[0]
    if (track) track.applyConstraints({ advanced: [{ zoom: v }] }).catch(function() {})
  }

  function basculerLampe() {
    var track = streamRef.current && streamRef.current.getVideoTracks()[0]
    var v = !torch
    if (track) track.applyConstraints({ advanced: [{ torch: v }] }).then(function() { setTorch(v) }).catch(function() {})
  }

  function submitManual() {
    if (manualCode.length >= 8) trouve(manualCode)
  }

  function fermer() { doneRef.current = true; arreter(); onClose() }
  function versEtiquette() { doneRef.current = true; arreter(); onLabel() }

  var btnLabel = onLabel && (
    <button onClick={versEtiquette}
      style={{ padding: '10px 16px', background: '#F3E6CC', color: '#2A2118', border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: '600' }}>
      📷 Pas de code ? Photographier l'étiquette
    </button>
  )

  if (errorType) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
        <div style={{ background: 'white', borderRadius: '20px', padding: '1.5rem', width: '100%', maxWidth: '400px', textAlign: 'center' }}>
          <div style={{ fontSize: '36px', marginBottom: '12px' }}>🔒</div>
          <div style={{ fontSize: '15px', fontWeight: '600', marginBottom: '8px' }}>
            {errorType === 'PERMISSION_DENIED' ? 'Accès à la caméra refusé' : 'Caméra indisponible'}
          </div>
          <div style={{ fontSize: '13px', color: '#666', marginBottom: '16px', lineHeight: 1.6 }}>
            {errorType === 'PERMISSION_DENIED'
              ? 'Dans Chrome : icône cadenas dans la barre d’adresse → Caméra → Autoriser. (La caméra exige aussi une adresse en https.)'
              : 'Aucune caméra utilisable sur cet appareil.'}
          </div>
          <div style={{ fontSize: '13px', fontWeight: '500', marginBottom: '8px' }}>Ou saisis le code manuellement :</div>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <input autoFocus inputMode="numeric" value={manualCode} onChange={e => setManualCode(e.target.value.replace(/\D/g, ''))}
              onKeyDown={e => e.key === 'Enter' && submitManual()} placeholder="3017620422003" maxLength={14}
              style={{ flex: 1, padding: '10px', border: '1px solid #ddd', borderRadius: '10px', fontSize: '15px', outline: 'none', fontFamily: 'monospace', textAlign: 'center' }} />
          </div>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={submitManual} disabled={manualCode.length < 8}
              style={{ padding: '10px 18px', background: '#2F6B4A', color: 'white', border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: '600', opacity: manualCode.length < 8 ? 0.5 : 1 }}>
              Rechercher
            </button>
            <button onClick={onClose} style={{ padding: '10px 14px', background: 'none', border: '1px solid #ddd', borderRadius: '10px', fontSize: '13px', color: '#555' }}>
              Annuler
            </button>
          </div>
          {onLabel && <div style={{ marginTop: '12px' }}>{btnLabel}</div>}
        </div>
      </div>
    )
  }

  var coin = { position: 'absolute', width: '30px', height: '30px', borderColor: '#F3E6CC', borderStyle: 'solid', borderWidth: 0 }

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', display: 'flex', flexDirection: 'column', zIndex: 100 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'rgba(0,0,0,0.6)' }}>
        <div style={{ color: 'white', fontSize: '15px', fontWeight: '600' }}>Scanner un code-barres</div>
        <button onClick={fermer} aria-label="Fermer" style={{ background: 'none', border: 'none', color: 'white', fontSize: '26px', lineHeight: 1 }}>×</button>
      </div>

      <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
        <video ref={videoRef} playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        {ready && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <div style={{ width: '86%', maxWidth: '420px', height: '170px', position: 'relative' }}>
              <div style={{ position: 'absolute', inset: 0, boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)', borderRadius: '8px' }} />
              <div style={{ ...coin, top: 0, left: 0, borderTopWidth: '3px', borderLeftWidth: '3px', borderTopLeftRadius: '8px' }} />
              <div style={{ ...coin, top: 0, right: 0, borderTopWidth: '3px', borderRightWidth: '3px', borderTopRightRadius: '8px' }} />
              <div style={{ ...coin, bottom: 0, left: 0, borderBottomWidth: '3px', borderLeftWidth: '3px', borderBottomLeftRadius: '8px' }} />
              <div style={{ ...coin, bottom: 0, right: 0, borderBottomWidth: '3px', borderRightWidth: '3px', borderBottomRightRadius: '8px' }} />
              <div style={{ position: 'absolute', top: '50%', left: '6%', right: '6%', height: '2px', background: 'rgba(201,138,58,0.9)', transform: 'translateY(-50%)' }} />
            </div>
          </div>
        )}
        {!ready && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '14px' }}>Démarrage de la caméra…</div>}
        {ready && <div style={{ position: 'absolute', left: 0, right: 0, bottom: '12px', textAlign: 'center', color: 'white', fontSize: '13px', textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>
          Place le code dans le cadre, à 15–20 cm, sans reflet
        </div>}
      </div>

      <div style={{ background: 'rgba(0,0,0,0.88)', padding: '14px 16px calc(14px + env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'stretch' }}>
        {(caps.zoom || caps.torch) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {caps.zoom && (
              <input type="range" min={caps.zoom.min} max={caps.zoom.max} step={caps.zoom.step} value={zoom}
                onChange={e => reglerZoom(parseFloat(e.target.value))} aria-label="Zoom" style={{ flex: 1, accentColor: '#C98A3A' }} />
            )}
            {caps.torch && (
              <button onClick={basculerLampe} style={{ padding: '8px 14px', borderRadius: '10px', border: 'none', fontSize: '13px', fontWeight: '600', background: torch ? '#F3E6CC' : 'rgba(255,255,255,0.15)', color: torch ? '#2A2118' : 'white' }}>
                🔦 Lampe
              </button>
            )}
          </div>
        )}
        {slow && onLabel && <div style={{ textAlign: 'center' }}>{btnLabel}</div>}
        {slow && <div style={{ color: '#C98A3A', fontSize: '12px', textAlign: 'center' }}>Rien de détecté ? Rapproche-toi, utilise le zoom ou la lampe, ou saisis le numéro.</div>}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input inputMode="numeric" value={manualCode} onChange={e => setManualCode(e.target.value.replace(/\D/g, ''))}
            onKeyDown={e => e.key === 'Enter' && submitManual()} placeholder="Ou saisir le numéro sous le code…" maxLength={14}
            style={{ flex: 1, padding: '10px 12px', border: 'none', borderRadius: '10px', fontSize: '14px', outline: 'none', fontFamily: 'monospace', background: 'rgba(255,255,255,0.15)', color: 'white' }} />
          <button onClick={submitManual} disabled={manualCode.length < 8}
            style={{ padding: '10px 16px', background: '#2F6B4A', color: 'white', border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: '600', opacity: manualCode.length < 8 ? 0.4 : 1 }}>
            OK
          </button>
        </div>
      </div>
    </div>
  )
}
