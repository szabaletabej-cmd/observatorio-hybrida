// Vista general de la matrícula en educación superior (SNIES), con el lenguaje visual
// de las maquetas del equipo de diseño: tarjetas de mujeres/hombres, donas, barras redondeadas
// y líneas suaves. Todo con datos reales y filtros de año y departamento.
import * as Plot from "@observablehq/plot";
import * as d3 from "d3";
import {formatear, signoPct} from "./datos.js";
import {paleta, mapa} from "./graficos.js";
import {botonImagen} from "./extras.js";

const IND = "snies_matriculados";
const ORDEN_NIVEL = ["Técnica profesional", "Tecnológica", "Universitaria", "Especialización", "Maestría", "Doctorado"];
const FUENTE_SNIES = "https://snies.mineducacion.gov.co/portal/ESTADISTICAS/Bases-consolidadas/";

function el(tag, attrs = {}, ...hijos) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "class") n.className = v;
    else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v);
  }
  for (const h of hijos.flat()) if (h != null) n.append(h instanceof Node ? h : document.createTextNode(String(h)));
  return n;
}

const fuente = (texto) => el("p", {class: "vg-fuente"}, el("strong", {}, "Fuente: "), texto);

function tarjeta(titulo, nombreImg, ...contenido) {
  const t = el("section", {class: "vg-card"});
  t.append(el("div", {class: "vg-card-cab"}, el("h3", {}, titulo), botonImagen(t, nombreImg)), ...contenido);
  return t;
}

// Valor de un desagregado para Colombia (suma) o un departamento
function valor(D, ind, anio, dep, des = "total", cat = "Total") {
  if (!dep) return D.nacional(ind, anio, des, cat);
  return D.valores(ind, anio, des, cat).get(dep) ?? null;
}

// ---------- piezas ----------
function icono(tipo) {
  const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  s.setAttribute("viewBox", "0 0 32 32");
  s.setAttribute("width", "30"); s.setAttribute("height", "30"); s.setAttribute("aria-hidden", "true");
  s.setAttribute("fill", "none"); s.setAttribute("stroke", "currentColor"); s.setAttribute("stroke-width", "2"); s.setAttribute("stroke-linecap", "round"); s.setAttribute("stroke-linejoin", "round");
  s.innerHTML = tipo === "mujer"
    ? '<circle cx="16" cy="12" r="6"/><path d="M10 12c0-6 3-8 6-8s6 2 6 8v6M10 12v6"/><path d="M7 28c1-5 4.5-7 9-7s8 2 9 7"/>'
    : '<circle cx="16" cy="12" r="6.5"/><path d="M9.5 11c2 0 5-1 6.5-4 1.5 3 4.5 4 6.5 4"/><path d="M7 28c1-5 4.5-7 9-7s8 2 9 7"/>';
  return s;
}

function kpiSexo(tipo, n, pct, anio) {
  return el("div", {class: `vg-kpi vg-kpi-${tipo}`},
    el("div", {class: "vg-kpi-ico"}, icono(tipo)),
    el("div", {class: "vg-kpi-txt"},
      el("div", {class: "vg-kpi-num"}, formatear(n, "personas")),
      el("div", {class: "vg-kpi-etq"}, `${tipo === "mujer" ? "Mujeres" : "Hombres"} · ${pct == null ? "" : formatear(pct, "%")} · ${anio}`)));
}

function dona(pct, etiqueta) {
  const p = paleta();
  const r = 44, c = 2 * Math.PI * r, v = Math.max(0, Math.min(100, pct ?? 0));
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 120 120");
  svg.setAttribute("width", "104"); svg.setAttribute("height", "104");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", `${etiqueta}: ${formatear(pct, "%")}`);
  svg.innerHTML = `<circle cx="60" cy="60" r="${r}" fill="none" stroke="${p.donaFondo}" stroke-width="14"/>
    <circle cx="60" cy="60" r="${r}" fill="none" stroke="${p.dona}" stroke-width="14" stroke-linecap="round"
      stroke-dasharray="${(c * v) / 100} ${c}" transform="rotate(-90 60 60)"/>
    <text x="60" y="66" text-anchor="middle" font-family="Poppins, system-ui" font-weight="600" font-size="19" fill="${p.titulo}">${pct == null ? "–" : d3.format(".0f")(pct)}%</text>`;
  return el("figure", {class: "vg-dona"}, svg, el("figcaption", {}, etiqueta));
}

function lineaTotal(D, dep, width) {
  const p = paleta();
  const datos = D.anios(IND).map((a) => ({anio: a, v: valor(D, IND, a, dep)})).filter((d) => d.v != null);
  return Plot.plot({
    width, height: 210, marginLeft: 52, marginRight: 16, marginTop: 14, marginBottom: 28,
    style: {fontFamily: "Roboto, system-ui, sans-serif", fontSize: "12px", color: p.tinta2, background: "transparent", overflow: "visible"},
    x: {label: null, tickFormat: "d", ticks: datos.map((d) => d.anio).filter((a, i) => i % 2 === 0)},
    y: {label: null, grid: true, nice: true, zero: false, tickFormat: (v) => formatear(v, "personas", {corto: true}), ticks: 4},
    marks: [
      Plot.areaY(datos, {x: "anio", y: "v", curve: "catmull-rom", fill: p.serie2[0], fillOpacity: 0.1}),
      Plot.lineY(datos, {x: "anio", y: "v", curve: "catmull-rom", stroke: p.serie2[0], strokeWidth: 2.5}),
      Plot.dot(datos.slice(-1), {x: "anio", y: "v", r: 5, fill: p.serie2[0], stroke: p.superficie, strokeWidth: 2}),
      Plot.ruleX(datos, Plot.pointerX({x: "anio", stroke: p.eje})),
      Plot.tip(datos, Plot.pointerX({x: "anio", y: "v", title: (d) => `${d.anio}\n${formatear(d.v, "personas")} matriculados`})),
    ],
  });
}

function barrasNivel(D, anio, dep, width) {
  const p = paleta();
  const tot = valor(D, IND, anio, dep);
  const datos = ORDEN_NIVEL.map((c) => ({c, v: valor(D, IND, anio, dep, "nivel_formacion", c)}))
    .filter((d) => d.v != null && d.v > 0).map((d) => ({...d, pct: tot ? (100 * d.v) / tot : null}));
  return Plot.plot({
    width, height: 36 + datos.length * 34, marginLeft: 128, marginRight: 70, marginTop: 4, marginBottom: 4,
    style: {fontFamily: "Roboto, system-ui, sans-serif", fontSize: "12.5px", color: p.tinta2, background: "transparent", overflow: "visible"},
    x: {axis: null}, y: {label: null, domain: datos.map((d) => d.c), tickSize: 0},
    marks: [
      Plot.barX(datos, {y: "c", x: "v", fill: (d) => (["Técnica profesional", "Tecnológica", "Universitaria"].includes(d.c) ? p.barra : p.barra2), rx: 5, insetTop: 6, insetBottom: 6,
        title: (d) => `${d.c}\n${formatear(d.v, "personas")} (${formatear(d.pct, "%")})`}),
      Plot.text(datos, {y: "c", x: "v", text: (d) => formatear(d.pct, "%"), dx: 8, textAnchor: "start", fill: p.tinta, fontWeight: 600}),
    ],
  });
}

function lineasSector(D, dep, width) {
  const p = paleta();
  const filas = [];
  for (const a of D.anios(IND)) {
    const tot = valor(D, IND, a, dep);
    for (const [cat, nombre] of [["Oficial", "IES oficiales"], ["Privado", "IES privadas"]]) {
      const v = valor(D, IND, a, dep, "sector", cat);
      if (tot && v != null) filas.push({anio: a, s: nombre, pct: (100 * v) / tot});
    }
  }
  const ult = d3.rollups(filas, (v) => v.at(-1), (d) => d.s).map((x) => x[1]);
  return Plot.plot({
    width, height: 220, marginLeft: 40, marginRight: 96, marginTop: 14, marginBottom: 28,
    style: {fontFamily: "Roboto, system-ui, sans-serif", fontSize: "12px", color: p.tinta2, background: "transparent", overflow: "visible"},
    x: {label: null, tickFormat: "d", ticks: D.anios(IND).filter((a, i) => i % 2 === 0)},
    y: {label: null, grid: true, domain: [0, 100], ticks: 5, tickFormat: (v) => `${v} %`},
    color: {domain: ["IES oficiales", "IES privadas"], range: p.serie2},
    marks: [
      Plot.lineY(filas, {x: "anio", y: "pct", stroke: "s", curve: "catmull-rom", strokeWidth: 2.5}),
      Plot.text(ult, {x: "anio", y: "pct", text: (d) => `${d.s} ${d3.format(".0f")(d.pct)} %`, dx: 8, textAnchor: "start", fill: p.tinta2, fontWeight: 500}),
      Plot.ruleX(filas, Plot.pointerX({x: "anio", stroke: p.eje})),
      Plot.tip(filas, Plot.pointerX({x: "anio", y: "pct", title: (d) => `${d.anio} · ${d.s}\n${formatear(d.pct, "%")} de la matrícula`})),
    ],
  });
}

function barrasTop(D, anio, dep, width, alElegir) {
  const p = paleta();
  const vals = [...D.valores(IND, anio)].filter(([, v]) => v != null);
  const tot = d3.sum(vals, (d) => d[1]);
  let datos = vals.sort((a, b) => b[1] - a[1]).map(([cod, v], i) => ({cod, n: D.deptos[cod], v, pct: (100 * v) / tot, pos: i + 1}));
  const top = datos.slice(0, 10);
  if (dep && !top.some((d) => d.cod === dep)) top.push(datos.find((d) => d.cod === dep));
  datos = top.filter(Boolean);
  const plot = Plot.plot({
    width, height: 30 + datos.length * 32, marginLeft: 150, marginRight: 64, marginTop: 4, marginBottom: 4,
    style: {fontFamily: "Roboto, system-ui, sans-serif", fontSize: "12.5px", color: p.tinta2, background: "transparent", overflow: "visible"},
    x: {axis: null}, y: {label: null, domain: datos.map((d) => d.n), tickSize: 0, tickFormat: (n) => { const d = datos.find((x) => x.n === n); return `${d.pos}. ${n}`; }},
    marks: [
      Plot.barX(datos, {y: "n", x: "v", fill: (d) => (d.cod === dep ? p.seleccion : p.barra), rx: 5, insetTop: 6, insetBottom: 6,
        title: (d) => `${d.n}\n${formatear(d.v, "personas")} matriculados (${formatear(d.pct, "%")} del país)`}),
      Plot.text(datos, {y: "n", x: "v", text: (d) => formatear(d.pct, "%"), dx: 8, textAnchor: "start", fill: p.tinta, fontWeight: 600}),
    ],
  });
  plot.querySelectorAll("[aria-label='bar'] rect").forEach((r, i) => { r.style.cursor = "pointer"; r.addEventListener("click", () => alElegir(datos[i].cod)); });
  return plot;
}

function descargarBD(D, dep) {
  const filas = D.filas.filter((f) => f.ind.startsWith("snies_") && (!dep || f.cod === dep));
  const cab = "anio;cod_depto;departamento;indicador;desagregacion;categoria;valor";
  const txt = [cab, ...filas.map((f) => [f.anio, f.cod, D.deptos[f.cod], f.ind, f.des, f.cat, String(f.valor).replace(".", ",")].join(";"))].join("\n");
  const a = el("a", {href: URL.createObjectURL(new Blob(["﻿" + txt], {type: "text/csv;charset=utf-8"})), download: `observatorio-hybrida-snies-${dep ? D.deptos[dep] : "colombia"}.csv`});
  a.click();
}

// ---------- vista ----------
export function vistaGeneral(main, {D, estado, render}) {
  const anios = D.anios(IND);
  const anio = anios.includes(estado.anioGeneral) ? estado.anioGeneral : anios.at(-1);
  const dep = estado.dep;
  const lugar = dep ? D.deptos[dep] : "Colombia";
  const a0 = anios[0];
  const tot = valor(D, IND, anio, dep), tot0 = valor(D, IND, a0, dep);
  const mujeres = valor(D, IND, anio, dep, "sexo", "Mujer");
  const hombres = valor(D, IND, anio, dep, "sexo", "Hombre");
  const sel = (etq, opciones, v, alCambiar) => el("label", {class: "vg-filtro"}, el("span", {}, etq),
    el("select", {onchange: (e) => alCambiar(e.target.value)}, opciones.map((o) => el("option", {value: o.v, selected: o.v === v ? "" : null}, o.t))));

  // Franja de título y filtros
  main.append(el("section", {class: "vg-banda"},
    el("div", {class: "vg-banda-tit"}, el("h1", {}, "Vista general y tendencias"), el("p", {}, `${a0} – ${anios.at(-1)}`)),
    el("div", {class: "vg-banda-filtros"},
      sel("Año", anios.slice().reverse().map((a) => ({v: String(a), t: String(a)})), String(anio), (v) => ((estado.anioGeneral = +v), render())),
      sel("Departamento", [{v: "", t: "Colombia"}, ...Object.entries(D.deptos).sort((x, y) => x[1].localeCompare(y[1], "es")).map(([c, n]) => ({v: c, t: n}))], dep, (v) => ((estado.dep = v), render())),
      el("button", {class: "vg-boton-banda", type: "button", onclick: () => descargarBD(D, dep)}, "Descargar BD"))));

  // Portada con cifra principal, tendencia y mujeres/hombres
  const cambio = tot != null && tot0 ? 100 * (tot / tot0 - 1) : null;
  const cLinea = el("div", {class: "vg-portada-graf"});
  const portada = el("section", {class: "vg-portada"},
    el("div", {class: "vg-portada-txt"},
      el("h2", {class: "vg-titulo"}, "Matriculados SNIES"),
      el("p", {class: "vg-periodo"}, `${a0} – ${anio}`),
      el("p", {class: "vg-resumen"},
        `En ${anio} hubo `, el("strong", {}, `${formatear(tot, "personas")} matriculados`), ` en educación superior en `, el("strong", {}, lugar),
        cambio == null ? "." : [", ", el("strong", {}, signoPct(Math.abs(cambio)).replace("+", "")), ` ${cambio >= 0 ? "más" : "menos"} que en ${a0}.`]),
      el("div", {class: "vg-kpis"}, kpiSexo("mujer", mujeres, tot ? (100 * mujeres) / tot : null, anio), kpiSexo("hombre", hombres, tot ? (100 * hombres) / tot : null, anio)),
      el("a", {class: "vg-boton", href: FUENTE_SNIES, target: "_blank", rel: "noopener"}, "Ir a la fuente")),
    el("div", {class: "vg-portada-der"}, el("h3", {}, `Evolución de la matrícula · ${lugar}`), cLinea, fuente("SNIES – Ministerio de Educación Nacional.")));
  main.append(portada);
  cLinea.append(lineaTotal(D, dep, Math.max(280, cLinea.clientWidth || 520)));

  // Composición, niveles y sector
  const fila = el("div", {class: "vg-fila"});
  main.append(fila);
  const donas = el("div", {class: "vg-donas"},
    dona(valor(D, "snies_pct_oficial", anio, dep), "En IES oficiales"),
    dona(valor(D, "snies_pct_mujeres", anio, dep), "Mujeres"),
    dona(valor(D, "snies_pct_virtual_distancia", anio, dep), "Virtual y a distancia"));
  fila.append(tarjeta(`Composición de la matrícula, ${anio}`, `composicion ${lugar} ${anio}`, donas, fuente("SNIES. Porcentaje del total de matriculados.")));
  const cNivel = el("div");
  const tNivel = tarjeta(`Matriculados por nivel de formación, ${anio}`, `nivel ${lugar} ${anio}`, cNivel, fuente("SNIES. Pregrado en azul oscuro, posgrado en azul claro."));
  fila.append(tNivel);
  cNivel.append(barrasNivel(D, anio, dep, Math.max(260, tNivel.clientWidth - 36)));
  const cSector = el("div");
  const tSector = tarjeta("Oficiales y privadas a lo largo de los años", `sector ${lugar}`, cSector, fuente("SNIES. Participación en la matrícula total."));
  fila.append(tSector);
  cSector.append(lineasSector(D, dep, Math.max(260, tSector.clientWidth - 36)));

  // Geografía: mapa + departamentos con más matriculados
  const info = D.info.get(IND);
  const geo = el("div", {class: "vg-fila vg-fila-2"});
  main.append(geo);
  const cMapa = el("div", {class: "vg-mapa-cont"});
  const tMapa = tarjeta(`Matriculados por departamento, ${anio}`, `mapa ${anio}`, cMapa, fuente("SNIES. Departamento donde se ofrece el programa. Haz clic para filtrar."));
  geo.append(tMapa);
  cMapa.append(mapa({geo: D.geo, valores: D.valores(IND, anio), info, deptos: D.deptos, width: Math.min(430, tMapa.clientWidth - 36), seleccion: dep,
    alElegir: (cod) => ((estado.dep = estado.dep === cod ? "" : cod), render())}));
  const cTop = el("div");
  const tTop = tarjeta(`Departamentos con más matriculados, ${anio}`, `top departamentos ${anio}`, cTop, fuente("SNIES. Porcentaje de la matrícula nacional."));
  geo.append(tTop);
  cTop.append(barrasTop(D, anio, dep, Math.max(260, tTop.clientWidth - 36), (cod) => ((estado.dep = estado.dep === cod ? "" : cod), render())));
}
