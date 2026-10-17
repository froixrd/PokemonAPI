/* Pokédex estática — listado con búsqueda, filtros y orden. */
import { ARTWORK, GENERATIONS, SPRITE, esc, isTyping, loadPokedex, normalize, pad, typeBadge } from "./common.js";

const grid = document.getElementById("dex-grid");
const form = document.querySelector("[data-filters]");
const input = document.getElementById("q");
const genSelect = document.getElementById("gen");
const sortSelect = document.getElementById("orden");
const counter = document.getElementById("result-count");
const emptyState = document.getElementById("empty-state");
const chipsBox = document.getElementById("type-chips");

let data;
try {
    data = await loadPokedex();
} catch (err) {
    console.error(err);
    form.hidden = true;
    document.getElementById("load-error").hidden = false;
    throw err;
}

// ---------- Pintar ----------

const species = data.species;
const first = species[0];
const last = species[species.length - 1];
document.getElementById("intro-lead").textContent =
    `${species.length} especies, de ${first.name} a ${last.name}. Busca por nombre o número, o filtra por tipo y generación.`;

genSelect.insertAdjacentHTML("beforeend", GENERATIONS
    .filter((g) => species.some((s) => s.gen === g.n))
    .map((g) => `<option value="${g.n}">Gen. ${g.roman} (${esc(g.region)})</option>`).join(""));

chipsBox.innerHTML = data.types
    .map((t) => `<button type="button" class="type type--${esc(t.key)} chip" data-type="${esc(t.key)}" aria-pressed="false">${esc(t.name)}</button>`)
    .join("");

grid.innerHTML = species.map((s) => {
    const types = s.types.map((k) => data.typeByKey.get(k)).filter(Boolean);
    return `<li class="dex-card tc-${esc(s.types[0] || "normal")}" data-id="${s.id}" data-name="${esc(s.name.toLowerCase())} ${esc(s.slug)}" data-gen="${s.gen}" data-types="${esc(s.types.join(" "))}">
<a class="dex-card__link" href="pokemon.html?id=${s.id}">
<span class="dex-card__num">${pad(s.id)}</span>
<span class="dex-card__stage"><img src="${SPRITE(s.id)}" data-fallback="${ARTWORK(s.id)}" alt="" width="96" height="96" loading="lazy" decoding="async" /></span>
<span class="dex-card__name">${esc(s.name)}</span>
<span class="dex-card__types">${types.map((t) => typeBadge(t)).join("")}</span>
</a></li>`;
}).join("");

// ---------- Filtrar ----------

const resetButtons = document.querySelectorAll("[data-reset]");
const chips = Array.from(chipsBox.querySelectorAll("[data-type]"));
const total = grid.children.length;

const cards = Array.from(grid.children, (el) => {
    const id = Number(el.getAttribute("data-id"));
    return {
        el,
        id,
        number: pad(id),
        name: normalize(el.getAttribute("data-name")),
        display: el.querySelector(".dex-card__name").textContent,
        gen: el.getAttribute("data-gen"),
        types: el.getAttribute("data-types").split(" ")
    };
});

let state = { q: "", gen: "", types: [], sort: "num" };
let lastSort = "num";
let visible = cards;

const sorters = {
    "num": (a, b) => a.id - b.id,
    "num-desc": (a, b) => b.id - a.id,
    "nombre": (a, b) => a.display.localeCompare(b.display, "es"),
    "nombre-desc": (a, b) => b.display.localeCompare(a.display, "es")
};

function matches(card) {
    if (state.gen && card.gen !== state.gen) return false;
    if (state.types.some((t) => !card.types.includes(t))) return false;
    if (!state.q) return true;
    if (/^\d+$/.test(state.q)) return card.id === Number(state.q) || card.number.startsWith(state.q);
    return card.name.includes(state.q);
}

function apply() {
    visible = [];
    for (const card of cards) {
        const show = matches(card);
        card.el.hidden = !show;
        if (show) visible.push(card);
    }

    if (state.sort !== lastSort) {
        const fragment = document.createDocumentFragment();
        cards.slice().sort(sorters[state.sort] || sorters.num).forEach((card) => fragment.appendChild(card.el));
        grid.appendChild(fragment);
        lastSort = state.sort;
    }

    const filtered = !!(state.q || state.gen || state.types.length);
    counter.textContent = filtered
        ? `${visible.length} ${visible.length === 1 ? "especie" : "especies"} de ${total}`
        : `${total} especies`;
    emptyState.hidden = visible.length > 0;
    resetButtons.forEach((b) => { if (b.closest("[data-filters]")) b.hidden = !filtered; });
    chips.forEach((chip) => chip.setAttribute("aria-pressed", state.types.includes(chip.getAttribute("data-type")) ? "true" : "false"));
    syncUrl();
}

function syncUrl() {
    const params = new URLSearchParams();
    if (input.value.trim()) params.set("q", input.value.trim());
    if (state.gen) params.set("gen", state.gen);
    if (state.types.length) params.set("tipo", state.types.join(","));
    if (state.sort !== "num") params.set("orden", state.sort);
    const query = params.toString();
    history.replaceState(null, "", location.pathname + (query ? "?" + query : ""));
}

function readUrl() {
    const params = new URLSearchParams(location.search);
    input.value = params.get("q") || "";
    state.q = normalize(input.value);
    state.gen = params.get("gen") || "";
    genSelect.value = state.gen;
    const known = chips.map((c) => c.getAttribute("data-type"));
    state.types = (params.get("tipo") || "").split(",").filter((t) => known.includes(t)).slice(0, 2);
    state.sort = sorters[params.get("orden")] ? params.get("orden") : "num";
    sortSelect.value = state.sort;
}

let debounce;
input.addEventListener("input", () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => { state.q = normalize(input.value); apply(); }, 100);
});

// Intro con un único resultado abre su ficha; Esc borra la búsqueda.
input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
        event.preventDefault();
        clearTimeout(debounce);
        state.q = normalize(input.value);
        apply();
        if (visible.length === 1) visible[0].el.querySelector("a").click();
    } else if (event.key === "Escape" && input.value) {
        input.value = "";
        state.q = "";
        apply();
    }
});

genSelect.addEventListener("change", () => { state.gen = genSelect.value; apply(); });
sortSelect.addEventListener("change", () => { state.sort = sortSelect.value; apply(); });

chips.forEach((chip) => {
    chip.addEventListener("click", () => {
        const type = chip.getAttribute("data-type");
        const index = state.types.indexOf(type);
        if (index >= 0) state.types.splice(index, 1);
        else {
            state.types.push(type);
            if (state.types.length > 2) state.types.shift(); // como mucho dos tipos
        }
        apply();
    });
});

resetButtons.forEach((button) => {
    button.addEventListener("click", () => {
        input.value = "";
        state = { q: "", gen: "", types: [], sort: state.sort };
        genSelect.value = "";
        apply();
        input.focus();
    });
});

// "/" enfoca la búsqueda.
document.addEventListener("keydown", (event) => {
    if (event.key === "/" && !isTyping(event) && !event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        input.focus();
        input.select();
    }
});

readUrl();
apply();
