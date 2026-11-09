// ─────────────────────────────────────────────────────────────
//  Chiikawa, Hachiware y Usagi, modelados a mano (sin archivos 3D).
//  Están de pícnic sobre una manta: respiran, parpadean, te siguen
//  con la mirada y, si los tocas, dan dos saltitos con cara feliz.
// ─────────────────────────────────────────────────────────────

import * as THREE from './lib/three.module.min.js';

const V3 = THREE.Vector3;
const GRADO = Math.PI / 180;
const limitar = (x, a, b) => Math.min(b, Math.max(a, x));
const suave = (t) => { t = limitar(t, 0, 1); return t * t * (3 - 2 * t); };
const TINTA = '#27222b';

export const ESCALA = 1.3; // tamaño de los personajes en el jardín
export const MANTA = { ancho: 2.5, fondo: 1.0 };

/* ═════════════════════ Formas ═════════════════════
   Cabeza y cuerpo son «bollos»: esferas achatadas, más cuadradas por abajo
   que por arriba (como un panecillo). */

const CAB = { a: 0.25, c: 0.2, arriba: 0.207, abajo: 0.138, pArriba: 2.25, pAbajo: 2.8 };
const CUE = { a: 0.202, c: 0.15, arriba: 0.2, abajo: 0.068, pArriba: 2, pAbajo: 2.8 };
const Y_CUERPO = 0.107; // altura del centro del cuerpo
const Y_CABEZA = 0.315; // altura de la línea más ancha de la cabeza
const Y_CUELLO = 0.2; // la cabeza gira desde aquí
const SEG = 60; // la cabeza tiene un segmento cada 6°
const CARA = { lon: 66, lat: 54 }; // trozo de cabeza que lleva la cara dibujada

function bollo(m) {
  return (lon, lat, o) => {
    const s = Math.sin(lat), c = Math.max(0, Math.cos(lat));
    const arriba = s >= 0;
    const p = 2 / (arriba ? m.pArriba : m.pAbajo);
    const r = Math.pow(c, p);
    const y = Math.sign(s) * Math.pow(Math.abs(s), p) * (arriba ? m.arriba : m.abajo);
    return o.set(m.a * r * Math.sin(lon), y, m.c * r * Math.cos(lon));
  };
}
const alturaBollo = (m, latGrados) => bollo(m)(0, latGrados * GRADO, new V3()).y;
const CARA_Y0 = alturaBollo(CAB, -CARA.lat);
const CARA_Y1 = alturaBollo(CAB, CARA.lat);

// Malla de un bollo. Devuelve la malla entera («todo») y, si se pide, la
// misma partida en dos: el trozo de la cara y el resto, que encajan sin
// rendija porque comparten los mismos vértices.
function mallaBollo(m, su, sv, conCara) {
  const fn = bollo(m);
  const cols = su + 1;
  const total = cols * (sv + 1);
  const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3);
  const uvCara = new Float32Array(total * 2), uvTodo = new Float32Array(total * 2);
  const p = new V3(), a = new V3(), b = new V3(), n = new V3();
  const e = 2e-3, tope = Math.PI / 2 - 0.03;
  for (let j = 0; j <= sv; j++) {
    const lat = -Math.PI / 2 + (j / sv) * Math.PI;
    for (let i = 0; i <= su; i++) {
      const lon = -Math.PI + (i / su) * Math.PI * 2;
      const k = j * cols + i;
      fn(lon, lat, p);
      pos[k * 3] = p.x; pos[k * 3 + 1] = p.y; pos[k * 3 + 2] = p.z;
      if (j === 0 || j === sv) n.set(0, j ? 1 : -1, 0);
      else {
        // normal exacta de la superficie (para un sombreado y un contorno limpios)
        const l = limitar(lat, -tope, tope);
        fn(lon + e, l, a); fn(lon - e, l, b); a.sub(b);
        fn(lon, l + e, b); fn(lon, l - e, n); b.sub(n);
        n.crossVectors(a, b).normalize();
      }
      nor[k * 3] = n.x; nor[k * 3 + 1] = n.y; nor[k * 3 + 2] = n.z;
      uvTodo[k * 2] = i / su;
      uvTodo[k * 2 + 1] = (p.y + m.abajo) / (m.arriba + m.abajo);
      uvCara[k * 2] = (lon / GRADO + CARA.lon) / (2 * CARA.lon);
      uvCara[k * 2 + 1] = (p.y - CARA_Y0) / (CARA_Y1 - CARA_Y0);
    }
  }
  const iCara = [], iResto = [], iTodo = [];
  const nLon = Math.round(CARA.lon / (360 / su)), nLat = Math.round(CARA.lat / (180 / sv));
  for (let j = 0; j < sv; j++) {
    for (let i = 0; i < su; i++) {
      const k = j * cols + i;
      const dentro = conCara && Math.abs(i + 0.5 - su / 2) < nLon && Math.abs(j + 0.5 - sv / 2) < nLat;
      const dest = dentro ? iCara : iResto;
      dest.push(k, k + 1, k + cols + 1, k, k + cols + 1, k + cols);
      iTodo.push(k, k + 1, k + cols + 1, k, k + cols + 1, k + cols);
    }
  }
  const aPos = new THREE.BufferAttribute(pos, 3), aNor = new THREE.BufferAttribute(nor, 3);
  const geo = (indices, uv) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', aPos);
    g.setAttribute('normal', aNor);
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(indices);
    g.computeBoundingSphere();
    return g;
  };
  return { todo: geo(iTodo, uvTodo), cara: conCara ? geo(iCara, uvCara) : null, resto: conCara ? geo(iResto, uvTodo) : null };
}

/* ═════════════════════ Caras dibujadas ═════════════════════
   Se pintan en un lienzo «desenrollado»: en horizontal van los grados
   alrededor de la cabeza y en vertical la altura. */

function lienzoCabeza(lon0, lon1, y0, y1, ancho) {
  const k = ancho / (lon1 - lon0); // píxeles por grado
  const s = (k * 180) / (Math.PI * CAB.a); // píxeles por unidad, en la frente
  const c = document.createElement('canvas');
  c.width = ancho;
  c.height = Math.max(2, Math.round((y1 - y0) * s));
  const sy = c.height / (y1 - y0);
  const g = c.getContext('2d');
  g.lineCap = g.lineJoin = 'round';
  return { c, g, s, X: (lon) => (lon - lon0) * k, Y: (y) => (y1 - y) * sy };
}

function textura(c) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// Borde de la mancha azul de Hachiware: dos ondas que cuelgan y se juntan
// en pico en mitad de la frente (y otro piquito más pequeño en la nuca).
function bordeGorro(lon) {
  const a = Math.abs(((lon + 540) % 360) - 180);
  let h;
  if (a < 26) h = 0.45 + 0.26 * (1 - Math.sqrt(1 - ((26 - a) / 26) ** 2));
  else if (a < 150) h = 0.45 + 0.15 * suave((a - 26) / 124);
  else h = 0.6 + 0.09 * (1 - Math.sqrt(1 - ((a - 150) / 30) ** 2));
  return h * CAB.arriba;
}

function pintarGorro(L, lon0, lon1, color) {
  const { g, X, Y, s } = L;
  const trazo = () => {
    g.beginPath();
    g.moveTo(X(lon0), Y(bordeGorro(lon0)));
    for (let l = lon0; l <= lon1; l += 0.5) g.lineTo(X(l), Y(bordeGorro(l)));
  };
  trazo();
  g.lineTo(X(lon1), -9);
  g.lineTo(X(lon0), -9);
  g.closePath();
  g.fillStyle = color;
  g.fill();
  trazo();
  g.strokeStyle = TINTA;
  g.lineWidth = 0.0085 * s;
  g.stroke();
}

const ROSA = '#f8c1cd'; // mejillas
const LENGUA = '#f4a3b5';

// Medidas de cada cara, sacadas de los dibujos de referencia
// (lon = grados hacia los lados; y = altura respecto a la línea más ancha de la cabeza)
const DATOS = {
  chiikawa: {
    nombre: 'Chiikawa', piel: '#ffffff', patas: 0, hombro: [0.19, 0.205], brazo: 0.62, cima: 0.56, ritmo: 1.9,
    ojos: { lon: 18, y: 0.012, r: 0.029 },
    mejilla: { lon: 33, y: -0.025, rx: 0.044, ry: 0.028 },
    boca: { y: -0.035, w: 0.057, h: 0.019, pico: 0.15, labio: -0.066 },
    frases: ['¡Yadaaa!'], // cada frase tiene su grabación en voces/ (lista CLIPS de musica.js)
  },
  hachiware: {
    nombre: 'Hachiware', piel: '#ffffff', azul: '#8dcbe9', patas: 0, hombro: [0.19, 0.205], brazo: 0.62, cima: 0.6, ritmo: 1.7,
    ojos: { lon: 17.5, y: 0.01, r: 0.029 },
    mejilla: { lon: 34, y: -0.038, rx: 0.045, ry: 0.03 },
    boca: { y: -0.037, w: 0.06, h: 0.019, pico: 0.95, labio: -0.099 },
    frases: ['¡Oi!', '¿Nani nani?', 'Zen zen wakannai…'],
  },
  usagi: {
    nombre: 'Usagi', piel: '#f8e8b2', patas: 0.022, hombro: [0.198, 0.2], brazo: 0.14, cima: 0.9, ritmo: 2.5,
    ojos: { lon: 19, y: 0.014, r: 0.029 },
    mejilla: { lon: 37.5, y: -0.037, rx: 0.05, ry: 0.029 },
    boca: { y: -0.035, w: 0.062, h: 0.019, pico: 0.55, labio: -0.093 },
    frases: ['¡Yahaaa!', '¡Urá!', '¡Purya!', '¿¡Haaaa!?', '¿Huh?'],
  },
};

function pintarCara(tipo, gesto, ancho) {
  const d = DATOS[tipo];
  const L = lienzoCabeza(-CARA.lon, CARA.lon, CARA_Y0, CARA_Y1, ancho);
  const { c, g, s, X, Y } = L;
  g.fillStyle = d.piel;
  g.fillRect(0, 0, c.width, c.height);
  if (tipo === 'hachiware') pintarGorro(L, -CARA.lon - 3, CARA.lon + 3, d.azul);
  const TRAZO = Math.max(2, 0.0062 * s);
  const feliz = gesto === 'feliz';

  // Mejillas rosas con cuatro rayitas negras inclinadas
  const m = d.mejilla;
  for (const lado of [-1, 1]) {
    const x = X(lado * m.lon), y = Y(m.y), rx = m.rx * s, ry = m.ry * s;
    g.fillStyle = ROSA;
    g.beginPath();
    g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = TINTA;
    g.lineWidth = TRAZO;
    for (const q of [-1.5, -0.5, 0.5, 1.5]) {
      const cx = x + q * rx * 0.4;
      g.beginPath();
      g.moveTo(cx - ry * 0.2, y + ry * 0.4);
      g.lineTo(cx + ry * 0.2, y - ry * 0.4);
      g.stroke();
    }
  }

  // Cejas
  const o = d.ojos;
  g.strokeStyle = TINTA;
  for (const lado of [-1, 1]) {
    g.beginPath();
    if (tipo === 'chiikawa') {
      // cortas, gruesas y caídas hacia fuera
      const cx = X(lado * o.lon), cy = Y(o.y + 0.0815), l = 0.0235 * s;
      g.lineWidth = TRAZO;
      g.moveTo(cx + lado * l * 0.95, cy + l * 0.3);
      g.quadraticCurveTo(cx, cy - l * 0.22, cx - lado * l * 0.95, cy - l * 0.3);
    } else if (tipo === 'hachiware') {
      // dos puntitos justo debajo de la mancha
      const cx = X(lado * (o.lon + 0.5)), cy = Y(o.y + 0.069), l = 0.0085 * s;
      g.lineWidth = TRAZO * 0.92;
      g.moveTo(cx + lado * l, cy + l * 0.3);
      g.lineTo(cx - lado * l, cy - l * 0.3);
    } else {
      // Usagi: un cuarto de círculo grande, desde encima del ojo hasta bajar por fuera
      const P = (lon, y) => [X(lado * (o.lon + lon)), Y(o.y + y)];
      const [x0, y0] = P(-2, 0.13), [x1, y1] = P(10.1, 0.13), [x2, y2] = P(20, 0.087), [x3, y3] = P(20, 0.035);
      g.lineWidth = 0.0085 * s;
      g.moveTo(x0, y0);
      g.bezierCurveTo(x1, y1, x2, y2, x3, y3);
    }
    g.stroke();
  }

  // Ojos: negros, con un brillo grande arriba y una medialuna abajo
  const R = o.r * s;
  for (const lado of [-1, 1]) {
    const x = X(lado * o.lon), y = Y(o.y);
    g.strokeStyle = g.fillStyle = TINTA;
    if (gesto === 'parpadeo') {
      g.lineWidth = R * 0.3;
      g.beginPath();
      g.moveTo(x - R * 0.9, y - R * 0.05);
      g.quadraticCurveTo(x, y + R * 0.6, x + R * 0.9, y - R * 0.05);
      g.stroke();
    } else if (feliz) {
      g.lineWidth = R * 0.32;
      g.beginPath();
      g.moveTo(x - R * 0.95, y + R * 0.45);
      g.quadraticCurveTo(x, y - R * 1.05, x + R * 0.95, y + R * 0.45);
      g.stroke();
    } else {
      g.beginPath();
      g.arc(x, y, R, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#ffffff';
      g.beginPath();
      g.arc(x + R * 0.03, y - R * 0.27, R * 0.48, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = '#ffffff';
      g.lineWidth = R * 0.15;
      g.beginPath();
      g.arc(x, y + R * 0.08, R * 0.62, Math.PI * 0.24, Math.PI * 0.76);
      g.stroke();
    }
  }

  // Boca: una «ω»; Hachiware y Usagi la llevan abierta, con la lengua rosa
  const b = d.boca;
  const x = X(0), y = Y(b.y), w = b.w * s, h = b.h * s;
  const bajo = y + h * 0.72; // por donde cuelga la boca abierta
  g.strokeStyle = TINTA;
  g.lineWidth = TRAZO;
  const bolsa = (ancho2, alto, relleno) => { // forma de «U» colgando de la «ω»
    const p = new Path2D();
    p.moveTo(x - ancho2 / 2, bajo);
    p.lineTo(x, y + h * 0.2);
    p.lineTo(x + ancho2 / 2, bajo);
    p.bezierCurveTo(x + ancho2 * 0.46, bajo + alto * 1.3, x - ancho2 * 0.46, bajo + alto * 1.3, x - ancho2 / 2, bajo);
    g.fillStyle = relleno;
    g.fill(p);
    return p;
  };
  const bordeBolsa = (ancho2, alto) => {
    g.beginPath();
    g.moveTo(x + ancho2 / 2, bajo);
    g.bezierCurveTo(x + ancho2 * 0.46, bajo + alto * 1.3, x - ancho2 * 0.46, bajo + alto * 1.3, x - ancho2 / 2, bajo);
    g.stroke();
  };
  let fondo = bajo; // hasta dónde llega la boca, para colocar el labio de abajo
  if (tipo === 'hachiware') {
    const bw = w * 0.66, bh = (feliz ? 0.046 : 0.036) * s;
    const p = bolsa(bw, bh, '#ffffff');
    g.save();
    g.clip(p);
    g.fillStyle = LENGUA; // la lengua, con forma de corazón
    for (const k of [-1, 1]) {
      g.beginPath();
      g.arc(x + k * bw * 0.14, bajo + bh * 0.74, bw * 0.2, 0, Math.PI * 2);
      g.fill();
    }
    g.fillRect(x - bw * 0.3, bajo + bh * 0.76, bw * 0.6, bh);
    g.restore();
    bordeBolsa(bw, bh);
    fondo = bajo + bh;
  } else if (tipo === 'usagi') {
    const bw = w * (feliz ? 0.62 : 0.5), bh = (feliz ? 0.04 : 0.028) * s;
    bolsa(bw, bh, LENGUA);
    bordeBolsa(bw, bh);
    fondo = bajo + bh;
  } else if (feliz) {
    const bw = w * 0.46, bh = 0.022 * s;
    bolsa(bw, bh, LENGUA);
    bordeBolsa(bw, bh);
    fondo = bajo + bh;
  }
  g.beginPath(); // la «ω»
  g.moveTo(x - w / 2, y - h * 0.25);
  g.bezierCurveTo(x - w / 2, y + h, x - w * 0.06, y + h, x, y - h * b.pico);
  g.bezierCurveTo(x + w * 0.06, y + h, x + w / 2, y + h, x + w / 2, y - h * 0.25);
  g.stroke();
  // Labio de abajo: una rayita curva
  const yl = Math.max(Y(b.labio), fondo + 0.012 * s), wl = 0.021 * s;
  g.beginPath();
  g.moveTo(x - wl / 2, yl);
  g.quadraticCurveTo(x, yl + wl * 0.3, x + wl / 2, yl);
  g.stroke();
  return textura(c);
}

/* ═════════════════════ Los tres amigos ═════════════════════ */

export function crearPersonajes({ geoSombra, matSombra, anchoCara = 768 }) {
  const grupo = new THREE.Group();
  const texturas = [];

  // Sombreado de dibujo animado, con los tonos fundidos entre sí
  const rampa = new THREE.DataTexture(
    new Uint8Array([122, 160, 204, 238, 255, 255].flatMap((v) => [v, v, v, 255])), 6, 1
  );
  rampa.minFilter = rampa.magFilter = THREE.LinearFilter;
  rampa.needsUpdate = true;
  const BRILLO = 0.3;
  const toon = (color) => new THREE.MeshToonMaterial({ color, gradientMap: rampa, emissive: color, emissiveIntensity: BRILLO });
  const toonMapa = (tex) =>
    new THREE.MeshToonMaterial({ map: tex, gradientMap: rampa, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: BRILLO });

  // Contorno: una copia del revés, hinchada a lo largo de las normales.
  // De lejos se engorda un poco para que no desaparezca en pantallas pequeñas.
  const uGrosor = { value: 0.0056 };
  const LINEA = new THREE.MeshBasicMaterial({ color: TINTA, side: THREE.BackSide });
  LINEA.onBeforeCompile = (sh) => {
    sh.uniforms.uGrosor = uGrosor;
    sh.vertexShader = 'uniform float uGrosor;\n' + sh.vertexShader.replace(
      '#include <begin_vertex>',
      `float lejos = -(modelViewMatrix * vec4(position, 1.0)).z;
      vec3 transformed = position + normalize(normal) * uGrosor * clamp(lejos * 0.2, 1.0, 3.0);`
    );
  };
  const pieza = (geo, mat, padre, contorno = true) => {
    const o = new THREE.Mesh(geo, mat);
    padre.add(o);
    if (contorno) o.add(new THREE.Mesh(geo, LINEA));
    return o;
  };

  /* ---------- Piezas ---------- */
  const cabeza = mallaBollo(CAB, SEG, SEG / 2, true);
  const cuerpo = mallaBollo(CUE, 40, 20, false).todo;

  const orejaConejo = (sx, sy, sz, y, z) => {
    const g = new THREE.CapsuleGeometry(0.032, 0.26, 8, 16).scale(sx, sy, sz).translate(0, y, z);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { // se curvan un poco hacia atrás
      const alto = Math.max(0, p.getY(i));
      p.setZ(i, p.getZ(i) - 0.3 * alto * alto);
    }
    g.computeBoundingSphere();
    return g;
  };
  const pompon = new THREE.IcosahedronGeometry(0.056, 3);
  {
    const p = pompon.attributes.position;
    for (let i = 0; i < p.count; i++) { // bultitos de algodón
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const r = Math.sin(Math.round(x * 900) * 12.9 + Math.round(y * 900) * 78.2 + Math.round(z * 900) * 37.7) * 43758.5;
      const f = 1 + ((r - Math.floor(r)) - 0.5) * 0.09;
      p.setXYZ(i, x * f, y * f, z * f);
    }
  }
  const curvaCola = new THREE.CatmullRomCurve3([new V3(0, 0, 0.012), new V3(0, 0.01, -0.034), new V3(0, 0.036, -0.062), new V3(0, 0.074, -0.072)]);
  const perfilOreja = new THREE.SplineCurve(
    [[0.062, 0], [0.059, 0.02], [0.05, 0.046], [0.036, 0.07], [0.019, 0.086], [0, 0.092]].map(([px, py]) => new THREE.Vector2(px, py))
  ).getPoints(18);
  for (const q of perfilOreja) q.x = Math.max(0, q.x);

  const G = {
    pierna: new THREE.CapsuleGeometry(0.025, 0.05, 6, 14),
    piernaLarga: new THREE.CapsuleGeometry(0.024, 0.074, 6, 14),
    brazo: new THREE.CapsuleGeometry(0.0215, 0.042, 6, 14).translate(0, -0.03, 0),
    brazoLargo: new THREE.CapsuleGeometry(0.021, 0.064, 6, 14).translate(0, -0.042, 0),
    orejaRedonda: new THREE.SphereGeometry(0.032, 20, 14).scale(1, 1, 0.85),
    colita: new THREE.SphereGeometry(0.024, 14, 10).scale(1, 1.1, 1),
    orejaGato: new THREE.LatheGeometry(perfilOreja, 24).scale(1, 1, 0.62),
    colaGato: new THREE.TubeGeometry(curvaCola, 12, 0.0135, 10, false),
    puntaCola: new THREE.SphereGeometry(0.0135, 12, 8).translate(0, 0.074, -0.072),
    orejaConejo: orejaConejo(1, 1, 0.66, 0.127, 0),
    orejaRosa: orejaConejo(0.72, 0.88, 0.44, 0.13, 0.0112),
    pompon,
    toque: new THREE.SphereGeometry(0.3, 8, 6),
  };
  for (const g of Object.values(G)) g.computeBoundingSphere();
  const INVISIBLE = new THREE.MeshBasicMaterial({ visible: false });

  // Mancha azul de Hachiware para el resto de la cabeza (da toda la vuelta)
  const texGorro = (() => {
    const L = lienzoCabeza(-180, 180, -CAB.abajo, CAB.arriba, anchoCara >= 768 ? 1536 : 1024);
    L.g.fillStyle = DATOS.hachiware.piel;
    L.g.fillRect(0, 0, L.c.width, L.c.height);
    pintarGorro(L, -184, 184, DATOS.hachiware.azul);
    return textura(L.c);
  })();
  texturas.push(texGorro);

  /* ---------- Montaje ---------- */
  const lista = [];
  const toques = [];

  function crear(tipo, x, z, giro) {
    const d = DATOS[tipo];
    const k = lista.length;
    const mPiel = toon(d.piel);
    const raiz = new THREE.Group(); // sitio en la manta
    const salto = new THREE.Group(); // saltitos, respiración
    const torso = new THREE.Group(); // todo menos las patas
    const cab = new THREE.Group(); // cabeza y orejas
    raiz.add(salto);
    salto.add(torso);
    torso.add(cab);
    raiz.position.set(x, 0, z);
    raiz.rotation.y = giro;
    raiz.scale.setScalar(ESCALA);
    torso.position.y = d.patas + 0.012; // que asomen las patitas
    cab.position.y = Y_CUELLO;
    cab.rotation.order = 'YXZ';

    for (const s of [-1, 1]) {
      const p = pieza(d.patas ? G.piernaLarga : G.pierna, mPiel, salto);
      p.position.set(s * 0.088, d.patas ? 0.061 : 0.05, 0.006);
      p.rotation.z = s * 0.06;
    }
    pieza(cuerpo, mPiel, torso).position.y = Y_CUERPO;
    const brazos = [-1, 1].map((s) => {
      const hombro = new THREE.Group();
      hombro.position.set(s * d.hombro[0], d.hombro[1], 0.012);
      hombro.rotation.z = s * d.brazo;
      torso.add(hombro);
      pieza(d.patas ? G.brazoLargo : G.brazo, mPiel, hombro);
      return hombro;
    });

    // Cabeza: el trozo de la cara lleva el dibujo; el resto, el color liso
    const caras = { normal: pintarCara(tipo, 'normal', anchoCara), parpadeo: pintarCara(tipo, 'parpadeo', anchoCara), feliz: pintarCara(tipo, 'feliz', anchoCara) };
    texturas.push(caras.normal, caras.parpadeo, caras.feliz);
    const matCara = toonMapa(caras.normal);
    const yCab = Y_CABEZA - Y_CUELLO;
    pieza(cabeza.resto, tipo === 'hachiware' ? toonMapa(texGorro) : mPiel, cab, false).position.y = yCab;
    pieza(cabeza.cara, matCara, cab, false).position.y = yCab;
    const contorno = new THREE.Mesh(cabeza.todo, LINEA);
    contorno.position.y = yCab;
    cab.add(contorno);

    const orejas = [];
    let cola = null;
    if (tipo === 'chiikawa') {
      for (const s of [-1, 1]) pieza(G.orejaRedonda, mPiel, cab).position.set(s * 0.131, yCab + 0.196, 0);
      pieza(G.colita, mPiel, torso).position.set(0, 0.088, -0.15);
    } else if (tipo === 'hachiware') {
      const azul = toon(d.azul);
      for (const s of [-1, 1]) {
        const o = pieza(G.orejaGato, azul, cab);
        o.position.set(s * 0.132, yCab + 0.142, -0.004);
        o.rotation.z = -s * 0.36;
        o.userData.reposo = -s * 0.36;
        orejas.push(o);
      }
      cola = new THREE.Group();
      cola.position.set(0, 0.07, -0.14);
      torso.add(cola);
      pieza(G.colaGato, azul, cola);
      pieza(G.puntaCola, azul, cola);
    } else {
      const rosa = toon('#f6b9c9');
      for (const s of [-1, 1]) {
        const base = new THREE.Group(); // las orejas se mecen desde su base
        base.position.set(s * 0.046, yCab + 0.168, -0.012);
        cab.add(base);
        pieza(G.orejaConejo, mPiel, base);
        pieza(G.orejaRosa, rosa, base, false);
        orejas.push(base);
      }
      pieza(G.pompon, toon('#ffffff'), torso).position.set(0, 0.094, -0.186);
    }

    const sombra = new THREE.Mesh(geoSombra, matSombra);
    sombra.position.y = 0.02;
    raiz.add(sombra);

    const toque = new THREE.Mesh(G.toque, INVISIBLE);
    toque.position.y = 0.3;
    toque.scale.y = tipo === 'usagi' ? 1.5 : 1.05;
    toque.userData.personaje = k;
    raiz.add(toque);
    toques.push(toque);

    grupo.add(raiz);
    lista.push({
      tipo, nombre: d.nombre, frases: d.frases, cima: d.cima * ESCALA, raiz, salto, torso, cab, brazos, orejas, cola, sombra,
      caras, matCara, gesto: 'normal', brazo: d.brazo, ritmo: d.ritmo, fase: k * 2.1,
      tSalto: -10, tParpadeo: 1.5 + k * 1.3, miraX: 0, miraY: 0, ladeo: 0, ladeoDestino: 0, tLadeo: 3 + k * 2,
      tOreja: 2 + k, tOreja0: -10, cualOreja: 0, tTiembla: 5,
    });
  }
  crear('hachiware', -0.78, -0.07, 0.2);
  crear('chiikawa', 0, 0.1, 0);
  crear('usagi', 0.78, -0.07, -0.2);

  /* ---------- La manta de pícnic ---------- */
  {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    g.fillStyle = '#f7efff';
    g.fillRect(0, 0, 64, 64);
    g.fillStyle = 'rgba(160, 110, 220, 0.5)';
    g.fillRect(0, 0, 32, 64);
    g.fillRect(0, 0, 64, 32);
    const tex = textura(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(3.6, 3.6);
    texturas.push(tex);
    const w = MANTA.ancho / 2, h = MANTA.fondo / 2, r = 0.14;
    const f = new THREE.Shape();
    f.moveTo(-w + r, -h);
    f.lineTo(w - r, -h);
    f.quadraticCurveTo(w, -h, w, -h + r);
    f.lineTo(w, h - r);
    f.quadraticCurveTo(w, h, w - r, h);
    f.lineTo(-w + r, h);
    f.quadraticCurveTo(-w, h, -w, h - r);
    f.lineTo(-w, -h + r);
    f.quadraticCurveTo(-w, -h, -w + r, -h);
    const manta = new THREE.Mesh(
      new THREE.ShapeGeometry(f, 6).rotateX(-Math.PI / 2),
      new THREE.MeshLambertMaterial({ map: tex, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.2 })
    );
    manta.position.y = 0.014;
    grupo.add(manta);
  }

  /* ---------- Vida ---------- */
  const v = new V3();

  function actualizar(t, dt, camara) {
    for (const p of lista) {
      const f = p.fase;

      // Dos saltitos al tocarlo
      const s = (t - p.tSalto) / 0.95;
      const saltando = s >= 0 && s < 1;
      let h = 0, aplasta = 0;
      if (saltando) {
        const bote = Math.abs(Math.sin(s * Math.PI * 2));
        h = bote * (s < 0.5 ? 0.2 : 0.11);
        aplasta = (1 - Math.min(1, bote * 3)) * 0.12 * (1 - s);
      }
      // Respiración
      const resp = Math.sin(t * p.ritmo + f);
      p.salto.position.y = h;
      const sx = 1 - resp * 0.008 + aplasta * 0.6;
      p.salto.scale.set(sx, 1 + resp * 0.014 - aplasta, sx);
      p.torso.rotation.z = Math.sin(t * 0.8 + f * 1.7) * 0.022;

      // Chiikawa tiembla un poquito de vez en cuando
      if (p.tipo === 'chiikawa') {
        if (t > p.tTiembla + 0.7) p.tTiembla = t + 5 + Math.random() * 7;
        p.torso.position.x = t > p.tTiembla ? Math.sin(t * 46) * 0.0028 : 0;
      }

      // La cabeza sigue a quien mira (si no está a su espalda)
      v.copy(camara.position);
      p.raiz.worldToLocal(v);
      let giro = Math.atan2(v.x, v.z);
      const detras = Math.abs(giro) > 2.1;
      giro = detras ? 0 : limitar(giro, -0.6, 0.6);
      const subir = detras ? 0 : limitar(Math.atan2(v.y - 0.4, Math.hypot(v.x, v.z)) * 0.55, -0.1, 0.3);
      const k = 1 - Math.exp(-dt * 3.2);
      p.miraY += (giro - p.miraY) * k;
      p.miraX += (subir - p.miraX) * k;
      if (t > p.tLadeo) {
        p.ladeoDestino = [0, 0, 0.11, -0.11, 0.06, -0.06][Math.floor(Math.random() * 6)];
        p.tLadeo = t + 2.5 + Math.random() * 4;
      }
      p.ladeo += (p.ladeoDestino - p.ladeo) * (1 - Math.exp(-dt * 4));
      p.cab.rotation.set(
        -p.miraX + Math.sin(t * 0.7 + f) * 0.015,
        p.miraY,
        p.ladeo + (saltando ? Math.sin(s * Math.PI * 4) * 0.05 : 0)
      );

      // Brazos: se mueven un pelín; al saltar, los levanta
      const arriba = saltando ? Math.sin(Math.min(1, s * 1.2) * Math.PI) : 0;
      for (let i = 0; i < 2; i++) {
        const lado = i ? 1 : -1;
        p.brazos[i].rotation.z = lado * (p.brazo + Math.sin(t * p.ritmo + f + i * 0.8) * 0.05 + arriba * (1.5 - p.brazo));
      }

      if (p.tipo === 'usagi') {
        for (let i = 0; i < 2; i++) {
          const lado = i ? 1 : -1;
          const o = p.orejas[i];
          o.rotation.x = -0.1 + Math.sin(t * 1.4 + f + i) * 0.045 - (saltando ? Math.cos(s * Math.PI * 2) * 0.22 : 0);
          o.rotation.z = -lado * 0.07 + Math.sin(t * 1.1 + f + i * 1.3) * 0.03;
        }
      } else if (p.tipo === 'hachiware') {
        if (t > p.tOreja) {
          p.cualOreja = Math.random() < 0.5 ? 0 : 1;
          p.tOreja0 = t;
          p.tOreja = t + 3 + Math.random() * 5;
        }
        const q = (t - p.tOreja0) / 0.32;
        for (let i = 0; i < 2; i++) {
          const o = p.orejas[i];
          o.rotation.z = o.userData.reposo + (i === p.cualOreja && q < 1 ? Math.sin(q * Math.PI * 2) * 0.2 : 0);
        }
        p.cola.rotation.y = Math.sin(t * 2.6) * 0.42;
      }

      // Cara: feliz al saltar; parpadeo de vez en cuando
      let gesto = 'normal';
      if (t - p.tSalto < 1.7) gesto = 'feliz';
      else if (t > p.tParpadeo) {
        gesto = 'parpadeo';
        if (t > p.tParpadeo + 0.13) p.tParpadeo = t + 2 + Math.random() * 3.8;
      }
      if (p.gesto !== gesto) {
        p.gesto = gesto;
        p.matCara.map = p.matCara.emissiveMap = p.caras[gesto];
      }
      p.sombra.scale.setScalar(0.68 - h * 0.6);
    }
  }

  function saltar(k, t) {
    const p = lista[k];
    if (!p || t - p.tSalto < 1) return false;
    p.tSalto = t;
    return true;
  }

  return { grupo, lista, toques, texturas, actualizar, saltar };
}
