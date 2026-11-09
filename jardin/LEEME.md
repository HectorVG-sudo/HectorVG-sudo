# 💜 Nuestro jardín de flores moradas

Un jardín en 3D con una flor por cada día juntos. Cada día brota una nueva.

- **La primera vez que entra** ve crecer la flor de hoy y le sale la carta de bienvenida. Después puede releerla con el botón «💌 Tu carta».
- **Los demás días** solo ve crecer la flor nueva, sin mensajes.
- **En la esquina** hay un contador de días juntos y de flores.
- Al tocar una flor, sale qué día juntos representa, o un mensaje escondido si le has puesto uno.

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
