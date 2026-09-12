// Recharts pinta atributos SVG con hex, no con clases: los tonos del gráfico
// se eligen aquí según el tema resuelto.
const TEMAS = {
    dark: {
        grid: '#334155',
        axis: '#64748b',
        cursor: 'rgba(255,255,255,0.05)',
        cursorStroke: 'rgba(255,255,255,0.12)',
        tooltip: { backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff', borderRadius: '8px' },
    },
    light: {
        grid: '#e2e8f0',
        axis: '#64748b',
        cursor: 'rgba(15,23,42,0.05)',
        cursorStroke: 'rgba(15,23,42,0.15)',
        tooltip: { backgroundColor: '#ffffff', borderColor: '#e2e8f0', color: '#0f172a', borderRadius: '8px' },
    },
}

export const chartTheme = (resolved) => TEMAS[resolved] ?? TEMAS.dark
