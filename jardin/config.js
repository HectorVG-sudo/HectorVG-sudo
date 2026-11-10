// ─────────────────────────────────────────────────────────────
//  💜  EL JARDÍN DE FLORES MORADAS — edita solo este archivo  💜
// ─────────────────────────────────────────────────────────────
//
//  El jardín tiene una flor por cada día que lleváis juntos, desde
//  "inicio". Cada día brota una nueva, para siempre.
//
//  Reglas para no romper nada:
//   · Los textos van entre comillas "..." y cada línea termina con una coma.
//   · Si quieres comillas dentro del texto, usa ‘ ’ o « ».
//   · Para un salto de línea dentro de un texto, escribe \n
//
//  Para probarlo sin esperar:
//   · .../jardin/?dia=50            → cómo se verá el día 50 juntos
//   · .../jardin/?dia=50&primera    → lo mismo, como si fuera su primera vez
//   · .../jardin/?reiniciar         → olvida la visita (vuelve a salir la carta)
// ─────────────────────────────────────────────────────────────

export default {
  // Cómo le dices. Sale en la portada ("Para …") y en el cartel del jardín.
  para: "Laura",

  // Tu firma (sale al final de la carta).
  de: "Héctor",

  // El día que empezasteis (año-mes-día). Ese día brotó la primera flor.
  inicio: "2026-09-25",

  // El día de vuestro primer beso (año-mes-día). Sale un contador de días
  // desde entonces. Déjalo en "" para ocultarlo.
  primerBeso: "2026-08-10",

  // Hora a la que brota la flor de cada día y cambian los contadores
  // (de 0 a 23; 0 = medianoche, 17 = las 5 de la tarde).
  horaFlor: 0,

  // Día en que os volvéis a ver (año-mes-día). Activa una cuenta atrás.
  // Déjalo en "" si aún no hay fecha.
  reencuentro: "",

  // Opcional: link a vuestra canción (Spotify, YouTube…). "" para ocultarlo.
  cancion: "",

  // La carta que le sale SOLO la primera vez que entra.
  // (Luego la puede releer con el botón «💌 Tu carta»).
  bienvenida:
    "Hola princesita 💜\nEs el día de las flores moradas, así que te he hecho esto.\n\nEste es nuestro jardín: tiene una flor por cada día que llevamos juntos. Cada día va a nacer una nueva, para que aunque estemos lejos nunca te falten flores mías.",

  // Amigos de Chiikawa que van llegando al jardín: a los cuántos meses
  // juntos llega cada uno (ese día la isla da un estirón y le hace sitio).
  // Pon 0 para que uno no venga.
  amigos: {
    momonga: 2,
    kurimanju: 3,
    rakko: 4,
    shisa: 5,
  },

  // Opcional: mensajes escondidos en las flores de días concretos.
  // Ella los encuentra al tocar la flor de ese día. Las demás flores
  // muestran qué día juntos representan.
  // Para poner una foto: "2026-10-12": { texto: "…", foto: "fotos/foto.jpg" },
  mensajes: {
    "2026-09-25": "El día que empezó todo 💜",
  },
};
