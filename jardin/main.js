import * as THREE from 'three';
import { OrbitControls } from 'three/addons/OrbitControls.js';

/* ═════════════════════ Utilidades ═════════════════════ */

const $ = (id) => document.getElementById(id);
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const lerp = (a, b, t) => a + (b - a) * t;
const suave = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const salida = (t) => 1 - Math.pow(1 - t, 3);
const rebote = (t) => {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
const V3 = THREE.Vector3;
const ARRIBA = new V3(0, 1, 0);
const plural = (n, uno, varios) => (n === 1 ? uno : varios);

function mostrarError(msg) {
  const e = $('error');
  e.textContent = msg;
  e.hidden = false;
}

// Generador aleatorio con semilla: el jardín es idéntico en cada visita.
function azar(semilla) {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function ruido3(x, y, z) {
  const r = (v) => Math.round(v * 1000) / 1000;
  const s = Math.sin(r(x) * 127.1 + r(y) * 311.7 + r(z) * 74.7) * 43758.5453;
  return s - Math.floor(s);
}

/* ═════════════════════ Configuración y fechas ═════════════════════ */

let CONFIG;
try {
  CONFIG = (await import('./config.js')).default;
  if (!CONFIG) throw new Error('config.js vacío');
} catch (e) {
  mostrarError('Hay un error en config.js 🙈 Revisa que cada texto esté entre comillas y que cada línea termine con una coma.');
  throw e;
}

const DIA_MS = 86400000;
function leerFecha(s) {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(String(s || '').trim());
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
}
const diasEntre = (a, b) => Math.round((b - a) / DIA_MS);
const masDias = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const fmtFecha = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'long' });

const ahora = new Date();
const HOY_REAL = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
const INICIO = leerFecha(CONFIG.inicio) || HOY_REAL;
const REENCUENTRO = leerFecha(CONFIG.reencuentro);

const params = new URLSearchParams(location.search);
const diaVista = parseInt(params.get('dia'), 10);
const MODO_VISTA = Number.isFinite(diaVista);
const HOY = MODO_VISTA ? masDias(INICIO, diaVista - 1) : HOY_REAL;

const DIA_N = diasEntre(INICIO, HOY) + 1; // día 1 = el día que empezasteis
const ABIERTAS = Math.max(0, DIA_N); // una flor por día juntos
const IDX_HOY = DIA_N >= 1 ? DIA_N - 1 : -1;

// Mensajes escondidos en flores de días concretos
const MENSAJES = new Map();
for (const [clave, valor] of Object.entries(CONFIG.mensajes || {})) {
  const d = leerFecha(clave);
  if (!d) continue;
  const i = diasEntre(INICIO, d);
  if (i < 0) continue;
  MENSAJES.set(i, typeof valor === 'string'
    ? { texto: valor, foto: '' }
    : { texto: String(valor?.texto ?? ''), foto: String(valor?.foto ?? '') });
}

// ¿Primera vez que entra? ¿Qué flores han brotado desde su última visita?
const CLAVE = `jardin-morado:${CONFIG.inicio || 'x'}:vistas`;
let guardado = null;
try {
  if (params.has('reiniciar')) localStorage.removeItem(CLAVE);
  guardado = localStorage.getItem(CLAVE);
} catch { /* sin almacenamiento: la tratamos como primera visita */ }

let PRIMERA, vistas;
if (MODO_VISTA) {
  PRIMERA = params.has('primera');
  vistas = ABIERTAS - 1;
} else if (guardado === null) {
  PRIMERA = true;
  vistas = ABIERTAS - 1; // las flores de antes ya están; hoy brota la de hoy
} else {
  PRIMERA = false;
  const v = parseInt(guardado, 10);
  vistas = Number.isFinite(v) ? Math.min(v, ABIERTAS) : ABIERTAS - 1;
}
vistas = Math.max(0, vistas, ABIERTAS - 7); // como mucho, 7 flores creciendo a la vez
const NUEVAS = [];
for (let i = vistas; i < ABIERTAS; i++) NUEVAS.push(i);

/* ═════════════════════ Render y escena ═════════════════════ */

const lienzo = $('escena');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas: lienzo, antialias: true, powerPreference: 'high-performance' });
} catch (e) {
  mostrarError('Tu navegador no puede mostrar el jardín en 3D 😢 Prueba a abrirlo con Chrome o Safari.');
  throw e;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const escena = new THREE.Scene();
escena.fog = new THREE.Fog('#3a1f5e', 24, 85);

const camara = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.05, 400);
const controles = new OrbitControls(camara, lienzo);
controles.enableDamping = true;
controles.dampingFactor = 0.07;
controles.enablePan = false;
controles.minDistance = 1.6;
controles.maxPolarAngle = 1.42;
controles.rotateSpeed = 0.7;
controles.autoRotateSpeed = 0.45;
const MOVIMIENTO_REDUCIDO = matchMedia('(prefers-reduced-motion: reduce)').matches;

const uTiempo = { value: 0 };

function texturaRadial(paradas, tam = 128) {
  const c = document.createElement('canvas');
  c.width = c.height = tam;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(tam / 2, tam / 2, 0, tam / 2, tam / 2, tam / 2);
  for (const [p, col] of paradas) gr.addColorStop(p, col);
  g.fillStyle = gr;
  g.fillRect(0, 0, tam, tam);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const TEX_BRILLO = texturaRadial([[0, 'rgba(255,255,255,1)'], [0.25, 'rgba(255,255,255,.75)'], [1, 'rgba(255,255,255,0)']], 64);
const TEX_HALO = texturaRadial([[0, 'rgba(255,255,255,.9)'], [0.35, 'rgba(255,255,255,.25)'], [1, 'rgba(255,255,255,0)']]);
const TEX_SOMBRA = texturaRadial([[0, 'rgba(0,0,0,.55)'], [0.6, 'rgba(0,0,0,.2)'], [1, 'rgba(0,0,0,0)']], 64);

/* ═════════════════════ La isla ═════════════════════ */

const ESPACIO = 0.62; // separación entre flores (espiral)
// La isla crece a medida que brotan flores (+1 por el brote de mañana).
const RADIO = Math.max(3.2, ESPACIO * Math.sqrt(ABIERTAS + 2) + 1.4);
const borde = (a) => 1 + 0.045 * Math.sin(a * 5 + 1.3) + 0.025 * Math.sin(a * 11 + 0.4) + 0.015 * Math.sin(a * 17);
const ANG_CARTEL = Math.PI / 2 + 0.62;

/* ---------- Cielo de atardecer ---------- */
{
  const cielo = new THREE.Mesh(
    new THREE.SphereGeometry(200, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        cArriba: { value: new THREE.Color('#0e0726') },
        cMedio: { value: new THREE.Color('#3b1a6b') },
        cHorizonte: { value: new THREE.Color('#cf86c2') },
        cAbajo: { value: new THREE.Color('#3a1c5e') },
      },
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 cArriba, cMedio, cHorizonte, cAbajo;
        varying vec3 vDir;
        void main() {
          float h = vDir.y;
          vec3 c = mix(cHorizonte, cMedio, smoothstep(-0.05, 0.12, h));
          c = mix(c, cArriba, smoothstep(0.1, 0.45, h));
          c = mix(c, cAbajo, smoothstep(-0.03, -0.32, h));
          gl_FragColor = vec4(c, 1.0);
          #include <colorspace_fragment>
        }`,
    })
  );
  cielo.renderOrder = -10;
  escena.add(cielo);

  // Estrellas
  const r = azar(77);
  const n = 700;
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const th = r() * Math.PI * 2;
    const y = 0.12 + r() * 0.88;
    const rr = Math.sqrt(1 - y * y);
    pos.set([Math.cos(th) * rr * 150, y * 150, Math.sin(th) * rr * 150], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const estrellas = new THREE.Points(
    g,
    new THREE.PointsMaterial({ map: TEX_BRILLO, size: 1.5, transparent: true, depthWrite: false, fog: false, color: '#fff3ff' })
  );
  estrellas.name = 'estrellas';
  escena.add(estrellas);

  // Luna con halo
  const luna = new THREE.Mesh(new THREE.SphereGeometry(4, 32, 16), new THREE.MeshBasicMaterial({ color: '#fff1dc', fog: false }));
  luna.position.set(-70, 62, -110);
  escena.add(luna);
  const halo = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: TEX_HALO, color: '#f3c6ff', blending: THREE.AdditiveBlending, depthWrite: false, fog: false, opacity: 0.7 })
  );
  halo.scale.setScalar(55);
  halo.position.copy(luna.position);
  escena.add(halo);
}

/* ---------- Mar de nubes bajo la isla ---------- */
{
  const r = azar(404);
  const tex = texturaRadial([[0, 'rgba(255,255,255,.85)'], [0.45, 'rgba(255,255,255,.35)'], [1, 'rgba(255,255,255,0)']]);
  const tonos = ['#f0b8e0', '#c9a0f0', '#e6a8d0', '#b892e8'];
  for (let i = 0; i < 26; i++) {
    const a = r() * Math.PI * 2;
    const rr = RADIO + 2 + r() * 38;
    const nube = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: tex, color: tonos[i % tonos.length], transparent: true, depthWrite: false, opacity: 0.22 + r() * 0.2, fog: false })
    );
    nube.position.set(Math.cos(a) * rr, -5 - r() * 7 - rr * 0.08, Math.sin(a) * rr);
    nube.scale.set(14 + r() * 16, 6 + r() * 5, 1);
    escena.add(nube);
  }
}

/* ---------- Luces ---------- */
escena.add(new THREE.HemisphereLight('#c7b2ff', '#2b1c12', 1.5));
const luzLuna = new THREE.DirectionalLight('#eadcff', 1.9);
luzLuna.position.set(-7, 9, -6);
escena.add(luzLuna);
const luzRelleno = new THREE.DirectionalLight('#ffb0d8', 1.1);
luzRelleno.position.set(6, 5, 9);
escena.add(luzRelleno);

/* ---------- Tierra y roca ---------- */
function deformarRadial(geo, fn) {
  const p = geo.attributes.position;
  const v = new V3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    if (Math.hypot(v.x, v.z) < 1e-4) continue;
    const f = fn(Math.atan2(v.z, v.x), v);
    p.setXYZ(i, v.x * f, v.y, v.z * f);
  }
  geo.computeVertexNormals();
}

{
  const cesped = new THREE.CylinderGeometry(RADIO, RADIO, 0.34, 72, 1);
  cesped.translate(0, -0.17, 0);
  deformarRadial(cesped, (a) => borde(a));
  escena.add(new THREE.Mesh(cesped, new THREE.MeshStandardMaterial({ color: '#3f7642', roughness: 1 })));

  const tierra = new THREE.CylinderGeometry(RADIO * 0.985, RADIO * 0.84, 0.55, 72, 2);
  tierra.translate(0, -0.34 - 0.275, 0);
  deformarRadial(tierra, (a, v) => borde(a) * (1 + (ruido3(v.x, v.y, v.z) - 0.5) * 0.04));
  escena.add(new THREE.Mesh(tierra, new THREE.MeshStandardMaterial({ color: '#5b3d2e', roughness: 1 })));

  const altoRoca = RADIO * 1.3;
  const roca = new THREE.ConeGeometry(RADIO * 0.84, altoRoca, 12, 5);
  roca.rotateX(Math.PI);
  roca.translate(0, -0.89 - altoRoca / 2, 0);
  deformarRadial(roca, (a, v) => borde(a) * (v.y > -0.9 ? 1 : 1 + (ruido3(v.x, v.y, v.z) - 0.5) * 0.35));
  escena.add(new THREE.Mesh(roca, new THREE.MeshStandardMaterial({ color: '#4d4061', roughness: 0.95, flatShading: true })));
}

/* ---------- Hierba que se mueve con el viento ---------- */
{
  const r = azar(2024);
  const n = Math.min(26000, Math.floor(Math.PI * RADIO * RADIO * 95));
  const geo = new THREE.ConeGeometry(0.022, 0.16, 3, 1, true); // sin base: nunca se ve
  geo.translate(0, 0.08, 0);
  const mat = new THREE.MeshLambertMaterial({ color: '#ffffff' });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTiempo = uTiempo;
    sh.vertexShader =
      'uniform float uTiempo;\n' +
      sh.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        #ifdef USE_INSTANCING
          float fase = instanceMatrix[3].x * 0.9 + instanceMatrix[3].z * 0.7;
          float k = position.y * 6.0;
          transformed.x += sin(uTiempo * 1.6 + fase) * 0.035 * k * k;
          transformed.z += cos(uTiempo * 1.2 + fase) * 0.02 * k * k;
        #endif`
      );
  };
  const pasto = new THREE.InstancedMesh(geo, mat, n);
  const d = new THREE.Object3D();
  const c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2;
    const rr = Math.sqrt(r()) * RADIO * 0.96 * borde(a);
    d.position.set(Math.cos(a) * rr, 0, Math.sin(a) * rr);
    d.rotation.set((r() - 0.5) * 0.35, r() * Math.PI * 2, (r() - 0.5) * 0.35);
    d.scale.set(1, 0.55 + r() * 0.9, 1);
    d.updateMatrix();
    pasto.setMatrixAt(i, d.matrix);
    c.setHSL(0.29 + r() * 0.07, 0.5 + r() * 0.2, 0.24 + r() * 0.14);
    pasto.setColorAt(i, c);
  }
  escena.add(pasto);
}

/* ---------- Arbustos, piedras y rocas flotantes ---------- */
const rocasFlotantes = [];
{
  const r = azar(99);
  const matArbusto = new THREE.MeshStandardMaterial({ color: '#2f6a3c', roughness: 0.9, flatShading: true });
  const matPiedra = new THREE.MeshStandardMaterial({ color: '#6d6280', roughness: 0.9, flatShading: true });
  const geoArbusto = new THREE.IcosahedronGeometry(0.32, 1);
  const geoPiedra = new THREE.DodecahedronGeometry(0.14, 0);
  const n = Math.round(RADIO * 2.6);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + (r() - 0.5) * 0.5;
    const dif = Math.atan2(Math.sin(a - ANG_CARTEL), Math.cos(a - ANG_CARTEL));
    if (Math.abs(dif) < 0.45 * (3.6 / Math.max(3.6, RADIO))) continue;
    const rr = RADIO * borde(a) - 0.32;
    const m = new THREE.Mesh(geoArbusto, matArbusto);
    const s = 0.7 + r() * 0.7;
    m.scale.set(s, s * (0.65 + r() * 0.25), s);
    m.position.set(Math.cos(a) * rr, 0.08, Math.sin(a) * rr);
    m.rotation.y = r() * 6;
    escena.add(m);
    if (r() < 0.5) {
      const p = new THREE.Mesh(geoPiedra, matPiedra);
      const a2 = a + 0.18 * (3.6 / Math.max(3.6, RADIO));
      const r2 = RADIO * borde(a2) - 0.55;
      p.position.set(Math.cos(a2) * r2, 0.03, Math.sin(a2) * r2);
      p.scale.setScalar(0.6 + r() * 0.8);
      p.rotation.set(r() * 3, r() * 3, r() * 3);
      escena.add(p);
    }
  }
  const geoRoca = new THREE.DodecahedronGeometry(1, 0);
  for (let i = 0; i < 4; i++) {
    const m = new THREE.Mesh(geoRoca, matPiedra);
    const a = i * 1.7 + 0.8;
    const rr = RADIO + 1.6 + r() * 1.6;
    m.position.set(Math.cos(a) * rr, -0.8 - r() * 1.6, Math.sin(a) * rr);
    m.scale.setScalar(0.22 + r() * 0.3);
    m.rotation.set(r() * 3, r() * 3, r() * 3);
    m.userData.y0 = m.position.y;
    m.userData.fase = r() * 6;
    rocasFlotantes.push(m);
    escena.add(m);
  }
}

/* ---------- Cartel con su nombre ---------- */
{
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 240;
  const ctx = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const nombre = String(CONFIG.para || 'ti').trim();
  const dibujar = () => {
    ctx.fillStyle = '#8a5a36';
    ctx.fillRect(0, 0, 512, 240);
    ctx.strokeStyle = 'rgba(60,32,16,.35)';
    ctx.lineWidth = 3;
    for (let y = 30; y < 240; y += 46) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(170, y + 6, 340, y - 6, 512, y + 3);
      ctx.stroke();
    }
    ctx.fillStyle = '#fff2e2';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'italic 400 44px Fraunces, Georgia, serif';
    ctx.fillText('El jardín de', 256, 74);
    let t = 86;
    do { ctx.font = `500 ${t}px Fraunces, Georgia, serif`; t -= 4; } while (ctx.measureText(nombre).width > 460 && t > 24);
    ctx.fillText(nombre, 256, 160);
    tex.needsUpdate = true;
  };
  dibujar();
  if (document.fonts?.load) {
    Promise.all([document.fonts.load('italic 400 44px Fraunces'), document.fonts.load('500 80px Fraunces')])
      .then(dibujar)
      .catch(() => {});
  }
  const madera = new THREE.MeshStandardMaterial({ color: '#7a4e2e', roughness: 0.9 });
  const frente = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 });
  const cartel = new THREE.Group();
  const tabla = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.52, 0.05), [madera, madera, madera, madera, frente, madera]);
  tabla.position.y = 0.72;
  cartel.add(tabla);
  for (const x of [-0.42, 0.42]) {
    const poste = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.8, 0.06), madera);
    poste.position.set(x, 0.4, -0.04);
    cartel.add(poste);
  }
  const rr = RADIO * borde(ANG_CARTEL) - 0.55;
  cartel.position.set(Math.cos(ANG_CARTEL) * rr, 0, Math.sin(ANG_CARTEL) * rr);
  cartel.rotation.set(-0.06, Math.PI / 2 - ANG_CARTEL, 0.04);
  escena.add(cartel);
}

/* ═════════════════════ Las flores ═════════════════════ */

const PALETA = ['#7b2cbf', '#9d4edd', '#c77dff', '#5a189a', '#b185db', '#8e44ad', '#d4a5f5', '#6c3fb5', '#a663cc', '#e0aaff'];
const TIPOS = ['margarita', 'anemona', 'tulipan', 'lavanda'];
const BRILLO_FLOR = 0.16; // brillo propio de pétalos (para que luzcan al atardecer)
const BRILLO_VERDE = 0.28;

const GEO = {
  margarita: new THREE.SphereGeometry(1, 10, 5).translate(1, 0, 0).scale(0.15, 0.022, 0.045),
  anemona: new THREE.SphereGeometry(1, 12, 6).translate(1, 0, 0).scale(0.13, 0.03, 0.1),
  tulipan: new THREE.SphereGeometry(1, 10, 6).translate(0, 1, 0).scale(0.04, 0.14, 0.078),
  flosculo: new THREE.SphereGeometry(0.026, 6, 4).scale(1, 1.35, 1),
  hoja: new THREE.SphereGeometry(1, 8, 4).translate(1, 0, 0).scale(0.15, 0.012, 0.055),
  centro: new THREE.SphereGeometry(0.055, 10, 6).scale(1, 0.55, 1),
  punto: new THREE.SphereGeometry(0.026, 8, 5),
  toque: new THREE.SphereGeometry(0.42, 8, 6),
  sombra: new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
};
const conBrillo = (color, intensidad, extra = {}) =>
  new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensidad, ...extra });
const MAT = {
  tallo: conBrillo('#4a8a40', BRILLO_VERDE, { roughness: 0.8 }),
  hoja: conBrillo('#56a04a', BRILLO_VERDE, { roughness: 0.75, side: THREE.DoubleSide }),
  centroDorado: conBrillo('#f2c14e', BRILLO_FLOR, { roughness: 0.6 }),
  centroOscuro: conBrillo('#2a173f', BRILLO_FLOR, { roughness: 0.7 }),
  invisible: new THREE.MeshBasicMaterial({ visible: false }),
  sombra: new THREE.MeshBasicMaterial({ map: TEX_SOMBRA, transparent: true, depthWrite: false, opacity: 0.75 }),
};

function posicionFlor(i) {
  const r = azar(5000 + i * 31);
  const rr = ESPACIO * Math.sqrt(i + 0.35);
  const a = i * 2.39996 + 0.6;
  return new V3(Math.cos(a) * rr + (r() - 0.5) * 0.18, 0, Math.sin(a) * rr + (r() - 0.5) * 0.18);
}

function crearFlor(i) {
  const r = azar(9173 + i * 7919);
  const tipo = i === 0 ? 'margarita' : TIPOS[Math.floor(r() * TIPOS.length)];
  const color = new THREE.Color(PALETA[Math.floor(r() * PALETA.length)]);
  color.offsetHSL((r() - 0.5) * 0.03, (r() - 0.5) * 0.1, (r() - 0.5) * 0.06);
  const matPetalo = conBrillo(color, BRILLO_FLOR, { roughness: 0.5, side: THREE.DoubleSide });

  const grupo = new THREE.Group();
  grupo.position.copy(posicionFlor(i));
  grupo.rotation.y = r() * Math.PI * 2;

  const nTallos = tipo === 'lavanda' ? 3 : 1;
  const tallos = [];
  for (let k = 0; k < nTallos; k++) {
    const alto = (tipo === 'lavanda' ? 0.7 : 0.62) + r() * 0.5 - k * 0.08;
    const ang = nTallos > 1 ? (k / nTallos) * Math.PI * 2 + r() * 0.8 : r() * Math.PI * 2;
    const curva = (nTallos > 1 ? 0.15 : 0.05) + r() * 0.08;
    const dx = Math.cos(ang) * curva, dz = Math.sin(ang) * curva;
    const camino = new THREE.CatmullRomCurve3([new V3(0, 0, 0), new V3(dx * 0.25, alto * 0.5, dz * 0.25), new V3(dx, alto, dz)]);
    const tallo = new THREE.Mesh(new THREE.TubeGeometry(camino, 8, tipo === 'lavanda' ? 0.012 : 0.019, 5), MAT.tallo);
    grupo.add(tallo);

    const punta = camino.getPoint(1);
    const cabeza = new THREE.Group();
    cabeza.quaternion.setFromUnitVectors(ARRIBA, camino.getTangent(1).normalize());
    if (tipo === 'margarita' || tipo === 'anemona') cabeza.rotateX((r() - 0.5) * 0.45);
    grupo.add(cabeza);

    const petalos = [];
    const anillo = (geo, n, cerrado, abierto, desfase = 0, x = 0, escala = 1) => {
      for (let p = 0; p < n; p++) {
        const eje = new THREE.Group();
        eje.rotation.y = (p / n) * Math.PI * 2 + desfase + (r() - 0.5) * 0.1;
        const m = new THREE.Mesh(geo, matPetalo);
        m.position.x = x;
        if (escala !== 1) m.scale.setScalar(escala);
        eje.add(m);
        cabeza.add(eje);
        petalos.push({ m, cerrado, abierto: typeof abierto === 'function' ? abierto(p) : abierto });
      }
    };
    if (tipo === 'margarita') {
      anillo(GEO.margarita, 13 + Math.floor(r() * 5), 1.45, (p) => (p % 2 ? 0.08 : 0.24) + r() * 0.08);
      cabeza.add(new THREE.Mesh(GEO.centro, MAT.centroDorado));
    } else if (tipo === 'anemona') {
      anillo(GEO.anemona, 5 + Math.floor(r() * 2), 1.35, () => 0.28 + r() * 0.1);
      cabeza.add(new THREE.Mesh(GEO.centro, MAT.centroOscuro));
      const punto = new THREE.Mesh(GEO.punto, MAT.centroDorado);
      punto.position.y = 0.03;
      cabeza.add(punto);
    } else if (tipo === 'tulipan') {
      anillo(GEO.tulipan, 3, 0.1, -0.34, 0, 0.042);
      anillo(GEO.tulipan, 3, 0.1, -0.16, Math.PI / 3, 0.03, 0.93);
    } else {
      const n = 16;
      for (let j = 0; j < n; j++) {
        const a = j * 2.39996;
        const rr = 0.024 * (1 - (j / n) * 0.5);
        const m = new THREE.Mesh(GEO.flosculo, matPetalo);
        m.position.set(Math.cos(a) * rr, 0.02 + j * 0.02, Math.sin(a) * rr);
        cabeza.add(m);
        petalos.push({ m, escala: j / n });
      }
    }

    const hojas = [];
    if (k < 2) {
      for (let h = 0; h < 2; h++) {
        const hoja = new THREE.Mesh(GEO.hoja, MAT.hoja);
        hoja.position.copy(camino.getPoint(0.22 + h * 0.18 + r() * 0.08));
        hoja.rotation.set(0, r() * Math.PI * 2, 0.45 + r() * 0.35, 'YXZ');
        tallo.add(hoja);
        hojas.push(hoja);
      }
    }
    tallos.push({ tallo, cabeza, punta, petalos, hojas });
  }

  const sombra = new THREE.Mesh(GEO.sombra, MAT.sombra);
  sombra.position.y = 0.012;
  grupo.add(sombra);

  const toque = new THREE.Mesh(GEO.toque, MAT.invisible);
  toque.userData.indice = i;
  grupo.add(toque);

  grupo.updateMatrixWorld(true);
  const flor = {
    i, tipo, grupo, tallos, sombra, toque, color, g: 0, anim: null, fase: r() * 6.28,
    punta: grupo.localToWorld(tallos[0].punta.clone()),
  };
  crecer(flor, 0);
  return flor;
}

// g: 0 = semilla · 0.3 = brote · 1 = flor abierta
function crecer(flor, g) {
  flor.g = g;
  const sg = suave(clamp01(g / 0.6));
  const sc = clamp01((g - 0.22) / 0.45);
  const ab = suave(clamp01((g - 0.55) / 0.45));
  for (const t of flor.tallos) {
    t.tallo.visible = g > 0.005;
    t.tallo.scale.setScalar(Math.max(0.001, sg));
    t.cabeza.visible = g > 0.12;
    t.cabeza.position.copy(t.punta).multiplyScalar(sg);
    t.cabeza.scale.setScalar(Math.max(0.001, 0.4 + 0.6 * (sc < 1 ? rebote(sc) : 1)) * Math.min(1, g * 6));
    for (const p of t.petalos) {
      if (p.escala !== undefined) p.m.scale.setScalar(0.35 + 0.65 * rebote(clamp01(ab * 1.6 - p.escala * 0.6)));
      else p.m.rotation.z = lerp(p.cerrado, p.abierto, ab);
    }
    for (const h of t.hojas) h.scale.setScalar(Math.max(0.001, salida(clamp01((g - 0.12) / 0.4))));
  }
  flor.sombra.visible = g > 0.005;
  flor.sombra.scale.setScalar(0.12 + 0.55 * sg);
  flor.toque.position.copy(flor.tallos[0].cabeza.position);
  flor.toque.scale.setScalar(Math.max(0.6, sg));
}

/* ---------- Flores ya crecidas: se funden en pocas mallas ----------
   Con cientos de flores, dibujar cada pétalo por separado iría lento en el
   móvil. Las flores que ya están abiertas se juntan en 2 mallas (flores y
   verde) que se mecen con la brisa directamente en la tarjeta gráfica. */

function materialFundido(roughness, brillo) {
  const m = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness, side: THREE.DoubleSide, emissive: '#ffffff', emissiveIntensity: brillo,
  });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTiempo = uTiempo;
    sh.vertexShader = 'uniform float uTiempo;\nattribute vec2 aBase;\n' + sh.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      float fase = aBase.x * 1.7 + aBase.y * 1.3;
      float alto = max(position.y, 0.0);
      transformed.x += sin(uTiempo * 1.3 + fase) * 0.035 * alto;
      transformed.z += cos(uTiempo * 1.05 + fase) * 0.03 * alto;`
    );
    sh.fragmentShader = sh.fragmentShader.replace(
      'vec3 totalEmissiveRadiance = emissive;',
      'vec3 totalEmissiveRadiance = emissive * vColor.rgb;'
    );
  };
  return m;
}

function fundir(piezas, material) {
  let nv = 0, ni = 0;
  for (const e of piezas) { nv += e.geo.attributes.position.count; ni += e.geo.index.count; }
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), col = new Float32Array(nv * 3), base = new Float32Array(nv * 2);
  const idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
  const v = new V3(), nm = new THREE.Matrix3();
  let ov = 0, oi = 0;
  for (const e of piezas) {
    const p = e.geo.attributes.position, n = e.geo.attributes.normal, ix = e.geo.index;
    nm.getNormalMatrix(e.m);
    for (let k = 0; k < p.count; k++) {
      const o = (ov + k) * 3;
      v.fromBufferAttribute(p, k).applyMatrix4(e.m);
      pos[o] = v.x; pos[o + 1] = v.y; pos[o + 2] = v.z;
      v.fromBufferAttribute(n, k).applyMatrix3(nm).normalize();
      nor[o] = v.x; nor[o + 1] = v.y; nor[o + 2] = v.z;
      col[o] = e.c.r; col[o + 1] = e.c.g; col[o + 2] = e.c.b;
      base[(ov + k) * 2] = e.bx; base[(ov + k) * 2 + 1] = e.bz;
    }
    for (let k = 0; k < ix.count; k++) idx[oi + k] = ix.getX(k) + ov;
    ov += p.count;
    oi += ix.count;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aBase', new THREE.BufferAttribute(base, 2));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeBoundingSphere();
  return new THREE.Mesh(g, material);
}

const flores = [];
const toques = [];
{
  const piezasFlor = [], piezasVerde = [], sombras = [];
  const ultima = ABIERTAS; // la de índice ABIERTAS es el brote de mañana
  for (let i = 0; i <= ultima; i++) {
    const f = crearFlor(i);
    f.estado = i < ABIERTAS ? 'abierta' : 'brote';
    const animada = f.estado === 'brote' || NUEVAS.includes(i);
    if (animada) {
      // Flores que crecen delante de ella: piezas sueltas
      if (f.estado === 'brote' && !NUEVAS.length) crecer(f, 0.3);
      f.dinamica = true;
      escena.add(f.grupo);
      toques.push(f.toque);
    } else {
      // Flores ya abiertas: se funden
      crecer(f, 1);
      f.grupo.updateMatrixWorld(true);
      const bx = f.grupo.position.x, bz = f.grupo.position.z;
      f.grupo.traverse((o) => {
        if (!o.isMesh || o === f.toque || o === f.sombra) return;
        const verde = o.material === MAT.tallo || o.material === MAT.hoja;
        (verde ? piezasVerde : piezasFlor).push({ geo: o.geometry, m: o.matrixWorld.clone(), c: o.material.color, bx, bz });
      });
      sombras.push(f.sombra.matrixWorld.clone());
      const toque = new THREE.Mesh(GEO.toque, MAT.invisible);
      toque.position.copy(f.punta);
      toque.userData.indice = i;
      escena.add(toque);
      toques.push(toque);
      f.dinamica = false;
    }
    flores.push(f);
  }
  if (piezasFlor.length) escena.add(fundir(piezasFlor, materialFundido(0.5, BRILLO_FLOR)));
  if (piezasVerde.length) escena.add(fundir(piezasVerde, materialFundido(0.78, BRILLO_VERDE)));
  if (sombras.length) {
    const s = new THREE.InstancedMesh(GEO.sombra, MAT.sombra, sombras.length);
    sombras.forEach((m, k) => s.setMatrixAt(k, m));
    escena.add(s);
  }
  // Las piezas sueltas de las flores fundidas ya no hacen falta
  for (const f of flores) {
    if (f.dinamica) continue;
    for (const t of f.tallos) t.tallo.geometry.dispose();
    f.grupo = null;
    f.tallos = null;
  }
}

/* ---------- Brillo sobre la flor de hoy ---------- */
let brilloHoy = null;
if (IDX_HOY >= 0) {
  const f = flores[IDX_HOY];
  const halo = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: TEX_HALO, color: '#e9c2ff', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 })
  );
  const luz = new THREE.PointLight('#d9a8ff', 0, 3, 1.6);
  halo.position.copy(f.punta);
  luz.position.copy(f.punta).add(new V3(0, 0.3, 0));
  escena.add(halo, luz);
  brilloHoy = { f, halo, luz };
}

/* ---------- Luciérnagas, pétalos que caen y chispas ---------- */
const luciernagas = (() => {
  const r = azar(31);
  const n = MOVIMIENTO_REDUCIDO ? 14 : Math.round(24 + RADIO * 3);
  const base = [];
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2, rr = Math.sqrt(r()) * (RADIO + 0.6);
    base.push({ x: Math.cos(a) * rr, y: 0.35 + r() * 1.8, z: Math.sin(a) * rr, f: r() * 6.28, v: 0.4 + r() * 0.6 });
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  const puntos = new THREE.Points(
    g,
    new THREE.PointsMaterial({ map: TEX_BRILLO, color: '#ffe7a3', size: 0.13, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })
  );
  puntos.frustumCulled = false;
  escena.add(puntos);
  return { base, g, puntos };
})();

const petalosCaen = (() => {
  const r = azar(55);
  const n = MOVIMIENTO_REDUCIDO ? 0 : Math.round(16 + RADIO * 3);
  const geo = new THREE.SphereGeometry(1, 6, 4).scale(0.05, 0.008, 0.032);
  const mat = new THREE.MeshStandardMaterial({ color: '#c99bf0', emissive: '#7b3fb0', emissiveIntensity: 0.3, roughness: 0.6 });
  const malla = new THREE.InstancedMesh(geo, mat, Math.max(1, n));
  malla.count = n;
  malla.frustumCulled = false;
  const datos = [];
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2, rr = Math.sqrt(r()) * RADIO;
    datos.push({ x: Math.cos(a) * rr, y: r() * 4.5, z: Math.sin(a) * rr, v: 0.18 + r() * 0.2, f: r() * 6.28, giro: r() * 3 });
  }
  escena.add(malla);
  return { malla, datos, r };
})();

const chispas = (() => {
  const n = 120;
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  const vida = new Float32Array(n);
  const vel = Array.from({ length: n }, () => new V3());
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const puntos = new THREE.Points(
    g,
    new THREE.PointsMaterial({ map: TEX_BRILLO, size: 0.09, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })
  );
  puntos.frustumCulled = false;
  escena.add(puntos);
  let siguiente = 0;
  return {
    lanzar(en, cuantas = 45, fuerza = 1) {
      for (let k = 0; k < cuantas; k++) {
        const i = siguiente++ % n;
        pos[i * 3] = en.x; pos[i * 3 + 1] = en.y; pos[i * 3 + 2] = en.z;
        vel[i].set((Math.random() - 0.5) * 1.4 * fuerza, (0.5 + Math.random() * 1.3) * fuerza, (Math.random() - 0.5) * 1.4 * fuerza);
        vida[i] = 1;
      }
    },
    actualizar(dt) {
      for (let i = 0; i < n; i++) {
        if (vida[i] <= 0) { col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = 0; continue; }
        vida[i] -= dt * 0.7;
        vel[i].y -= dt * 0.9;
        vel[i].multiplyScalar(1 - dt * 1.2);
        pos[i * 3] += vel[i].x * dt;
        pos[i * 3 + 1] += vel[i].y * dt;
        pos[i * 3 + 2] += vel[i].z * dt;
        const v = Math.max(0, vida[i]);
        col[i * 3] = v; col[i * 3 + 1] = v * 0.85; col[i * 3 + 2] = v;
      }
      g.attributes.position.needsUpdate = true;
      g.attributes.color.needsUpdate = true;
    },
  };
})();

/* ═════════════════════ Cámara ═════════════════════ */

const vertical = () => camara.aspect < 1;
function ajustarCamara() {
  const w = window.innerWidth, h = window.innerHeight;
  camara.aspect = w / h;
  camara.fov = vertical() ? 55 : 42;
  camara.updateProjectionMatrix();
  renderer.setSize(w, h, false);
  controles.maxDistance = RADIO * 3.2 + 8;
}
ajustarCamara();

function vistaGeneral() {
  // Con pocas flores se ve la isla entera; en jardines muy grandes, la zona más florida.
  const rf = Math.min(RADIO + 0.4, Math.max(Math.min(RADIO, 3.6), ESPACIO * Math.sqrt(ABIERTAS + 1) + 1.3));
  const tan = Math.tan(THREE.MathUtils.degToRad(camara.fov / 2));
  const d = Math.max((rf * (vertical() ? 0.8 : 1.05)) / (tan * camara.aspect), (rf * 1.05) / tan, 4.2);
  const objetivo = new V3(0, 0.45 + rf * 0.28, 0); // la isla abajo, el cielo arriba
  const dir = camara.position.clone().sub(controles.target).setY(0);
  if (dir.lengthSq() < 1e-6) dir.set(0.25, 0, 1);
  dir.normalize();
  const polar = vertical() ? 1.2 : 1.16;
  const pos = objetivo.clone().addScaledVector(dir, d * Math.sin(polar)).add(new V3(0, d * Math.cos(polar), 0));
  return { objetivo, pos, rf };
}

const vuelo = { activo: false, t0: 0, dur: 1.6, dT: new V3(), hT: new V3(), dC: new V3(), hC: new V3() };
function volar(objetivo, pos, dur = 1.6) {
  vuelo.dT.copy(controles.target);
  vuelo.hT.copy(objetivo);
  vuelo.dC.copy(camara.position);
  vuelo.hC.copy(pos);
  vuelo.t0 = performance.now() / 1000;
  vuelo.dur = dur;
  vuelo.activo = true;
  controles.autoRotate = false;
}
function volarAFlor(flor, dur) {
  const p = flor.punta;
  const dir = camara.position.clone().sub(controles.target).setY(0);
  if (dir.lengthSq() < 1e-6) dir.set(0, 0, 1);
  dir.normalize();
  const dist = vertical() ? 3.1 : 2.6;
  const bajar = vertical() ? 0.62 : 0.32; // deja la flor por encima de la tarjeta
  const objetivo = p.clone().add(new V3(0, -bajar, 0));
  const pos = p.clone().addScaledVector(dir, dist * 0.88).add(new V3(0, dist * 0.42, 0));
  volar(objetivo, pos, dur);
}
function volverAGeneral(dur = 1.8, bajar = 0) {
  const v = vistaGeneral();
  volar(v.objetivo.clone().add(new V3(0, -bajar, 0)), v.pos, dur);
}

{
  const v = vistaGeneral();
  controles.target.copy(v.objetivo);
  camara.position.copy(v.pos);
  controles.update();
}

let reanudarGiro = 0;
let tocado = false; // ella ya ha movido la cámara
controles.addEventListener('start', () => {
  vuelo.activo = false;
  controles.autoRotate = false;
  reanudarGiro = Infinity;
  tocado = true;
});
controles.addEventListener('end', () => {
  reanudarGiro = performance.now() / 1000 + 7;
});

/* ═════════════════════ Interfaz ═════════════════════ */

const ui = {
  intro: $('intro'), hud: $('hud'), acciones: $('acciones'), pista: $('pista'),
  tarjeta: $('tarjeta'), etiqueta: $('tarjetaEtiqueta'), texto: $('tarjetaTexto'), firma: $('tarjetaFirma'),
  foto: $('tarjetaFoto'), nav: $('tarjetaNav'), ant: $('btnAnterior'), sig: $('btnSiguiente'),
};
let tarjetaAbierta = null; // índice de flor o 'carta'

function pintarInterfaz() {
  const para = String(CONFIG.para || '').trim();
  $('introPara').textContent = para ? `Para ${para} 💜` : 'Para ti 💜';
  $('introFirma').textContent = CONFIG.de ? `Con amor, ${CONFIG.de}` : '';

  let texto;
  if (DIA_N < 1) {
    const faltan = 1 - DIA_N;
    texto = `Nuestro jardín empieza a crecer ${faltan === 1 ? 'mañana' : `en ${faltan} días`} 🌱`;
  } else if (PRIMERA) {
    texto = 'Una flor por cada día que llevamos juntos.';
  } else if (NUEVAS.length > 1) {
    texto = `Han brotado ${NUEVAS.length} flores nuevas desde tu última visita 🌸`;
  } else if (NUEVAS.length === 1) {
    texto = `Hoy ha brotado una flor nueva: ya llevamos ${DIA_N} ${plural(DIA_N, 'día', 'días')} juntos 💜`;
  } else {
    texto = 'Ya viste la flor de hoy. Mañana brota otra 🌱';
  }
  $('introTexto').textContent = texto;

  // Contador de la esquina
  const dias = Math.max(0, DIA_N);
  $('hudDias').textContent = dias;
  $('hudDiasTxt').textContent = plural(dias, 'día juntos', 'días juntos');
  $('hudFlores').textContent = ABIERTAS;
  $('hudFloresTxt').textContent = plural(ABIERTAS, 'flor', 'flores');

  if (REENCUENTRO) {
    const f = diasEntre(HOY, REENCUENTRO);
    const c = $('hudCuenta');
    if (f >= 0) {
      c.textContent = f === 0 ? '¡Hoy nos vemos! 💜' : f === 1 ? '¡Mañana nos vemos! 💜' : `Faltan ${f} días para vernos ✈️`;
      c.hidden = false;
    }
  }
  if (MODO_VISTA) {
    $('hudVista').textContent = `Vista previa · día ${diaVista}${PRIMERA ? ' · 1ª vez' : ''}`;
    $('hudVista').hidden = false;
  }
  $('btnHoy').hidden = IDX_HOY < 0;
  $('btnCarta').hidden = !CONFIG.bienvenida;
  if (CONFIG.cancion) {
    $('btnCancion').href = CONFIG.cancion;
    $('btnCancion').hidden = false;
  }
  if (DIA_N < 1) $('pista').textContent = 'Toca la semilla · arrastra para girar';
}
pintarInterfaz();

function mostrarTarjeta() {
  ui.tarjeta.hidden = false;
  ui.tarjeta.style.animation = 'none';
  void ui.tarjeta.offsetWidth;
  ui.tarjeta.style.animation = '';
  ui.tarjeta.scrollTop = 0;
  ui.acciones.classList.add('oculto');
  ui.pista.classList.add('oculto');
  controles.autoRotate = false;
  reanudarGiro = Infinity;
}

function abrirTarjeta(i) {
  const flor = flores[i];
  if (!flor) return;
  tarjetaAbierta = i;
  const fecha = masDias(INICIO, i);
  ui.firma.hidden = true;
  ui.etiqueta.textContent = `Flor nº ${i + 1} · ${fmtFecha.format(fecha)}${i === IDX_HOY ? ' · hoy' : ''}`;
  if (flor.estado === 'brote') {
    const dif = diasEntre(HOY, fecha);
    ui.texto.textContent = dif <= 1 ? 'Esta flor brota mañana. Vuelve a verla 🌱' : `Esta flor brota dentro de ${dif} días 🌱`;
    ui.foto.hidden = true;
    ui.nav.hidden = true;
  } else {
    const msj = MENSAJES.get(i);
    ui.texto.textContent = msj?.texto
      || (i === IDX_HOY ? `La flor de hoy: ya llevamos ${i + 1} ${plural(i + 1, 'día', 'días')} juntos 💜` : `Día ${i + 1} juntos 💜`);
    if (msj?.foto) {
      ui.foto.src = msj.foto;
      ui.foto.hidden = false;
    } else ui.foto.hidden = true;
    ui.nav.hidden = ABIERTAS < 2;
    ui.ant.disabled = i === 0;
    ui.sig.disabled = i >= ABIERTAS - 1;
  }
  ui.tarjeta.style.setProperty('--color', '#' + flor.color.getHexString());
  mostrarTarjeta();
  volarAFlor(flor);
  if (flor.dinamica) flor.saltito = performance.now() / 1000;
}

function abrirCarta() {
  if (!CONFIG.bienvenida) return;
  tarjetaAbierta = 'carta';
  ui.etiqueta.textContent = 'Para ti 💌';
  ui.texto.textContent = String(CONFIG.bienvenida);
  ui.firma.textContent = CONFIG.de ? `— ${CONFIG.de}` : '';
  ui.firma.hidden = !CONFIG.de;
  ui.foto.hidden = true;
  ui.nav.hidden = true;
  ui.tarjeta.style.removeProperty('--color');
  mostrarTarjeta();
  // El jardín queda por encima de la carta
  const v = vistaGeneral();
  volar(vertical() ? new V3(0, -0.42 * v.rf, 0) : v.objetivo.clone().add(new V3(0, -0.8, 0)), v.pos, 2.2);
  chispas.lanzar(new V3(0, 1.6, 0), 90, 1.4);
}

function cerrarTarjeta() {
  if (tarjetaAbierta === null) return;
  tarjetaAbierta = null;
  ui.tarjeta.hidden = true;
  ui.acciones.classList.remove('oculto');
  volverAGeneral();
  reanudarGiro = performance.now() / 1000 + 2.5;
}

$('btnCerrar').addEventListener('click', cerrarTarjeta);
ui.ant.addEventListener('click', () => typeof tarjetaAbierta === 'number' && abrirTarjeta(tarjetaAbierta - 1));
ui.sig.addEventListener('click', () => typeof tarjetaAbierta === 'number' && abrirTarjeta(tarjetaAbierta + 1));
$('btnHoy').addEventListener('click', () => IDX_HOY >= 0 && abrirTarjeta(IDX_HOY));
$('btnCarta').addEventListener('click', abrirCarta);
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') cerrarTarjeta();
  if (typeof tarjetaAbierta === 'number' && flores[tarjetaAbierta]?.estado === 'abierta') {
    if (e.key === 'ArrowLeft' && tarjetaAbierta > 0) abrirTarjeta(tarjetaAbierta - 1);
    if (e.key === 'ArrowRight' && tarjetaAbierta < ABIERTAS - 1) abrirTarjeta(tarjetaAbierta + 1);
  }
});

/* ---------- Tocar flores ---------- */
const rayo = new THREE.Raycaster();
const puntero = new THREE.Vector2();
let pulsado = null;
let entrado = false;
lienzo.addEventListener('pointerdown', (e) => { pulsado = { x: e.clientX, y: e.clientY, t: performance.now() }; });
lienzo.addEventListener('pointerup', (e) => {
  if (!pulsado || !entrado) return;
  const mov = Math.hypot(e.clientX - pulsado.x, e.clientY - pulsado.y);
  const dur = performance.now() - pulsado.t;
  pulsado = null;
  if (mov > 8 || dur > 600) return;
  const rect = lienzo.getBoundingClientRect();
  puntero.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
  rayo.setFromCamera(puntero, camara);
  const hit = rayo.intersectObjects(toques, false)[0];
  if (hit) abrirTarjeta(hit.object.userData.indice);
  else if (tarjetaAbierta !== null) cerrarTarjeta();
});

/* ---------- Entrar al jardín ---------- */
function alTerminarDeCrecer(flor) {
  if (PRIMERA) {
    // Primera vez: le sale la carta
    setTimeout(() => tarjetaAbierta === null && abrirCarta(), 700);
  } else {
    // Los demás días: la flor nueva crece y volvemos a ver el jardín, sin mensajes
    setTimeout(() => {
      if (tarjetaAbierta !== null || tocado) return;
      volverAGeneral(2.4);
      reanudarGiro = performance.now() / 1000 + 2.6;
    }, 2200);
  }
}

function entrar() {
  if (entrado) return;
  entrado = true;
  ui.intro.classList.add('oculto');
  setTimeout(() => (ui.intro.hidden = true), 1300);
  ui.hud.classList.remove('oculto');
  ui.acciones.classList.remove('oculto');
  ui.pista.classList.remove('oculto');
  setTimeout(() => ui.pista.classList.add('oculto'), 9000);
  if (!MODO_VISTA) { try { localStorage.setItem(CLAVE, String(ABIERTAS)); } catch {} }

  const t = performance.now() / 1000;
  if (NUEVAS.length) {
    const foco = flores[NUEVAS[NUEVAS.length - 1]];
    volarAFlor(foco, 2.2);
    const escalon = Math.min(0.45, 2.4 / NUEVAS.length);
    NUEVAS.forEach((i, k) => {
      flores[i].anim = { desde: 0, hasta: 1, t0: t + 0.9 + k * escalon, dur: 3.4, ultima: i === foco.i };
    });
    const brote = flores.find((f) => f.estado === 'brote');
    if (brote) brote.anim = { desde: 0, hasta: 0.3, t0: t + 1.2 + NUEVAS.length * escalon, dur: 2 };
    reanudarGiro = Infinity;
  } else if (PRIMERA) {
    setTimeout(abrirCarta, 1200);
  } else {
    reanudarGiro = t + 2;
  }
}
$('btnEntrar').addEventListener('click', entrar);

/* ═════════════════════ Bucle principal ═════════════════════ */

const reloj = new THREE.Clock();
const ayuda = new THREE.Object3D();
const estrellas = escena.getObjectByName('estrellas');
const dinamicas = flores.filter((f) => f.dinamica);
let primerCuadro = true;

function bucle() {
  const dt = Math.min(reloj.getDelta(), 0.05);
  const t = performance.now() / 1000;
  uTiempo.value = t;

  // Flores que crecen (las demás se mecen en la tarjeta gráfica)
  for (const f of dinamicas) {
    if (f.anim) {
      const p = clamp01((t - f.anim.t0) / f.anim.dur);
      if (t >= f.anim.t0) crecer(f, lerp(f.anim.desde, f.anim.hasta, p));
      if (p >= 1) {
        const a = f.anim;
        f.anim = null;
        if (a.hasta === 1) chispas.lanzar(f.punta);
        if (a.ultima) alTerminarDeCrecer(f);
      }
    }
    const s = f.saltito ? clamp01((t - f.saltito) / 0.7) : 1;
    const salto = s < 1 ? Math.sin(s * Math.PI) * 0.12 * (1 - s) : 0;
    f.grupo.rotation.z = Math.sin(t * 1.3 + f.fase) * 0.035 * f.g + salto;
    f.grupo.rotation.x = Math.cos(t * 1.05 + f.fase) * 0.03 * f.g;
    f.grupo.scale.setScalar(1 + (s < 1 ? Math.sin(s * Math.PI) * 0.08 : 0));
  }

  if (brilloHoy) {
    const { f, halo, luz } = brilloHoy;
    const vis = clamp01((f.g - 0.6) / 0.4);
    halo.scale.setScalar((0.95 + Math.sin(t * 2.2) * 0.12) * vis + 0.001);
    halo.material.opacity = 0.55 * vis;
    luz.intensity = 1.6 * vis;
  }

  // Luciérnagas
  {
    const pos = luciernagas.g.attributes.position;
    luciernagas.base.forEach((b, i) => {
      pos.setXYZ(
        i,
        b.x + Math.sin(t * 0.4 * b.v + b.f) * 0.5,
        b.y + Math.sin(t * 0.7 * b.v + b.f * 2) * 0.25,
        b.z + Math.cos(t * 0.35 * b.v + b.f) * 0.5
      );
    });
    pos.needsUpdate = true;
    luciernagas.puntos.material.opacity = 0.75 + Math.sin(t * 2.3) * 0.2;
  }

  // Pétalos que caen
  if (petalosCaen.datos.length) {
    petalosCaen.datos.forEach((d, i) => {
      d.y -= d.v * dt;
      if (d.y < 0.02) {
        const r = petalosCaen.r;
        const a = r() * Math.PI * 2, rr = Math.sqrt(r()) * RADIO;
        d.x = Math.cos(a) * rr; d.z = Math.sin(a) * rr; d.y = 4 + r();
      }
      ayuda.position.set(d.x + Math.sin(t * 0.8 + d.f) * 0.4, d.y, d.z + Math.cos(t * 0.6 + d.f) * 0.4);
      ayuda.rotation.set(t * 0.9 + d.giro, d.giro, Math.sin(t * 1.4 + d.f) * 1.2);
      ayuda.updateMatrix();
      petalosCaen.malla.setMatrixAt(i, ayuda.matrix);
    });
    petalosCaen.malla.instanceMatrix.needsUpdate = true;
  }

  chispas.actualizar(dt);
  for (const m of rocasFlotantes) {
    m.position.y = m.userData.y0 + Math.sin(t * 0.6 + m.userData.fase) * 0.12;
    m.rotation.y += dt * 0.08;
  }
  if (estrellas) estrellas.material.opacity = 0.8 + Math.sin(t * 0.9) * 0.15;

  // Cámara
  if (vuelo.activo) {
    const p = suave(clamp01((t - vuelo.t0) / vuelo.dur));
    controles.target.lerpVectors(vuelo.dT, vuelo.hT, p);
    camara.position.lerpVectors(vuelo.dC, vuelo.hC, p);
    if (p >= 1) vuelo.activo = false;
  }
  if (!MOVIMIENTO_REDUCIDO && tarjetaAbierta === null && !vuelo.activo && t > reanudarGiro) controles.autoRotate = true;
  controles.update();

  renderer.render(escena, camara);

  if (primerCuadro) {
    primerCuadro = false;
    const b = $('btnEntrar');
    b.disabled = false;
    b.textContent = DIA_N < 1 ? 'Ver la semilla 🌱' : 'Entrar al jardín';
  }
  requestAnimationFrame(bucle);
}

window.addEventListener('resize', ajustarCamara);
requestAnimationFrame(bucle);
if (params.has('debug')) window.jardin = { renderer, escena, flores };
