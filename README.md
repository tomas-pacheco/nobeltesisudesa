# Nobel & Thesis — UdeSA Economics

Una página web estática para explorar menciones de apellidos de premios Nobel de Economía en tesis de siete colecciones del repositorio de la Universidad de San Andrés.

**El proyecto se entrega sin datos reales:** los archivos `data/*.json` están inicialmente vacíos. No mostramos números inventados. Se rellenan con `build_data.py` a partir de los CSV que ya generaste con el contador de apellidos.

## 1. Qué incluye

| Archivo | Para qué sirve |
| --- | --- |
| `index.html` | Página principal y estructura de las visualizaciones |
| `style.css` | Estilos responsive |
| `app.js` | Filtros, gráficos, buscador y tabla de tesis |
| `build_data.py` | Convierte tus CSV de Python a JSON para la web |
| `requirements.txt` | Dependencia de Python (`pandas`) |
| `data/tesis.json` | Títulos, autores, años, colecciones y URLs |
| `data/nobeles.json` | Nombre, apellido y año de Nobel |
| `data/menciones.json` | Menciones por par tesis–laureado |
| `data/metadata.json` | Fecha de actualización y cobertura |
| `.nojekyll` | Publicar los archivos tal cual en GitHub Pages |

Los gráficos usan Plotly.js desde un CDN, de modo que la página necesita internet para visualizar las figuras. La web no descarga PDFs ni ejecuta Python en GitHub.

## 2. Cómo generar tus datos por primera vez

**Requisitos:** tener los tres CSV creados con `udesa_contador_nobeles.py` en tu carpeta principal `tesis_udesa_economia`:

- `attributes_nobeles.csv`
- `catalogo_nobeles.csv`
- `menciones_nobeles.csv`

No necesitás copiar los PDFs ni los TXT a la web. Solo necesitás esos tres CSV para exportar.

**Terminal (Mac):**

```bash
cd "/ruta/a/udesa-nobel-dashboard"
python -m pip install -r requirements.txt
python build_data.py --main "/Users/tu_usuario/Documents/tesis_udesa_economia"
```

Reemplazá la ruta por **tu carpeta real**, aquella donde están los tres CSV. El script escribirá automáticamente los JSON dentro de `data/`.

**Si usás Spyder:** editá la variable `MAIN` al principio de `build_data.py`, por ejemplo:

```python
MAIN = Path("/Users/tu_usuario/Documents/tesis_udesa_economia")
```

Después ejecutá el archivo desde Spyder. No necesita parámetros.

El programa muestra cuántas tesis tienen texto legible y cuántas no tienen año de publicación identificable. Nunca inventa años usando el año en que el PDF fue subido al repositorio.

## 3. Cómo abrir la página localmente

Debido a las restricciones de los navegadores al leer JSON desde `file://`, **no basta con abrir `index.html` con doble clic**.

En Terminal, dentro de la carpeta `udesa-nobel-dashboard`, ejecutá:

```bash
python -m http.server 8000
```

Después abrí en el navegador: http://localhost:8000

Para terminar el servidor, `Ctrl+C` en la Terminal.

## 4. Publicar gratuitamente con GitHub Pages

1. Creá en GitHub un repositorio público, por ejemplo `udesa-nobel-theses`.
2. Subí a la raíz del repositorio **el contenido** de esta carpeta: `index.html`, `style.css`, `app.js`, `data/`, `.nojekyll`, etc. No subas la carpeta `tesis_udesa_economia` de tus PDFs o TXT.
3. En GitHub, entrá a **Settings → Pages**.
4. En **Build and deployment**, elegí **Deploy from a branch**.
5. Seleccioná `main` y `/(root)`, y guardá.
6. La web estará en una dirección parecida a `https://TU_USUARIO.github.io/udesa-nobel-theses/`.

Documentación oficial: https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site

## 5. Actualización anual

Cuando haya tesis nuevas o premiados nuevos:

1. Ejecutá el scraper para descargar solo PDFs que faltan.
2. Ejecutá el conversor PDF → TXT / OCR para los documentos nuevos.
3. Actualizá el catálogo de Nobel y ejecutá **nuevamente** `udesa_contador_nobeles.py` sobre **todos** los TXT. Importante: un premiado nuevo pudo haber sido mencionado en tesis de años anteriores.
4. Ejecutá `build_data.py` apuntando a la carpeta `tesis_udesa_economia`.
5. En GitHub, actualizá únicamente `data/tesis.json`, `data/nobeles.json`, `data/menciones.json` y `data/metadata.json`.

La página web **no necesita cambios** para incorporar nuevos años o laureados: lee los JSON que acabás de exportar.

## 6. Interpretación y limitaciones

- Se buscan **apellidos como palabras completas**, sin distinguir mayúsculas ni acentos. No se identifican citas bibliográficas con certeza.
- `Hall`, `Card`, `Smith`, etc. pueden aparecer como palabras comunes. Peter Diamond y Douglas Diamond comparten el mismo conteo del apellido.
- **Tesis que mencionan a un Nobel** = tesis con texto extraíble en cuyo TXT aparece al menos una vez algún apellido del catálogo.
- Los porcentajes anuales se calculan **entre las tesis con texto extraíble**; las tesis sin TXT no se consideran ceros.
- El **año de la tesis** proviene preferentemente de `dc.date.issued`, no del año de incorporación al repositorio.
- Una tesis puede aparecer en más de una colección; cada par `(colección, UUID)` se trata como registro independiente.
- En rankings por laureado, compartir un apellido puede dar contadores repetidos; el KPI general de tesis con algún apellido evita ese doble conteo.
- Si una tesis no tiene año de publicación conocido, puede aparecer en la tabla del laureado cuando el filtro de año es «All years», pero no en el gráfico anual.

## 7. Resolución de problemas

**“No hay datos reales publicados todavía”:** generá `data/*.json` con `build_data.py`. Los archivos incluidos inicialmente son intencionalmente vacíos.

**“No se pudo cargar el JSON”:** asegurate de abrir la página mediante `python -m http.server 8000` o GitHub Pages, no con `file://`.

**Años faltantes:** revisá en tu CSV el campo `dc.date.issued` u otra columna de publicación. El exportador avisa si faltan años.

**No aparecen gráficos:** revisá que tengas conexión a internet, porque Plotly se carga desde un CDN. El resto de la página puede verse sin ese recurso.

**Rutas relativas:** evitá introducir una barra `/` antes de `data/`, para que funcione la página en un repositorio GitHub Pages con subruta.
