# %% [markdown]
# # Observatorio HYBRIDA · Panel departamental
#
# Lee las bases oficiales de **06 Observatorio – Bases de datos** (Drive), las armoniza por **departamento (código DANE) y año** y deja en `_procesado/` las tablas que alimentan el tablero.
#
# Se ejecuta desde Colab con una sola línea:
# `exec(open(glob.glob('/content/drive/MyDrive/HYBRIDA*/06 Observatorio*/observatorio_hybrida.py')[0], encoding='utf-8').read())`
#
# Todo termina en un formato largo: anio | cod_depto | depto | indicador | desagregacion | categoria | valor.
# Una fuente nueva = una función `cargar_<fuente>()` + sus fichas en `CATALOGO` (sección 13).

# %% [markdown]
# ## 1. Montar Drive y ubicar carpetas

# %%
import os, re, io, glob, unicodedata, json, datetime as dt
import numpy as np
import pandas as pd

try:
    from google.colab import drive
    drive.mount('/content/drive')
    EN_COLAB = True
except ImportError:
    EN_COLAB = False

def ubicar_base():
    """Busca la carpeta del observatorio en Mi unidad o en unidades compartidas."""
    if os.environ.get('HYBRIDA_BASE'):
        return os.environ['HYBRIDA_BASE']
    patrones = [
        '/content/drive/MyDrive/HYBRIDA*/06 Observatorio*',
        '/content/drive/MyDrive/*/HYBRIDA*/06 Observatorio*',
        '/content/drive/Shareddrives/*/HYBRIDA*/06 Observatorio*',
        '/content/drive/MyDrive/06 Observatorio*',
    ]
    for p in patrones:
        hits = glob.glob(p)
        if hits:
            return hits[0]
    raise FileNotFoundError('No encontré "06 Observatorio – Bases de datos". Escribe la ruta en BASE a mano.')

BASE = ubicar_base()
SALIDA = os.path.join(BASE, '_procesado')
CACHE = os.path.join(SALIDA, 'cache')
os.makedirs(CACHE, exist_ok=True)
print('Carpeta de bases:', BASE)

# %% [markdown]
# ## 2. Configuración
# Todo lo que se puede ajustar sin tocar el código está aquí.

# %%
# Carpetas de cada fuente (búsqueda por inicio del nombre)
CARPETAS = {
    'snies_matriculados': 'SNIES – Matriculados*',
    'snies_flujos':       'SNIES – Inscritos*',
    'mintic_internet':    'MINTIC - Internet Fijo*',
    'saber_tyt':          'Saber TyT*',
    'saber_11':           'Saber 11*',
}

# Fuentes a procesar. Pon False para saltar una (útil mientras se prueba).
ACTIVAS = globals().get('ACTIVAS') or {
    'snies_matriculados': True,
    'snies_flujos':       True,
    'mintic_internet':    True,
    'saber_tyt':          True,
    'saber_11':           True,   # la más pesada (~4 GB): 10-25 min la primera vez
}

# Si True, reutiliza lo ya procesado en _procesado/cache y no relee el archivo original.
USAR_CACHE = globals().get('USAR_CACHE', True)

# SNIES matrícula: semestre de referencia para el dato anual (stock).
# 2 = segundo semestre. Si un año no tiene ese semestre se omite por no ser comparable (queda en el registro).
SEMESTRE_MATRICULA = 2

# Calidad: un indicador-año se publica solo si tiene dato para al menos este número de departamentos
MIN_DEPTOS = int(os.environ.get('HYBRIDA_MIN_DEPTOS', 10))

# Tamaño de bloque para leer archivos grandes
CHUNK = 250_000

# Columnas forzadas a mano, por fuente, si la detección automática falla.
# Ejemplo: COLUMNAS['saber_11'] = {'depto_cod': 'cole_cod_depto_ubicacion'}
COLUMNAS = {k: {} for k in CARPETAS}

# %% [markdown]
# ## 3. Utilidades: texto, departamentos, detección de columnas

# %%
def norm(s):
    """Minúsculas, sin tildes, solo letras/números/guion bajo."""
    s = unicodedata.normalize('NFKD', str(s)).encode('ascii', 'ignore').decode()
    s = re.sub(r'[^a-z0-9]+', '_', s.lower()).strip('_')
    return s

def norm_val(s):
    """Para valores categóricos: MAYÚSCULAS sin tildes, espacios simples."""
    if pd.isna(s):
        return ''
    s = unicodedata.normalize('NFKD', str(s)).encode('ascii', 'ignore').decode().upper()
    return re.sub(r'\s+', ' ', re.sub(r'[^A-Z0-9 \-]', ' ', s)).strip()

# Divipola departamental (DANE)
DEPTOS = {
    '05': 'Antioquia', '08': 'Atlántico', '11': 'Bogotá D.C.', '13': 'Bolívar', '15': 'Boyacá',
    '17': 'Caldas', '18': 'Caquetá', '19': 'Cauca', '20': 'Cesar', '23': 'Córdoba',
    '25': 'Cundinamarca', '27': 'Chocó', '41': 'Huila', '44': 'La Guajira', '47': 'Magdalena',
    '50': 'Meta', '52': 'Nariño', '54': 'Norte de Santander', '63': 'Quindío', '66': 'Risaralda',
    '68': 'Santander', '70': 'Sucre', '73': 'Tolima', '76': 'Valle del Cauca', '81': 'Arauca',
    '85': 'Casanare', '86': 'Putumayo', '88': 'San Andrés y Providencia', '91': 'Amazonas',
    '94': 'Guainía', '95': 'Guaviare', '97': 'Vaupés', '99': 'Vichada',
}
_NOMBRE_A_COD = {norm_val(v): k for k, v in DEPTOS.items()}

def depto_desde_nombre(nombre):
    n = norm_val(nombre)
    if not n:
        return None
    if n in _NOMBRE_A_COD:
        return _NOMBRE_A_COD[n]
    reglas = [('BOGOTA', '11'), ('SAN ANDRES', '88'), ('ARCHIPIELAGO', '88'), ('NORTE', '54'),
              ('VALLE', '76'), ('GUAJIRA', '44'), ('ATLANTICO', '08')]
    for clave, cod in reglas:
        if clave in n:
            return cod
    return None

def depto_desde_codigo(c):
    if pd.isna(c):
        return None
    s = re.sub(r'\D', '', str(c).split('.')[0])
    if not s:
        return None
    if len(s) >= 4:          # vino un código municipal (5 dígitos)
        s = s.zfill(5)[:2]
    s = s.zfill(2)
    return s if s in DEPTOS else None

def armonizar_depto(df, col_cod=None, col_nom=None):
    """Agrega cod_depto usando código si existe y nombre como respaldo."""
    cod = pd.Series([None] * len(df), index=df.index, dtype=object)
    if col_cod and col_cod in df:
        u = df[col_cod].drop_duplicates()
        m = {x: depto_desde_codigo(x) for x in u}
        cod = df[col_cod].map(m)
    if col_nom and col_nom in df:
        u = df[col_nom].drop_duplicates()
        m = {x: depto_desde_nombre(x) for x in u}
        cod = cod.fillna(df[col_nom].map(m))
    df = df.copy()
    df['cod_depto'] = cod
    return df

def buscar_col(cols, *opciones, excluir=()):
    """Primera columna que coincide con alguna opción (en orden de prioridad).
    Prefiere el nombre exacto; ignora columnas de código interno 'ID ...' salvo que se pidan."""
    ncols = {c: norm(c) for c in cols}
    for frags in opciones:
        if isinstance(frags, str):
            frags = (frags,)
        exacto = '_'.join(frags)
        for c, n in ncols.items():
            if n == exacto:
                return c
        for c, n in ncols.items():
            if n.startswith('id_') and 'id' not in frags:
                continue
            if all(f in n for f in frags) and not any(e in n for e in excluir):
                return c
    return None

def primera(cols, candidatos):
    """Primera columna presente según el orden de 'candidatos' (nombres normalizados)."""
    ncols = {norm(c): c for c in cols}
    return next((ncols[norm(k)] for k in candidatos if norm(k) in ncols), None)

def anio_desde(texto):
    m = re.search(r'(20\d{2})', str(texto))
    return int(m.group(1)) if m else None

def a_numero(s):
    if s.dtype.kind in 'if':
        return s
    out = pd.to_numeric(s, errors='coerce')
    if out.isna().mean() > 0.5:   # números con separador de miles
        out = pd.to_numeric(s.astype(str).str.replace(r'[^\d\-]', '', regex=True), errors='coerce')
    return out

REGISTRO = []
def registrar(fuente, archivo, **kw):
    REGISTRO.append({'fuente': fuente, 'archivo': os.path.basename(str(archivo)),
                     'procesado': dt.datetime.now().strftime('%Y-%m-%d %H:%M'), **kw})

def archivos(fuente, extensiones=('xlsx', 'xls', 'csv', 'txt')):
    carpetas = glob.glob(os.path.join(BASE, CARPETAS[fuente]))
    if not carpetas:
        print(f'⚠ No encontré la carpeta de {fuente}')
        return []
    out = []
    for ext in extensiones:
        out += glob.glob(os.path.join(carpetas[0], '**', f'*.{ext}'), recursive=True)
    return sorted(out)

# %% [markdown]
# ### Categorías armonizadas
# Reglas para que "PRIVADA", "Privado" o "NO OFICIAL" queden igual en todos los años.

# %%
def cat_sector(v):
    v = norm_val(v)
    if 'NO OFICIAL' in v or 'PRIVAD' in v: return 'Privado'
    if 'OFICIAL' in v or 'PUBLIC' in v:    return 'Oficial'
    return 'Sin información'

def cat_sexo(v):
    v = norm_val(v)
    if v in ('M', '1', 'HOMBRE', 'MASCULINO') or v.startswith('HOMBR') or v.startswith('MASC'): return 'Hombre'
    if v in ('F', '2', 'MUJER', 'FEMENINO') or v.startswith('MUJ') or v.startswith('FEM'):      return 'Mujer'
    return 'Sin información'

def cat_modalidad(v):
    v = norm_val(v)
    if 'VIRTUAL' in v and 'PRESENCIAL' in v: return 'Combinada'
    if 'VIRTUAL' in v:   return 'Virtual'
    if 'DISTANCIA' in v: return 'Distancia'
    if 'DUAL' in v:      return 'Dual'
    if 'PRESENCIAL' in v:return 'Presencial'
    return 'Sin información'

def cat_nivel_academico(v):
    v = norm_val(v)
    if 'POSGRAD' in v: return 'Posgrado'
    if 'PREGRAD' in v: return 'Pregrado'
    return 'Sin información'

def cat_nivel_formacion(v):
    v = norm_val(v)
    if 'DOCTOR' in v:     return 'Doctorado'
    if 'MAESTR' in v:     return 'Maestría'
    if 'ESPECIALIZ' in v: return 'Especialización'
    if 'TECNOLOG' in v:   return 'Tecnológica'
    if 'TECNIC' in v:     return 'Técnica profesional'
    if 'UNIVERSIT' in v:  return 'Universitaria'
    return 'Otro'

def cat_estrato(v):
    v = norm_val(v)
    m = re.search(r'([1-6])', v)
    if m:
        e = int(m.group(1))
        return 'Estrato 1-2' if e <= 2 else ('Estrato 3-4' if e <= 4 else 'Estrato 5-6')
    if 'SIN' in v: return 'Sin estrato'
    return 'Sin información'

def cat_zona(v):
    v = norm_val(v)
    if 'RURAL' in v: return 'Rural'
    if 'URBAN' in v: return 'Urbana'
    return 'Sin información'

def cat_tecnologia(v):
    v = norm_val(v)
    if 'HFC' in v or 'COAXIAL' in v: return 'Cable'
    if 'FIBRA' in v or 'FIBER' in v or 'FTT' in v: return 'Fibra óptica'
    if 'CABLE' in v: return 'Cable'
    if 'DSL' in v:   return 'xDSL'
    if 'SATEL' in v: return 'Satelital'
    if any(x in v for x in ('INALAMBR', 'WIMAX', 'RADIO', 'WIFI', 'LTE')): return 'Inalámbrica'
    return 'Otras'

def cat_segmento(v):
    v = norm_val(v)
    m = re.search(r'ESTRATO\s*([1-6])', v)
    if m:
        e = int(m.group(1))
        return 'Residencial 1-2' if e <= 2 else ('Residencial 3-4' if e <= 4 else 'Residencial 5-6')
    if 'CORPORAT' in v or 'EMPRES' in v: return 'Corporativo'
    return 'Otros'

def si_no(v):
    v = norm_val(v)
    if v in ('SI', 'S', '1', 'TRUE'): return 1.0
    if v in ('NO', 'N', '0', 'FALSE'): return 0.0
    return np.nan

# %% [markdown]
# ### Agregador común
# Convierte una tabla con `cod_depto`, `anio` y un valor en filas del formato largo: total + cada desagregación.

# %%
COLS_LARGO = ['anio', 'cod_depto', 'indicador', 'desagregacion', 'categoria', 'valor']

def agregar_suma(df, valor, indicador, desagregaciones=()):
    base = df.dropna(subset=['cod_depto', 'anio'])
    partes = []
    t = base.groupby(['anio', 'cod_depto'], as_index=False)[valor].sum()
    t['desagregacion'], t['categoria'] = 'total', 'Total'
    partes.append(t)
    for d in desagregaciones:
        if d not in base:
            continue
        g = base.groupby(['anio', 'cod_depto', d], as_index=False)[valor].sum()
        g = g.rename(columns={d: 'categoria'})
        g['desagregacion'] = d
        partes.append(g)
    out = pd.concat(partes, ignore_index=True).rename(columns={valor: 'valor'})
    out['indicador'] = indicador
    return out[COLS_LARGO]

def leer_texto_por_bloques(ruta, usecols_fn):
    """Lee CSV/TXT grandes por bloques. Detecta separador y codificación."""
    with open(ruta, 'rb') as f:
        cab = f.readline()
    for enc in ('utf-8-sig', 'latin-1'):
        try:
            linea = cab.decode(enc)
            break
        except UnicodeDecodeError:
            continue
    sep = max(['¬', ';', '|', '\t', ','], key=linea.count)
    cols = [c.strip().strip('"') for c in linea.rstrip('\r\n').split(sep)]
    usar = [c for c in usecols_fn(cols) if c]
    if not (sep == '¬' and enc.startswith('utf')):
        lector = pd.read_csv(ruta, sep=sep, encoding=enc, usecols=usar, dtype=str,
                             chunksize=CHUNK, engine='c', on_bad_lines='skip')
        return cols, lector
    # Vía rápida para Icfes: '¬' en UTF-8 son dos bytes y el lector rápido solo acepta uno.
    # Se reemplaza al vuelo por el carácter de control \x1f, sin copiar el archivo.
    lector = pd.read_csv(io.BufferedReader(_Reemplazo(ruta)), sep='\x1f', encoding='utf-8-sig',
                         usecols=usar, dtype=str, chunksize=CHUNK, engine='c', on_bad_lines='skip')
    return cols, lector

class _Reemplazo(io.RawIOBase):
    """Lee un archivo y cambia b'\xc2\xac' (¬) por b'\x1f', cuidando cortes entre bloques."""
    def __init__(self, ruta):
        self.f = open(ruta, 'rb'); self.resto = b''
    def readable(self):
        return True
    def readinto(self, b):
        datos = self.resto + self.f.read(len(b))
        self.resto = b''
        if datos.endswith(b'\xc2'):
            datos, self.resto = datos[:-1], b'\xc2'
        datos = datos.replace(b'\xc2\xac', b'\x1f')
        if len(datos) > len(b):
            self.resto, datos = datos[len(b):] + self.resto, datos[:len(b)]
        b[:len(datos)] = datos
        return len(datos)
    def close(self):
        self.f.close(); super().close()

def con_cache(fuente, fn):
    ruta = os.path.join(CACHE, f'{fuente}.csv')
    if USAR_CACHE and os.path.exists(ruta):
        print(f'↺ {fuente}: usando cache')
        return pd.read_csv(ruta, dtype={'cod_depto': str})
    print(f'▶ procesando {fuente} ...')
    df = fn()
    if df is not None and len(df):
        df.to_csv(ruta, index=False)
    return df

# %% [markdown]
# ## 4. Inspección
# Muestra, por fuente, un archivo de ejemplo con sus columnas. Es el paso para verificar antes de procesar todo.

# %%
def leer_excel_con_encabezado(ruta, nrows=None):
    """Los Excel del SNIES traen títulos arriba: busca la fila que es encabezado real."""
    hojas = pd.read_excel(ruta, sheet_name=None, header=None, nrows=30)
    mejor = None
    for hoja, d in hojas.items():
        for i, fila in d.iterrows():
            celdas = [norm(x) for x in fila.dropna()]
            pista = sum(any(k in c for c in celdas) for k in ('ano', 'semestre', 'departamento', 'ies', 'sexo'))
            if pista >= 3:
                mejor = (hoja, i)
                break
        if mejor:
            break
    if not mejor:
        mejor = (list(hojas)[0], 0)
    df = pd.read_excel(ruta, sheet_name=mejor[0], header=mejor[1], nrows=nrows)
    df.columns = [str(c).strip() for c in df.columns]
    return df.dropna(how='all')

for fuente in CARPETAS:
    fs = archivos(fuente)
    print(f'\n=== {fuente}: {len(fs)} archivos')
    if not fs:
        continue
    ej = fs[-1]
    try:
        if ej.endswith(('xlsx', 'xls')):
            muestra = leer_excel_con_encabezado(ej, nrows=5)
        else:
            _, lec = leer_texto_por_bloques(ej, lambda c: c)
            muestra = next(iter(lec)).head(5)
        print(os.path.basename(ej), '·', len(muestra.columns), 'columnas')
    except Exception as e:
        print('  no pude leer', os.path.basename(ej), '→', e)

# %% [markdown]
# ## 5. SNIES · Matriculados
# Dato anual = semestre de referencia (`SEMESTRE_MATRICULA`). Departamento = **donde se oferta el programa**.

# %%
def cargar_snies_matriculados():
    partes = []
    for ruta in archivos('snies_matriculados', ('xlsx', 'xls')):
        df = leer_excel_con_encabezado(ruta)
        c = df.columns
        f = COLUMNAS['snies_matriculados']
        col_val = f.get('valor') or buscar_col(c, 'matriculad')
        col_cod = f.get('depto_cod') or buscar_col(c, ('cod', 'depart', 'programa'), ('cod', 'depart', 'oferta'), ('cod', 'depart'), excluir=('ies',))
        col_nom = f.get('depto_nom') or buscar_col(c, ('depart', 'programa'), ('depart', 'oferta'), excluir=('cod',)) or buscar_col(c, 'depart', excluir=('cod', 'ies'))
        col_anio = f.get('anio') or buscar_col(c, 'ano', excluir=('semestre',))
        col_sem = f.get('semestre') or buscar_col(c, 'semestre')
        if not col_val:
            print('⚠ sin columna de matriculados en', os.path.basename(ruta)); continue
        df['v'] = a_numero(df[col_val]).fillna(0)
        df['anio'] = a_numero(df[col_anio]) if col_anio else np.nan
        df['anio'] = pd.Series(df['anio'], index=df.index).fillna(anio_desde(os.path.basename(ruta))).astype(int)
        df['sem'] = a_numero(df[col_sem]).fillna(0).astype(int) if col_sem else 0
        df = armonizar_depto(df, col_cod, col_nom)
        # semestre de referencia por año
        for a, g in df.groupby('anio'):
            sems = sorted(g['sem'].unique())
            if SEMESTRE_MATRICULA not in sems:
                print(f'  · {a}: sin semestre {SEMESTRE_MATRICULA}, se omite (dato parcial, no comparable)')
                registrar('snies_matriculados', ruta, anio=a, omitido='sin semestre de referencia')
                continue
            s = SEMESTRE_MATRICULA
            g = g[g['sem'] == s].copy()
            dims = {
                'sector': buscar_col(c, 'sector'),
                'modalidad': buscar_col(c, 'modalidad') or buscar_col(c, 'metodologia'),
                'nivel_academico': buscar_col(c, ('nivel', 'academ')),
                'nivel_formacion': buscar_col(c, ('nivel', 'formacion')),
                'sexo': buscar_col(c, 'sexo', excluir=('id',)) or buscar_col(c, 'sexo') or buscar_col(c, 'genero'),
            }
            fn = {'sector': cat_sector, 'modalidad': cat_modalidad, 'nivel_academico': cat_nivel_academico,
                  'nivel_formacion': cat_nivel_formacion, 'sexo': cat_sexo}
            for d, col in dims.items():
                if col:
                    g[d] = g[col].map(fn[d])
            partes.append(agregar_suma(g, 'v', 'snies_matriculados', list(dims)))
            registrar('snies_matriculados', ruta, anio=a, semestre_usado=s, filas=len(g),
                      sin_depto=int(g['cod_depto'].isna().sum()))
        print(f'  ✓ {os.path.basename(ruta)}')
    return pd.concat(partes, ignore_index=True) if partes else None

# %% [markdown]
# ## 6. SNIES · Inscritos, admitidos, primer curso y graduados
# Son flujos: se suman los dos semestres del año. Cada archivo se identifica por su columna de valor.

# %%
# Fragmentos del nombre de la columna de valor (los archivos antiguos usan otros nombres:
# 'Admitdos 2015', 'Admisiones 2017', 'Inscripciones 2017')
FLUJOS = {'inscrit': 'snies_inscritos', 'inscripcion': 'snies_inscritos',
          'admitid': 'snies_admitidos', 'admitd': 'snies_admitidos', 'admision': 'snies_admitidos',
          'primer_curso': 'snies_primer_curso', 'graduad': 'snies_graduados'}

def cargar_snies_flujos():
    partes, vistos = [], set()
    for ruta in archivos('snies_flujos', ('xlsx', 'xls')):
        df = leer_excel_con_encabezado(ruta)
        c = df.columns
        col_val, indicador = None, None
        for frag, ind in FLUJOS.items():
            col_val = buscar_col(c, frag, excluir=('cod',))
            if col_val:
                indicador = ind; break
        if not col_val:
            print('⚠ no identifiqué el tipo de', os.path.basename(ruta)); continue
        col_cod = buscar_col(c, ('cod', 'depart', 'programa'), ('cod', 'depart', 'oferta'), ('cod', 'depart'), excluir=('ies',))
        col_nom = buscar_col(c, ('depart', 'programa'), ('depart', 'oferta'), excluir=('cod',)) or buscar_col(c, 'depart', excluir=('cod', 'ies'))
        col_anio = buscar_col(c, 'ano', excluir=('semestre',))
        df['v'] = a_numero(df[col_val]).fillna(0)
        df['anio'] = (a_numero(df[col_anio]) if col_anio else np.nan)
        df['anio'] = pd.Series(df['anio']).fillna(anio_desde(os.path.basename(ruta))).astype(int)
        anios = tuple(sorted(df['anio'].unique()))
        if (indicador, anios) in vistos:
            print('⚠ duplicado, se omite:', os.path.basename(ruta)); continue
        vistos.add((indicador, anios))
        df = armonizar_depto(df, col_cod, col_nom)
        dims = {'sector': buscar_col(c, 'sector'),
                'modalidad': buscar_col(c, 'modalidad') or buscar_col(c, 'metodologia'),
                'nivel_academico': buscar_col(c, ('nivel', 'academ')),
                'sexo': buscar_col(c, 'sexo', excluir=('id',)) or buscar_col(c, 'sexo')}
        fn = {'sector': cat_sector, 'modalidad': cat_modalidad, 'nivel_academico': cat_nivel_academico, 'sexo': cat_sexo}
        for d, col in dims.items():
            if col:
                df[d] = df[col].map(fn[d])
        partes.append(agregar_suma(df, 'v', indicador, list(dims)))
        registrar('snies_flujos', ruta, indicador=indicador, filas=len(df), sin_depto=int(df['cod_depto'].isna().sum()))
        print(f'  ✓ {os.path.basename(ruta)} → {indicador}')
    return pd.concat(partes, ignore_index=True) if partes else None

# %% [markdown]
# ## 7. MinTIC · Accesos a internet fijo
# Es un stock: se toma el **último trimestre disponible de cada año**.

# %%
def cargar_mintic_internet():
    partes = []
    for ruta in archivos('mintic_internet', ('csv', 'txt')):
        sel = {}
        def usecols(cols):
            f = COLUMNAS['mintic_internet']
            sel['anio'] = f.get('anio') or buscar_col(cols, 'ano') or buscar_col(cols, 'anno')
            sel['trim'] = f.get('trimestre') or buscar_col(cols, 'trimestre')
            sel['cod'] = f.get('depto_cod') or buscar_col(cols, ('cod', 'depart'))
            sel['nom'] = f.get('depto_nom') or buscar_col(cols, 'depart', excluir=('cod',))
            sel['seg'] = buscar_col(cols, 'segmento')
            sel['tec'] = buscar_col(cols, 'tecnolog')
            sel['val'] = f.get('valor') or buscar_col(cols, 'acceso')
            print('  columnas MinTIC:', sel)
            return list(sel.values())
        _, lector = leer_texto_por_bloques(ruta, usecols)
        acum, n = [], 0
        for ch in lector:
            n += len(ch)
            ch = armonizar_depto(ch, sel['cod'], sel['nom'])
            ch['anio'] = a_numero(ch[sel['anio']])
            ch['trim'] = a_numero(ch[sel['trim']]) if sel['trim'] else 4
            ch['v'] = a_numero(ch[sel['val']]).fillna(0)
            ch['tecnologia'] = ch[sel['tec']].map(cat_tecnologia) if sel['tec'] else 'Otras'
            ch['segmento'] = ch[sel['seg']].map(cat_segmento) if sel['seg'] else 'Otros'
            acum.append(ch.groupby(['anio', 'trim', 'cod_depto', 'tecnologia', 'segmento'], as_index=False)['v'].sum())
        d = pd.concat(acum).groupby(['anio', 'trim', 'cod_depto', 'tecnologia', 'segmento'], as_index=False)['v'].sum()
        ult = d.groupby('anio')['trim'].transform('max')
        d = d[d['trim'] == ult]
        partes.append(agregar_suma(d, 'v', 'mintic_accesos_internet_fijo', ['tecnologia', 'segmento']))
        registrar('mintic_internet', ruta, filas=n)
        print(f'  ✓ {os.path.basename(ruta)}: {n:,} registros')
    return pd.concat(partes, ignore_index=True) if partes else None

# %% [markdown]
# ## 8. Icfes · Cargador común para Saber 11 y Saber TyT
# Calcula por departamento-año: número de evaluados, promedio de cada puntaje y % de hogares con internet/computador (cuando la prueba lo trae). Todo por bloques para no llenar la memoria.

# %%
# ---------- Enfoque diferencial (Icfes): etnia, discapacidad, nacionalidad, edad, trabajo ----------
def mapear(s, fn):
    """Aplica fn sobre los valores únicos (mucho más rápido que .map(fn) en millones de filas)."""
    u = s.drop_duplicates()
    return s.map({x: fn(x) for x in u})

def cat_etnia(v):
    v = norm_val(v)
    if not v: return 'Sin información'
    if 'NINGUN' in v or v in ('NO', 'N'): return 'Ninguno'
    if 'INDIGEN' in v: return 'Indígena'
    if any(k in v for k in ('AFRO', 'NEGR', 'PALENQ', 'RAIZAL')): return 'Afro, negro, raizal o palenquero'
    if 'ROM' in v or 'GITAN' in v: return 'Rrom'
    if v in ('SI', 'S'): return 'Grupo étnico (sin especificar)'
    if 'OTRO' in v: return 'Otro grupo étnico'
    # En varios años el Icfes lista pueblos indígenas por nombre (Wayuu, Zenú, Embera, Nasa, Pastos...)
    return 'Indígena'

def bin_etnia(v):
    c = cat_etnia(v)
    return np.nan if c == 'Sin información' else (0.0 if c == 'Ninguno' else 1.0)

def bin_discapacidad(v):
    v = norm_val(v)
    if not v: return np.nan
    if v in ('N', 'NO') or 'NINGUN' in v or v.startswith('NO '): return 0.0
    return 1.0

def cat_discapacidad(v):
    b = bin_discapacidad(v)
    return 'Sin información' if pd.isna(b) else ('Con discapacidad' if b else 'Sin discapacidad')

def bin_extranjero(v):
    v = norm_val(v)
    if not v: return np.nan
    return 0.0 if 'COLOMBIA' in v else 1.0

def bin_trabaja(v):
    v = norm_val(v)
    if not v: return np.nan
    return 0.0 if (v in ('0', 'NO', 'NINGUNA') or v.startswith('0 ')) else 1.0

def edad_s11(e):
    if pd.isna(e): return 'Sin información'
    return '16 años o menos' if e <= 16 else ('17 a 18 años' if e <= 18 else '19 años o más')

def edad_tyt(e):
    if pd.isna(e): return 'Sin información'
    return 'Menos de 25 años' if e < 25 else ('25 a 34 años' if e < 35 else '35 años o más')

def cargar_icfes(fuente, prefijo, cand_depto_cod, cand_depto_nom, cand_dims, cand_binarias):
    partes = []
    for ruta in archivos(fuente, ('txt', 'csv')):
        sel = {}
        def usecols(cols):
            f = COLUMNAS[fuente]
            sel['nom'] = f.get('depto_nom') or primera(cols, cand_depto_nom)
            sel['cod'] = f.get('depto_cod') or primera(cols, cand_depto_cod)
            sel['periodo'] = buscar_col(cols, 'periodo')
            sel['puntajes'] = [c for c in cols if re.search(r'(^punt_|_punt$|^punt_global)', norm(c)) and 'desemp' not in norm(c) and 'percentil' not in norm(c)]
            sel['nac'] = primera(cols, ['estu_fechanacimiento'])
            virtuales = list(cols) + (['__edad'] if sel['nac'] else [])
            # Cada dimensión o binaria puede venir en varias columnas según el año: se usan todas las
            # presentes y, fila a fila, gana la primera con dato (algunas columnas existen pero vienen vacías).
            sel['dims'] = {d: [c for c in (primera(virtuales, [o]) for o in opts) if c] for d, (opts, _) in cand_dims.items()}
            sel['bins'] = {}
            for b, spec in cand_binarias.items():
                opciones = [(spec, si_no)] if isinstance(spec, str) else spec
                sel['bins'][b] = [(primera(virtuales, [c]), f) for c, f in opciones if primera(virtuales, [c])]
            if ruta == archivos(fuente, ('txt', 'csv'))[0]:
                print(f'  columnas {fuente}:', {k: v for k, v in sel.items() if k != 'puntajes'}, '| puntajes:', sel['puntajes'])
            todas = [sel['cod'], sel['nom'], sel['periodo'], sel['nac'], *sel['puntajes'],
                     *[c for v in sel['dims'].values() for c in v], *[c for v in sel['bins'].values() for c, _ in v]]
            return list(dict.fromkeys(c for c in todas if c and c != '__edad'))
        _, lector = leer_texto_por_bloques(ruta, usecols)
        acum, n = [], 0
        anio_archivo = anio_desde(os.path.basename(ruta))
        for ch in lector:
            n += len(ch)
            ch = armonizar_depto(ch, sel['cod'], sel['nom'])
            ch['anio'] = anio_archivo or (ch[sel['periodo']].str[:4].astype(float) if sel['periodo'] else np.nan)
            if sel['nac']:
                nac = pd.to_numeric(ch[sel['nac']].astype(str).str.extract(r'((?:19|20)\d{2})')[0], errors='coerce')
                edad = ch['anio'] - nac
                ch['__edad'] = edad.where((edad >= 10) & (edad <= 80))
            ch['__n'] = 1.0
            medidas = ['__n']
            for p in sel['puntajes']:
                ch[p] = a_numero(ch[p])
                ch[p + '__c'] = ch[p].notna().astype(float)
                medidas += [p, p + '__c']
            for b, opciones in sel['bins'].items():
                if opciones:
                    val = None
                    for col, fn in opciones:
                        v = mapear(ch[col], fn)
                        val = v if val is None else val.combine_first(v)
                    ch[b] = val
                    ch[b + '__c'] = ch[b].notna().astype(float)
                    medidas += [b, b + '__c']
            ch['__tot'] = 'Total'
            for d, cols_d in [('total', ['__tot'])] + [(d, c) for d, c in sel['dims'].items() if c]:
                if d == 'total':
                    cat = ch['__tot']
                else:
                    crudo = None
                    for col in cols_d:
                        v = ch[col] if col == '__edad' else ch[col].replace('', np.nan)
                        crudo = v if crudo is None else crudo.combine_first(v)
                    cat = mapear(crudo, cand_dims[d][1])
                g = ch.assign(categoria=cat).groupby(['anio', 'cod_depto', 'categoria'])[medidas].sum().reset_index()
                g['desagregacion'] = d
                acum.append(g)
        d = pd.concat(acum).groupby(['anio', 'cod_depto', 'desagregacion', 'categoria']).sum().reset_index()
        filas = []
        base_cols = ['anio', 'cod_depto', 'desagregacion', 'categoria']
        t = d[base_cols].copy(); t['indicador'] = f'{prefijo}_evaluados'; t['valor'] = d['__n']; filas.append(t)
        for p in sel['puntajes']:
            t = d[base_cols].copy(); t['indicador'] = f'{prefijo}_{norm(p)}_prom'
            t['valor'] = d[p] / d[p + '__c'].replace(0, np.nan); filas.append(t)
        for b, opciones in sel['bins'].items():
            if opciones:
                t = d[base_cols].copy(); t['indicador'] = f'{prefijo}_pct_{b}'
                t['valor'] = 100 * d[b] / d[b + '__c'].replace(0, np.nan); filas.append(t)
        partes.append(pd.concat(filas)[COLS_LARGO])
        registrar(fuente, ruta, anio=anio_archivo, filas=n)
        print(f'  ✓ {os.path.basename(ruta)}: {n:,} registros')
    return pd.concat(partes, ignore_index=True) if partes else None

def cargar_saber_11():
    return cargar_icfes(
        'saber_11', 's11',
        cand_depto_cod=['cole_cod_depto_ubicacion', 'cole_cod_dane_depto'],
        cand_depto_nom=['cole_depto_ubicacion'],
        cand_dims={'naturaleza': (['cole_naturaleza'], cat_sector),
                   'zona': (['cole_area_ubicacion'], cat_zona),
                   'sexo': (['estu_genero'], cat_sexo),
                   'estrato': (['fami_estratovivienda'], cat_estrato),
                   'etnia': (['estu_grupoetnia', 'estu_etnia'], cat_etnia),
                   'discapacidad': (['estu_discapacidad'], cat_discapacidad),
                   'grupo_edad': (['__edad'], edad_s11)},
        cand_binarias={'internet_hogar': 'fami_tieneinternet', 'computador_hogar': 'fami_tienecomputador',
                       'etnia': [('estu_tieneetnia', si_no), ('estu_grupoetnia', bin_etnia), ('estu_etnia', bin_etnia)],
                       'discapacidad': [('estu_discapacidad', bin_discapacidad)],
                       'extranjero': [('estu_nacionalidad', bin_extranjero)],
                       'campesino': [('estu_comunidadcampesina', si_no)],
                       'trabaja': [('estu_horassemanatrabaja', bin_trabaja)],
                       'extraedad': [('__edad', lambda e: np.nan if pd.isna(e) else float(e >= 19))]},
    )

def cargar_saber_tyt():
    return cargar_icfes(
        'saber_tyt', 'tyt',
        # Departamento donde se ofrece el programa (mismo criterio que SNIES); si no existe, el de la institución
        cand_depto_cod=[],
        cand_depto_nom=['estu_prgm_departamento', 'estu_inst_departamento', 'estu_depto_presentacion'],
        cand_dims={'sexo': (['estu_genero'], cat_sexo),
                   'estrato': (['fami_estratovivienda'], cat_estrato),
                   'naturaleza': (['inst_origen'], cat_sector),
                   'modalidad': (['estu_metodo_prgm'], cat_modalidad),
                   'etnia': (['estu_grupoetnia', 'estu_etnia'], cat_etnia),
                   'discapacidad': (['estu_discapacidad'], cat_discapacidad),
                   'grupo_edad': (['__edad'], edad_tyt)},
        cand_binarias={'internet_hogar': 'fami_tieneinternet', 'computador_hogar': 'fami_tienecomputador',
                       'etnia': [('estu_tieneetnia', si_no), ('estu_grupoetnia', bin_etnia), ('estu_etnia', bin_etnia)],
                       'discapacidad': [('estu_discapacidad', bin_discapacidad)],
                       'extranjero': [('estu_nacionalidad', bin_extranjero)],
                       'trabaja': [('estu_horassemanatrabaja', bin_trabaja)],
                       'mayor_25': [('__edad', lambda e: np.nan if pd.isna(e) else float(e >= 25))]},
    )

# %% [markdown]
# ## 9. Ejecutar fuentes

# %%
CARGADORES = {
    'snies_matriculados': cargar_snies_matriculados,
    'snies_flujos':       cargar_snies_flujos,
    'mintic_internet':    cargar_mintic_internet,
    'saber_tyt':          cargar_saber_tyt,
    'saber_11':           cargar_saber_11,
}

resultados = {}
for fuente, fn in CARGADORES.items():
    if not ACTIVAS.get(fuente):
        continue
    try:
        r = con_cache(fuente, fn)
        if r is not None:
            resultados[fuente] = r
            print(f'✓ {fuente}: {len(r):,} filas')
    except Exception as e:
        print(f'✗ {fuente} falló: {e}')

panel = pd.concat(resultados.values(), ignore_index=True)
panel['cod_depto'] = panel['cod_depto'].astype(str).str.zfill(2)
panel['anio'] = panel['anio'].astype(int)
panel = panel[panel['cod_depto'].isin(DEPTOS)]
print(f'\nPanel base: {len(panel):,} filas, {panel.indicador.nunique()} indicadores')

# %% [markdown]
# ## 10. Indicadores derivados
# Se calculan sobre el panel ya armonizado. Para sumar uno nuevo, agrega una línea aquí y su ficha en el catálogo.

# %%
def serie(ind, desag='total', cat='Total'):
    s = panel[(panel.indicador == ind) & (panel.desagregacion == desag) & (panel.categoria == cat)]
    return s.set_index(['anio', 'cod_depto'])['valor']

def proporcion(nombre, num, den, factor=100):
    r = (factor * num / den.replace(0, np.nan)).dropna().rename('valor').reset_index()
    r['indicador'], r['desagregacion'], r['categoria'] = nombre, 'total', 'Total'
    return r[COLS_LARGO]

def brecha(nombre, ind, desag, a, b):
    r = (serie(ind, desag, a) - serie(ind, desag, b)).dropna().rename('valor').reset_index()
    r['indicador'], r['desagregacion'], r['categoria'] = nombre, 'total', 'Total'
    return r[COLS_LARGO]

def desplazar(s, anios=1):
    s = s.reset_index(); s['anio'] += anios
    return s.set_index(['anio', 'cod_depto'])['valor']

derivados = []
def intentar(fn, *a):
    try:
        r = fn(*a)
        if len(r): derivados.append(r)
    except KeyError:
        pass

M = 'snies_matriculados'
intentar(proporcion, 'snies_pct_mujeres', serie(M, 'sexo', 'Mujer'), serie(M))
intentar(proporcion, 'snies_pct_oficial', serie(M, 'sector', 'Oficial'), serie(M))
intentar(proporcion, 'snies_pct_virtual_distancia', serie(M, 'modalidad', 'Virtual').add(serie(M, 'modalidad', 'Distancia'), fill_value=0), serie(M))
intentar(proporcion, 'snies_pct_tecnica_tecnologica', serie(M, 'nivel_formacion', 'Técnica profesional').add(serie(M, 'nivel_formacion', 'Tecnológica'), fill_value=0), serie(M))
intentar(proporcion, 'snies_tasa_admision', serie('snies_admitidos'), serie('snies_inscritos'))
intentar(proporcion, 'snies_graduados_por_100_matriculados', serie('snies_graduados'), serie(M))
# Absorción aproximada: primer curso de pregrado en t+1 frente a evaluados Saber 11 (calendario A) en t
intentar(proporcion, 'absorcion_aprox', serie('snies_primer_curso', 'nivel_academico', 'Pregrado'), desplazar(serie('s11_evaluados')))
intentar(proporcion, 'mintic_pct_fibra', serie('mintic_accesos_internet_fijo', 'tecnologia', 'Fibra óptica'), serie('mintic_accesos_internet_fijo'))
intentar(proporcion, 'mintic_pct_residencial_1_2', serie('mintic_accesos_internet_fijo', 'segmento', 'Residencial 1-2'), serie('mintic_accesos_internet_fijo'))
intentar(brecha, 's11_brecha_oficial_privado', 's11_punt_global_prom', 'naturaleza', 'Oficial', 'Privado')
intentar(brecha, 's11_brecha_rural_urbana', 's11_punt_global_prom', 'zona', 'Rural', 'Urbana')
intentar(brecha, 's11_brecha_internet_estrato', 's11_pct_internet_hogar', 'estrato', 'Estrato 1-2', 'Estrato 5-6')
# Representación: mujeres entre evaluados y brechas de puntaje por sexo, etnia y discapacidad
intentar(proporcion, 's11_pct_mujeres', serie('s11_evaluados', 'sexo', 'Mujer'), serie('s11_evaluados', 'sexo', 'Mujer').add(serie('s11_evaluados', 'sexo', 'Hombre'), fill_value=0))
intentar(proporcion, 'tyt_pct_mujeres', serie('tyt_evaluados', 'sexo', 'Mujer'), serie('tyt_evaluados', 'sexo', 'Mujer').add(serie('tyt_evaluados', 'sexo', 'Hombre'), fill_value=0))
intentar(brecha, 's11_brecha_sexo', 's11_punt_global_prom', 'sexo', 'Mujer', 'Hombre')
intentar(brecha, 'tyt_brecha_sexo', 'tyt_punt_global_prom', 'sexo', 'Mujer', 'Hombre')
intentar(brecha, 's11_brecha_discapacidad', 's11_punt_global_prom', 'discapacidad', 'Con discapacidad', 'Sin discapacidad')
for _g, _slug in [('Indígena', 'indigena'), ('Afro, negro, raizal o palenquero', 'afro')]:
    intentar(brecha, f's11_brecha_{_slug}', 's11_punt_global_prom', 'etnia', _g, 'Ninguno')

if derivados:
    panel = pd.concat([panel] + derivados, ignore_index=True)
panel['depto'] = panel['cod_depto'].map(DEPTOS)
panel = panel[['anio', 'cod_depto', 'depto', 'indicador', 'desagregacion', 'categoria', 'valor']]
print(f'Panel final: {len(panel):,} filas, {panel.indicador.nunique()} indicadores')

# %% [markdown]
# ## 11. Catálogo de indicadores (ficha técnica mínima)
# `dimension` organiza el tablero según la tríada de la Declaración. **Es una propuesta: validar con Mayra.**
# Los indicadores de puntaje por prueba se documentan con una regla general.

# %%
CATALOGO = [
    # indicador, nombre, dimension, unidad, fuente, definicion
    ('snies_matriculados', 'Matriculados en educación superior', 'Redistribución', 'personas', 'SNIES – MEN', 'Matrícula del semestre de referencia por departamento de oferta del programa.'),
    ('snies_inscritos', 'Inscritos', 'Redistribución', 'personas', 'SNIES – MEN', 'Suma de inscritos de los dos semestres.'),
    ('snies_admitidos', 'Admitidos', 'Redistribución', 'personas', 'SNIES – MEN', 'Suma de admitidos de los dos semestres.'),
    ('snies_primer_curso', 'Matriculados en primer curso', 'Redistribución', 'personas', 'SNIES – MEN', 'Suma de primer curso de los dos semestres.'),
    ('snies_graduados', 'Graduados', 'Reconocimiento', 'personas', 'SNIES – MEN', 'Suma de graduados de los dos semestres.'),
    ('snies_tasa_admision', 'Tasa de admisión', 'Redistribución', '%', 'SNIES – MEN', 'Admitidos / inscritos × 100.'),
    ('snies_pct_mujeres', 'Participación de mujeres en la matrícula', 'Representación', '%', 'SNIES – MEN', 'Matriculadas mujeres / total × 100.'),
    ('snies_pct_oficial', 'Matrícula en IES oficiales', 'Redistribución', '%', 'SNIES – MEN', 'Matrícula en IES oficiales / total × 100.'),
    ('snies_pct_virtual_distancia', 'Matrícula virtual y a distancia', 'Redistribución', '%', 'SNIES – MEN', '(Virtual + distancia) / total × 100.'),
    ('snies_pct_tecnica_tecnologica', 'Matrícula técnica y tecnológica', 'Redistribución', '%', 'SNIES – MEN', '(Técnica profesional + tecnológica) / total × 100.'),
    ('snies_graduados_por_100_matriculados', 'Graduados por cada 100 matriculados', 'Reconocimiento', 'razón', 'SNIES – MEN', 'Graduados del año / matrícula del año × 100. Aproximación, no es tasa de graduación por cohorte.'),
    ('absorcion_aprox', 'Absorción aproximada', 'Redistribución', '%', 'SNIES – MEN; Icfes', 'Primer curso pregrado (t+1) / evaluados Saber 11 calendario A (t) × 100. Proxy: no sigue a las mismas personas.'),
    ('mintic_accesos_internet_fijo', 'Accesos a internet fijo', 'Redistribución', 'accesos', 'MinTIC – Colombia TIC', 'Accesos del último trimestre disponible de cada año. Sin población aún: no es tasa por 100 habitantes.'),
    ('mintic_pct_fibra', 'Accesos por fibra óptica', 'Redistribución', '%', 'MinTIC – Colombia TIC', 'Accesos de fibra / total × 100.'),
    ('mintic_pct_residencial_1_2', 'Accesos residenciales estratos 1-2', 'Redistribución', '%', 'MinTIC – Colombia TIC', 'Accesos residenciales estratos 1 y 2 / total × 100.'),
    ('s11_evaluados', 'Evaluados Saber 11 (calendario A)', 'Reconocimiento', 'personas', 'Icfes – DataIcfes', 'Estudiantes evaluados en el periodo 2 del año, por departamento del colegio.'),
    ('s11_pct_internet_hogar', 'Estudiantes Saber 11 con internet en el hogar', 'Redistribución', '%', 'Icfes – DataIcfes', 'Respuestas "Sí" / respuestas válidas × 100.'),
    ('s11_pct_computador_hogar', 'Estudiantes Saber 11 con computador en el hogar', 'Redistribución', '%', 'Icfes – DataIcfes', 'Respuestas "Sí" / respuestas válidas × 100.'),
    ('s11_brecha_oficial_privado', 'Brecha Saber 11 oficial – privado', 'Reconocimiento', 'puntos', 'Icfes – DataIcfes', 'Puntaje global promedio oficial − privado.'),
    ('s11_brecha_rural_urbana', 'Brecha Saber 11 rural – urbana', 'Reconocimiento', 'puntos', 'Icfes – DataIcfes', 'Puntaje global promedio rural − urbano.'),
    ('s11_brecha_internet_estrato', 'Brecha de internet en el hogar, estrato 1-2 vs 5-6', 'Redistribución', 'puntos %', 'Icfes – DataIcfes', '% con internet estrato 1-2 − % estrato 5-6.'),
    ('tyt_evaluados', 'Evaluados Saber TyT', 'Reconocimiento', 'personas', 'Icfes – DataIcfes', 'Evaluados del año por departamento donde se ofrece el programa.'),
    ('tyt_pct_internet_hogar', 'Evaluados TyT con internet en el hogar', 'Redistribución', '%', 'Icfes – DataIcfes', 'Respuestas "Sí" / respuestas válidas × 100.'),
    ('tyt_pct_computador_hogar', 'Evaluados TyT con computador en el hogar', 'Redistribución', '%', 'Icfes – DataIcfes', 'Respuestas "Sí" / respuestas válidas × 100.'),
    # Representación · enfoque diferencial (autorreportado en el formulario del Icfes)
    ('s11_pct_mujeres', 'Mujeres entre los evaluados de Saber 11', 'Representación', '%', 'Icfes – DataIcfes', 'Evaluadas mujeres / (mujeres + hombres) × 100.'),
    ('tyt_pct_mujeres', 'Mujeres entre los evaluados de Saber TyT', 'Representación', '%', 'Icfes – DataIcfes', 'Evaluadas mujeres / (mujeres + hombres) × 100.'),
    ('s11_pct_etnia', 'Bachilleres que se reconocen de un grupo étnico', 'Representación', '%', 'Icfes – DataIcfes', 'Evaluados que se reconocen indígenas, afro, raizales, palenqueros, Rrom u otro grupo / respuestas válidas × 100.'),
    ('tyt_pct_etnia', 'Evaluados TyT que se reconocen de un grupo étnico', 'Representación', '%', 'Icfes – DataIcfes', 'Evaluados que se reconocen de un grupo étnico / respuestas válidas × 100.'),
    ('s11_pct_discapacidad', 'Bachilleres con discapacidad', 'Representación', '%', 'Icfes – DataIcfes', 'Evaluados que reportan alguna discapacidad / respuestas válidas × 100.'),
    ('tyt_pct_discapacidad', 'Evaluados TyT con discapacidad', 'Representación', '%', 'Icfes – DataIcfes', 'Evaluados que reportan alguna discapacidad / respuestas válidas × 100.'),
    ('s11_pct_extranjero', 'Bachilleres de nacionalidad extranjera', 'Representación', '%', 'Icfes – DataIcfes', 'Evaluados con nacionalidad distinta a la colombiana / respuestas válidas × 100. Aproxima la población migrante en el sistema escolar.'),
    ('tyt_pct_extranjero', 'Evaluados TyT de nacionalidad extranjera', 'Representación', '%', 'Icfes – DataIcfes', 'Evaluados con nacionalidad distinta a la colombiana / respuestas válidas × 100.'),
    ('s11_pct_campesino', 'Bachilleres que se reconocen como campesinos', 'Representación', '%', 'Icfes – DataIcfes', 'Evaluados que se reconocen parte de una comunidad campesina / respuestas válidas × 100. Pregunta reciente.'),
    ('s11_pct_extraedad', 'Bachilleres en extraedad (19 años o más)', 'Representación', '%', 'Icfes – DataIcfes', 'Evaluados con 19 años o más en el año de la prueba / evaluados con edad válida × 100.'),
    ('tyt_pct_mayor_25', 'Evaluados TyT de 25 años o más', 'Representación', '%', 'Icfes – DataIcfes', 'Evaluados con 25 años o más / evaluados con edad válida × 100.'),
    ('s11_pct_trabaja', 'Bachilleres que trabajan', 'Representación', '%', 'Icfes – DataIcfes', 'Evaluados que reportan horas de trabajo a la semana / respuestas válidas × 100.'),
    ('tyt_pct_trabaja', 'Evaluados TyT que trabajan', 'Representación', '%', 'Icfes – DataIcfes', 'Evaluados que reportan horas de trabajo a la semana / respuestas válidas × 100.'),
    ('s11_brecha_sexo', 'Brecha Saber 11 mujeres – hombres', 'Representación', 'puntos', 'Icfes – DataIcfes', 'Puntaje global promedio de mujeres − hombres.'),
    ('tyt_brecha_sexo', 'Brecha Saber TyT mujeres – hombres', 'Representación', 'puntos', 'Icfes – DataIcfes', 'Puntaje global promedio de mujeres − hombres.'),
    ('s11_brecha_discapacidad', 'Brecha Saber 11 con – sin discapacidad', 'Representación', 'puntos', 'Icfes – DataIcfes', 'Puntaje global promedio de evaluados con discapacidad − sin discapacidad.'),
    ('s11_brecha_indigena', 'Brecha Saber 11 indígenas – sin pertenencia étnica', 'Representación', 'puntos', 'Icfes – DataIcfes', 'Puntaje global promedio de evaluados indígenas − evaluados sin pertenencia étnica.'),
    ('s11_brecha_afro', 'Brecha Saber 11 afro – sin pertenencia étnica', 'Representación', 'puntos', 'Icfes – DataIcfes', 'Puntaje global promedio de evaluados afro, negros, raizales o palenqueros − sin pertenencia étnica.'),
]
cat = pd.DataFrame(CATALOGO, columns=['indicador', 'nombre', 'dimension', 'unidad', 'fuente', 'definicion'])

# Puntajes promedio: ficha por regla general
extra = []
for ind in sorted(set(panel.indicador) - set(cat.indicador)):
    if ind.endswith('_prom'):
        prueba = 'Saber 11' if ind.startswith('s11') else 'Saber TyT'
        modulo = ind.split('_', 1)[1].replace('_prom', '').replace('punt_', '').replace('mod_', '').replace('_punt', '').replace('_', ' ')
        modulo = {'c naturales': 'ciencias naturales', 'ingles': 'inglés', 'lectura critica': 'lectura crítica', 'matematicas': 'matemáticas', 'sociales ciudadanas': 'sociales y ciudadanas', 'competen ciudada': 'competencias ciudadanas', 'comuni escrita': 'comunicación escrita', 'razona cuantitat': 'razonamiento cuantitativo'}.get(modulo, modulo)
        extra.append((ind, f'{prueba}: puntaje promedio {modulo}', 'Reconocimiento', 'puntos', 'Icfes – DataIcfes',
                      f'Promedio del puntaje {modulo} entre evaluados con puntaje válido.'))
cat = pd.concat([cat, pd.DataFrame(extra, columns=cat.columns)], ignore_index=True)
cat = cat[cat.indicador.isin(panel.indicador)]

sin_ficha = sorted(set(panel.indicador) - set(cat.indicador))
if sin_ficha:
    print('⚠ Indicadores sin ficha en el catálogo:', sin_ficha)

# %% [markdown]
# ## 12. Validaciones y exportación
# Revisa cobertura (cuántos departamentos tiene cada indicador por año) y guarda todo en `_procesado/`.

# %%
# Calidad: se descartan indicador-año con menos de MIN_DEPTOS departamentos (series incompletas)
_n = panel[panel.desagregacion == 'total'].groupby(['indicador', 'anio'])['cod_depto'].nunique()
_ok = set(_n[_n >= MIN_DEPTOS].index)
panel = panel[[(i, a) in _ok for i, a in zip(panel.indicador, panel.anio)]]

cobertura = (panel[panel.desagregacion == 'total']
             .groupby(['indicador', 'anio'])['cod_depto'].nunique()
             .unstack('anio'))
print('Departamentos con dato por indicador y año (máximo 33):')
print(cobertura.fillna(0).astype(int).to_string())

ancho = (panel[panel.desagregacion == 'total']
         .pivot_table(index=['anio', 'cod_depto', 'depto'], columns='indicador', values='valor')
         .reset_index())

panel.to_csv(os.path.join(SALIDA, 'panel_largo.csv'), index=False)
ancho.to_csv(os.path.join(SALIDA, 'panel_departamental_ancho.csv'), index=False)
cat.to_csv(os.path.join(SALIDA, 'catalogo_indicadores.csv'), index=False)
cobertura.to_csv(os.path.join(SALIDA, 'cobertura_indicadores.csv'))
reg_path = os.path.join(SALIDA, 'registro_procesamiento.csv')
nuevo = pd.DataFrame(REGISTRO)
if os.path.exists(reg_path) and len(nuevo):
    nuevo = pd.concat([pd.read_csv(reg_path), nuevo], ignore_index=True)
if len(nuevo):
    nuevo.to_csv(reg_path, index=False)

# Archivo compacto para el tablero (sin vacíos ni infinitos: el navegador no los acepta en JSON)
web = panel.replace([np.inf, -np.inf], np.nan).dropna(subset=['valor'])
tablero = {
    'generado': dt.datetime.now().isoformat(timespec='minutes'),
    'deptos': DEPTOS,
    'catalogo': cat.to_dict('records'),
    'datos': [[int(a), str(c), i, d, k, round(float(v), 3)] for a, c, i, d, k, v in
              web[['anio', 'cod_depto', 'indicador', 'desagregacion', 'categoria', 'valor']].itertuples(index=False)],
    'columnas': ['anio', 'cod_depto', 'indicador', 'desagregacion', 'categoria', 'valor'],
}
with open(os.path.join(SALIDA, 'tablero_datos.json'), 'w', encoding='utf-8') as f:
    json.dump(tablero, f, ensure_ascii=False, separators=(',', ':'), allow_nan=False)

print('\nListo. Archivos en', SALIDA)
for f in sorted(os.listdir(SALIDA)):
    if os.path.isfile(os.path.join(SALIDA, f)):
        print(f'  {f}  ({os.path.getsize(os.path.join(SALIDA, f))/1e6:.1f} MB)')

# %% [markdown]
# ## 13. Cómo sumar una variable nueva
#
# **Caso A · nueva base (ej. proyecciones de población DANE, SPADIES, Saber Pro):**
# 1. Sube los archivos a una subcarpeta nueva dentro de *06 Observatorio – Bases de datos*.
# 2. Agrega la carpeta en `CARPETAS` y `ACTIVAS` (sección 2).
# 3. Escribe `cargar_<fuente>()` que devuelva columnas `anio, cod_depto, indicador, desagregacion, categoria, valor`. Usa `armonizar_depto()` y `agregar_suma()`; para pruebas Icfes basta con llamar a `cargar_icfes()` (Saber Pro es casi idéntico a TyT).
# 4. Regístrala en `CARGADORES` (sección 9) y agrega sus fichas en `CATALOGO`.
#
# **Caso B · indicador calculado con lo que ya existe:** una línea en la sección 10 (`proporcion`, `brecha` o `desplazar`) + su ficha.
#
# **Cuando llegue la población DANE** se activan las tasas: cobertura bruta (matrícula / población 17-21), accesos por 100 habitantes y por 100 hogares. Ya quedan previstas con `proporcion()`.
#
# **Reprocesar:** `USAR_CACHE = False` para todo, o borra solo el archivo de esa fuente en `_procesado/cache/`.
