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

// ---------- Menú móvil ----------

const menu = document.getElementById("menu");
const menuToggle = document.querySelector("[data-menu-toggle]");
if (menu && menuToggle) {
    const setOpen = (open) => {
        menu.classList.toggle("is-open", open);
        menuToggle.setAttribute("aria-expanded", open ? "true" : "false");
        menuToggle.setAttribute("aria-label", open ? "Cerrar menú" : "Abrir menú");
    };
    menuToggle.addEventListener("click", () => setOpen(!menu.classList.contains("is-open")));
    menu.addEventListener("click", (event) => { if (event.target.closest("a")) setOpen(false); });
    document.addEventListener("keydown", (event) => { if (event.key === "Escape") setOpen(false); });
}

// ---------- Pokémon aleatorio ----------

document.addEventListener("click", async (event) => {
    const link = event.target.closest("[data-random]");
    if (!link) return;
    event.preventDefault();
    try {
        const data = await loadPokedex();
        const pick = data.species[Math.floor(Math.random() * data.species.length)];
        location.href = "pokemon.html?id=" + pick.id;
    } catch (err) {
        location.href = "pokedex.html";
    }
});

// ---------- Búsqueda rápida (botón de la barra o tecla "/") ----------

let dialog;

function searchResults(data, query) {
    const q = normalize(query);
    if (!q) return [];
    if (/^\d+$/.test(q)) {
        return data.species.filter((s) => String(s.id) === q || pad(s.id).startsWith(q)).slice(0, 8);
    }
    const starts = [];
    const contains = [];
    for (const s of data.species) {
        const name = normalize(s.name);
        const slug = normalize(s.slug.replace(/-/g, " "));
        if (name.startsWith(q) || slug.startsWith(q)) starts.push(s);
        else if (name.includes(q) || slug.includes(q)) contains.push(s);
        if (starts.length >= 8) break;
    }
    return starts.concat(contains).slice(0, 8);
}

function buildDialog() {
    dialog = document.createElement("dialog");
    dialog.className = "quicksearch";
    dialog.setAttribute("aria-label", "Buscar un Pokémon");
    dialog.innerHTML = `
<div class="quicksearch__field">
    <svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></svg>
    <input type="search" placeholder="Nombre o número del Pokémon" autocomplete="off" spellcheck="false" aria-label="Nombre o número" />
    <kbd>Esc</kbd>
</div>
<ul class="quicksearch__results" role="listbox" aria-label="Resultados"></ul>
<p class="quicksearch__foot"><span>↑ ↓ para moverte</span><span>Intro para abrir</span></p>`;
    document.body.appendChild(dialog);

    const input = dialog.querySelector("input");
    const list = dialog.querySelector(".quicksearch__results");
    let active = 0;

    const highlight = () => {
        list.querySelectorAll("a").forEach((a, i) => {
            a.classList.toggle("is-active", i === active);
            a.setAttribute("aria-selected", i === active ? "true" : "false");
        });
    };

    const update = async () => {
        const data = await loadPokedex();
        const found = searchResults(data, input.value);
        active = 0;
        if (!input.value.trim()) {
            list.innerHTML = `<li class="quicksearch__empty">Escribe un nombre (por ejemplo, Lucario) o un número.</li>`;
            return;
        }
        if (!found.length) {
            list.innerHTML = `<li class="quicksearch__empty">Ningún Pokémon con ese nombre o número.</li>`;
            return;
        }
        list.innerHTML = found.map((s) => `<li><a href="pokemon.html?id=${s.id}" role="option">
    <img src="${SPRITE(s.id)}" data-fallback="${ARTWORK(s.id)}" alt="" width="48" height="48" />
    <span><span class="quicksearch__name">${esc(s.name)}</span><br /><span class="quicksearch__num">Nº ${pad(s.id)}</span></span>
    <span class="quicksearch__types">${s.types.map((k) => data.typeByKey.get(k)).filter(Boolean).map((t) => typeBadge(t)).join("")}</span>
</a></li>`).join("");
        highlight();
    };

    input.addEventListener("input", update);
    input.addEventListener("keydown", (event) => {
        const links = list.querySelectorAll("a");
        if (event.key === "ArrowDown" && links.length) { event.preventDefault(); active = (active + 1) % links.length; highlight(); }
        else if (event.key === "ArrowUp" && links.length) { event.preventDefault(); active = (active - 1 + links.length) % links.length; highlight(); }
        else if (event.key === "Enter" && links.length) { event.preventDefault(); links[active].click(); }
    });
    dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
    update();
}

export function openSearch() {
    if (!dialog) buildDialog();
    dialog.showModal();
    const input = dialog.querySelector("input");
    input.select();
    input.focus();
}

document.querySelectorAll("[data-search-open]").forEach((button) => button.addEventListener("click", openSearch));

document.addEventListener("keydown", (event) => {
    // En la Pokédex "/" enfoca el filtro de la propia página (lo gestiona lista.js).
    if (event.key === "/" && !isTyping(event) && !event.ctrlKey && !event.metaKey && !document.querySelector("[data-filters]")) {
        event.preventDefault();
        openSearch();
    }
});
