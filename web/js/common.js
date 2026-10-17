/* Pokédex estática — utilidades comunes a todas las páginas. */

export const API = "https://pokeapi.co/api/v2/";
export const SPRITE = (id) => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
export const ARTWORK = (id) => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;

export const GENERATIONS = [
    { n: 1, roman: "I", region: "Kanto" },
    { n: 2, roman: "II", region: "Johto" },
    { n: 3, roman: "III", region: "Hoenn" },
    { n: 4, roman: "IV", region: "Sinnoh" },
    { n: 5, roman: "V", region: "Teselia" },
    { n: 6, roman: "VI", region: "Kalos" },
    { n: 7, roman: "VII", region: "Alola" },
    { n: 8, roman: "VIII", region: "Galar" },
    { n: 9, roman: "IX", region: "Paldea" }
];

export function generation(n) {
    return GENERATIONS.find((g) => g.n === n) || { n, roman: String(n), region: "" };
}

export const pad = (id) => String(id).padStart(4, "0");

export function esc(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

export function normalize(text) {
    return (text || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9♀♂ ]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

export function prettyName(slug) {
    return (slug || "").split("-").filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
}

export function isTyping(event) {
    const el = event.target;
    return !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
}

export function typeBadge(type, extra = "") {
    return `<span class="type type--${esc(type.key)}${extra}">${esc(type.name)}</span>`;
}

// ---------- Datos del listado (generados al publicar) ----------

let pokedexPromise;

/** data/pokedex.json: especies (nombre en español, tipos, generación) y los 18 tipos con su tabla de daño. */
export function loadPokedex() {
    if (!pokedexPromise) {
        pokedexPromise = fetch("data/pokedex.json", { cache: "no-cache" }).then((res) => {
            if (!res.ok) throw new Error("No se pudo cargar data/pokedex.json (" + res.status + ")");
            return res.json();
        }).then((data) => {
            data.typeByKey = new Map(data.types.map((t) => [t.key, t]));
            data.byId = new Map(data.species.map((s) => [s.id, s]));
            return data;
        });
        pokedexPromise.catch(() => { pokedexPromise = null; });
    }
    return pokedexPromise;
}

// ---------- PokeAPI ----------

export class NotFoundError extends Error { }

const requests = new Map();

/** GET a PokeAPI con reintentos ante 429/5xx/red y una sola petición por URL a la vez. */
export function api(pathOrUrl) {
    const url = pathOrUrl.startsWith("http") ? pathOrUrl : API + pathOrUrl;
    if (!requests.has(url)) {
        const promise = fetchWithRetry(url);
        requests.set(url, promise);
        promise.catch(() => requests.delete(url));
    }
    return requests.get(url);
}

/** Igual que api() pero devuelve null si falla: para datos secundarios que no deben romper la página. */
export function tryApi(pathOrUrl) {
    return pathOrUrl ? api(pathOrUrl).catch(() => null) : Promise.resolve(null);
}

async function fetchWithRetry(url, attempt = 1) {
    let res;
    try {
        res = await fetch(url);
    } catch (err) {
        if (attempt >= 3) throw new Error("No se pudo contactar con PokeAPI.");
        await wait(attempt);
        return fetchWithRetry(url, attempt + 1);
    }
    if (res.ok) return res.json();
    if (res.status === 404) throw new NotFoundError(url);
    if ((res.status === 429 || res.status >= 500) && attempt < 3) {
        await wait(attempt);
        return fetchWithRetry(url, attempt + 1);
    }
    throw new Error("PokeAPI respondió " + res.status + ".");
}

const wait = (attempt) => new Promise((r) => setTimeout(r, 400 * 2 ** (attempt - 1)));

/** Texto en español; si no hay, en inglés. Con latest toma la entrada más reciente. */
export function pickLanguage(items, field, latest = false) {
    for (const lang of ["es", "en"]) {
        const matches = (items || []).filter((i) => i.language && i.language.name === lang && i[field]);
        if (matches.length) return matches[latest ? matches.length - 1 : 0][field];
    }
    return null;
}

/** Los textos de los juegos traen saltos de línea y avances de página a mitad de frase. */
export function cleanText(text) {
    return text ? text.replace(/­\s?/g, "").replace(/[\f\n\r]/g, " ").replace(/\s+/g, " ").trim() : text;
}

// ---------- Comportamiento común ----------

const THEME_KEY = "pokedex-theme";

function currentTheme() {
    const set = document.documentElement.getAttribute("data-theme");
    if (set) return set;
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

const toggle = document.querySelector("[data-theme-toggle]");
if (toggle) {
    toggle.addEventListener("click", () => {
        const next = currentTheme() === "dark" ? "light" : "dark";
        document.documentElement.setAttribute("data-theme", next);
        try { localStorage.setItem(THEME_KEY, next); } catch (e) { /* sin almacenamiento */ }
    });
}

// Si falta el sprite, usar la ilustración oficial.
document.addEventListener("error", (event) => {
    const img = event.target;
    if (!img || img.tagName !== "IMG") return;
    const fallback = img.getAttribute("data-fallback");
    if (fallback && !img.hasAttribute("data-fell-back")) {
        img.setAttribute("data-fell-back", "");
        img.classList.add("is-artwork");
        img.src = fallback;
    }
}, true);
