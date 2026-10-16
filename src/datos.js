import * as d3 from "d3";

// Formato numérico colombiano: miles con punto, decimales con coma
const local = d3.formatLocale({decimal: ",", thousands: ".", grouping: [3], currency: ["$", ""]});
const entero = local.format(",.0f");
const uno = local.format(",.1f");
const compacto = (v) => {
  const a = Math.abs(v);
  if (a >= 1e6) return local.format(",.1f")(v / 1e6) + " M";
  if (a >= 1e4) return local.format(",.0f")(v / 1e3) + " mil";
  return entero(v);
};

export function formatear(v, unidad, {corto = false} = {}) {
  if (v == null || Number.isNaN(v)) return "sin dato";
  switch (unidad) {
    case "%": return uno(v) + " %";
    case "puntos %": return (v > 0 ? "+" : "") + uno(v) + " p. p.";
    case "puntos": return uno(v) + " pts";
    case "razón": return uno(v);
    default: return corto ? compacto(v) : entero(v);
  }
}
export const signoPct = (v) => (v > 0 ? "+" : "") + uno(v) + " %";

// Indicadores que se suman entre departamentos; el resto se promedia ponderado
const ADITIVAS = new Set(["personas", "accesos"]);
const PESO = [
  [/^s11_/, "s11_evaluados"],
  [/^tyt_/, "tyt_evaluados"],
  [/^mintic_/, "mintic_accesos_internet_fijo"],
  [/^(snies_|absorcion)/, "snies_matriculados"],
];

export async function cargarDatos() {
  const [raw, geo] = await Promise.all([
    fetch("data/tablero_datos.json").then((r) => r.json()),
    fetch("data/departamentos.json").then((r) => r.json()),
  ]);
  const ix = Object.fromEntries(raw.columnas.map((c, i) => [c, i]));
  const filas = raw.datos.map((r) => ({
    anio: +r[ix.anio],
    cod: String(r[ix.cod_depto]).padStart(2, "0"),
    ind: r[ix.indicador],
    des: r[ix.desagregacion],
    cat: r[ix.categoria],
    valor: r[ix.valor] == null ? null : +r[ix.valor],
  }));

  const deptos = raw.deptos;
  const catalogo = raw.catalogo.filter((c) => filas.some((f) => f.ind === c.indicador));
  const info = new Map(catalogo.map((c) => [c.indicador, c]));

  // índice: indicador → desagregación → categoría → año → cod → valor
  const idx = new Map();
  for (const f of filas) {
    const k = `${f.ind}|${f.des}|${f.cat}`;
    if (!idx.has(k)) idx.set(k, new Map());
    const porAnio = idx.get(k);
    if (!porAnio.has(f.anio)) porAnio.set(f.anio, new Map());
    porAnio.get(f.anio).set(f.cod, f.valor);
  }
  const desagregaciones = d3.rollup(filas.filter((f) => f.des !== "total"), (v) => [...new Set(v.map((f) => f.cat))], (f) => f.ind, (f) => f.des);

  const valores = (ind, anio, des = "total", cat = "Total") =>
    idx.get(`${ind}|${des}|${cat}`)?.get(anio) ?? new Map();
  const anios = (ind) => [...(idx.get(`${ind}|total|Total`)?.keys() ?? [])].sort((a, b) => a - b);
  const serie = (ind, cod, des = "total", cat = "Total") => {
    const m = idx.get(`${ind}|${des}|${cat}`);
    if (!m) return [];
    return [...m].map(([anio, v]) => ({anio, valor: v.get(cod) ?? null})).filter((d) => d.valor != null).sort((a, b) => a.anio - b.anio);
  };
  const esAditiva = (ind) => ADITIVAS.has(info.get(ind)?.unidad);
  const indicadorPeso = (ind) => PESO.find(([re]) => re.test(ind))?.[1];

  // Agregado nacional: suma si es aditiva, promedio ponderado si no (aproximación documentada)
  function nacional(ind, anio, des = "total", cat = "Total") {
    const v = valores(ind, anio, des, cat);
    if (!v.size) return null;
    if (esAditiva(ind)) return d3.sum(v.values());
    const pesoInd = indicadorPeso(ind);
    const w = pesoInd ? valores(pesoInd, anio, pesoInd === ind ? des : "total", pesoInd === ind ? cat : "Total") : new Map();
    let num = 0, den = 0;
    for (const [cod, x] of v) {
      const p = w.get(cod) ?? (w.size ? 0 : 1);
      num += x * p; den += p;
    }
    return den ? num / den : null;
  }

  return {raw, geo, filas, deptos, catalogo, info, valores, anios, serie, desagregaciones, nacional, esAditiva, demo: !!raw.demo, generado: raw.generado};
}

export const NOMBRES_DESAG = {
  sector: "Sector de la IES", naturaleza: "Naturaleza del colegio o IES", modalidad: "Modalidad",
  nivel_academico: "Nivel académico", nivel_formacion: "Nivel de formación", sexo: "Sexo",
  zona: "Zona", estrato: "Estrato", tecnologia: "Tecnología", segmento: "Segmento",
};

export const ORDEN_DIM = ["Redistribución", "Reconocimiento", "Representación"];
