# 💜 Nuestro jardín de flores moradas

Un jardín en 3D que crece una flor cada día. Cada flor guarda un mensaje y se abre al tocarla.

## Personalizarlo

Edita **solo `config.js`**:

- `para`: su nombre o cómo le dices (sale en la portada y en el cartel del jardín).
- `de`: tu firma.
- `inicio`: el día en que brota la primera flor (`"AAAA-MM-DD"`).
- `reencuentro`: el día en que os veis. Activa la cuenta atrás. Déjalo en `""` si aún no hay fecha.
- `cancion`: un link opcional a vuestra canción.
- `flores`: un mensaje por flor y día. Cuantos más pongas, más días crece.
- `mensajeFinal`: aparece cuando ya han brotado todas.

¿Quieres poner fotos? Súbelas a `jardin/fotos/` y escribe la flor así:
`{ texto: "Nuestra primera videollamada", foto: "fotos/llamada.jpg" }`

## Vista previa

- `.../jardin/?dia=7` muestra cómo se verá el día 7 y no guarda nada.
- `.../jardin/?reiniciar` vuelve a hacer crecer las flores como si fuera la primera visita.

## Publicarlo gratis (GitHub Pages)

1. Ve al repo en GitHub → **Settings** → **Pages**.
2. En *Source* elige **Deploy from a branch**, la rama donde esté este código y la carpeta **/ (root)**. Pulsa **Save**.
3. Espera 1 o 2 minutos. El jardín estará en:
   `https://hectorvg-sudo.github.io/HectorVG-sudo/jardin/`

Funciona en el móvil sin instalar nada. Cada vez que cambies `config.js`, la web se actualiza sola en uno o dos minutos.

---
Hecho con [three.js](https://threejs.org) (licencia MIT, incluida en `lib/`).
