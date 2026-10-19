# Observatorio HYBRIDA · Tablero departamental

[![Publicar tablero](https://github.com/szabaletabej-cmd/observatorio-hybrida/actions/workflows/publicar.yml/badge.svg)](https://github.com/szabaletabej-cmd/observatorio-hybrida/actions/workflows/publicar.yml)

En línea: https://observatorio-hybrida.pages.dev

Tablero web del Observatorio HYBRIDA de Datos Educativos. Cruza bases oficiales (SNIES, Icfes, MinTIC) por departamento y año, organizadas según la tríada **redistribución, reconocimiento y representación**.

Secciones: Panorama · Redistribución · Reconocimiento · Representación · Cruces · Metodología.

Datos: SNIES 2015–2025, Saber 11 2015–2025, Saber TyT 2016–2025 y MinTIC internet fijo 2017–2023, para los 33 departamentos.

## Cómo funciona

```
Drive (bases oficiales)  →  notebook en Colab  →  tablero_datos.json  →  este repositorio  →  Cloudflare Pages
```

- Las bases pesadas **se quedan en Drive**. Al repositorio solo llega el resumen por departamento y año.
- El tablero lee `public/data/tablero_datos.json` al abrir la página. Para actualizar cifras no hay que tocar código.

## Actualizar los datos

1. Abre `notebooks/Observatorio_HYBRIDA_procesamiento.ipynb` en Colab y ejecútalo. El código vive en Drive (`06 Observatorio – Bases de datos/observatorio_hybrida.py`); en este repositorio hay una copia en `notebooks/`.
2. Descarga `tablero_datos.json` de la carpeta `_procesado/` en Drive.
3. En GitHub, entra a `public/data/`, elige **Add file → Upload files**, sube el archivo (reemplaza el anterior) y confirma.
4. GitHub Actions publica la nueva versión en uno o dos minutos.

## Publicación automática

Cada cambio en la rama `main` se publica solo en Cloudflare Pages mediante GitHub Actions (`.github/workflows/publicar.yml`): instala, compila y sube `dist/` al proyecto `observatorio-hybrida`. El avance se ve en la pestaña **Actions** del repositorio. También se puede lanzar a mano desde **Actions → Publicar tablero → Run workflow**.

Requisito (una sola vez): el secreto `CLOUDFLARE_API_TOKEN` en **Settings → Secrets and variables → Actions**, con un token de Cloudflare que tenga permiso *Account · Cloudflare Pages · Edit*.

## Sumar un indicador

1. En `observatorio_hybrida.py`: una función de carga para la fuente nueva (que devuelva el formato largo `anio | cod_depto | indicador | desagregacion | categoria | valor`), o una línea en los derivados si se calcula con lo que ya existe, más su ficha en `CATALOGO` (nombre, dimensión de la tríada, unidad, fuente, definición).
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
public/marca/                    isotipo y logo del Centro de Pensamiento
src/main.js                      vistas y navegación
src/graficos.js                  mapa, ranking, evolución, desagregación, dispersión, correlaciones
src/datos.js                     carga, índices y agregado nacional
src/estilos.css                  estilos (modo claro y oscuro)
notebooks/                       procesamiento reproducible en Colab
```

## Identidad visual

Sigue el Manual de Marca del Centro de Pensamiento HYBRIDA:

- **Colores:** Azul Académico `#10357A` (estructura, títulos, mapas), Púrpura Innovación `#800080` (enlaces, controles y el departamento seleccionado), Negro Profundo `#1A1A1A` y blanco (fondos), en proporción 70-30-10. El degradado azul–púrpura solo aparece en la franja superior y en la portada.
- **Tipografía:** Poppins para marca y títulos; Source Sans 3 para texto y datos. Ambas van incluidas en el sitio, sin depender de Google Fonts.
- **Logo:** `public/marca/` (isotipo y logo completo). En modo oscuro se usa la versión de un tono en negativo, como indica el manual.
- **Gráficos:** escala secuencial en azules de marca; brechas en naranja (negativo) y azul (positivo); paleta categórica validada para daltonismo. Los tokens están en `src/estilos.css` y `src/graficos.js` (función `paleta`).

## Ciencia abierta

Para obtener un DOI por versión: conectar el repositorio en [Zenodo](https://zenodo.org) (GitHub → activar el repositorio) y crear un *release* en GitHub. Cada release queda depositado y citable.

## Fuentes

- Ministerio de Educación Nacional, SNIES.
- Icfes, DataIcfes (Saber 11 y Saber TyT).
- MinTIC, Colombia TIC (internet fijo).
- DANE, Marco Geoestadístico Nacional 2018.
