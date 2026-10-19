import "@fontsource/poppins/latin-500.css";
import "@fontsource/poppins/latin-600.css";
import "@fontsource/source-sans-3/latin-400.css";
import "@fontsource/source-sans-3/latin-600.css";
import "@fontsource/source-sans-3/latin-700.css";
import "./estilos.css";
import * as d3 from "d3";
import {cargarDatos, formatear, signoPct, NOMBRES_DESAG, ORDEN_DIM} from "./datos.js";
import {mapa, ranking, evolucion, desagregacion, dispersion, matrizCorrelacion, vacio, paleta} from "./graficos.js";
import {GRUPOS, GUIA, FUENTES, RECOLECCION} from "./guia.js";
import {botonImagen, crearBuscador, recorrido, recorridoPrimeraVez} from "./extras.js";

const VISTAS = [
  {ruta: "esencial", nombre: "Lo esencial"},
  {ruta: "panorama", nombre: "Panorama"},
  {ruta: "redistribucion", nombre: "Redistribución", dim: "Redistribución"},
  {ruta: "reconocimiento", nombre: "Reconocimiento", dim: "Reconocimiento"},
  {ruta: "representacion", nombre: "Representación", dim: "Representación"},
  {ruta: "cruces", nombre: "Cruces"},
  {ruta: "metodologia", nombre: "Metodología"},
];

const BAJADAS = {
  "Redistribución": "Acceso material a la educación y a la conectividad: quién llega a la educación superior, en qué condiciones y con qué recursos en el hogar.",
  "Reconocimiento": "Resultados y valoración de los aprendizajes: cómo se distribuyen los puntajes de las pruebas de Estado y la graduación entre territorios.",
  "Representación": "Quién está presente y con qué peso en el sistema: participación de mujeres y otros grupos en la matrícula.",
};

const PANORAMA_MAPAS = ["snies_pct_virtual_distancia", "s11_punt_global_prom", "s11_pct_internet_hogar", "mintic_pct_fibra"];
const PANORAMA_DATOS = ["snies_matriculados", "s11_evaluados", "mintic_accesos_internet_fijo", "s11_pct_internet_hogar"];

let D;
const estado = {anio: null, dep: "", ind: {}, des: {}, x: null, y: null, anioCruce: null};

// ---------- utilidades de DOM ----------
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

function selector({etiqueta, opciones, valor, alCambiar, ancho = false}) {
  const s = el("select", {onchange: (e) => alCambiar(e.target.value)});
  for (const o of opciones) {
    if (o.grupo) {
      const g = el("optgroup", {label: o.grupo});
      for (const x of o.opciones) g.append(el("option", {value: x.valor, selected: x.valor === valor ? "" : null}, x.texto));
      s.append(g);
    } else s.append(el("option", {value: o.valor, selected: o.valor === valor ? "" : null}, o.texto));
  }
  return el("div", {class: "filtro" + (ancho ? " filtro-ancho" : "")}, el("label", {}, etiqueta), s);
}

function deslizadorAnio({anios, valor, alCambiar}) {
  const salida = el("output", {}, valor);
  const r = el("input", {type: "range", min: anios[0], max: anios.at(-1), step: 1, value: valor, "aria-label": "Año"});
  r.addEventListener("input", (e) => (salida.textContent = e.target.value));
  r.addEventListener("change", (e) => alCambiar(+e.target.value));
  return el("div", {class: "filtro"}, el("label", {}, "Año"), el("div", {class: "anio"}, r, salida));
}

function opcionesDeptos() {
  return [{valor: "", texto: "Ninguno"}, ...Object.entries(D.deptos).sort((a, b) => a[1].localeCompare(b[1], "es")).map(([c, n]) => ({valor: c, texto: n}))];
}

function opcionesIndicadores(dim) {
  const grupos = ORDEN_DIM.filter((g) => !dim || g === dim).map((g) => ({
    grupo: g,
    opciones: D.catalogo.filter((c) => c.dimension === g).map((c) => ({valor: c.indicador, texto: c.nombre})),
  })).filter((g) => g.opciones.length);
  return dim ? grupos[0]?.opciones ?? [] : grupos;
}

const anchoDe = (n) => Math.max(260, n.clientWidth - 36);

function tarjeta(titulo, sub, ...contenido) {
  const t = el("section", {class: "tarjeta"});
  t.append(el("div", {class: "tarjeta-cab"}, el("div", {}, el("h2", {}, titulo), sub ? el("p", {}, sub) : null),
    botonImagen(t, [titulo, estado.contextoImg].filter(Boolean).join(" ")) ), ...contenido);
  return t;
}

function tablaDatos(cols, filas, nombreArchivo) {
  const t = el("table", {},
    el("thead", {}, el("tr", {}, cols.map((c) => el("th", {class: c.num ? "num" : null}, c.titulo)))),
    el("tbody", {}, filas.map((f) => el("tr", {}, cols.map((c) => el("td", {class: c.num ? "num" : null}, c.formato ? c.formato(f[c.clave]) : f[c.clave]))))));
  const csv = () => {
    const txt = [cols.map((c) => c.titulo).join(";"), ...filas.map((f) => cols.map((c) => {
      const v = f[c.clave];
      return typeof v === "number" ? String(v).replace(".", ",") : `"${String(v ?? "").replace(/"/g, '""')}"`;
    }).join(";"))].join("\n");
    const a = el("a", {href: URL.createObjectURL(new Blob(["﻿" + txt], {type: "text/csv;charset=utf-8"})), download: nombreArchivo});
    a.click();
  };
  return el("details", {class: "tabla"},
    el("summary", {}, "Ver tabla de datos"),
    el("div", {style: "margin-top:8px"}, el("button", {class: "boton", onclick: csv}, "Descargar CSV")),
    el("div", {class: "tabla-cont"}, t));
}

// ---------- vistas ----------
function cambioTexto(v, v0, unidad) {
  if (v == null || v0 == null) return "";
  if (unidad === "%" || unidad === "puntos %") return formatear(v - v0, "puntos %");
  if (unidad === "puntos" || unidad === "razón") return (v - v0 > 0 ? "+" : "") + formatear(v - v0, "razón") + (unidad === "puntos" ? " pts" : "");
  return signoPct(100 * (v / v0 - 1));
}

function minigrafico(serie, ancho = 220, alto = 46) {
  const p = paleta();
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", `0 0 ${ancho} ${alto}`);
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", alto);
  svg.setAttribute("aria-hidden", "true");
  const ok = serie.filter((d) => d.valor != null);
  if (ok.length < 2) return svg;
  const x = d3.scaleLinear(d3.extent(ok, (d) => d.anio), [4, ancho - 4]);
  const ext = d3.extent(ok, (d) => d.valor);
  const pad = (ext[1] - ext[0]) * 0.15 || Math.abs(ext[0]) * 0.05 || 1;
  const y = d3.scaleLinear([ext[0] - pad, ext[1] + pad], [alto - 4, 4]);
  const path = document.createElementNS(ns, "path");
  path.setAttribute("d", d3.line((d) => x(d.anio), (d) => y(d.valor))(ok));
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", p.serie[0]);
  path.setAttribute("stroke-width", "2");
  path.setAttribute("stroke-linejoin", "round");
  svg.append(path);
  const u = ok.at(-1);
  const c = document.createElementNS(ns, "circle");
  c.setAttribute("cx", x(u.anio)); c.setAttribute("cy", y(u.valor)); c.setAttribute("r", 3.5);
  c.setAttribute("fill", p.serie[0]);
  svg.append(c);
  return svg;
}

function valorClave(ind, anio, dep) {
  return dep ? D.valores(ind, anio).get(dep) ?? null : D.nacional(ind, anio);
}

function tarjetaClave(ind, dep) {
  const info = D.info.get(ind);
  const g = GUIA[ind];
  const anios = D.anios(ind);
  const a = anios.at(-1), a0 = anios[0];
  const v = valorClave(ind, a, dep), v0 = valorClave(ind, a0, dep);
  const serie = anios.map((x) => ({anio: x, valor: valorClave(ind, x, dep)}));
  const f = (x) => formatear(x, info.unidad, {corto: true});
  const abrir = () => abrirFicha(ind);
  return el("article", {class: "tarjeta clave", tabindex: 0, role: "button", "aria-haspopup": "dialog",
    onclick: abrir, onkeydown: (e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), abrir())},
    el("h3", {}, g.corto),
    el("div", {class: "clave-valor"}, el("span", {class: "dato-valor"}, f(v)), el("span", {class: "clave-anio"}, `${dep ? D.deptos[dep] : "Colombia"}, ${a}`)),
    minigrafico(serie),
    el("div", {class: "clave-pie"},
      el("span", {}, a0 !== a && v != null && v0 != null ? `Desde ${a0}: ${cambioTexto(v, v0, info.unidad)}` : dep ? `Colombia: ${f(D.nacional(ind, a))}` : ""),
      el("span", {class: "clave-ir"}, "Ficha")));
}

function abrirFicha(ind) {
  const info = D.info.get(ind);
  const g = GUIA[ind];
  const anios = D.anios(ind);
  const a = anios.at(-1);
  const dep = estado.dep;
  const vals = [...D.valores(ind, a)].filter(([, x]) => x != null);
  const orden = g.cercaCero ? [...vals].sort((p, q) => Math.abs(p[1]) - Math.abs(q[1])) : [...vals].sort((p, q) => q[1] - p[1]);
  const f = (x) => formatear(x, info.unidad);
  const des = [...(D.desagregaciones.get(ind)?.keys() ?? [])].map((d) => NOMBRES_DESAG[d] ?? d);
  const recol = RECOLECCION.find(([re]) => re.test(ind))?.[1] ?? info.fuente;
  const fila = (t, ...v) => [el("dt", {}, t), el("dd", {}, ...v)];

  const dlg = el("dialog", {class: "ficha-dlg", "aria-labelledby": "ficha-titulo"});
  const cerrar = () => dlg.close();
  dlg.addEventListener("close", () => dlg.remove());
  dlg.addEventListener("click", (e) => e.target === dlg && cerrar());
  const cMapa = el("div", {class: "ficha-mapa"});
  const contenido = el("div", {class: "ficha-contenido"});
  dlg.append(contenido);
  contenido.append(
    el("div", {class: "ficha-cab"},
      el("div", {},
        el("span", {class: "chip"}, `Ficha del indicador · ${info.dimension}`),
        el("h2", {id: "ficha-titulo"}, info.nombre),
        el("p", {}, g.para)),
      el("button", {class: "ficha-cerrar no-imagen", "aria-label": "Cerrar", onclick: cerrar}, "×")),
    el("div", {class: "ficha-cuerpo"},
      el("div", {class: "ficha-resumen"},
        el("div", {class: "ficha-cifras"},
          el("div", {}, el("div", {class: "dato-etq"}, `Colombia, ${a}`), el("div", {class: "dato-valor"}, f(D.nacional(ind, a)))),
          dep ? el("div", {}, el("div", {class: "dato-etq"}, `${D.deptos[dep]}, ${a}`), el("div", {class: "dato-valor sel"}, f(D.valores(ind, a).get(dep)))) : null),
        cMapa,
        orden.length ? el("dl", {class: "clave-extremos"},
          el("dt", {}, g.extremo[0]), el("dd", {}, `${D.deptos[orden[0][0]]} · ${f(orden[0][1])}`),
          el("dt", {}, g.extremo[1]), el("dd", {}, `${D.deptos[orden.at(-1)[0]]} · ${f(orden.at(-1)[1])}`)) : null),
      el("dl", {class: "pirs"},
        ...fila("Definición", g.definicion ?? info.definicion),
        ...fila("Cálculo", g.calculo ?? info.definicion),
        ...fila("Unidad", info.unidad),
        ...fila("Nivel geográfico", "Departamento (código DANE). El dato nacional es la suma o el promedio ponderado de los departamentos."),
        ...fila("Desagregaciones", des.length ? des.join(", ") : "Ninguna"),
        ...fila("Fuente", info.fuente),
        ...fila("Recolección", recol),
        ...fila("Frecuencia", g.frecuencia ?? "Anual"),
        ...fila("Cobertura", `${anios[0]}–${a} · ${vals.length} departamentos en ${a}`),
        ...fila("Limitaciones", g.limites ?? "—"),
        ...fila("Dimensión de la tríada", info.dimension))));
  dlg.append(
    el("div", {class: "ficha-pie"},
      botonImagen(contenido, `ficha ${info.nombre}`),
      el("button", {class: "boton", onclick: cerrar}, "Cerrar"),
      el("button", {class: "boton primario", onclick: () => { cerrar(); irA(info, ind); }}, "Ver mapa completo y desagregaciones")));
  document.body.append(dlg);
  dlg.showModal();
  cMapa.append(mapa({geo: D.geo, valores: D.valores(ind, a), info, deptos: D.deptos, width: Math.max(220, cMapa.clientWidth || 260), compacto: true, seleccion: dep}));
}

function vistaEsencial(main) {
  main.append(el("section", {class: "portada"},
    el("span", {class: "chip"}, "Observatorio HYBRIDA de datos educativos"),
    el("h1", {}, "Lo esencial en 12 indicadores"),
    el("p", {class: "bajada"}, "Datos oficiales sobre las brechas educativas en Colombia. Elige un departamento para compararlo con el país y abre cualquier tarjeta para ver su ficha técnica."),
  ));
  const grupoSel = estado.grupo ?? "";
  const chips = el("div", {class: "chips", role: "group", "aria-label": "Tema"},
    [{p: "", t: "Todos"}, ...GRUPOS.map((g) => ({p: g.pregunta, t: g.corto}))].map(({p, t}) =>
      el("button", {class: "chip-filtro", "aria-pressed": String(p === grupoSel), onclick: () => ((estado.grupo = p), render())}, t)));
  main.append(el("div", {class: "filtros filtros-clave"},
    selector({etiqueta: "Departamento", opciones: [{valor: "", texto: "Colombia (nacional)"}, ...opcionesDeptos().slice(1)], valor: estado.dep, alCambiar: (v) => ((estado.dep = v), render())}),
    el("div", {class: "filtro"}, el("label", {}, "Tema"), chips)));
  for (const grupo of GRUPOS.filter((g) => !grupoSel || g.pregunta === grupoSel)) {
    const inds = grupo.indicadores.filter((i) => D.info.has(i) && GUIA[i]);
    if (!inds.length) continue;
    main.append(el("section", {class: "grupo-clave"},
      el("h2", {}, grupo.pregunta),
      el("div", {class: "rejilla r-clave"}, inds.map((i) => tarjetaClave(i, estado.dep)))));
  }
  main.append(el("details", {class: "grupo-clave fuentes-plegable"},
    el("summary", {}, "¿De dónde salen los datos?"),
    el("div", {class: "rejilla r4", style: "margin-top:12px"}, FUENTES.map((x) => el("div", {class: "tarjeta fuente"},
      el("div", {class: "fuente-nombre"}, x.nombre, el("span", {}, x.entidad)),
      el("p", {}, x.que),
      el("p", {class: "fuente-responde"}, x.responde))))));
}

function vistaPanorama(main) {
  main.append(el("section", {class: "portada"},
    el("span", {class: "chip"}, "Tablero 1 · Educación superior y conectividad"),
    el("h1", {}, "Brechas educativas por departamento"),
    el("p", {class: "bajada"}, "Panel armonizado del Observatorio HYBRIDA a partir de bases oficiales y abiertas (SNIES, Icfes y MinTIC). Los indicadores se organizan según la tríada de la Declaración fundacional: redistribución, reconocimiento y representación."),
  ));
  const datos = el("div", {class: "rejilla r4"});
  for (const ind of PANORAMA_DATOS.filter((i) => D.info.has(i))) {
    const info = D.info.get(ind);
    const anios = D.anios(ind);
    const a = anios.at(-1);
    const v = D.nacional(ind, a);
    const prev = anios.length > 1 ? D.nacional(ind, anios.at(-2)) : null;
    let pie = `Colombia, ${a}`;
    if (prev != null && v != null) pie += " · " + (info.unidad === "%" ? `${formatear(v - prev, "puntos %")} vs ${anios.at(-2)}` : `${signoPct(100 * (v / prev - 1))} vs ${anios.at(-2)}`);
    datos.append(el("div", {class: "tarjeta dato"},
      el("div", {class: "dato-etq"}, info.nombre),
      el("div", {class: "dato-valor"}, formatear(v, info.unidad, {corto: true})),
      el("div", {class: "dato-pie"}, pie)));
  }
  main.append(datos);

  main.append(el("h2", {style: "margin:28px 0 4px"}, "Cuatro miradas al territorio"),
    el("p", {class: "bajada", style: "margin-bottom:14px"}, "Último año disponible de cada indicador. Haz clic en un mapa para explorarlo."));
  const mapas = el("div", {class: "rejilla r4"});
  main.append(mapas);
  const inds = PANORAMA_MAPAS.filter((i) => D.info.has(i));
  for (const ind of (inds.length ? inds : D.catalogo.slice(0, 4).map((c) => c.indicador))) {
    const info = D.info.get(ind);
    const a = D.anios(ind).at(-1);
    const cont = el("div");
    const t = el("section", {class: "tarjeta mini", tabindex: 0, role: "link",
      onclick: () => irA(info, ind), onkeydown: (e) => e.key === "Enter" && irA(info, ind)},
      el("div", {class: "tarjeta-cab"}, el("div", {}, el("h2", {}, info.nombre), el("p", {}, `${info.dimension} · ${a}`))), cont);
    mapas.append(t);
    cont.append(mapa({geo: D.geo, valores: D.valores(ind, a), info, deptos: D.deptos, width: anchoDe(t), compacto: true}));
  }
  main.append(el("p", {class: "nota", style: "margin-top:16px"},
    "Para comparar dos indicadores entre departamentos, usa ", el("a", {href: "#/cruces"}, "Cruces"), "."));
}

function irA(info, ind) {
  const v = VISTAS.find((x) => x.dim === info.dimension);
  estado.ind[info.dimension] = ind;
  location.hash = `#/${v?.ruta ?? "redistribucion"}`;
}

function vistaExplorador(main, dim) {
  const opciones = opcionesIndicadores(dim);
  if (!opciones.length) return main.append(vacio("Aún no hay indicadores asignados a esta dimensión."));
  const ind = estado.ind[dim] && D.info.has(estado.ind[dim]) ? estado.ind[dim] : opciones[0].valor;
  estado.ind[dim] = ind;
  const info = D.info.get(ind);
  const anios = D.anios(ind);
  const anio = anios.includes(estado.anio) ? estado.anio : anios.at(-1);
  estado.contextoImg = `${info.nombre} ${anio}`;
  const desOps = [...(D.desagregaciones.get(ind)?.keys() ?? [])];
  const des = desOps.includes(estado.des[ind]) ? estado.des[ind] : desOps[0];
  const dep = estado.dep;
  const rerender = () => render();

  main.append(el("p", {class: "bajada"}, BAJADAS[dim]));
  main.append(el("div", {class: "filtros"},
    selector({etiqueta: "Indicador", opciones, valor: ind, ancho: true, alCambiar: (v) => ((estado.ind[dim] = v), rerender())}),
    deslizadorAnio({anios, valor: anio, alCambiar: (v) => ((estado.anio = v), rerender())}),
    selector({etiqueta: "Departamento", opciones: opcionesDeptos(), valor: dep, alCambiar: (v) => ((estado.dep = v), rerender())}),
    desOps.length ? selector({etiqueta: "Desagregar por", opciones: desOps.map((d) => ({valor: d, texto: NOMBRES_DESAG[d] ?? d})), valor: des, alCambiar: (v) => ((estado.des[ind] = v), rerender())}) : null,
  ));

  main.append(el("div", {class: "ficha"},
    el("h1", {}, info.nombre),
    GUIA[ind] ? el("p", {class: "para-que"}, el("strong", {}, "Para qué sirve: "), GUIA[ind].para) : null,
    el("p", {class: "bajada", style: "margin-bottom:8px"}, info.definicion),
    el("div", {class: "meta"}, el("span", {class: "chip"}, info.dimension), el("span", {}, `Unidad: ${info.unidad}`), el("span", {}, `Fuente: ${info.fuente}`))));

  const valores = D.valores(ind, anio);
  const elegir = (cod) => ((estado.dep = estado.dep === cod ? "" : cod), rerender());
  const cMapa = el("div"), cRank = el("div");
  const nac = D.nacional(ind, anio);
  const subMapa = `${anio} · ${D.esAditiva(ind) ? "Total" : "Promedio ponderado"} nacional: ${formatear(nac, info.unidad)}`;
  const fila = el("div", {class: "rejilla r2"},
    tarjeta("Mapa departamental", subMapa, cMapa),
    tarjeta("Ranking", "Haz clic en un departamento para resaltarlo.", cRank));
  main.append(fila);
  cMapa.append(mapa({geo: D.geo, valores, info, deptos: D.deptos, width: Math.min(anchoDe(fila.children[0]), 560), seleccion: dep, alElegir: elegir}));
  cRank.append(ranking({valores, info, deptos: D.deptos, width: anchoDe(fila.children[1]), seleccion: dep, alElegir: elegir}));

  const cEvo = el("div");
  const tEvo = tarjeta("Evolución", dep ? `${D.deptos[dep]} frente a la mediana de los departamentos` : "Elige un departamento para resaltarlo frente a la mediana.", cEvo);
  tEvo.classList.add("seccion");
  main.append(tEvo);
  cEvo.append(evolucion({D, ind, info, width: anchoDe(tEvo), seleccion: dep}));

  if (desOps.length) {
    const cDes = el("div");
    const quien = dep ? D.deptos[dep] : `Colombia (${D.esAditiva(ind) ? "total" : "promedio ponderado"})`;
    const tDes = tarjeta(`Desagregado por: ${NOMBRES_DESAG[des] ?? des}`, quien, cDes);
    tDes.classList.add("seccion");
    main.append(tDes);
    cDes.append(desagregacion({D, ind, info, des, cod: dep, width: anchoDe(tDes)}));
  }

  const anterior = anios[anios.indexOf(anio) - 1];
  const prev = anterior ? D.valores(ind, anterior) : new Map();
  const filas = Object.entries(D.deptos).map(([cod, n]) => {
    const v = valores.get(cod), p = prev.get(cod);
    return {cod, depto: n, v: v ?? null, p: p ?? null, c: v != null && p != null ? v - p : null};
  }).sort((a, b) => (b.v ?? -Infinity) - (a.v ?? -Infinity));
  const f = (v) => formatear(v, info.unidad);
  main.append(el("div", {class: "seccion"}, tablaDatos([
    {titulo: "Código", clave: "cod"}, {titulo: "Departamento", clave: "depto"},
    {titulo: String(anio), clave: "v", num: true, formato: f},
    ...(anterior ? [{titulo: String(anterior), clave: "p", num: true, formato: f}, {titulo: "Cambio", clave: "c", num: true, formato: (v) => (v == null ? "" : (v > 0 ? "+" : "") + formatear(v, info.unidad))}] : []),
  ], filas, `${ind}_${anio}.csv`)));
}

function vistaCruces(main) {
  const todos = D.catalogo.map((c) => c.indicador);
  const x = D.info.has(estado.x) ? estado.x : (D.info.has("s11_pct_internet_hogar") ? "s11_pct_internet_hogar" : todos[0]);
  const y = D.info.has(estado.y) ? estado.y : (D.info.has("s11_punt_global_prom") ? "s11_punt_global_prom" : todos[1]);
  estado.x = x; estado.y = y;
  const comunes = D.anios(x).filter((a) => D.anios(y).includes(a));
  const anios = comunes.length ? comunes : D.anios(x);
  const anio = anios.includes(estado.anioCruce) ? estado.anioCruce : anios.at(-1);
  const rerender = () => render();

  main.append(el("p", {class: "bajada"}, "Compara dos indicadores entre departamentos para un mismo año. Cada punto es un departamento; la línea gris es la tendencia lineal."));
  main.append(el("div", {class: "filtros"},
    selector({etiqueta: "Eje horizontal", opciones: opcionesIndicadores(), valor: x, ancho: true, alCambiar: (v) => ((estado.x = v), rerender())}),
    selector({etiqueta: "Eje vertical", opciones: opcionesIndicadores(), valor: y, ancho: true, alCambiar: (v) => ((estado.y = v), rerender())}),
    deslizadorAnio({anios, valor: anio, alCambiar: (v) => ((estado.anioCruce = v), rerender())}),
    selector({etiqueta: "Resaltar", opciones: opcionesDeptos(), valor: estado.dep, alCambiar: (v) => ((estado.dep = v), rerender())}),
  ));

  const infoX = D.info.get(x), infoY = D.info.get(y);
  const cont = el("div");
  const t = el("section", {class: "tarjeta"});
  main.append(t);
  const {nodo, r, n} = dispersion({X: D.valores(x, anio), Y: D.valores(y, anio), infoX, infoY, deptos: D.deptos, width: anchoDe(t), seleccion: estado.dep,
    alElegir: (cod) => ((estado.dep = estado.dep === cod ? "" : cod), rerender())});
  const lectura = r == null ? "" : `r = ${r.toFixed(2).replace(".", ",")} · ${n} departamentos · relación ${fuerza(r)}`;
  estado.contextoImg = String(anio);
  t.append(el("div", {class: "tarjeta-cab"}, el("div", {}, el("h2", {}, `${infoY.nombre} · ${infoX.nombre}`), el("p", {}, `${anio}${lectura ? " · " + lectura : ""}`)),
    botonImagen(t, `cruce ${infoY.nombre} ${infoX.nombre} ${anio}`)), cont);
  cont.append(nodo);
  t.append(el("p", {class: "nota"}, "Una correlación entre departamentos no implica causalidad ni describe a las personas dentro de cada departamento (falacia ecológica)."));

  const datos = [...D.valores(x, anio)].filter(([c, v]) => v != null && D.valores(y, anio).get(c) != null)
    .map(([cod, v]) => ({cod, depto: D.deptos[cod], x: v, y: D.valores(y, anio).get(cod)})).sort((a, b) => a.depto.localeCompare(b.depto, "es"));
  t.append(tablaDatos([
    {titulo: "Departamento", clave: "depto"},
    {titulo: infoX.nombre, clave: "x", num: true, formato: (v) => formatear(v, infoX.unidad)},
    {titulo: infoY.nombre, clave: "y", num: true, formato: (v) => formatear(v, infoY.unidad)},
  ], datos, `cruce_${x}_${y}_${anio}.csv`));

  const cMat = el("div");
  const tMat = tarjeta("Mapa de correlaciones", `${anio} · Correlación entre indicadores (tasas, porcentajes y puntajes) a nivel departamental. Los conteos se excluyen porque reflejan el tamaño de cada departamento. Haz clic en una celda para cruzar ese par.`, cMat);
  tMat.classList.add("seccion");
  main.append(tMat);
  // Los conteos absolutos se excluyen: correlacionan entre sí por el tamaño de cada departamento
  const inds = D.catalogo.filter((c) => !D.esAditiva(c.indicador)).map((c) => c.indicador).filter((i) => D.valores(i, anio).size >= 8);
  cMat.append(inds.length > 2
    ? matrizCorrelacion({D, anio, inds, width: anchoDe(tMat), alElegir: (a, b) => { estado.x = a; estado.y = b; rerender(); scrollTo({top: 0, behavior: "smooth"}); }})
    : vacio("Se necesitan al menos tres indicadores con datos en este año."));
}

function fuerza(r) {
  const a = Math.abs(r);
  const s = r > 0 ? "positiva" : "negativa";
  if (a < 0.2) return "muy débil";
  if (a < 0.4) return `débil ${s}`;
  if (a < 0.6) return `moderada ${s}`;
  if (a < 0.8) return `fuerte ${s}`;
  return `muy fuerte ${s}`;
}

function vistaMetodologia(main) {
  const tx = el("div", {class: "texto"},
    el("h1", {}, "Metodología"),
    el("p", {class: "bajada"}, "El observatorio usa exclusivamente bases oficiales y abiertas, armonizadas por departamento (código DANE) y año. Cada indicador tiene una ficha con definición, fórmula, fuente y unidad."),
    el("h2", {}, "Fuentes"),
    el("ul", {},
      el("li", {}, "SNIES (Ministerio de Educación Nacional): matriculados, inscritos, admitidos, primer curso y graduados. Departamento de oferta del programa."),
      el("li", {}, "Icfes, DataIcfes: microdatos de Saber 11 (calendario A, periodo 2) y Saber TyT. Departamento del colegio o de la institución."),
      el("li", {}, "MinTIC, Colombia TIC: accesos a internet fijo por tecnología y segmento. Último trimestre de cada año."),
      el("li", {}, "DANE, Marco Geoestadístico Nacional 2018: límites departamentales del mapa.")),
    el("h2", {}, "Decisiones de armonización"),
    el("ul", {},
      el("li", {}, "Matrícula: dato anual del segundo semestre (si no existe, el último disponible). Inscritos, admitidos, primer curso y graduados suman los dos semestres."),
      el("li", {}, "Agregado nacional: suma para conteos; promedio ponderado (por matrícula, evaluados o accesos) para porcentajes y puntajes."),
      el("li", {}, "Absorción aproximada: primer curso de pregrado del año siguiente frente a evaluados de Saber 11. No sigue a las mismas personas."),
      el("li", {}, "Las brechas restan el promedio de dos grupos dentro de cada departamento (por ejemplo, oficial menos privado).")),
    el("h2", {}, "Limitaciones"),
    el("ul", {},
      el("li", {}, "Aún no se incorporan proyecciones de población DANE, por lo que no hay tasas de cobertura ni accesos por cada 100 habitantes."),
      el("li", {}, "Los cambios metodológicos de las fuentes (por ejemplo, en pruebas Saber) pueden generar rupturas de serie."),
      el("li", {}, "La asignación de indicadores a la tríada es una propuesta en validación.")),
    el("h2", {}, "Reproducibilidad"),
    el("p", {}, "El procesamiento está en el notebook del repositorio (carpeta notebooks). Cada actualización genera un registro de archivos procesados y una tabla de cobertura."),
    el("h2", {}, "Catálogo de indicadores"),
  );
  main.append(tx);
  const filas = [...D.catalogo].sort((a, b) => ORDEN_DIM.indexOf(a.dimension) - ORDEN_DIM.indexOf(b.dimension));
  const t = el("div", {class: "tabla-cont cat", style: "max-height:none"},
    el("table", {},
      el("thead", {}, el("tr", {}, ["Indicador", "Dimensión", "Unidad", "Fuente", "Definición", "Años"].map((h) => el("th", {}, h)))),
      el("tbody", {}, filas.map((c) => {
        const a = D.anios(c.indicador);
        return el("tr", {}, el("td", {}, c.nombre), el("td", {}, c.dimension), el("td", {}, c.unidad), el("td", {}, c.fuente), el("td", {}, c.definicion), el("td", {}, a.length ? `${a[0]}–${a.at(-1)}` : ""));
      }))));
  main.append(t);
  main.append(el("p", {class: "nota"}, `Datos generados: ${D.generado ?? "s. f."}`));
}

// ---------- enrutador ----------
function render() {
  const ruta = location.hash.replace(/^#\/?/, "") || "esencial";
  const vista = VISTAS.find((v) => v.ruta === ruta) ?? VISTAS[0];
  document.querySelectorAll(".nav a").forEach((a) => a.setAttribute("aria-current", a.dataset.ruta === vista.ruta ? "page" : "false"));
  const main = document.querySelector("main");
  const y = scrollY;
  main.replaceChildren();
  estado.contextoImg = "";
  if (D.demo) main.append(el("div", {class: "aviso", role: "note"}, "Datos de demostración generados para probar el tablero. No corresponden a cifras reales."));
  if (vista.dim) {
    main.append(el("span", {class: "chip"}, "Tríada"));
    main.append(el("h1", {style: "margin-top:8px"}, vista.nombre));
    vistaExplorador(main, vista.dim);
  } else if (vista.ruta === "cruces") {
    main.append(el("h1", {}, "Cruces de información"));
    vistaCruces(main);
  } else if (vista.ruta === "metodologia") vistaMetodologia(main);
  else if (vista.ruta === "esencial") vistaEsencial(main);
  else vistaPanorama(main);
  document.title = `${vista.nombre} · Observatorio HYBRIDA`;
  scrollTo(0, ruta === render.ultima ? y : 0);
  render.ultima = ruta;
}

async function iniciar() {
  const nav = document.querySelector(".nav");
  for (const v of VISTAS) nav.append(el("a", {href: `#/${v.ruta}`, "data-ruta": v.ruta}, v.nombre));
  const main = document.querySelector("main");
  main.append(el("p", {class: "vacio"}, "Cargando datos…"));
  try {
    D = await cargarDatos();
  } catch (e) {
    main.replaceChildren(el("p", {class: "vacio"}, "No se pudieron cargar los datos (data/tablero_datos.json)."));
    console.error(e);
    return;
  }
  const abrirBuscador = crearBuscador({D, GUIA,
    irAIndicador: (ind) => irA(D.info.get(ind), ind),
    irADepto: (cod) => { estado.dep = cod; if (location.hash === "#/esencial") render(); else location.hash = "#/esencial"; }});
  nav.after(el("div", {class: "herramientas"},
    el("button", {class: "herr herr-buscar", type: "button", title: "Buscar (tecla /)", "aria-label": "Buscar indicadores y departamentos", onclick: abrirBuscador},
      svgIcono('<circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5 14 14"/>'), el("span", {}, "Buscar")),
    el("button", {class: "herr herr-ayuda", type: "button", title: "Cómo usar el tablero", "aria-label": "Cómo usar el tablero", onclick: () => { if (!/esencial/.test(location.hash) && location.hash) { location.hash = "#/esencial"; setTimeout(recorrido, 400); } else recorrido(); }},
      svgIcono('<circle cx="8" cy="8" r="6.5"/><path d="M6.2 6.3a1.9 1.9 0 1 1 2.6 1.8c-.5.2-.8.6-.8 1.1v.4"/><circle cx="8" cy="11.6" r=".4" fill="currentColor"/>'))));
  addEventListener("hashchange", render);
  let t;
  let ancho = innerWidth;
  addEventListener("resize", () => {
    if (innerWidth === ancho) return;
    ancho = innerWidth;
    clearTimeout(t);
    t = setTimeout(render, 200);
  });
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", render);
  render();
  if (!location.hash || /esencial/.test(location.hash)) recorridoPrimeraVez();
}

function svgIcono(trazos) {
  const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  s.setAttribute("viewBox", "0 0 16 16"); s.setAttribute("width", "16"); s.setAttribute("height", "16"); s.setAttribute("aria-hidden", "true");
  s.setAttribute("fill", "none"); s.setAttribute("stroke", "currentColor"); s.setAttribute("stroke-width", "1.6"); s.setAttribute("stroke-linecap", "round");
  s.innerHTML = trazos;
  return s;
}

iniciar();
