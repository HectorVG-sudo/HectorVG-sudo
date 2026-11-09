# 💜 Nuestro jardín de flores moradas

Un jardín en 3D con una flor por cada día juntos. Cada día brota una nueva.

- **La primera vez que entra** ve crecer la flor de hoy y le sale la carta de bienvenida. Después puede releerla con el botón «💌 Tu carta».
- **Los demás días** solo ve crecer la flor nueva, sin mensajes.
- **En la esquina** hay un contador de días juntos y de flores.
- Al tocar una flor, sale qué día juntos representa, o un mensaje escondido si le has puesto uno.
- **Chiikawa, Hachiware y Usagi** están de pícnic en una manta al borde del jardín. Respiran, parpadean, mueven las orejas y la cola, y te siguen con la mirada. Si los tocas, la cámara se acerca, dan dos saltitos con cara de felicidad y dicen algo. Tocando fuera se vuelve a ver el jardín entero. Están modelados a mano en `personajes.js` (sin archivos 3D).
- **Flores especiales**: la flor de cada mes juntos, la de cada año y la de cada 100 días sale casi blanca, con un destello, y al tocarla lo dice («¡2 meses juntos! 💜»). Si ese día tiene un mensaje tuyo en `config.js`, sale tu mensaje.
- **Diez tipos de flor morada**: margarita, anémona, tulipán, lavanda, campanilla, pensamiento, lirio, allium (bola de florecitas), rosa y jacinto. Cada día tiene siempre la misma.
- **Cámara**: un dedo (o arrastrar) gira y sube o baja la vista, hasta ras de hierba; dos dedos (o botón derecho) la mueven; pellizcar (o la rueda) acerca hacia donde apuntas. El botón 🏝️ de arriba vuelve a ver todo el jardín.
- **Mariposas** entre las flores y **estrellas fugaces** de vez en cuando.
- **Música lo-fi tranquila** generada en el propio navegador (`musica.js`), sin archivos de audio. Al tocar a los personajes hablan con grabaciones de la carpeta `voces/`; cada frase del bocadillo va atada a su archivo en la lista `CLIPS` de `musica.js`. Empieza al pulsar «Entrar al jardín» y se puede silenciar con el botón 🎵 de arriba a la derecha. El jardín recuerda la elección.

## Personalizarlo

Edita **solo `config.js`**:

| Campo | Qué es |
|---|---|
| `para` | Cómo le dices. Sale en la portada y en el cartel. |
| `de` | Tu firma al final de la carta. |
| `inicio` | El día que empezasteis (`"AAAA-MM-DD"`). Ese día brotó la flor nº 1. |
| `bienvenida` | La carta que sale solo la primera vez. |
| `mensajes` | Mensajes escondidos en las flores de días concretos (opcional). |
| `reencuentro` | El día en que os veis. Activa una cuenta atrás. Déjalo en `""` si no hay fecha. |
| `cancion` | Un link opcional a vuestra canción. |

Para poner una foto en una flor, súbela a `jardin/fotos/` y escribe:
`"2026-10-12": { texto: "Nuestra primera videollamada", foto: "fotos/llamada.jpg" },`

## En el móvil

Está pensado para abrirse en el móvil: se gira con un dedo, se acerca pellizcando y todo se toca con el dedo. Para que vaya fluido:

- En el móvil se dibuja con menos detalle (menos hierba, flores más sencillas, sin desenfoques).
- Si aun así va lento, el jardín **baja solo la resolución** a los pocos segundos hasta que va fluido.
- Cuantas más flores haya, más sencilla se dibuja cada una en el móvil, para que siga yendo bien dentro de años.
- Se puede forzar con `?calidad=alta`, `?calidad=media` o `?calidad=baja` al final del link.

## Probarlo sin esperar

- `.../jardin/?dia=50` muestra cómo se verá el día 50 juntos y no guarda nada.
- `.../jardin/?dia=50&primera` muestra el día 50 como si fuera su primera vez, con la carta.
- `.../jardin/?reiniciar` olvida tu visita en ese navegador, así que vuelve a salir la carta.

## Publicarlo gratis (GitHub Pages)

1. Ve al repo en GitHub → **Settings** → **Pages**.
2. En *Source* elige **Deploy from a branch**, la rama donde esté este código y la carpeta **/ (root)**. Pulsa **Save**.
3. Espera 1 o 2 minutos. El jardín estará en:
   `https://hectorvg-sudo.github.io/HectorVG-sudo/jardin/`

> ⚠️ Pruébalo con `?dia=` antes de mandárselo. Si abres el link normal en tu móvil, tu navegador recordará que ya entraste. En su móvil le saldrá la carta igualmente, porque cada navegador recuerda sus propias visitas.

---
Hecho con [three.js](https://threejs.org) (licencia MIT, incluida en `lib/`).
