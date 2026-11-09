// ─────────────────────────────────────────────────────────────
//  💜  EL JARDÍN DE FLORES MORADAS — edita solo este archivo  💜
// ─────────────────────────────────────────────────────────────
//
//  Cada mensaje de "flores" es una flor. La primera brota el día
//  de "inicio", la segunda al día siguiente, y así hasta la última.
//
//  Reglas para no romper nada:
//   · Cada mensaje va entre comillas "..." y termina con una coma.
//   · Si quieres comillas dentro del texto, usa ‘ ’ o « ».
//   · Para un salto de línea dentro de un mensaje, escribe \n
//   · Para añadir una foto a una flor, súbela a la carpeta jardin/fotos/
//     y escribe la flor así:
//        { texto: "Nuestra primera videollamada", foto: "fotos/llamada.jpg" },
//
//  Para ver cómo se verá un día concreto sin esperar, abre la página
//  con ?dia=5 al final del link (por ejemplo .../jardin/?dia=5).
// ─────────────────────────────────────────────────────────────

export default {
  // Cómo se llama ella (o cómo le dices). Sale en la portada y en el cartel.
  para: "Mi amor",

  // Tu firma.
  de: "Héctor",

  // Día en que brota la PRIMERA flor (año-mes-día).
  inicio: "2026-11-09",

  // Día en que os volvéis a ver (año-mes-día). Déjalo en "" si aún no hay fecha.
  reencuentro: "",

  // Opcional: link a vuestra canción (Spotify, YouTube…). "" para ocultarlo.
  cancion: "",

  // Se muestra cuando ya han brotado todas las flores.
  mensajeFinal:
    "Nuestro jardín ya está completo, pero lo que siento por ti sigue creciendo.\nGracias por regarlo conmigo cada día, aunque estemos lejos.\n\nTe quiero muchísimo. 💜",

  // ✏️ EJEMPLOS: cámbialos por recuerdos, chistes internos y cosas vuestras.
  // Cuantos más pongas, más días crece el jardín.
  flores: [
    "Hoy brotó la primera flor de nuestro jardín. Cada día va a nacer una nueva, para que aunque estemos lejos nunca te falten flores mías. 💜",
    "Esta es por tu risa. Es mi sonido favorito del mundo, incluso cuando llega con retraso por la videollamada.",
    "Esta es por todas las noches que nos quedamos hablando aunque al día siguiente tocara madrugar.",
    "Una flor por cada vez que me haces sentir en casa, aunque haya kilómetros entre nosotros.",
    "Esta es para tus días malos: vuelve aquí y acuérdate de que hay alguien lejos que piensa en ti todo el rato.",
    "Esta es por lo valiente que eres. Te admiro más de lo que te digo.",
    "Dicen que las flores moradas significan admiración. Ya sabes por qué te regalo un jardín entero.",
    "Esta es por la primera vez que hablamos. No tenía ni idea de lo mucho que me ibas a cambiar la vida.",
    "La distancia solo es el tiempo que falta para el siguiente abrazo.",
    "Esta es por tus mensajes de buenos días. Hacen que cualquier mañana merezca la pena.",
    "Una flor por todo lo que vamos a hacer juntos cuando por fin estemos en el mismo sitio.",
    "Esta es porque sí. Porque te quiero y punto.",
    "Si pudiera, te llevaría este jardín en persona. De momento te lo dejo aquí, para que lo riegues cuando me eches de menos.",
    "Gracias por esperarme, por elegirme y por quedarte. Te quiero muchísimo.",
  ],
};
