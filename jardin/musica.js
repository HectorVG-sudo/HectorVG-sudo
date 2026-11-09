// ─────────────────────────────────────────────────────────────
//  Música lo-fi tranquila, generada en el navegador en tiempo real.
//  No usa archivos de audio (nada que descargar ni derechos de autor):
//  piano eléctrico, bajo suave, batería muy floja, campanitas que
//  improvisan y un poco de crujido de vinilo.
// ─────────────────────────────────────────────────────────────

const TEMPO = 72;
const NEGRA = 60 / TEMPO;
const SEMI = NEGRA / 4; // semicorchea: la música avanza de 16 en 16 pasos por compás
const VOLUMEN = 0.7;
const frecuencia = (m) => 440 * Math.pow(2, (m - 69) / 12);

// Fmaj9 → Em9 → Dm9 → Cmaj9 (la bajada clásica del lo-fi)
const ACORDES = [
  { bajo: 41, notas: [57, 60, 64, 67] },
  { bajo: 40, notas: [55, 59, 62, 66] },
  { bajo: 38, notas: [53, 57, 60, 64] },
  { bajo: 36, notas: [52, 55, 59, 62] },
];
const ESCALA = [69, 72, 74, 76, 79, 81, 84, 86]; // pentatónica para las campanitas

export function crearMusica() {
  let ctx = null;
  let final, salida, reverb, eco, teclas, bajos, bateria, campanas, ruidoBlanco;
  let paso = 0;
  let siguiente = 0;
  let nota = 3;
  let silenciada = false;

  const ganancia = (v, destino) => {
    const g = ctx.createGain();
    g.gain.value = v;
    if (destino) g.connect(destino);
    return g;
  };
  const filtro = (tipo, f, q, destino) => {
    const b = ctx.createBiquadFilter();
    b.type = tipo;
    b.frequency.value = f;
    if (q) b.Q.value = q;
    if (destino) b.connect(destino);
    return b;
  };
  const oscilador = (tipo, f, t, fin, destino) => {
    const o = ctx.createOscillator();
    o.type = tipo;
    o.frequency.setValueAtTime(f, t);
    o.connect(destino);
    o.start(t);
    o.stop(fin);
    return o;
  };
  // Envolvente: ataque rápido y caída exponencial
  const envolvente = (t, pico, ataque, dur, destino) => {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(pico, t + ataque);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(destino);
    return g;
  };

  function montar() {
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();

    final = ctx.createDynamicsCompressor();
    final.threshold.value = -18;
    final.ratio.value = 3;
    final.connect(ctx.destination);
    const calido = filtro('lowpass', 5200, 0.5, final);
    salida = ganancia(0, filtro('highpass', 55, 0.6, calido));

    // Reverb: respuesta de sala generada con ruido que se apaga
    const n = Math.floor(ctx.sampleRate * 3);
    const ir = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.6);
    }
    reverb = ctx.createConvolver();
    reverb.buffer = ir;
    reverb.connect(ganancia(0.3, salida));

    // Eco suave para las campanitas
    eco = ctx.createDelay(2);
    eco.delayTime.value = NEGRA * 0.75;
    const ecoFiltro = filtro('lowpass', 2200, 0.5);
    const ecoVuelta = ganancia(0.33, eco);
    eco.connect(ecoFiltro);
    ecoFiltro.connect(ecoVuelta);
    const ecoSalida = ganancia(0.45, salida);
    ecoSalida.connect(reverb);
    ecoFiltro.connect(ecoSalida);

    // Piano eléctrico con trémolo
    teclas = ganancia(0.95, salida);
    teclas.connect(reverb);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 3.4;
    lfo.connect(ganancia(0.08, teclas.gain));
    lfo.start();

    bajos = ganancia(0.2, filtro('lowpass', 800, 0.7, salida));

    bateria = ganancia(0.75, filtro('lowpass', 3600, 0.4, salida));
    bateria.connect(ganancia(0.12, reverb));

    campanas = ganancia(0.9, salida);
    campanas.connect(eco);
    campanas.connect(reverb);

    // Ruido blanco reutilizable (caja y platillos)
    ruidoBlanco = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const rb = ruidoBlanco.getChannelData(0);
    for (let i = 0; i < rb.length; i++) rb[i] = Math.random() * 2 - 1;

    // Crujido de vinilo en bucle
    const m = ctx.sampleRate * 4;
    const vin = ctx.createBuffer(1, m, ctx.sampleRate);
    const v = vin.getChannelData(0);
    for (let i = 0; i < m; i++) {
      v[i] = (Math.random() * 2 - 1) * 0.012;
      if (Math.random() < 0.0004) v[i] += (Math.random() < 0.5 ? -1 : 1) * (0.15 + Math.random() * 0.45);
    }
    const vinilo = ctx.createBufferSource();
    vinilo.buffer = vin;
    vinilo.loop = true;
    vinilo.connect(filtro('highpass', 900, 0.5, ganancia(0.11, salida)));
    vinilo.start();
  }

  /* ---------- Instrumentos ---------- */

  function piano(m, t, dur, vel) {
    const f = frecuencia(m) * Math.pow(2, (Math.random() - 0.5) * 0.008); // pequeña desafinación lo-fi
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vel, t + 0.012);
    g.gain.exponentialRampToValueAtTime(vel * 0.4, t + 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(teclas);
    oscilador('sine', f, t, t + dur + 0.05, g);
    oscilador('sine', f * 2.003, t, t + 0.6, envolvente(t, vel * 0.22, 0.005, 0.5, teclas)); // el «tin» del Rhodes
  }

  function bajo(m, t, dur) {
    const f = frecuencia(m);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.42, t + 0.03);
    g.gain.setTargetAtTime(0.0001, t + dur * 0.55, dur * 0.18);
    g.connect(bajos);
    oscilador('sine', f, t, t + dur + 0.4, g);
    oscilador('triangle', f, t, t + dur + 0.4, ganancia(0.45, g)); // armónicos: que se oiga en el móvil
  }

  function bombo(t, vel) {
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(115, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
    o.connect(envolvente(t, vel, 0.004, 0.34, bateria));
    o.start(t);
    o.stop(t + 0.4);
  }

  function ruido(t, dur, destino) {
    const s = ctx.createBufferSource();
    s.buffer = ruidoBlanco;
    s.connect(destino);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur);
  }

  function caja(t, vel) {
    ruido(t, 0.22, filtro('bandpass', 1700, 0.7, envolvente(t, vel * 0.55, 0.003, 0.18, bateria)));
    oscilador('sine', 185, t, t + 0.12, envolvente(t, vel * 0.3, 0.003, 0.09, bateria));
  }

  function platillo(t, vel) {
    ruido(t, 0.08, filtro('highpass', 6500, 0.5, envolvente(t, vel, 0.002, 0.05, bateria)));
  }

  function campana(m, t, vel, destino = campanas) {
    const f = frecuencia(m);
    oscilador('sine', f, t, t + 1.8, envolvente(t, vel, 0.005, 1.7, destino));
    oscilador('sine', f * 3.01, t, t + 0.8, envolvente(t, vel * 0.13, 0.003, 0.7, destino));
  }

  /* ---------- La canción ---------- */

  function tocar(p, t) {
    const enCompas = p % 16;
    const compas = Math.floor(p / 16);
    const acorde = ACORDES[compas % 4];
    if (enCompas % 4 === 2) t += SEMI * 0.32; // swing
    const puente = compas % 16 >= 14; // cada 16 compases, 2 sin batería
    const conBateria = compas >= 2 && !puente;

    if (enCompas === 0) {
      acorde.notas.forEach((m, i) => piano(m, t + i * 0.022, NEGRA * 3.6, 0.13));
      bajo(acorde.bajo, t, NEGRA * 1.8);
    }
    if (enCompas === 8) bajo(acorde.bajo + 7, t, NEGRA * 1.3);
    if (enCompas === 14) bajo(acorde.bajo + 12, t, NEGRA * 0.45);
    if (enCompas === 10 && Math.random() < 0.6) acorde.notas.slice(2).forEach((m, i) => piano(m, t + i * 0.02, NEGRA * 1.4, 0.055));

    if (conBateria) {
      if (enCompas === 0) bombo(t, 0.32);
      if (enCompas === 10) bombo(t, 0.22);
      if (enCompas === 7 && Math.random() < 0.35) bombo(t, 0.28);
      if (enCompas === 4 || enCompas === 12) caja(t, 0.5);
      if (enCompas % 2 === 0 && Math.random() > 0.08) platillo(t, 0.06 + Math.random() * 0.04);
    }

    // Campanitas que improvisan (paseo aleatorio por la escala)
    if (compas >= 1 && enCompas % 2 === 0 && Math.random() < (puente ? 0.3 : 0.17)) {
      nota = Math.max(0, Math.min(ESCALA.length - 1, nota + [-2, -1, -1, 1, 1, 2][Math.floor(Math.random() * 6)]));
      campana(ESCALA[nota], t, 0.1 + Math.random() * 0.05);
    }
  }

  function programar() {
    if (!ctx || ctx.state !== 'running') return;
    if (siguiente < ctx.currentTime) siguiente = ctx.currentTime + 0.05; // no amontonar notas atrasadas
    while (siguiente < ctx.currentTime + 0.8) {
      tocar(paso, siguiente);
      siguiente += SEMI;
      paso++;
    }
  }

  function fundir(v, seg) {
    const t = ctx.currentTime;
    salida.gain.cancelScheduledValues(t);
    salida.gain.setValueAtTime(salida.gain.value, t);
    salida.gain.linearRampToValueAtTime(v, t + seg);
  }

  return {
    get silenciada() { return silenciada; },

    // Llamar dentro de un toque/clic (los navegadores lo exigen para sonar)
    iniciar() {
      if (ctx) return;
      try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch {} // suena aunque el iPhone esté en silencio
      try { montar(); } catch { ctx = null; return; }
      ctx.resume?.();
      siguiente = ctx.currentTime + 0.2;
      setInterval(programar, 120);
      if (!silenciada) fundir(VOLUMEN, 4);
      else ctx.suspend();
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) ctx.suspend();
        else if (!silenciada) ctx.resume().then(() => { siguiente = Math.max(siguiente, ctx.currentTime + 0.1); });
      });
    },

    silenciar(si) {
      silenciada = si;
      if (!ctx) return;
      if (si) {
        fundir(0, 0.6);
        setTimeout(() => silenciada && ctx.suspend(), 700);
      } else {
        ctx.resume().then(() => {
          siguiente = Math.max(siguiente, ctx.currentTime + 0.1);
          fundir(VOLUMEN, 1.2);
        });
      }
    },

    // Sonidos sueltos: un «boing» al saltar y un arpegio al brotar una flor
    efecto(tipo) {
      if (!ctx || silenciada || ctx.state !== 'running') return;
      const t = ctx.currentTime + 0.01;
      if (tipo === 'salto') {
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.setValueAtTime(420, t);
        o.frequency.exponentialRampToValueAtTime(980, t + 0.14);
        o.frequency.exponentialRampToValueAtTime(720, t + 0.3);
        o.connect(envolvente(t, 0.13, 0.01, 0.34, salida));
        o.start(t);
        o.stop(t + 0.4);
      } else if (tipo === 'flor') {
        [72, 76, 79, 83, 86].forEach((m, i) => campana(m, t + i * 0.09, 0.09));
      }
    },

    _depurar: () => ({ ctx, final }),
  };
}
