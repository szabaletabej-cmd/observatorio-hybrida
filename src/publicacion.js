// Qué secciones están publicadas. Para abrir una sección nueva, pásala de OCULTAS a PUBLICADAS.
// Con VITE_TODO=1 (versión interna) se ven todas.
export const PUBLICADAS = ["redistribucion", "reconocimiento", "representacion", "metodologia"];
export const OCULTAS = ["esencial", "panorama", "cruces"];

export const verTodo = import.meta.env.VITE_TODO === "1";
export const visible = (ruta) => verTodo || PUBLICADAS.includes(ruta);
