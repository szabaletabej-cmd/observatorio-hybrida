import * as Plot from "@observablehq/plot";
import * as d3 from "d3";
import {formatear} from "./datos.js";

export const oscuro = () =>
  document.documentElement.dataset.theme === "dark" ||
  (document.documentElement.dataset.theme !== "light" && matchMedia("(prefers-color-scheme: dark)").matches);

// Paleta de referencia (validada): categórica, secuencial azul, divergente azul–rojo
export function paleta() {
  const d = oscuro();
  return {
    serie: d ? ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"]
             : ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"],
    secuencial: d ? ["#184f95", "#256abf", "#3987e5", "#6da7ec", "#9ec5f4"]
                  : ["#b7d3f6", "#86b6ef", "#5598e7", "#2a78d6", "#1c5cab"],
    divergente: d ? ["#e66767", "#8e4a49", "#383835", "#3d6aa3", "#6da7ec"]
                  : ["#c43a39", "#ec9a99", "#f0efec", "#86b6ef", "#1c5cab"],
    suave: d ? "#256abf" : "#9ec5f4",
    fuerte: d ? "#9ec5f4" : "#1c5cab",
    gris: d ? "#383835" : "#d6d5cf",
    sinDato: d ? "#232322" : "#ecebe6",
    superficie: d ? "#1a1a19" : "#fcfcfb",
    tinta: d ? "#f0efec" : "#0b0b0b",
    tinta2: d ? "#c3c2b7" : "#52514e",
    tinta3: "#898781",
    eje: d ? "#383835" : "#c3c2b7",
  };
}

const base = () => {
  const p = paleta();
  return {
    style: {fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif", fontSize: "12px", color: p.tinta2, background: "transparent", overflow: "visible"},
  };
};

const numLocal = d3.formatLocale({decimal: ",", thousands: ".", grouping: [3]});
// Formato de eje: la unidad va en el título del gráfico, no en cada marca
export function ejeFmt(info) {
  if (info.unidad === "personas" || info.unidad === "accesos") return (v) => formatear(v, info.unidad, {corto: true});
  if (info.unidad === "%") return (v) => numLocal.format(",~f")(v) + " %";
  return numLocal.format(",~f");
}

const esBrecha = (info) => /brecha/.test(info.indicador) || info.unidad === "puntos %";

function escalaColor(info, vals) {
  const p = paleta();
  const ext = d3.extent(vals);
  if (esBrecha(info)) {
    const m = d3.max(vals, Math.abs) || 1;
    return {type: "quantize", domain: [-m, m], range: p.divergente, unknown: p.sinDato};
  }
  if (info.unidad === "personas" || info.unidad === "accesos")
    return {type: "quantile", domain: vals, n: 5, range: p.secuencial, unknown: p.sinDato};
  return {type: "quantize", domain: ext[0] === ext[1] ? [ext[0] - 1, ext[1] + 1] : ext, range: p.secuencial, unknown: p.sinDato, nice: true};
}

function leyenda(color, info, ancho = 260) {
  const p = paleta();
  const num = d3.formatLocale({decimal: ",", thousands: ".", grouping: [3]});
  const ext = d3.max(color.domain) - d3.min(color.domain);
  const fmt = info.unidad === "personas" || info.unidad === "accesos"
    ? (v) => formatear(v, info.unidad, {corto: true})
    : num.format(ext >= 20 ? ",.0f" : ",.1f");
  const cont = document.createElement("div");
  cont.style.marginTop = "6px";
  cont.append(Plot.legend({
    color: {...color, legend: "ramp", label: null, tickFormat: fmt},
    width: ancho, height: 44, marginTop: 6, marginLeft: 8, marginRight: 14,
    style: {background: "transparent", color: p.tinta2, fontSize: "11px", fontFamily: "system-ui"},
  }));
  const u = document.createElement("p");
  u.className = "nota";
  u.style.marginTop = "0";
  u.textContent = `Unidad: ${info.unidad}`;
  cont.append(u);
  return cont;
}

// ---------- Mapa coroplético con San Andrés en recuadro ----------
export function mapa({geo, valores, info, deptos, width, altura, seleccion, alElegir, compacto = false}) {
  const p = paleta();
  const feats = geo.features;
  const continente = {type: "FeatureCollection", features: feats.filter((f) => f.properties.cod !== "88")};
  const islas = {type: "FeatureCollection", features: feats.filter((f) => f.properties.cod === "88")};
  const vals = [...valores.values()].filter((v) => v != null);
  const color = escalaColor(info, vals);
  const h = altura ?? Math.round(width * 1.18);
  const valor = (f) => valores.get(f.properties.cod) ?? null;

  const capas = (features, conTip) => [
    Plot.geo(features, {fill: (f) => valor(f), stroke: p.superficie, strokeWidth: compacto ? 0.6 : 0.9}),
    seleccion ? Plot.geo(features.filter((f) => f.properties.cod === seleccion), {stroke: p.tinta, strokeWidth: 2}) : null,
    conTip
      ? Plot.tip(features, Plot.pointer(Plot.geoCentroid({
          title: (f) => `${formatear(valor(f), info.unidad)}\n${deptos[f.properties.cod]}`,
          fill: p.superficie, stroke: p.eje,
        })))
      : null,
  ];

  const principal = Plot.plot({
    ...base(), width, height: h, margin: 2,
    projection: {type: "mercator", domain: continente},
    color,
    marks: capas(continente.features, true),
  });
  const cont = document.createElement("div");
  cont.className = "mapa";
  cont.append(principal);

  // San Andrés: el límite oficial incluye zona marítima; se muestra como marcador
  const cod88 = islas.features[0];
  const tam = compacto ? 34 : 44;
  const inset = Plot.plot({
    ...base(), width: tam, height: tam, margin: 0, x: {axis: null, domain: [0, 1]}, y: {axis: null, domain: [0, 1]},
    color,
    marks: cod88 ? [
      Plot.dot([cod88], {x: () => 0.5, y: () => 0.5, r: compacto ? 9 : 12, fill: (f) => valor(f), stroke: seleccion === "88" ? p.tinta : p.superficie, strokeWidth: 2}),
      Plot.tip([cod88], Plot.pointer({x: () => 0.5, y: () => 0.5, fill: p.superficie, maxRadius: 30,
        title: (f) => `${formatear(valor(f), info.unidad)}\n${deptos["88"]}`})),
    ] : [],
  });
  const caja = document.createElement("div");
  caja.className = "mapa-inset";
  caja.append(inset);
  const s = document.createElement("span");
  s.textContent = compacto ? "S. Andrés" : "San Andrés";
  caja.append(s);
  cont.append(caja);

  if (alElegir) {
    for (const pl of [principal, inset]) {
      pl.style.cursor = "pointer";
      pl.addEventListener("click", () => pl.value && alElegir(pl.value.properties?.cod ?? "88"));
    }
  }
  const envoltura = document.createElement("div");
  envoltura.append(cont, leyenda(color, info, Math.min(compacto ? 200 : 280, width - 10)));
  const sinDato = feats.filter((f) => valor(f) == null).length;
  if (sinDato) {
    const n = document.createElement("p");
    n.className = "nota";
    n.textContent = `${sinDato} ${sinDato === 1 ? "departamento" : "departamentos"} sin dato (gris claro).`;
    envoltura.append(n);
  }
  return envoltura;
}

// ---------- Ranking de departamentos ----------
export function ranking({valores, info, deptos, width, seleccion, alElegir}) {
  const p = paleta();
  const datos = [...valores].filter(([, v]) => v != null).map(([cod, v]) => ({cod, depto: deptos[cod], v})).sort((a, b) => d3.descending(a.v, b.v));
  if (!datos.length) return vacio("Sin datos para este año.");
  const brecha = esBrecha(info);
  const pl = Plot.plot({
    ...base(), width, height: datos.length * 17 + 40, marginLeft: width < 400 ? 128 : 150, marginRight: width < 400 ? 56 : 70, marginTop: 24,
    x: {label: null, grid: true, tickFormat: ejeFmt(info), ticks: Math.max(2, Math.floor((width - 200) / 90)), axis: "top"},
    y: {label: null, domain: datos.map((d) => d.depto), tickSize: 0},
    marks: [
      Plot.gridX({stroke: p.gris, strokeOpacity: 1}),
      Plot.barX(datos, {
        x: "v", y: "depto", insetTop: 2.5, insetBottom: 2.5, rx: 3,
        fill: (d) => brecha
          ? (d.v < 0 ? p.divergente[d.cod === seleccion ? 0 : 1] : p.divergente[d.cod === seleccion ? 4 : 3])
          : (d.cod === seleccion ? p.fuerte : p.suave),
      }),
      Plot.ruleX([0], {stroke: p.tinta3}),
      // Valor junto al extremo positivo; si es negativo, al lado derecho del cero (zona libre)
      Plot.text(datos.filter((d) => d.cod === seleccion || d === datos[0] || (brecha && d === datos.at(-1))), {
        x: (d) => Math.max(0, d.v), y: "depto", text: (d) => formatear(d.v, info.unidad, {corto: true}),
        textAnchor: "start", dx: 6, fill: p.tinta, fontWeight: 600,
      }),
      Plot.tip(datos, Plot.pointerY({x: "v", y: "depto", title: (d) => `${formatear(d.v, info.unidad)}\n${d.depto}`, fill: p.superficie})),
    ],
  });
  if (alElegir) {
    pl.style.cursor = "pointer";
    pl.addEventListener("click", () => pl.value && alElegir(pl.value.cod));
  }
  return pl;
}

// ---------- Evolución: todos en gris, mediana y departamento elegido ----------
export function evolucion({D, ind, info, width, seleccion}) {
  const p = paleta();
  const anios = D.anios(ind);
  const todos = [];
  for (const cod of Object.keys(D.deptos)) for (const d of D.serie(ind, cod)) todos.push({...d, cod});
  if (!todos.length) return vacio("Sin datos.");
  const mediana = anios.map((anio) => ({anio, valor: d3.median(todos.filter((d) => d.anio === anio), (d) => d.valor)}));
  const elegido = seleccion ? todos.filter((d) => d.cod === seleccion) : [];
  const series = [{nombre: "Mediana departamental", color: p.tinta2}];
  if (seleccion) series.unshift({nombre: D.deptos[seleccion], color: p.serie[0]});
  const ultimo = (arr) => arr[arr.length - 1];

  const pl = Plot.plot({
    ...base(), width, height: 300, marginLeft: 56, marginRight: seleccion ? 120 : 40, marginTop: 16,
    x: {label: null, tickFormat: "d", ticks: anios.filter((a, i) => i % Math.ceil(anios.length / Math.max(2, Math.floor(width / 70))) === 0)},
    y: {label: null, grid: true, tickFormat: ejeFmt(info), nice: true},
    marks: [
      Plot.gridY({stroke: p.gris, strokeOpacity: 1}),
      esBrecha(info) ? Plot.ruleY([0], {stroke: p.tinta3}) : null,
      Plot.lineY(todos, {x: "anio", y: "valor", z: "cod", stroke: p.gris, strokeWidth: 1}),
      Plot.lineY(mediana, {x: "anio", y: "valor", stroke: p.tinta2, strokeWidth: 2}),
      Plot.lineY(elegido, {x: "anio", y: "valor", stroke: p.serie[0], strokeWidth: 2.5}),
      Plot.dot(elegido.length ? [ultimo(elegido)] : [], {x: "anio", y: "valor", r: 4.5, fill: p.serie[0], stroke: p.superficie, strokeWidth: 2}),
      Plot.text(elegido.length ? [ultimo(elegido)] : [], {x: "anio", y: "valor", text: (d) => formatear(d.valor, info.unidad, {corto: true}), dx: 9, textAnchor: "start", fill: p.tinta, fontWeight: 600}),
      Plot.ruleX(todos, Plot.pointerX({x: "anio", stroke: p.tinta3, strokeWidth: 1})),
      Plot.tip(anios.map((anio) => ({
        anio,
        med: mediana.find((m) => m.anio === anio)?.valor,
        sel: elegido.find((e) => e.anio === anio)?.valor,
      })), Plot.pointerX({
        x: "anio", y: (d) => d.sel ?? d.med, fill: p.superficie,
        title: (d) => `${d.anio}\n` + (seleccion ? `${formatear(d.sel, info.unidad)}  ${D.deptos[seleccion]}\n` : "") + `${formatear(d.med, info.unidad)}  mediana`,
      })),
    ],
  });
  return conLeyenda(pl, series, "Cada línea gris es un departamento.");
}

// ---------- Desagregación en el tiempo ----------
export function desagregacion({D, ind, info, des, cod, width}) {
  const p = paleta();
  const cats = (D.desagregaciones.get(ind)?.get(des) ?? []).filter((c) => !/^Sin /.test(c));
  if (!cats.length) return vacio("Este indicador no tiene esa desagregación.");
  const datos = [];
  for (const cat of cats) {
    for (const anio of D.anios(ind)) {
      const v = cod ? D.valores(ind, anio, des, cat).get(cod) : D.nacional(ind, anio, des, cat);
      if (v != null) datos.push({anio, cat, valor: v});
    }
  }
  if (!datos.length) return vacio("Sin datos para esta selección.");
  const colores = cats.map((_, i) => p.serie[i % 8]);
  const finales = cats.map((cat) => datos.filter((d) => d.cat === cat).at(-1)).filter(Boolean);
  const pl = Plot.plot({
    ...base(), width, height: 280, marginLeft: 56, marginRight: 30, marginTop: 16,
    x: {label: null, tickFormat: "d", ticks: [...new Set(datos.map((d) => d.anio))].filter((a, i, arr) => i % Math.ceil(arr.length / Math.max(2, Math.floor(width / 70))) === 0)},
    y: {label: null, grid: true, nice: true, tickFormat: ejeFmt(info)},
    color: {domain: cats, range: colores},
    marks: [
      Plot.gridY({stroke: p.gris, strokeOpacity: 1}),
      Plot.lineY(datos, {x: "anio", y: "valor", stroke: "cat", strokeWidth: 2}),
      Plot.dot(finales, {x: "anio", y: "valor", fill: "cat", r: 4, stroke: p.superficie, strokeWidth: 2}),
      Plot.ruleX(datos, Plot.pointerX({x: "anio", stroke: p.tinta3})),
      Plot.tip(d3.groups(datos, (d) => d.anio).map(([anio, v]) => ({anio, v})), Plot.pointerX({
        x: "anio", y: (d) => d3.max(d.v, (x) => x.valor), fill: p.superficie,
        title: (d) => `${d.anio}\n` + d.v.sort((a, b) => b.valor - a.valor).map((x) => `${formatear(x.valor, info.unidad)}  ${x.cat}`).join("\n"),
      })),
    ],
  });
  return conLeyenda(pl, cats.map((c, i) => ({nombre: c, color: colores[i]})));
}

// ---------- Dispersión para cruces ----------
export function dispersion({X, Y, infoX, infoY, deptos, width, seleccion, alElegir}) {
  const p = paleta();
  const datos = [...X].filter(([cod, x]) => x != null && Y.get(cod) != null).map(([cod, x]) => ({cod, depto: deptos[cod], x, y: Y.get(cod)}));
  if (datos.length < 3) return {nodo: vacio("No hay suficientes departamentos con ambos datos en este año."), r: null, n: datos.length};
  const r = pearson(datos.map((d) => d.x), datos.map((d) => d.y));
  const etiquetados = datos.filter((d) => d.cod === seleccion);
  const pl = Plot.plot({
    ...base(), width, height: Math.min(520, Math.max(340, width * 0.62)), marginLeft: 64, marginBottom: 44, marginTop: 30, marginRight: 24,
    x: {label: `${infoX.nombre} →`, grid: true, nice: true, tickFormat: ejeFmt(infoX), labelArrow: "none"},
    y: {label: `↑ ${infoY.nombre}`, grid: true, nice: true, tickFormat: ejeFmt(infoY), labelArrow: "none"},
    marks: [
      Plot.gridX({stroke: p.gris, strokeOpacity: 1}),
      Plot.gridY({stroke: p.gris, strokeOpacity: 1}),
      Plot.linearRegressionY(datos, {x: "x", y: "y", stroke: p.tinta3, strokeWidth: 1.5, ci: 0}),
      Plot.dot(datos, {x: "x", y: "y", r: 6, fill: (d) => (d.cod === seleccion ? p.serie[1] : p.serie[0]), fillOpacity: 0.9, stroke: p.superficie, strokeWidth: 2}),
      Plot.text(etiquetados, {x: "x", y: "y", text: "depto", dy: -14, fill: p.tinta, fontWeight: 600}),
      Plot.tip(datos, Plot.pointer({
        x: "x", y: "y", fill: p.superficie, maxRadius: 30,
        title: (d) => `${d.depto}\n${formatear(d.x, infoX.unidad)}  ${infoX.nombre}\n${formatear(d.y, infoY.unidad)}  ${infoY.nombre}`,
      })),
    ],
  });
  if (alElegir) {
    pl.style.cursor = "pointer";
    pl.addEventListener("click", () => pl.value && alElegir(pl.value.cod));
  }
  return {nodo: pl, r, n: datos.length};
}

// ---------- Matriz de correlaciones ----------
export function matrizCorrelacion({D, anio, inds, width, alElegir}) {
  const p = paleta();
  const vecs = inds.map((ind) => ({ind, v: D.valores(ind, anio)}));
  const celdas = [];
  for (const a of vecs) for (const b of vecs) {
    const comunes = [...a.v.keys()].filter((c) => a.v.get(c) != null && b.v.get(c) != null);
    const r = comunes.length >= 8 ? pearson(comunes.map((c) => a.v.get(c)), comunes.map((c) => b.v.get(c))) : null;
    celdas.push({a: a.ind, b: b.ind, r, n: comunes.length});
  }
  const recorte = (k) => (ind) => {
    const n = D.info.get(ind)?.nombre ?? ind;
    return n.length > k ? n.slice(0, k - 1) + "…" : n;
  };
  const corto = recorte(38);
  const lado = Math.max(12, Math.min(22, Math.floor((width - 250) / inds.length)));
  const pl = Plot.plot({
    ...base(), width: 250 + lado * inds.length + 10, height: 40 + lado * inds.length + 150,
    marginLeft: 250, marginBottom: 160, marginTop: 10, padding: 0.06,
    x: {domain: inds, tickFormat: recorte(26), tickRotate: -55, label: null, tickSize: 0},
    y: {domain: inds, tickFormat: corto, label: null, tickSize: 0},
    color: {type: "linear", domain: [-1, 1], range: p.divergente, interpolate: "rgb", unknown: p.sinDato},
    marks: [
      Plot.cell(celdas, {x: "a", y: "b", fill: "r", rx: 2}),
      Plot.tip(celdas, Plot.pointer({
        x: "a", y: "b", fill: p.superficie,
        title: (d) => (d.r == null ? "sin datos suficientes" : `r = ${d.r.toFixed(2).replace(".", ",")}`) + `\n${D.info.get(d.a)?.nombre}\n${D.info.get(d.b)?.nombre}\n${d.n} departamentos`,
      })),
    ],
  });
  if (alElegir) {
    pl.style.cursor = "pointer";
    pl.addEventListener("click", () => pl.value && pl.value.a !== pl.value.b && alElegir(pl.value.a, pl.value.b));
  }
  const cont = document.createElement("div");
  cont.style.overflowX = "auto";
  const ley = Plot.legend({
    color: {type: "linear", domain: [-1, 1], range: p.divergente, interpolate: "rgb", label: null, tickFormat: (v) => String(v).replace(".", ",")},
    width: 260, height: 44, marginTop: 6, marginLeft: 8, marginRight: 14, ticks: 5,
    style: {background: "transparent", color: p.tinta2, fontSize: "11px"},
  });
  cont.append(ley, pl);
  return cont;
}

// ---------- utilidades ----------
export function pearson(x, y) {
  const mx = d3.mean(x), my = d3.mean(y);
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < x.length; i++) {
    sxy += (x[i] - mx) * (y[i] - my);
    sxx += (x[i] - mx) ** 2;
    syy += (y[i] - my) ** 2;
  }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : null;
}

function conLeyenda(nodo, series, nota) {
  const cont = document.createElement("div");
  const ley = document.createElement("div");
  ley.style.cssText = "display:flex;flex-wrap:wrap;gap:4px 16px;font-size:12.5px;color:var(--tinta-2);margin-bottom:6px";
  for (const s of series) {
    const it = document.createElement("span");
    it.style.cssText = "display:inline-flex;align-items:center;gap:6px";
    const k = document.createElement("span");
    k.style.cssText = `display:inline-block;width:16px;height:2.5px;border-radius:2px;background:${s.color}`;
    const t = document.createElement("span");
    t.textContent = s.nombre;
    it.append(k, t);
    ley.append(it);
  }
  if (nota) {
    const n = document.createElement("span");
    n.style.color = "var(--tinta-3)";
    n.textContent = nota;
    ley.append(n);
  }
  cont.append(ley, nodo);
  return cont;
}

export function vacio(texto) {
  const p = document.createElement("p");
  p.className = "vacio";
  p.textContent = texto;
  return p;
}
