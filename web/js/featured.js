// Pokémon del banner de la portada: sale uno distinto cada día.
// Se guarda su tipo principal para pintar el banner con su color sin esperar a los datos.
// También lo lee tools/build-thumbs.mjs para generar las ilustraciones del banner.
export const FEATURED = [
    [6, "fire"], [25, "electric"], [94, "ghost"], [448, "fighting"], [658, "water"], [384, "dragon"],
    [150, "psychic"], [133, "normal"], [197, "dark"], [149, "dragon"], [445, "dragon"], [700, "fairy"],
    [1, "grass"], [9, "water"], [143, "normal"], [249, "psychic"], [282, "psychic"], [887, "dragon"],
    [1007, "fighting"], [815, "fire"], [778, "ghost"], [571, "dark"], [248, "rock"], [130, "water"]
];

/** El destacado de hoy (cambia a medianoche, igual para todos): { id, type }. */
export function featuredToday(date = new Date()) {
    const day = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
    const [id, type] = FEATURED[day % FEATURED.length];
    return { id, type };
}
