import * as THREE from './lib/three.module.min.js';
import { OrbitControls } from './lib/OrbitControls.js';
import { crearMusica } from './musica.js';
import { crearPersonajes, MANTA, AMIGOS_NUEVOS } from './personajes.js';

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
const musica = crearMusica();
const ARRIBA = new V3(0, 1, 0);
const plural = (n, uno, varios) => (n === 1 ? uno : varios);
const vibrar = (ms) => { try { navigator.vibrate?.(ms); } catch { /* sin vibración */ } };

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

// La flor de cada día brota a esta hora (config.js → horaFlor), hora de quien mira.
// Hasta entonces, en el jardín sigue siendo el día anterior.
const HORA_FLOR = Math.min(23, Math.max(0, Math.floor(Number(CONFIG.horaFlor ?? 0)) || 0));
function diaJardin(d) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours() - HORA_FLOR);
  return new Date(x.getFullYear(), x.getMonth(), x.getDate());
}
const ahora = new Date();
const HOY_REAL = diaJardin(ahora);
const HOY_CALENDARIO = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
const INICIO = leerFecha(CONFIG.inicio) || HOY_REAL;
const REENCUENTRO = leerFecha(CONFIG.reencuentro);
const BESO = leerFecha(CONFIG.primerBeso);

const params = new URLSearchParams(location.search);
const diaVista = parseInt(params.get('dia'), 10);
const MODO_VISTA = Number.isFinite(diaVista);
const HOY = MODO_VISTA ? masDias(INICIO, diaVista - 1) : HOY_REAL;

const DIA_N = diasEntre(INICIO, HOY) + 1; // día 1 = el día que empezasteis
const ABIERTAS = Math.max(0, DIA_N); // una flor por día juntos
const IDX_HOY = DIA_N >= 1 ? DIA_N - 1 : -1;

// Meses enteros juntos. Cada mes llega al jardín un amigo nuevo de Chiikawa
// (config.js → amigos dice en qué mes llega cada uno).
const MESES = Math.max(0, (HOY.getFullYear() - INICIO.getFullYear()) * 12 + HOY.getMonth() - INICIO.getMonth()
  - (HOY.getDate() < INICIO.getDate() ? 1 : 0));
const MES_AMIGO = CONFIG.amigos ?? { momonga: 2, kurimanju: 3, rakko: 4, shisa: 5 };
const LLEGADOS = AMIGOS_NUEVOS
  .map((tipo, hueco) => ({ tipo, hueco, mes: Number(MES_AMIGO[tipo]) }))
  .filter((q) => q.mes >= 1 && q.mes <= MESES);

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

/* ═════════════════════ Calidad según el dispositivo ═════════════════════
   En el móvil se dibuja con menos detalle para que vaya fluido. Además, si
   aun así va lento, el propio jardín baja la resolución sobre la marcha.
   Se puede forzar con ?calidad=alta, ?calidad=media o ?calidad=baja. */

const TACTIL = matchMedia('(pointer: coarse)').matches;
const NIVEL = (() => {
  const pedido = params.get('calidad');
  if (['alta', 'media', 'baja'].includes(pedido)) return pedido;
  const pequeno = Math.min(screen.width, screen.height) < 700;
  if (!TACTIL && !pequeno) return 'alta';
  return navigator.deviceMemory && navigator.deviceMemory <= 3 ? 'baja' : 'media';
})();
const Q = {
  alta: { dpr: 2, dprMin: 1, suavizado: true, hierba: 95, hierbaMax: 26000, detalle: 1, estrellas: 700, nubes: 26, pbr: true, caras: 768, mariposas: 6 },
  media: { dpr: 1.75, dprMin: 1, suavizado: true, hierba: 55, hierbaMax: 12000, detalle: 0.7, estrellas: 500, nubes: 18, pbr: false, caras: 512, mariposas: 5 },
  baja: { dpr: 1.25, dprMin: 0.8, suavizado: false, hierba: 30, hierbaMax: 6000, detalle: 0.5, estrellas: 350, nubes: 12, pbr: false, caras: 512, mariposas: 3 },
}[NIVEL];
// Cuantas más flores haya, más sencilla se dibuja cada una en el móvil: así el jardín sigue yendo fluido dentro de años.
if (NIVEL !== 'alta') Q.detalle *= Math.min(1, Math.sqrt((NIVEL === 'media' ? 160 : 90) / Math.max(1, ABIERTAS)));
const seg = (n, min = 3) => Math.max(min, Math.round(n * Q.detalle));
// Material con brillos realistas en ordenador; uno más ligero en el móvil
function material(p) {
  if (Q.pbr) return new THREE.MeshStandardMaterial(p);
  const { roughness, metalness, ...resto } = p;
  return new THREE.MeshLambertMaterial(resto);
}

/* ═════════════════════ Render y escena ═════════════════════ */

const lienzo = $('escena');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas: lienzo, antialias: Q.suavizado, powerPreference: 'high-performance' });
} catch (e) {
  mostrarError('Tu navegador no puede mostrar el jardín en 3D 😢 Prueba a abrirlo con Chrome o Safari.');
  throw e;
}
let ratio = Math.min(window.devicePixelRatio || 1, Q.dpr);
renderer.setPixelRatio(ratio);
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const escena = new THREE.Scene();
escena.fog = new THREE.Fog('#3a1f5e', 24, 85);

const camara = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.05, 400);
const controles = new OrbitControls(camara, lienzo);
controles.enableDamping = true;
controles.dampingFactor = 0.07;
controles.enablePan = true; // con dos dedos (o el botón derecho) se mueve la vista
controles.screenSpacePanning = true;
controles.panSpeed = 0.9;
controles.zoomToCursor = true; // el zoom va hacia donde pellizcas o donde está el ratón
controles.minDistance = 1.3;
controles.maxPolarAngle = 1.42; // se recalcula en cada cuadro: puede bajar hasta ras de hierba
controles.cursor.set(0, 0.8, 0);
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
// La isla crece a medida que brotan flores (+1 por el brote de mañana)
// y da un estirón cada vez que llega un amigo nuevo.
const ESTIRON = 0.3;
const RADIO = Math.max(3.4, ESPACIO * Math.sqrt(ABIERTAS + 2) + 1.55) + ESTIRON * LLEGADOS.length;
const bordeBase = (a) => 1 + 0.045 * Math.sin(a * 5 + 1.3) + 0.025 * Math.sin(a * 11 + 0.4) + 0.015 * Math.sin(a * 17);
const ANG_CARTEL = Math.PI / 2 + 0.62;
const difAngulo = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

// Sitio de la manta de Chiikawa y sus amigos: el saliente más ancho de la
// parte de delante de la isla, lo más cerca del borde que quepa entera.
const SITIO = (() => {
  let mejor = null;
  for (let a = 0.95; a <= 1.72; a += 0.02) {
    let r = RADIO * 1.12;
    const cabe = () => {
      for (let k = -4; k <= 4; k++) {
        const x = (k / 4) * (MANTA.ancho / 2), z = r + MANTA.fondo / 2;
        if (Math.hypot(x, z) > RADIO * bordeBase(a - Math.atan2(x, z)) - 0.22) return false;
      }
      return true;
    };
    while (r > 1 && !cabe()) r -= 0.02;
    if (!mejor || r > mejor.r) mejor = { a, r };
  }
  const ca = Math.cos(mejor.a), sa = Math.sin(mejor.a);
  return { ...mejor, ca, sa, x: ca * mejor.r, z: sa * mejor.r, medioAngulo: Math.atan2(MANTA.ancho / 2 + 0.35, mejor.r) };
})();

// Cada amigo que llega tiene su sitio a un lado u otro de la manta, y la isla
// saca ahí un saliente nuevo para él. El sitio de cada uno no cambia nunca.
const HUECOS = [-0.85, 1.45, -1.6, 2.2]; // ángulo respecto a la manta
const COJIN = 0.46; // radio de su mantita redonda
const VECINOS = LLEGADOS.map((q) => ({ ...q, a: SITIO.a + HUECOS[q.hueco] }));
const borde = (a) => {
  let b = bordeBase(a);
  for (const v of VECINOS) b += 0.075 * Math.exp(-((difAngulo(a, v.a) / 0.3) ** 2));
  return b;
};
for (const v of VECINOS) {
  v.r = RADIO * borde(v.a) - 0.72;
  v.x = Math.cos(v.a) * v.r;
  v.z = Math.sin(v.a) * v.r;
  v.frente = v.a + difAngulo(SITIO.a, v.a) * 0.55; // mira hacia fuera, girado hacia donde se entra al jardín
  v.medioAngulo = Math.atan2(COJIN + 0.34, v.r);
}
const juntoAVecino = (a) => VECINOS.some((v) => Math.abs(difAngulo(a, v.a)) < v.medioAngulo);

function enManta(x, z, margen = 0.07) {
  const dx = x - SITIO.x, dz = z - SITIO.z;
  if (Math.abs(dx * SITIO.sa - dz * SITIO.ca) < MANTA.ancho / 2 + margen
    && Math.abs(dx * SITIO.ca + dz * SITIO.sa) < MANTA.fondo / 2 + margen) return true;
  return VECINOS.some((v) => Math.hypot(x - v.x, z - v.z) < COJIN + margen);
}

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
  const n = Q.estrellas;
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
  for (let i = 0; i < Q.nubes; i++) {
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
  escena.add(new THREE.Mesh(cesped, material({ color: '#3f7642', roughness: 1 })));

  const tierra = new THREE.CylinderGeometry(RADIO * 0.985, RADIO * 0.84, 0.55, 72, 2);
  tierra.translate(0, -0.34 - 0.275, 0);
  deformarRadial(tierra, (a, v) => borde(a) * (1 + (ruido3(v.x, v.y, v.z) - 0.5) * 0.04));
  escena.add(new THREE.Mesh(tierra, material({ color: '#5b3d2e', roughness: 1 })));

  const altoRoca = RADIO * 1.3;
  const roca = new THREE.ConeGeometry(RADIO * 0.84, altoRoca, 12, 5);
  roca.rotateX(Math.PI);
  roca.translate(0, -0.89 - altoRoca / 2, 0);
  deformarRadial(roca, (a, v) => borde(a) * (v.y > -0.9 ? 1 : 1 + (ruido3(v.x, v.y, v.z) - 0.5) * 0.35));
  escena.add(new THREE.Mesh(roca, material({ color: '#4d4061', roughness: 0.95, flatShading: true })));
}

/* ---------- Hierba que se mueve con el viento ---------- */
let pasto;
{
  const r = azar(2024);
  const n = Math.min(Q.hierbaMax, Math.floor(Math.PI * RADIO * RADIO * Q.hierba));
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
  pasto = new THREE.InstancedMesh(geo, mat, n);
  const d = new THREE.Object3D();
  const c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2;
    const rr = Math.sqrt(r()) * RADIO * 0.96 * borde(a);
    d.position.set(Math.cos(a) * rr, 0, Math.sin(a) * rr);
    d.rotation.set((r() - 0.5) * 0.35, r() * Math.PI * 2, (r() - 0.5) * 0.35);
    d.scale.set(1, 0.55 + r() * 0.9, 1);
    if (enManta(d.position.x, d.position.z)) d.scale.setScalar(0); // la manta aplasta la hierba
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
  const matArbusto = material({ color: '#2f6a3c', roughness: 0.9, flatShading: true });
  const matPiedra = material({ color: '#6d6280', roughness: 0.9, flatShading: true });
  const geoArbusto = new THREE.IcosahedronGeometry(0.32, 1);
  const geoPiedra = new THREE.DodecahedronGeometry(0.14, 0);
  const n = Math.round(RADIO * 2.6);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + (r() - 0.5) * 0.5;
    const dif = Math.atan2(Math.sin(a - ANG_CARTEL), Math.cos(a - ANG_CARTEL));
    if (Math.abs(dif) < 0.45 * (3.6 / Math.max(3.6, RADIO))) continue;
    if (Math.abs(difAngulo(a, SITIO.a)) < SITIO.medioAngulo || juntoAVecino(a)) continue; // que no tapen a Chiikawa y sus amigos
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
  const madera = material({ color: '#7a4e2e', roughness: 0.9 });
  const frente = material({ map: tex, roughness: 0.85 });
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
const TIPOS = ['margarita', 'anemona', 'tulipan', 'lavanda', 'campanilla', 'pensamiento', 'lirio', 'allium', 'rosa', 'jacinto'];
// Tallo de cada tipo: alto mínimo, cuánto puede variar, cuánto se inclina y grosor
const TALLO = {
  margarita: [0.62, 0.5, 0.05, 0.019],
  anemona: [0.62, 0.5, 0.05, 0.019],
  tulipan: [0.62, 0.5, 0.05, 0.019],
  lavanda: [0.7, 0.5, 0.15, 0.012],
  campanilla: [0.66, 0.36, 0.2, 0.014],
  pensamiento: [0.3, 0.22, 0.05, 0.015],
  lirio: [0.72, 0.4, 0.04, 0.02],
  allium: [0.88, 0.42, 0.04, 0.016],
  rosa: [0.6, 0.42, 0.05, 0.02],
  jacinto: [0.42, 0.25, 0.03, 0.025],
};
const ABAJO = new V3(0, -1, 0);
const BRILLO_FLOR = 0.16; // brillo propio de pétalos (para que luzcan al atardecer)
const BRILLO_VERDE = 0.28;

const GEO = {
  margarita: new THREE.SphereGeometry(1, seg(10, 5), seg(5)).translate(1, 0, 0).scale(0.15, 0.022, 0.045),
  anemona: new THREE.SphereGeometry(1, seg(12, 6), seg(6)).translate(1, 0, 0).scale(0.13, 0.03, 0.1),
  tulipan: new THREE.SphereGeometry(1, seg(10, 5), seg(6)).translate(0, 1, 0).scale(0.04, 0.14, 0.078),
  flosculo: new THREE.SphereGeometry(0.026, seg(6, 4), seg(4, 2)).scale(1, 1.35, 1),
  // campana que cuelga boca abajo (la punta arriba, en el origen)
  campana: new THREE.LatheGeometry(
    [[0.037, -0.076], [0.027, -0.067], [0.022, -0.044], [0.017, -0.02], [0.007, -0.004], [0, 0]].map(([x, y]) => new THREE.Vector2(x, y)),
    seg(8, 6)
  ),
  pensamiento: new THREE.SphereGeometry(1, seg(10, 6), seg(5)).translate(0.85, 0, 0).scale(0.074, 0.015, 0.07),
  lirio: new THREE.SphereGeometry(1, seg(10, 5), seg(5)).translate(1, 0, 0).scale(0.1, 0.016, 0.052),
  rosa: new THREE.SphereGeometry(1, seg(10, 6), seg(6, 4)).translate(0, 1, 0).scale(0.02, 0.05, 0.058),
  hoja: new THREE.SphereGeometry(1, seg(8, 5), seg(4)).translate(1, 0, 0).scale(0.15, 0.012, 0.055),
  centro: new THREE.SphereGeometry(0.055, seg(10, 6), seg(6, 4)).scale(1, 0.55, 1),
  punto: new THREE.SphereGeometry(0.026, 8, 5),
  toque: new THREE.SphereGeometry(0.42, 8, 6),
  sombra: new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
};
const conBrillo = (color, intensidad, extra = {}) =>
  material({ color, emissive: color, emissiveIntensity: intensidad, ...extra });
const MAT = {
  tallo: conBrillo('#4a8a40', BRILLO_VERDE, { roughness: 0.8 }),
  hoja: conBrillo('#56a04a', BRILLO_VERDE, { roughness: 0.75, side: THREE.DoubleSide }),
  centroDorado: conBrillo('#f2c14e', BRILLO_FLOR, { roughness: 0.6 }),
  centroOscuro: conBrillo('#2a173f', BRILLO_FLOR, { roughness: 0.7 }),
  invisible: new THREE.MeshBasicMaterial({ visible: false }),
  sombra: new THREE.MeshBasicMaterial({ map: TEX_SOMBRA, transparent: true, depthWrite: false, opacity: 0.75 }),
};

// Flores especiales: la de cada mes juntos, la de cada año y la de cada 100 días
function hito(i) {
  if (i <= 0) return '';
  const f = masDias(INICIO, i);
  if (f.getDate() === INICIO.getDate()) {
    const meses = (f.getFullYear() - INICIO.getFullYear()) * 12 + f.getMonth() - INICIO.getMonth();
    if (meses > 0 && meses % 12 === 0) return `¡${meses / 12} ${plural(meses / 12, 'año', 'años')} juntos! 🎉`;
    if (meses > 0) return `¡${meses} ${plural(meses, 'mes', 'meses')} juntos! 💜`;
  }
  if ((i + 1) % 100 === 0) return `¡${i + 1} días juntos! ✨`;
  return '';
}

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
  const especial = hito(i);
  if (especial) color.set('#f4e6ff'); // las flores especiales son casi blancas
  const matPetalo = conBrillo(color, BRILLO_FLOR, { roughness: 0.5, side: THREE.DoubleSide });

  const grupo = new THREE.Group();
  grupo.position.copy(posicionFlor(i));
  grupo.rotation.y = r() * Math.PI * 2;

  const [altoMin, altoVar, curvaMin, grosor] = TALLO[tipo];
  const nTallos = tipo === 'lavanda' ? 3 : 1;
  const tallos = [];
  for (let k = 0; k < nTallos; k++) {
    const alto = altoMin + r() * altoVar - k * 0.08;
    const ang = nTallos > 1 ? (k / nTallos) * Math.PI * 2 + r() * 0.8 : r() * Math.PI * 2;
    const curva = curvaMin + r() * 0.08;
    const dx = Math.cos(ang) * curva, dz = Math.sin(ang) * curva;
    const camino = tipo === 'campanilla'
      ? new THREE.CatmullRomCurve3([ // el tallo se arquea por arriba y las campanas cuelgan de él
        new V3(0, 0, 0), new V3(dx * 0.1, alto * 0.5, dz * 0.1), new V3(dx * 0.55, alto * 0.9, dz * 0.55), new V3(dx * 1.3, alto * 0.97, dz * 1.3),
      ])
      : new THREE.CatmullRomCurve3([new V3(0, 0, 0), new V3(dx * 0.25, alto * 0.5, dz * 0.25), new V3(dx, alto, dz)]);
    const tallo = new THREE.Mesh(
      new THREE.TubeGeometry(camino, tipo === 'campanilla' ? seg(12, 7) : seg(8, 5), grosor, Q.detalle < 1 ? 4 : 5),
      MAT.tallo
    );
    grupo.add(tallo);

    const punta = camino.getPoint(1);
    const cabeza = new THREE.Group();
    cabeza.quaternion.setFromUnitVectors(ARRIBA, camino.getTangent(1).normalize());
    if (tipo === 'margarita' || tipo === 'anemona') cabeza.rotateX((r() - 0.5) * 0.45);
    else if (tipo === 'pensamiento') cabeza.rotateX(0.7 + r() * 0.35); // mira de lado, no al cielo
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
    } else if (tipo === 'rosa') {
      // tres vueltas de pétalos: un capullo apretado dentro y cada vuelta más abierta
      anillo(GEO.rosa, 3, 0.12, 0.02, 0, 0.011, 0.75);
      anillo(GEO.rosa, 5, 0.15, () => -0.4 - r() * 0.08, 0.5, 0.027, 0.95);
      anillo(GEO.rosa, 6, 0.15, () => -0.8 - r() * 0.12, 1.1, 0.04, 1.12);
    } else if (tipo === 'lirio') {
      // tres pétalos que caen (con su mancha amarilla) y tres que se quedan de pie
      anillo(GEO.lirio, 3, 1.3, () => -0.5 - r() * 0.2, 0, 0.012);
      for (const p of petalos) {
        const marca = new THREE.Mesh(GEO.punto, MAT.centroDorado);
        marca.scale.set(1.5, 0.4, 0.75);
        marca.position.set(0.062, 0.011, 0);
        p.m.add(marca);
      }
      anillo(GEO.tulipan, 3, 0.04, -0.13, Math.PI / 3, 0.016, 0.82);
    } else if (tipo === 'pensamiento') {
      // cinco pétalos redondos: los dos de arriba más oscuros y el de abajo más grande
      const oscuro = conBrillo(color.clone().offsetHSL(0, 0.04, -0.14), BRILLO_FLOR, { roughness: 0.5, side: THREE.DoubleSide });
      for (let p = 0; p < 5; p++) {
        const eje = new THREE.Group();
        eje.rotation.y = -Math.PI / 2 + (p / 5) * Math.PI * 2 + (r() - 0.5) * 0.08;
        const alta = p === 2 || p === 3;
        const m = new THREE.Mesh(GEO.pensamiento, alta ? oscuro : matPetalo);
        m.scale.setScalar(p === 0 ? 1.15 : alta ? 1.02 : 0.9);
        eje.add(m);
        cabeza.add(eje);
        petalos.push({ m, cerrado: 1.3, abierto: 0.1 + r() * 0.1 });
      }
      const centro = new THREE.Mesh(GEO.punto, MAT.centroDorado);
      centro.scale.set(0.9, 0.5, 0.9);
      centro.position.y = 0.008;
      cabeza.add(centro);
    } else if (tipo === 'campanilla') {
      // campanas que cuelgan del arco del tallo, a un lado y a otro
      const n = 5;
      const qInv = cabeza.quaternion.clone().invert();
      const hacia = new V3(dx, 0, dz).normalize();
      const lateral = new V3(-hacia.z, 0, hacia.x);
      for (let j = 0; j < n; j++) {
        const m = new THREE.Mesh(GEO.campana, matPetalo);
        m.position.copy(camino.getPoint(0.52 + j * 0.115)).sub(punta).applyQuaternion(qInv);
        const cae = new V3(0, -1, 0).addScaledVector(hacia, 0.35).addScaledVector(lateral, j % 2 ? 0.4 : -0.4).normalize();
        m.quaternion.setFromUnitVectors(ABAJO, cae).premultiply(qInv);
        cabeza.add(m);
        petalos.push({ m, escala: j / n, base: 1 - j * 0.08 });
      }
    } else if (tipo === 'allium') {
      // una bola de florecitas en lo alto de un tallo largo
      const n = Q.detalle < 1 ? 22 : 30;
      const nucleo = new THREE.Mesh(GEO.punto, matPetalo);
      nucleo.scale.setScalar(2.7);
      nucleo.position.y = 0.085;
      cabeza.add(nucleo);
      for (let j = 0; j < n; j++) {
        const y = 1 - (2 * (j + 0.5)) / n, rad = Math.sqrt(1 - y * y), a = j * 2.39996;
        const m = new THREE.Mesh(GEO.flosculo, matPetalo);
        m.position.set(Math.cos(a) * rad * 0.088, 0.085 + y * 0.088, Math.sin(a) * rad * 0.088);
        cabeza.add(m);
        petalos.push({ m, escala: (1 - y) / 2, base: 1.45 });
      }
    } else if (tipo === 'jacinto') {
      // una espiga gorda y apretada
      const n = 20;
      const nucleo = new THREE.Mesh(GEO.punto, matPetalo);
      nucleo.scale.set(1.25, 5.4, 1.25);
      nucleo.position.y = 0.15;
      cabeza.add(nucleo);
      for (let j = 0; j < n; j++) {
        const a = j * 2.39996;
        const rr = 0.046 * (1 - Math.pow(j / n, 2) * 0.55);
        const m = new THREE.Mesh(GEO.flosculo, matPetalo);
        m.position.set(Math.cos(a) * rr, 0.015 + j * 0.0135, Math.sin(a) * rr);
        cabeza.add(m);
        petalos.push({ m, escala: j / n, base: 1.6 });
      }
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
    i, tipo, grupo, tallos, sombra, toque, color, hito: especial, g: 0, anim: null, fase: r() * 6.28,
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
      if (p.escala !== undefined) p.m.scale.setScalar((p.base || 1) * (0.35 + 0.65 * rebote(clamp01(ab * 1.6 - p.escala * 0.6))));
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
  const m = material({
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

/* ---------- Destello sobre las flores especiales ---------- */
const destellos = [];
for (const f of flores) {
  if (!f.hito || f.estado !== 'abierta' || f === brilloHoy?.f) continue;
  const d = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: TEX_HALO, color: '#ffe9ff', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.4 })
  );
  d.position.copy(f.punta);
  d.userData.fase = f.i * 1.7;
  escena.add(d);
  destellos.push(d);
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
  const mat = material({ color: '#c99bf0', emissive: '#7b3fb0', emissiveIntensity: 0.3, roughness: 0.6 });
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

/* ---------- Mariposas que revolotean entre las flores ---------- */
const mariposas = (() => {
  const n = MOVIMIENTO_REDUCIDO ? 0 : Q.mariposas;
  const r = azar(808);
  const ala = new THREE.Shape();
  ala.moveTo(0, 0);
  ala.bezierCurveTo(0.02, 0.075, 0.095, 0.085, 0.088, 0.022);
  ala.bezierCurveTo(0.084, -0.008, 0.052, -0.014, 0.034, -0.01);
  ala.bezierCurveTo(0.062, -0.03, 0.042, -0.064, 0.014, -0.046);
  ala.bezierCurveTo(0.004, -0.03, 0, -0.012, 0, 0);
  const geo = new THREE.ShapeGeometry(ala, 5).rotateX(Math.PI / 2); // tumbada: vuela hacia +z
  const tonos = ['#ecd6ff', '#ffc6e8', '#ffffff', '#cfa8ff', '#ffe9a8', '#b9d8ff'];
  const lista = [];
  for (let i = 0; i < n; i++) {
    const grupo = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: tonos[i % tonos.length], side: THREE.DoubleSide });
    const alas = [1, -1].map((lado) => {
      const m = new THREE.Mesh(geo, mat);
      m.scale.x = lado;
      grupo.add(m);
      return m;
    });
    const a = r() * Math.PI * 2, rr = Math.sqrt(r()) * RADIO * 0.6;
    escena.add(grupo);
    lista.push({
      grupo, alas, cx: Math.cos(a) * rr, cz: Math.sin(a) * rr, rx: 0.9 + r() * 1.5, rz: 0.9 + r() * 1.5,
      y: 0.95 + r() * 0.55, v: 0.22 + r() * 0.2, f: r() * 6.28, f2: r() * 6.28,
    });
  }
  const sitio = (m, t, o) => o.set(
    m.cx + Math.sin(t * m.v + m.f) * m.rx,
    m.y + Math.sin(t * m.v * 2.3 + m.f2) * 0.22 + Math.sin(t * 9 + m.f) * 0.012,
    m.cz + Math.sin(t * m.v * 1.31 + m.f2) * m.rz
  );
  const delante = new V3();
  return {
    actualizar(t) {
      for (const m of lista) {
        sitio(m, t, m.grupo.position);
        m.grupo.lookAt(sitio(m, t + 0.25, delante));
        const aleteo = 0.2 + (Math.sin(t * 17 + m.f) * 0.5 + 0.5) * 1.15;
        m.alas[0].rotation.z = aleteo;
        m.alas[1].rotation.z = -aleteo;
      }
    },
  };
})();

/* ---------- Estrellas fugaces ---------- */
const fugaz = (() => {
  if (MOVIMIENTO_REDUCIDO) return { actualizar() {} };
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 16;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 128, 0);
  gr.addColorStop(0, 'rgba(255,255,255,0)');
  gr.addColorStop(0.9, 'rgba(255,255,255,1)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  for (let k = 0; k < 7; k++) { // más intensa en el centro
    g.globalAlpha = 0.28;
    g.fillRect(0, k, 128, 16 - k * 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const malla = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: tex, color: '#fff4ff', transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, opacity: 0 })
  );
  malla.scale.set(24, 0.8, 1);
  malla.visible = false;
  malla.renderOrder = -5;
  escena.add(malla);
  const desde = new V3(), hacia = new V3(), lado = new V3(), eje = new V3(), base = new THREE.Matrix4();
  let t0 = 0, siguiente = 5 + Math.random() * 6;
  const DUR = 0.95;
  return {
    actualizar(t) {
      if (!malla.visible) {
        if (t < siguiente) return;
        const az = Math.random() * Math.PI * 2, el = 0.35 + Math.random() * 0.5;
        desde.set(Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el));
        lado.crossVectors(desde, ARRIBA).normalize().multiplyScalar(Math.random() < 0.5 ? 1 : -1);
        eje.crossVectors(desde, lado).normalize(); // hacia abajo o hacia arriba, sobre el cielo
        if (eje.y > 0) eje.negate();
        hacia.copy(lado).multiplyScalar(0.85).addScaledVector(eje, 0.3 + Math.random() * 0.35).normalize();
        eje.crossVectors(desde, hacia).normalize();
        base.makeBasis(hacia, eje, desde);
        malla.quaternion.setFromRotationMatrix(base);
        desde.multiplyScalar(150);
        t0 = t;
        malla.visible = true;
      }
      const p = (t - t0) / DUR;
      if (p >= 1) {
        malla.visible = false;
        siguiente = t + 7 + Math.random() * 13;
        return;
      }
      malla.position.copy(desde).addScaledVector(hacia, p * 70);
      malla.material.opacity = Math.sin(p * Math.PI) * 0.95;
    },
  };
})();

/* ═════════════════════ Chiikawa, Hachiware y Usagi ═════════════════════
   Están de pícnic en una manta al borde del jardín (ver personajes.js).
   Si los tocas, dan dos saltitos, dicen algo y la cámara se acerca. */

const amigos = crearPersonajes({
  geoSombra: GEO.sombra, matSombra: MAT.sombra, anchoCara: Q.caras,
  extras: VECINOS.map((v) => ({ tipo: v.tipo, x: v.x, z: v.z, giro: Math.PI / 2 - v.frente })),
});
amigos.grupo.position.set(SITIO.x, 0, SITIO.z);
amigos.grupo.rotation.y = Math.PI / 2 - SITIO.a; // mirando hacia fuera de la isla
escena.add(amigos.grupo, amigos.extras);
amigos.grupo.updateMatrixWorld(true);
amigos.extras.updateMatrixWorld(true);
for (const tex of amigos.texturas) renderer.initTexture(tex); // así no hay tirón la primera vez que cambian de cara
const toquesPersonajes = amigos.toques;
const FRENTE_AMIGOS = new V3(SITIO.ca, 0, SITIO.sa);
// Hacia dónde mira cada uno: desde ahí se le acerca la cámara
for (const p of amigos.lista) p.frente = p.extra ? new V3(Math.sin(p.giro), 0, Math.cos(p.giro)) : FRENTE_AMIGOS;

const burbuja = { el: $('burbuja'), de: -1, fin: 0, medio: 60, pos: new V3() };
function decir(k) {
  const p = amigos.lista[k];
  p.frase = ((p.frase ?? -1) + 1 + Math.floor(Math.random() * (p.frases.length - 1))) % p.frases.length;
  burbuja.el.textContent = p.frases[p.frase];
  burbuja.el.hidden = false;
  burbuja.medio = burbuja.el.offsetWidth / 2 + 8;
  burbuja.el.style.animation = 'none';
  void burbuja.el.offsetWidth;
  burbuja.el.style.animation = '';
  burbuja.de = k;
  burbuja.fin = performance.now() / 1000 + 2.4;
}
function moverBurbuja(t) {
  if (burbuja.de < 0) return;
  const p = amigos.lista[burbuja.de];
  p.raiz.getWorldPosition(burbuja.pos);
  burbuja.pos.y += p.cima + p.salto.position.y + 0.08;
  burbuja.pos.project(camara);
  if (t > burbuja.fin || burbuja.pos.z > 1) {
    burbuja.de = -1;
    burbuja.el.hidden = true;
    return;
  }
  const ancho = window.innerWidth;
  const x = Math.min(Math.max((burbuja.pos.x * 0.5 + 0.5) * ancho, burbuja.medio), ancho - burbuja.medio); // que no se salga de la pantalla
  const y = Math.max(70, (-burbuja.pos.y * 0.5 + 0.5) * window.innerHeight);
  burbuja.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
}

let enfoque = null; // personaje al que se ha acercado la cámara
function tocarPersonaje(k) {
  const p = amigos.lista[k];
  const t = performance.now() / 1000;
  if (amigos.saltar(k, t)) {
    chispas.lanzar(p.raiz.getWorldPosition(new V3()).add(new V3(0, p.cima * 0.75, 0)), 26, 0.8);
    vibrar(12);
    if (p.frases.length) { // los amigos sin grabación de voz no dicen nada
      decir(k);
      const dura = musica.voz(p.tipo, p.frases[p.frase]); // dice con su voz lo que pone en el bocadillo
      burbuja.fin = Math.max(burbuja.fin, t + dura + 0.4); // el bocadillo no se va antes de que acabe de hablar
    } else {
      musica.efecto('salto');
    }
  }
  if (tarjetaAbierta !== null) cerrarTarjeta(false);
  if (enfoque !== k) {
    enfoque = k;
    volarAPersonaje(p);
  }
  reanudarGiro = t + 8;
}

/* ═════════════════════ Cámara ═════════════════════ */

const vertical = () => camara.aspect < 1;
function ajustarCamara() {
  const w = window.innerWidth || 1, h = window.innerHeight || 1; // nunca 0: la cámara se rompería
  camara.aspect = w / h;
  camara.fov = vertical() ? 55 : 42;
  camara.updateProjectionMatrix();
  renderer.setSize(w, h, false);
  controles.maxDistance = RADIO * 3.2 + 8;
  controles.maxTargetRadius = RADIO + 1; // la vista no se puede ir lejos de la isla
}
ajustarCamara();

let reanudarGiro = 0;
let tocado = false; // ella ya ha movido la cámara
function vistaGeneral() {
  // Con pocas flores se ve la isla entera; en jardines muy grandes, la zona más florida.
  const rf = Math.min(RADIO + 0.4, Math.max(Math.min(RADIO, 3.6), ESPACIO * Math.sqrt(ABIERTAS + 1) + 1.3));
  const tan = Math.tan(THREE.MathUtils.degToRad(camara.fov / 2));
  const d = Math.max((rf * (vertical() ? 0.8 : 1.05)) / (tan * camara.aspect), (rf * 1.05) / tan, 4.2);
  // la isla abajo, el cielo arriba (con el móvil tumbado, menos cielo: que no la tapen los botones)
  const objetivo = new V3(0, 0.45 + rf * (window.innerHeight < 480 ? 0.06 : 0.28), 0);
  const dir = camara.position.clone().sub(controles.target).setY(0);
  if (!tocado || dir.lengthSq() < 1e-6) {
    // De entrada, el jardín se ve desde donde están Chiikawa y sus amigos (y el cartel a un lado)
    const az = SITIO.a + (vertical() ? 0.1 : 0.28);
    dir.set(Math.cos(az), 0, Math.sin(az));
  }
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
function volarAPersonaje(p) {
  const c = p.raiz.getWorldPosition(new V3());
  const dist = vertical() ? 3.3 : 2.7;
  const objetivo = c.clone().add(new V3(0, p.cima * 0.6, 0));
  const pos = objetivo.clone().addScaledVector(p.frente, dist * 0.96).add(new V3(0, dist * 0.2, 0));
  volar(objetivo, pos, 1.5);
}
function volverAGeneral(dur = 1.8, bajar = 0) {
  const v = vistaGeneral();
  volar(v.objetivo.clone().add(new V3(0, -bajar, 0)), v.pos, dur);
}

// Cómo es la vista general (para saber cuándo se ha alejado de ella)
const GENERAL = { obj: new V3(), d: 10 };
function medirGeneral() {
  const v = vistaGeneral();
  GENERAL.obj.copy(v.objetivo);
  GENERAL.d = v.pos.distanceTo(v.objetivo);
  return v;
}
{
  const v = medirGeneral();
  controles.target.copy(v.objetivo);
  camara.position.copy(v.pos);
  controles.update();
}

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

// Cuenta atrás hasta la próxima flor: brota cada día a las HORA_FLOR (hora de quien mira)
function cuentaAtrasFlor() {
  const c = $('hudProxima');
  if (DIA_N < 0) return; // el jardín aún no ha empezado
  const a = new Date();
  const brotada = diaJardin(a).getTime() !== HOY_REAL.getTime(); // ya ha dado la hora y sigue con el jardín abierto
  const proxima = new Date(a.getFullYear(), a.getMonth(), a.getDate() + (a.getHours() >= HORA_FLOR ? 1 : 0), HORA_FLOR);
  const s = Math.max(0, Math.ceil((proxima - a) / 1000));
  const dos = (n) => String(n).padStart(2, '0');
  const falta = `${dos(Math.floor(s / 3600))}:${dos(Math.floor(s / 60) % 60)}:${dos(s % 60)}`;
  c.hidden = false;
  c.classList.toggle('brotada', brotada);
  if (brotada) c.textContent = '🌸 ¡Ha brotado una flor nueva! Toca aquí';
  else c.innerHTML = `🌱 Nueva flor en <strong>${falta}</strong>`;
  const intro = $('introFalta');
  if (intro) intro.textContent = brotada ? '00:00:00' : falta;
}

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
    texto = 'Ya has visto todas las flores 🌱';
  }
  // El día que se cumple el mes, avisa de quién acaba de llegar
  const recien = HOY.getDate() === INICIO.getDate() ? VECINOS.find((v) => v.mes === MESES) : null;
  if (recien && DIA_N >= 1) {
    const nombre = amigos.lista.find((p) => p.tipo === recien.tipo)?.nombre;
    if (nombre) texto += ` ¡Y hoy ha llegado ${nombre} al jardín!`;
  }
  $('introTexto').textContent = texto;
  if (DIA_N >= 1 && !PRIMERA && !NUEVAS.length) { // ya vio la de hoy: cuánto falta para la siguiente
    const falta = document.createElement('strong');
    falta.id = 'introFalta';
    $('introTexto').append(' Faltan ', falta, ' para la siguiente.');
  }
  cuentaAtrasFlor();
  setInterval(cuentaAtrasFlor, 1000);
  $('hudProxima').addEventListener('click', () => location.reload());

  // Contador de la esquina
  const dias = Math.max(0, DIA_N);
  $('hudDias').textContent = dias;
  $('hudDiasTxt').textContent = plural(dias, 'día juntos', 'días juntos');
  $('hudFlores').textContent = ABIERTAS;
  $('hudFloresTxt').textContent = plural(ABIERTAS, 'flor', 'flores');

  // Días desde el primer beso (cambia a la misma hora que la flor)
  if (BESO) {
    const n = diasEntre(BESO, HOY);
    if (n >= 0) {
      const c = $('hudBeso');
      const num = document.createElement('strong');
      num.textContent = n;
      c.append('💋 ', num, ` ${plural(n, 'día', 'días')} desde nuestro primer beso`);
      c.hidden = false;
    }
  }

  if (REENCUENTRO) {
    const f = diasEntre(MODO_VISTA ? HOY : HOY_CALENDARIO, REENCUENTRO);
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
  $('pista').textContent = DIA_N < 1
    ? 'Toca la semilla · arrastra para girar'
    : TACTIL
      ? 'Toca una flor o a Chiikawa · un dedo gira · dos dedos mueven y acercan'
      : 'Toca una flor o a Chiikawa · arrastra para girar · rueda para acercarte';
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
  enfoque = null;
  const fecha = masDias(INICIO, i);
  ui.firma.hidden = true;
  ui.etiqueta.textContent = `Flor nº ${i + 1} · ${fmtFecha.format(fecha)}${i === IDX_HOY ? ' · hoy' : ''}`;
  if (flor.estado === 'brote') {
    const dif = diasEntre(HOY, fecha);
    const cuando = new Date().getHours() < HORA_FLOR ? 'hoy' : 'mañana';
    ui.texto.textContent = dif <= 1 ? `Esta flor brota ${HORA_FLOR ? `${cuando} a las ${HORA_FLOR}:00` : 'a medianoche'}. Vuelve a verla 🌱` : `Esta flor brota dentro de ${dif} días 🌱`;
    ui.foto.hidden = true;
    ui.nav.hidden = true;
  } else {
    const msj = MENSAJES.get(i);
    ui.texto.textContent = msj?.texto || flor.hito
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
  enfoque = null;
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

function cerrarTarjeta(volver = true) {
  if (tarjetaAbierta === null) return;
  tarjetaAbierta = null;
  ui.tarjeta.hidden = true;
  ui.acciones.classList.remove('oculto');
  if (!volver) return;
  volverAGeneral();
  reanudarGiro = performance.now() / 1000 + 2.5;
}

$('btnCerrar').addEventListener('click', () => cerrarTarjeta());
ui.ant.addEventListener('click', () => typeof tarjetaAbierta === 'number' && abrirTarjeta(tarjetaAbierta - 1));
ui.sig.addEventListener('click', () => typeof tarjetaAbierta === 'number' && abrirTarjeta(tarjetaAbierta + 1));
$('btnHoy').addEventListener('click', () => IDX_HOY >= 0 && abrirTarjeta(IDX_HOY));
$('btnCarta').addEventListener('click', abrirCarta);
$('btnVista').addEventListener('click', () => {
  enfoque = null;
  if (tarjetaAbierta !== null) cerrarTarjeta(false);
  volverAGeneral();
  reanudarGiro = performance.now() / 1000 + 2.5;
});
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
lienzo.addEventListener('pointerdown', (e) => { pulsado = e.isPrimary === false ? null : { x: e.clientX, y: e.clientY, t: performance.now() }; });
lienzo.addEventListener('pointercancel', () => { pulsado = null; });
lienzo.addEventListener('pointerup', (e) => {
  if (!pulsado || !entrado) return;
  const mov = Math.hypot(e.clientX - pulsado.x, e.clientY - pulsado.y);
  const dur = performance.now() - pulsado.t;
  pulsado = null;
  if (mov > (e.pointerType === 'touch' ? 14 : 8) || dur > 600) return;
  const rect = lienzo.getBoundingClientRect();
  puntero.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
  rayo.setFromCamera(puntero, camara);
  const hit = rayo.intersectObjects([...toquesPersonajes, ...toques], false)[0];
  if (hit && hit.object.userData.personaje !== undefined) tocarPersonaje(hit.object.userData.personaje);
  else if (hit) { vibrar(8); abrirTarjeta(hit.object.userData.indice); }
  else if (tarjetaAbierta !== null) cerrarTarjeta();
  else if (enfoque !== null) {
    // tocar fuera: vuelve a verse el jardín entero
    enfoque = null;
    volverAGeneral();
    reanudarGiro = performance.now() / 1000 + 2.5;
  }
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

  // Música: empieza con este toque (los navegadores no dejan sonar sin uno)
  let sinMusica = false;
  try { sinMusica = localStorage.getItem(CLAVE_MUSICA) === 'no'; } catch {}
  musica.silenciar(sinMusica);
  musica.iniciar();
  pintarBotonMusica();
  $('btnMusica').hidden = false;
  $('btnVista').hidden = false; // el botón de la isla se queda siempre a la vista

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

const CLAVE_MUSICA = 'jardin-morado:musica';
function pintarBotonMusica() {
  const b = $('btnMusica');
  b.textContent = musica.silenciada ? '🔇' : '🎵';
  b.setAttribute('aria-label', musica.silenciada ? 'Activar la música' : 'Silenciar la música');
  b.classList.toggle('apagado', musica.silenciada);
}
$('btnMusica').addEventListener('click', () => {
  musica.silenciar(!musica.silenciada);
  musica.iniciar();
  try { localStorage.setItem(CLAVE_MUSICA, musica.silenciada ? 'no' : 'si'); } catch {}
  pintarBotonMusica();
});

/* ═════════════════════ Bucle principal ═════════════════════ */

const reloj = new THREE.Clock();
const ayuda = new THREE.Object3D();
const estrellas = escena.getObjectByName('estrellas');
const dinamicas = flores.filter((f) => f.dinamica);
let primerCuadro = true;

// Si el jardín va lento, baja la resolución (y luego la hierba) hasta que vaya fluido.
const ritmo = { n: 0, suma: 0, desde: performance.now() / 1000 + 4, previo: 0, ratioPrevio: 0, fin: false };
function vigilarRitmo(dtReal, t) {
  if (ritmo.fin || t < ritmo.desde || dtReal > 0.25) return;
  ritmo.n++;
  ritmo.suma += dtReal;
  if (ritmo.n < 80) return;
  const medio = ritmo.suma / ritmo.n;
  ritmo.n = ritmo.suma = 0;
  if (ritmo.previo && medio > ritmo.previo * 0.93) {
    // Bajar la resolución no ha servido: el límite es otro (p. ej. el modo ahorro de batería). Se deja como estaba.
    ratio = ritmo.ratioPrevio;
    renderer.setPixelRatio(ratio);
    ritmo.fin = true;
    return;
  }
  ritmo.previo = 0;
  if (medio < 1 / 42) return; // va bien
  if (ratio > Q.dprMin + 0.01) {
    ritmo.previo = medio;
    ritmo.ratioPrevio = ratio;
    ratio = Math.max(Q.dprMin, ratio - 0.25);
    renderer.setPixelRatio(ratio);
  } else if (pasto.count > 2500) {
    pasto.count = Math.floor(pasto.count * 0.6);
  } else ritmo.fin = true;
  ritmo.desde = t + 1;
}

function bucle() {
  const dtReal = reloj.getDelta();
  const dt = Math.min(dtReal, 0.05);
  const t = performance.now() / 1000;
  uTiempo.value = t;
  vigilarRitmo(dtReal, t);

  // Flores que crecen (las demás se mecen en la tarjeta gráfica)
  for (const f of dinamicas) {
    if (f.anim) {
      const p = clamp01((t - f.anim.t0) / f.anim.dur);
      if (t >= f.anim.t0) crecer(f, lerp(f.anim.desde, f.anim.hasta, p));
      if (p >= 1) {
        const a = f.anim;
        f.anim = null;
        if (a.hasta === 1) chispas.lanzar(f.punta);
        if (a.ultima) { musica.efecto('flor'); alTerminarDeCrecer(f); }
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

  amigos.actualizar(t, dt, camara);
  mariposas.actualizar(t);
  fugaz.actualizar(t);
  for (const d of destellos) d.scale.setScalar(0.5 + Math.sin(t * 1.8 + d.userData.fase) * 0.09);
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
  {
    // La cámara puede bajar hasta ras de hierba, pero no meterse bajo tierra
    const tg = controles.target;
    tg.y = Math.min(Math.max(tg.y, 0.15), GENERAL.obj.y + 1.2);
    const d = camara.position.distanceTo(tg);
    controles.maxPolarAngle = Math.min(1.75, Math.acos(THREE.MathUtils.clamp((0.3 - tg.y) / d, -1, 1)));
  }
  controles.update();

  renderer.render(escena, camara);
  moverBurbuja(t);

  if (primerCuadro) {
    primerCuadro = false;
    window.jardinListo = performance.now() || 1;
    const b = $('btnEntrar');
    b.disabled = false;
    b.textContent = DIA_N < 1 ? 'Ver la semilla 🌱' : 'Entrar al jardín';
  }
  requestAnimationFrame(bucle);
}

window.addEventListener('resize', () => { ajustarCamara(); medirGeneral(); });
requestAnimationFrame(bucle);
if (params.has('debug')) window.jardin = { THREE, renderer, escena, flores, camara, controles, amigos, musica, calidad: () => ({ NIVEL, ratio }), tocarPersonaje, SITIO };
