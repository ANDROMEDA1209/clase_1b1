# DataAcademy BI

Plataforma educativa front-end sobre Business Intelligence, con dos páginas independientes:

- `index.html`: fundamentos de BI y retos gamificados con progreso guardado en `localStorage`.
- `dashboard.html`: análisis interactivo de ventas de una heladería ficticia de Guayaquil.

## Ejecutar localmente

Abre `index.html` con un servidor estático desde la carpeta del proyecto, por ejemplo:

```bash
python3 -m http.server 8000
```

Luego visita `http://localhost:8000/`. Chart.js se carga desde jsDelivr, por lo que se requiere conexión a Internet para mostrar los gráficos.

## Estructura

- `css/styles.css`: estilos adaptables compartidos.
- `js/data.js`: catálogo y 672 registros deterministas y simulados de 2025.
- `js/dashboard.js`: filtros, indicadores, visualizaciones, insights y tabla.
- `js/gamification.js`: XP, niveles, rachas, insignias y persistencia local.
- `js/academy.js`: contenido y actividades interactivas de la academia.

Todos los datos de ventas son ficticios y se incluyen únicamente con fines educativos.
