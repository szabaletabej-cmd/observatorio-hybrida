// Guía en lenguaje sencillo: qué mide cada indicador clave y para qué sirve.
// sentido: 1 = más es mejor, -1 = menos es mejor, 0 = descriptivo.
// extremo: cómo nombrar los departamentos de los extremos en las tarjetas.

export const GRUPOS = [
  {
    pregunta: "¿Quién llega a la educación superior?",
    texto: "Cuántas personas estudian en universidades e instituciones técnicas, cuántas logran entrar y cuántas terminan.",
    indicadores: ["snies_matriculados", "snies_tasa_admision", "snies_graduados_por_100_matriculados"],
  },
  {
    pregunta: "¿Cómo les va en las pruebas de Estado?",
    texto: "Resultados del Icfes al terminar el colegio (Saber 11) y en programas técnicos y tecnológicos (Saber TyT), y las brechas entre grupos.",
    indicadores: ["s11_punt_global_prom", "s11_brecha_oficial_privado", "s11_brecha_rural_urbana", "tyt_punt_global_prom"],
  },
  {
    pregunta: "¿Tienen conexión a internet?",
    texto: "Acceso a internet en los hogares de los estudiantes y calidad de la red fija en cada departamento.",
    indicadores: ["s11_pct_internet_hogar", "s11_brecha_internet_estrato", "mintic_pct_fibra"],
  },
  {
    pregunta: "¿Quién está presente y cómo estudia?",
    texto: "Participación de las mujeres y peso de la educación virtual y a distancia en la matrícula.",
    indicadores: ["snies_pct_mujeres", "snies_pct_virtual_distancia"],
  },
];

export const GUIA = {
  snies_matriculados: {
    corto: "Estudiantes en educación superior",
    para: "Muestra el tamaño de la educación superior en cada departamento. Sirve para dimensionar la oferta, no para comparar oportunidades, porque depende de la población.",
    sentido: 0, extremo: ["Más estudiantes", "Menos estudiantes"],
  },
  snies_tasa_admision: {
    corto: "De cada 100 inscritos, cuántos son admitidos",
    para: "Indica qué tan difícil es conseguir un cupo. Un valor bajo señala más demanda que oferta.",
    sentido: 1, extremo: ["Más admite", "Menos admite"],
  },
  snies_graduados_por_100_matriculados: {
    corto: "Graduados por cada 100 matriculados",
    para: "Aproxima cuántos estudiantes terminan. No es una tasa de graduación exacta porque no sigue a las mismas personas.",
    sentido: 1, extremo: ["Más gradúa", "Menos gradúa"],
  },
  s11_punt_global_prom: {
    corto: "Puntaje promedio Saber 11 (0 a 500)",
    para: "Resume el nivel de aprendizaje al terminar el colegio. Es la referencia más usada para comparar territorios.",
    sentido: 1, extremo: ["Puntaje más alto", "Puntaje más bajo"],
  },
  s11_brecha_oficial_privado: {
    corto: "Diferencia de puntaje: colegios oficiales frente a privados",
    para: "Negativo significa que los colegios oficiales sacan menos que los privados. Entre más cerca de cero, menor desigualdad.",
    sentido: 0, extremo: ["Brecha menor", "Brecha mayor"], cercaCero: true,
  },
  s11_brecha_rural_urbana: {
    corto: "Diferencia de puntaje: colegios rurales frente a urbanos",
    para: "Negativo significa que los colegios rurales sacan menos que los urbanos. Entre más cerca de cero, menor desigualdad.",
    sentido: 0, extremo: ["Brecha menor", "Brecha mayor"], cercaCero: true,
  },
  tyt_punt_global_prom: {
    corto: "Puntaje promedio Saber TyT",
    para: "Mide competencias genéricas de estudiantes de programas técnicos y tecnológicos al final de su formación.",
    sentido: 1, extremo: ["Puntaje más alto", "Puntaje más bajo"],
  },
  s11_pct_internet_hogar: {
    corto: "Bachilleres con internet en la casa",
    para: "Muestra la brecha digital en los hogares de quienes terminan el colegio. Es clave para la educación virtual.",
    sentido: 1, extremo: ["Más conectado", "Menos conectado"],
  },
  s11_brecha_internet_estrato: {
    corto: "Diferencia de acceso a internet: estratos 1-2 frente a 5-6",
    para: "Negativo significa que los hogares de estratos bajos tienen menos internet. Entre más cerca de cero, menor desigualdad.",
    sentido: 0, extremo: ["Brecha menor", "Brecha mayor"], cercaCero: true,
  },
  mintic_pct_fibra: {
    corto: "Conexiones de internet fijo por fibra óptica",
    para: "Aproxima la calidad de la red: la fibra permite velocidades más altas y estables.",
    sentido: 1, extremo: ["Más fibra", "Menos fibra"],
  },
  snies_pct_mujeres: {
    corto: "Mujeres en la matrícula",
    para: "Indica la participación femenina en la educación superior. Por encima de 50 % hay más mujeres que hombres.",
    sentido: 0, extremo: ["Más mujeres", "Menos mujeres"],
  },
  snies_pct_virtual_distancia: {
    corto: "Matrícula virtual y a distancia",
    para: "Muestra cuánto depende cada departamento de la educación no presencial, que suele llegar a donde no hay sedes.",
    sentido: 0, extremo: ["Más virtual", "Menos virtual"],
  },
};

export const FUENTES = [
  {nombre: "SNIES", entidad: "Ministerio de Educación", que: "Registro oficial de la educación superior: inscritos, admitidos, matriculados y graduados en cada programa.", responde: "¿Quién entra, quién estudia y quién termina?"},
  {nombre: "Saber 11", entidad: "Icfes", que: "Examen que presentan los estudiantes al terminar el colegio. Incluye puntajes y datos del hogar.", responde: "¿Cómo salen preparados del colegio y en qué condiciones?"},
  {nombre: "Saber TyT", entidad: "Icfes", que: "Examen para estudiantes de programas técnicos y tecnológicos al final de su carrera.", responde: "¿Qué competencias logra la formación técnica?"},
  {nombre: "Internet fijo", entidad: "MinTIC", que: "Conexiones de internet fijo reportadas por los operadores, por tecnología y estrato.", responde: "¿Qué tan conectado está el territorio?"},
];
