# Taper Prednisolona — Calculadora de esquema de reducción

Página estática (HTML + CSS + JS puro, sin build ni dependencias) publicada en GitHub Pages:
https://jalzam.github.io/Taper-Prednisolona/ — repo `JalZam/Taper-Prednisolona`, rama `main`, raíz.

## Qué hace
- Calcula la dosis inicial por peso (0.2–1 mg/kg), redondea a múltiplos de 5 mg y avisa si supera 80 mg (KDIGO 2021).
- Preset KDIGO: 4 semanas a dosis plena → −10 mg/semana hasta 20 → −5 mg/semana hasta 10 → 7.5 mg × 2 semanas → 5 mg × 4 semanas.
- Reglas de reducción encadenadas definidas por el usuario (desde dosis X, bajar Y cada Z semanas hasta W).
- Tabla con fechas por escalón, vista previa con barras y hoja imprimible / PDF para el paciente.

## Archivos
- `index.html` — estructura: tarjeta de cálculo (`#calc-card`), constructor del esquema (`#builder-card`), reglas automáticas (`#auto-rules-list`), vista previa (`#preview-card`) y sección de impresión (`#print-section`).
- `app.js` — toda la lógica. Estado en `rows` (escalones) y `autoRules` (reglas). Funciones clave: `calcDose`, `applyKDIGOPreset`, `generateKDIGOSteps`, `applyAutoRules`, `recalcDates`, `renderRows`, `renderPreview`, `printReport`.
- `style.css` — estilos, incluye reglas `@media print`.

## Cómo trabajar aquí
- Probar en local: `python3 -m http.server 8000` en esta carpeta y abrir http://localhost:8000 (la extensión de Chrome no abre `file://`).
- No hay tests automáticos: verificar a mano con dosis típicas (60 mg, 80 mg, 7.5 mg) y revisar la vista de impresión.
- `git commit` y `git push` los corre Juanjo (en Claude Code, con el prefijo `!`). GitHub Pages publica en 1–2 minutos; verificar con `curl` la página publicada.
- Mantener el aviso de >80 mg y el redondeo a múltiplos de 5: son decisiones clínicas deliberadas.

## Historial relevante
- 2026-04: versión inicial, calculadora de dosis, botón "Nueva consulta".
- 2026-09-28: revisión; se quitó el contador de visitas (counterapi v1 devolvía 410), se corrigió la URL del PDF (404 por minúsculas), el texto "≈16 semanas" (con 80 mg dura 18) y el escalón de 7.5 mg cuando la dosis inicial es ≤7.5 mg.
- 2026-10-12: esas correcciones publicadas (commit 8683414).

## Pendientes
- Decidir si vuelve el contador de visitas (counterapi v2 exige crear un workspace).
- Proyecto hermano: Velocímetro Renal (`~/nefro-velocimetro`), misma línea de páginas clínicas en GitHub Pages.
