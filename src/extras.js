// Herramientas de apoyo: descarga de imágenes (html-to-image), buscador (Fuse.js) y recorrido guiado (Driver.js).
import {toPng} from "html-to-image";
import Fuse from "fuse.js";
import {driver} from "driver.js";
import "driver.js/dist/driver.css";

const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const slug = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);

// ---------- Descargar como imagen ----------
export function botonImagen(objetivo, nombre) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "boton boton-img";
  b.title = "Descargar como imagen (PNG)";
  b.setAttribute("aria-label", `Descargar ${nombre} como imagen`);
  b.innerHTML = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M8 1v9m0 0L4.5 6.5M8 10l3.5-3.5M2 11v3h12v-3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg><span>PNG</span>';
  b.addEventListener("click", async (e) => {
    e.stopPropagation();
    const nodo = typeof objetivo === "function" ? objetivo() : objetivo;
    b.disabled = true;
    nodo.classList.add("capturando");
    const firma = document.createElement("p");
    firma.className = "firma-imagen";
    firma.textContent = `Observatorio HYBRIDA de datos educativos · observatorio-hybrida.pages.dev · ${new Date().toLocaleDateString("es-CO")}`;
    nodo.append(firma);
    try {
      const url = await toPng(nodo, {
        backgroundColor: css("--superficie") || "#ffffff",
        pixelRatio: 2,
        width: nodo.offsetWidth,
        height: nodo.scrollHeight,
        style: {margin: "0", position: "static", inset: "auto", transform: "none", boxShadow: "none", maxHeight: "none"},
        cacheBust: true,
        filter: (n) => !(n.classList && (n.classList.contains("boton-img") || n.classList.contains("no-imagen"))),
      });
      const a = document.createElement("a");
      a.href = url;
      a.download = `observatorio-hybrida-${slug(nombre)}.png`;
      a.click();
    } catch (err) {
      console.error("[HYBRIDA] no se pudo generar la imagen", err);
    } finally {
      nodo.classList.remove("capturando");
      firma.remove();
      b.disabled = false;
    }
  });
  return b;
}

// ---------- Buscador ----------
export function crearBuscador({D, GUIA, irAIndicador, irADepto}) {
  const items = [
    ...D.catalogo.map((c) => ({tipo: "Indicador", id: c.indicador, titulo: c.nombre, extra: [GUIA[c.indicador]?.corto, c.definicion, c.dimension, c.fuente].filter(Boolean).join(" · ")})),
    ...Object.entries(D.deptos).map(([cod, n]) => ({tipo: "Departamento", id: cod, titulo: n, extra: `Código DANE ${cod}`})),
  ];
  const fuse = new Fuse(items, {keys: [{name: "titulo", weight: 3}, {name: "extra", weight: 1}], threshold: 0.38, ignoreLocation: true, ignoreDiacritics: true});

  const dlg = document.createElement("dialog");
  dlg.className = "buscador";
  dlg.setAttribute("aria-label", "Buscar indicadores y departamentos");
  dlg.innerHTML = `<div class="buscador-caja">
      <input type="search" placeholder="Busca un indicador o un departamento (ej.: internet, Chocó)" aria-label="Buscar" autocomplete="off">
      <ul role="listbox"></ul>
      <p class="buscador-pie">Enter para abrir · Esc para cerrar</p>
    </div>`;
  document.body.append(dlg);
  const input = dlg.querySelector("input");
  const lista = dlg.querySelector("ul");
  let res = [], activo = 0;

  const elegir = (r) => {
    dlg.close();
    if (!r) return;
    if (r.tipo === "Indicador") irAIndicador(r.id);
    else irADepto(r.id);
  };
  const pintar = () => {
    const q = input.value.trim();
    res = q ? fuse.search(q, {limit: 8}).map((x) => x.item) : [
      ...["s11_punt_global_prom", "s11_pct_internet_hogar", "snies_matriculados", "snies_pct_mujeres"].filter((i) => D.info.has(i)).map((i) => items.find((x) => x.id === i)),
    ];
    activo = Math.min(activo, Math.max(0, res.length - 1));
    lista.replaceChildren(...res.map((r, i) => {
      const li = document.createElement("li");
      li.setAttribute("role", "option");
      li.setAttribute("aria-selected", String(i === activo));
      li.innerHTML = `<span class="b-tipo"></span><span class="b-titulo"></span>`;
      li.querySelector(".b-tipo").textContent = r.tipo;
      li.querySelector(".b-titulo").textContent = r.titulo;
      li.addEventListener("click", () => elegir(r));
      li.addEventListener("mousemove", () => { if (activo !== i) { activo = i; pintar(); } });
      return li;
    }));
    if (q && !res.length) {
      const li = document.createElement("li");
      li.className = "b-vacio";
      li.textContent = "Sin resultados. Prueba con otra palabra.";
      lista.append(li);
    }
  };
  input.addEventListener("input", () => { activo = 0; pintar(); });
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); activo = Math.min(activo + 1, res.length - 1); pintar(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); activo = Math.max(activo - 1, 0); pintar(); }
    else if (e.key === "Enter") { e.preventDefault(); elegir(res[activo]); }
  });
  dlg.addEventListener("click", (e) => e.target === dlg && dlg.close());

  const abrir = () => {
    input.value = ""; activo = 0; pintar();
    dlg.showModal();
    input.focus();
  };
  addEventListener("keydown", (e) => {
    const escribiendo = /input|select|textarea/i.test(document.activeElement?.tagName ?? "");
    if ((e.key === "k" && (e.ctrlKey || e.metaKey)) || (e.key === "/" && !escribiendo && !dlg.open)) {
      e.preventDefault();
      abrir();
    }
  });
  return abrir;
}

// ---------- Recorrido guiado ----------
const CLAVE_TOUR = "hybrida-tour-visto";

export function recorrido() {
  const pasos = [
    {popover: {title: "Bienvenida al Observatorio", description: "Un recorrido de un minuto por lo principal. Puedes salir cuando quieras con Esc."}},
    {element: ".nav", popover: {title: "Secciones", description: "Los indicadores se organizan en la tríada <b>Redistribución</b>, <b>Reconocimiento</b> y <b>Representación</b>. En <b>Metodología</b> están las fuentes y las fichas técnicas."}},
    {element: ".filtros .filtro", popover: {title: "Elige el indicador", description: "Cada pestaña tiene varios indicadores. Debajo verás su definición, su fuente y para qué sirve."}},
    {element: ".filtros input[type=range]", popover: {title: "Año y departamento", description: "Mueve el año y elige un departamento para resaltarlo en el mapa, el ranking y la evolución."}},
    {element: ".tarjeta .boton-img", popover: {title: "Descarga lo que necesites", description: "Cada mapa y gráfico se puede bajar como imagen con el botón <b>PNG</b>."}},
    {element: ".filtros-clave .filtro", popover: {title: "Elige un departamento", description: "Las tarjetas pasan a mostrar las cifras del departamento en lugar de las nacionales."}},
    {element: ".chips", popover: {title: "Filtra por tema", description: "Acceso, aprendizaje, conectividad o participación."}},
    {element: ".clave", popover: {title: "Cada tarjeta es un indicador", description: "Cifra más reciente, tendencia y cambio desde el primer año. Haz clic para abrir su <b>ficha técnica</b>: definición, cálculo, fuente, limitaciones y mapa."}},
    {element: ".herr-buscar", popover: {title: "Buscador", description: "Encuentra cualquier indicador o departamento. Atajo: tecla <b>/</b> o Ctrl + K."}},
    {element: ".herr-ayuda", popover: {title: "Vuelve a ver este recorrido", description: "Cuando quieras, desde este botón."}},
  ].filter((p) => !p.element || document.querySelector(p.element));
  const d = driver({
    showProgress: true,
    progressText: "{{current}} de {{total}}",
    nextBtnText: "Siguiente",
    prevBtnText: "Anterior",
    doneBtnText: "Listo",
    popoverClass: "hybrida-tour",
    steps: pasos,
  });
  d.drive();
  try { localStorage.setItem(CLAVE_TOUR, "1"); } catch {}
}

export function recorridoPrimeraVez() {
  let visto = true;
  try { visto = localStorage.getItem(CLAVE_TOUR) === "1"; } catch {}
  if (!visto) setTimeout(recorrido, 700);
}
