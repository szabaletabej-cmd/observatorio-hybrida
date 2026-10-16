# Observatorio HIBRIDA · Tablero departamental

Tablero web del Observatorio HIBRIDA de Datos Educativos. Cruza bases oficiales (SNIES, Icfes, MinTIC) por departamento y año, organizadas según la tríada **redistribución, reconocimiento y representación**.

Secciones: Panorama · Redistribución · Reconocimiento · Representación · Cruces · Metodología.

> Los datos incluidos ahora son **de demostración**. Se reemplazan con los reales al correr el notebook (ver abajo).

## Cómo funciona

```
Drive (bases oficiales)  →  notebook en Colab  →  tablero_datos.json  →  este repositorio  →  Cloudflare Pages
```

- Las bases pesadas **se quedan en Drive**. Al repositorio solo llega el resumen por departamento y año.
- El tablero lee `public/data/tablero_datos.json` al abrir la página. Para actualizar cifras no hay que tocar código.

## Actualizar los datos

1. Abre `notebooks/Observatorio_HIBRIDA_panel_departamental.ipynb` en Colab y ejecútalo.
2. Descarga `tablero_datos.json` de la carpeta `_procesado/` en Drive.
3. En GitHub, entra a `public/data/`, elige **Add file → Upload files**, sube el archivo (reemplaza el anterior) y confirma.
4. Cloudflare publica la nueva versión sola en uno o dos minutos.

El aviso de "datos de demostración" desaparece solo cuando el archivo viene del notebook.

## Publicar en Cloudflare Pages (una sola vez)

1. En Cloudflare: **Workers & Pages → Create → Pages → Connect to Git** y elige este repositorio.
2. Configuración de build:
   - Framework preset: `Vite` (o ninguno)
   - Build command: `npm run build`
   - Build output directory: `dist`
3. **Save and Deploy**. Queda en una dirección `*.pages.dev`; después se puede asignar un dominio propio (por ejemplo `observatorio.hibrida.org`) en **Custom domains**.

Cada cambio que se suba al repositorio se publica automáticamente.

## Sumar un indicador

1. En el notebook: una función de carga para la fuente nueva, o una línea en la sección 10 si se calcula con lo que ya existe, más su ficha en `CATALOGO` (nombre, dimensión de la tríada, unidad, fuente, definición).
2. Volver a correr el notebook y subir el nuevo `tablero_datos.json`.

El tablero toma los indicadores del catálogo: aparecen solos en la pestaña de su dimensión, en Cruces y en Metodología.

## Trabajar en local (opcional)

```bash
npm install
npm run dev      # vista previa en http://localhost:5173
npm run build    # genera dist/
```

## Estructura

```
public/data/tablero_datos.json   datos del tablero (sale del notebook)
public/data/departamentos.json   límites departamentales (DANE, MGN 2018, simplificados)
src/main.js                      vistas y navegación
src/graficos.js                  mapa, ranking, evolución, desagregación, dispersión, correlaciones
src/datos.js                     carga, índices y agregado nacional
src/estilos.css                  estilos (modo claro y oscuro)
notebooks/                       procesamiento reproducible en Colab
```

## Ciencia abierta

Para obtener un DOI por versión: conectar el repositorio en [Zenodo](https://zenodo.org) (GitHub → activar el repositorio) y crear un *release* en GitHub. Cada release queda depositado y citable.

## Fuentes

- Ministerio de Educación Nacional, SNIES.
- Icfes, DataIcfes (Saber 11 y Saber TyT).
- MinTIC, Colombia TIC (internet fijo).
- DANE, Marco Geoestadístico Nacional 2018.
