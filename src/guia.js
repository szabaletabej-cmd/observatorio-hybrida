// Guía en lenguaje sencillo: qué mide cada indicador clave y para qué sirve.
// sentido: 1 = más es mejor, -1 = menos es mejor, 0 = descriptivo.
// extremo: cómo nombrar los departamentos de los extremos en las tarjetas.

export const GRUPOS = [
  {
    pregunta: "¿Quién llega a la educación superior?",
    corto: "Acceso",
    texto: "Cuántas personas estudian en universidades e instituciones técnicas, cuántas logran entrar y cuántas terminan.",
    indicadores: ["snies_matriculados", "snies_tasa_admision", "snies_graduados_por_100_matriculados"],
  },
  {
    pregunta: "¿Cómo les va en las pruebas de Estado?",
    corto: "Aprendizaje",
    texto: "Resultados del Icfes al terminar el colegio (Saber 11) y en programas técnicos y tecnológicos (Saber TyT), y las brechas entre grupos.",
    indicadores: ["s11_punt_global_prom", "s11_brecha_oficial_privado", "s11_brecha_rural_urbana", "tyt_punt_global_prom"],
  },
  {
    pregunta: "¿Tienen conexión a internet?",
    corto: "Conectividad",
    texto: "Acceso a internet en los hogares de los estudiantes y calidad de la red fija en cada departamento.",
    indicadores: ["s11_pct_internet_hogar", "s11_brecha_internet_estrato", "mintic_pct_fibra"],
  },
  {
    pregunta: "¿Quién está presente y cómo estudia?",
    corto: "Participación",
    texto: "Participación de las mujeres y peso de la educación virtual y a distancia en la matrícula.",
    indicadores: ["snies_pct_mujeres", "snies_pct_virtual_distancia"],
  },
];

export const GUIA = {
  snies_matriculados: {
    definicion: 'Número de estudiantes matriculados en programas de educación superior (pregrado y posgrado), según el departamento donde se ofrece el programa.',
    calculo: 'Suma de matriculados del segundo semestre de cada año.',
    frecuencia: 'Anual (segundo semestre).',
    limites: 'Cuenta matrículas, no personas únicas. Depende del tamaño de la población, por eso no sirve para comparar cobertura entre departamentos. 2025 es preliminar.',
    corto: "Estudiantes en educación superior",
    para: "Muestra el tamaño de la educación superior en cada departamento. Sirve para dimensionar la oferta, no para comparar oportunidades, porque depende de la población.",
    sentido: 0, extremo: ["Más estudiantes", "Menos estudiantes"],
  },
  snies_tasa_admision: {
    definicion: 'Proporción de inscritos a programas de educación superior que fueron admitidos en el año.',
    calculo: 'Admitidos ÷ inscritos × 100, sumando los dos semestres.',
    frecuencia: 'Anual.',
    limites: 'Una persona puede inscribirse en varios programas, así que no es la probabilidad de que un aspirante entre. Valores muy altos pueden indicar programas con admisión abierta.',
    corto: "De cada 100 inscritos, cuántos son admitidos",
    para: "Indica qué tan difícil es conseguir un cupo. Un valor bajo señala más demanda que oferta.",
    sentido: 1, extremo: ["Más admite", "Menos admite"],
  },
  snies_graduados_por_100_matriculados: {
    definicion: 'Graduados de educación superior en el año por cada 100 estudiantes matriculados ese mismo año.',
    calculo: 'Graduados del año ÷ matriculados del año × 100.',
    frecuencia: 'Anual.',
    limites: 'No es una tasa de graduación por cohorte: no sigue a las mismas personas. Faltan los años 2015 a 2017.',
    corto: "Graduados por cada 100 matriculados",
    para: "Aproxima cuántos estudiantes terminan. No es una tasa de graduación exacta porque no sigue a las mismas personas.",
    sentido: 1, extremo: ["Más gradúa", "Menos gradúa"],
  },
  s11_punt_global_prom: {
    definicion: 'Puntaje global promedio de los estudiantes que presentan Saber 11 calendario A, según el departamento del colegio.',
    calculo: 'Promedio simple del puntaje global (0 a 500) entre evaluados con puntaje válido.',
    frecuencia: 'Anual (segundo periodo de cada año).',
    limites: 'Incluye solo calendario A. Cambios en la prueba pueden afectar la comparación entre años.',
    corto: "Puntaje promedio Saber 11 (0 a 500)",
    para: "Resume el nivel de aprendizaje al terminar el colegio. Es la referencia más usada para comparar territorios.",
    sentido: 1, extremo: ["Puntaje más alto", "Puntaje más bajo"],
  },
  s11_brecha_oficial_privado: {
    definicion: 'Diferencia entre el puntaje global promedio de colegios oficiales y el de colegios privados dentro de cada departamento.',
    calculo: 'Promedio oficial − promedio privado. Negativo: los oficiales están por debajo.',
    frecuencia: 'Anual.',
    limites: 'En departamentos con pocos colegios privados la brecha puede variar mucho de un año a otro. El valor nacional es un promedio ponderado de las brechas departamentales.',
    corto: "Diferencia de puntaje: colegios oficiales frente a privados",
    para: "Negativo significa que los colegios oficiales sacan menos que los privados. Entre más cerca de cero, menor desigualdad.",
    sentido: 0, extremo: ["Brecha menor", "Brecha mayor"], cercaCero: true,
  },
  s11_brecha_rural_urbana: {
    definicion: 'Diferencia entre el puntaje global promedio de colegios rurales y el de colegios urbanos dentro de cada departamento.',
    calculo: 'Promedio rural − promedio urbano. Negativo: los rurales están por debajo.',
    frecuencia: 'Anual.',
    limites: 'La zona es la del colegio, no la de residencia del estudiante. El valor nacional es un promedio ponderado de las brechas departamentales.',
    corto: "Diferencia de puntaje: colegios rurales frente a urbanos",
    para: "Negativo significa que los colegios rurales sacan menos que los urbanos. Entre más cerca de cero, menor desigualdad.",
    sentido: 0, extremo: ["Brecha menor", "Brecha mayor"], cercaCero: true,
  },
  tyt_punt_global_prom: {
    definicion: 'Puntaje global promedio de los estudiantes de programas técnicos y tecnológicos que presentan Saber TyT, según el departamento del programa.',
    calculo: 'Promedio simple del puntaje global entre evaluados con puntaje válido.',
    frecuencia: 'Anual.',
    limites: 'La prueba es obligatoria para graduarse, pero quienes la presentan no representan a todos los que ingresaron. Desde 2016.',
    corto: "Puntaje promedio Saber TyT",
    para: "Mide competencias genéricas de estudiantes de programas técnicos y tecnológicos al final de su formación.",
    sentido: 1, extremo: ["Puntaje más alto", "Puntaje más bajo"],
  },
  s11_pct_internet_hogar: {
    definicion: 'Porcentaje de estudiantes que presentan Saber 11 y reportan tener internet en el hogar.',
    calculo: 'Respuestas «Sí» ÷ respuestas válidas × 100.',
    frecuencia: 'Anual.',
    limites: 'Es autorreportado y describe solo a los hogares de bachilleres, no a toda la población.',
    corto: "Bachilleres con internet en la casa",
    para: "Muestra la brecha digital en los hogares de quienes terminan el colegio. Es clave para la educación virtual.",
    sentido: 1, extremo: ["Más conectado", "Menos conectado"],
  },
  s11_brecha_internet_estrato: {
    definicion: 'Diferencia en el acceso a internet en el hogar entre estudiantes de estratos 1-2 y de estratos 5-6 dentro de cada departamento.',
    calculo: '% con internet en estratos 1-2 − % en estratos 5-6.',
    frecuencia: 'Anual.',
    limites: 'En departamentos con pocos estudiantes de estratos 5-6 el dato es inestable.',
    corto: "Diferencia de acceso a internet: estratos 1-2 frente a 5-6",
    para: "Negativo significa que los hogares de estratos bajos tienen menos internet. Entre más cerca de cero, menor desigualdad.",
    sentido: 0, extremo: ["Brecha menor", "Brecha mayor"], cercaCero: true,
  },
  mintic_pct_fibra: {
    definicion: 'Porcentaje de las conexiones de internet fijo que usan fibra óptica.',
    calculo: 'Accesos de fibra (FTTH, FTTB, FTTx y similares) ÷ total de accesos × 100, último trimestre del año.',
    frecuencia: 'Anual (último trimestre disponible).',
    limites: 'Cuenta conexiones, no hogares. La serie disponible va de 2017 a 2023.',
    corto: "Conexiones de internet fijo por fibra óptica",
    para: "Aproxima la calidad de la red: la fibra permite velocidades más altas y estables.",
    sentido: 1, extremo: ["Más fibra", "Menos fibra"],
  },
  snies_pct_mujeres: {
    definicion: 'Porcentaje de mujeres en la matrícula de educación superior.',
    calculo: 'Matriculadas mujeres ÷ total de matriculados × 100.',
    frecuencia: 'Anual (segundo semestre).',
    limites: 'El SNIES registra solo sexo binario.',
    corto: "Mujeres en la matrícula",
    para: "Indica la participación femenina en la educación superior. Por encima de 50 % hay más mujeres que hombres.",
    sentido: 0, extremo: ["Más mujeres", "Menos mujeres"],
  },
  snies_pct_virtual_distancia: {
    definicion: 'Porcentaje de la matrícula en programas virtuales o a distancia.',
    calculo: '(Matrícula virtual + a distancia) ÷ total × 100.',
    frecuencia: 'Anual (segundo semestre).',
    limites: 'La matrícula se asigna al departamento donde se ofrece el programa, que puede no ser donde vive el estudiante.',
    corto: "Matrícula virtual y a distancia",
    para: "Muestra cuánto depende cada departamento de la educación no presencial, que suele llegar a donde no hay sedes.",
    sentido: 0, extremo: ["Más virtual", "Menos virtual"],
  },
};

export const RECOLECCION = [
  [/^snies_/, "Registros administrativos que reportan las instituciones de educación superior al Ministerio de Educación (SNIES)."],
  [/^s11_/, "Microdatos del examen Saber 11 y del formulario sociodemográfico que diligencia cada estudiante (Icfes, DataIcfes)."],
  [/^tyt_/, "Microdatos del examen Saber TyT y de su formulario sociodemográfico (Icfes, DataIcfes)."],
  [/^mintic_/, "Reportes trimestrales de los operadores de internet fijo a MinTIC (Colombia TIC)."],
];

export const FUENTES = [
  {nombre: "SNIES", entidad: "Ministerio de Educación", que: "Registro oficial de la educación superior: inscritos, admitidos, matriculados y graduados en cada programa.", responde: "¿Quién entra, quién estudia y quién termina?"},
  {nombre: "Saber 11", entidad: "Icfes", que: "Examen que presentan los estudiantes al terminar el colegio. Incluye puntajes y datos del hogar.", responde: "¿Cómo salen preparados del colegio y en qué condiciones?"},
  {nombre: "Saber TyT", entidad: "Icfes", que: "Examen para estudiantes de programas técnicos y tecnológicos al final de su carrera.", responde: "¿Qué competencias logra la formación técnica?"},
  {nombre: "Internet fijo", entidad: "MinTIC", que: "Conexiones de internet fijo reportadas por los operadores, por tecnología y estrato.", responde: "¿Qué tan conectado está el territorio?"},
];
