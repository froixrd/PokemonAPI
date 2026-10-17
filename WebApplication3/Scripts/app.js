/* Pokédex — interacción en el navegador (sin dependencias). */
(function () {
    "use strict";

    var THEME_KEY = "pokedex-theme";

    function storageGet(key) {
        try { return localStorage.getItem(key); } catch (e) { return null; }
    }

    function storageSet(key, value) {
        try { localStorage.setItem(key, value); } catch (e) { /* sin almacenamiento: no pasa nada */ }
    }

    function normalize(text) {
        return (text || "")
            .toLowerCase()
            .normalize("NFD")
            .replace(/[̀-ͯ]/g, "")
            .replace(/[^a-z0-9♀♂ ]/g, " ")
            .replace(/\s+/g, " ")
            .trim();
    }

    function isTyping(event) {
        var el = event.target;
        return el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
    }

    // ---------- Tema claro/oscuro ----------

    function currentTheme() {
        var set = document.documentElement.getAttribute("data-theme");
        if (set) return set;
        return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }

    var toggle = document.querySelector("[data-theme-toggle]");
    if (toggle) {
        toggle.addEventListener("click", function () {
            var next = currentTheme() === "dark" ? "light" : "dark";
            document.documentElement.setAttribute("data-theme", next);
            storageSet(THEME_KEY, next);
        });
    }

    // ---------- Imágenes: si falta el sprite, usar la ilustración oficial ----------

    document.addEventListener("error", function (event) {
        var img = event.target;
        if (!img || img.tagName !== "IMG") return;
        var fallback = img.getAttribute("data-fallback");
        if (fallback && !img.hasAttribute("data-fell-back")) {
            img.setAttribute("data-fell-back", "");
            img.classList.add("is-artwork");
            img.src = fallback;
        }
    }, true);

    // ---------- Listado: búsqueda, filtros y orden ----------

    var grid = document.getElementById("dex-grid");
    var form = document.querySelector("[data-filters]");

    if (grid && form) {
        var input = document.getElementById("q");
        var genSelect = document.getElementById("gen");
        var sortSelect = document.getElementById("orden");
        var counter = document.getElementById("result-count");
        var emptyState = document.getElementById("empty-state");
        var resetButtons = document.querySelectorAll("[data-reset]");
        var chips = Array.prototype.slice.call(form.querySelectorAll("[data-type]"));
        var total = grid.children.length;

        var cards = Array.prototype.map.call(grid.children, function (el) {
            var id = parseInt(el.getAttribute("data-id"), 10);
            return {
                el: el,
                id: id,
                number: String(id).padStart(4, "0"),
                name: normalize(el.getAttribute("data-name")),
                display: el.querySelector(".dex-card__name").textContent,
                gen: el.getAttribute("data-gen"),
                types: (el.getAttribute("data-types") || "").split(" ")
            };
        });

        var state = { q: "", gen: "", types: [], sort: "num" };
        var lastSort = "num";
        var visible = cards;

        var sorters = {
            "num": function (a, b) { return a.id - b.id; },
            "num-desc": function (a, b) { return b.id - a.id; },
            "nombre": function (a, b) { return a.display.localeCompare(b.display, "es"); },
            "nombre-desc": function (a, b) { return b.display.localeCompare(a.display, "es"); }
        };

        var matches = function (card) {
            if (state.gen && card.gen !== state.gen) return false;
            for (var i = 0; i < state.types.length; i++) {
                if (card.types.indexOf(state.types[i]) < 0) return false;
            }
            if (!state.q) return true;
            if (/^\d+$/.test(state.q)) {
                return card.id === parseInt(state.q, 10) || card.number.indexOf(state.q) === 0;
            }
            return card.name.indexOf(state.q) >= 0;
        };

        var apply = function () {
            visible = [];
            cards.forEach(function (card) {
                var show = matches(card);
                card.el.hidden = !show;
                if (show) visible.push(card);
            });

            if (state.sort !== lastSort) {
                var fragment = document.createDocumentFragment();
                cards.slice().sort(sorters[state.sort] || sorters.num).forEach(function (card) {
                    fragment.appendChild(card.el);
                });
                grid.appendChild(fragment);
                lastSort = state.sort;
            }

            var filtered = state.q || state.gen || state.types.length;
            counter.textContent = filtered
                ? visible.length + (visible.length === 1 ? " especie" : " especies") + " de " + total
                : total + " especies";
            emptyState.hidden = visible.length > 0;
            resetButtons.forEach(function (b) { if (b.closest("[data-filters]")) b.hidden = !filtered; });

            chips.forEach(function (chip) {
                var on = state.types.indexOf(chip.getAttribute("data-type")) >= 0;
                chip.setAttribute("aria-pressed", on ? "true" : "false");
            });

            syncUrl();
        };

        var syncUrl = function () {
            var params = new URLSearchParams();
            if (input.value.trim()) params.set("q", input.value.trim());
            if (state.gen) params.set("gen", state.gen);
            if (state.types.length) params.set("tipo", state.types.join(","));
            if (state.sort !== "num") params.set("orden", state.sort);
            var query = params.toString();
            history.replaceState(null, "", location.pathname + (query ? "?" + query : ""));
        };

        var readUrl = function () {
            var params = new URLSearchParams(location.search);
            input.value = params.get("q") || "";
            state.q = normalize(input.value);
            state.gen = params.get("gen") || "";
            genSelect.value = state.gen;
            var known = chips.map(function (c) { return c.getAttribute("data-type"); });
            state.types = (params.get("tipo") || "").split(",").filter(function (t) { return known.indexOf(t) >= 0; }).slice(0, 2);
            state.sort = sorters[params.get("orden")] ? params.get("orden") : "num";
            sortSelect.value = state.sort;
        };

        var debounce;
        input.addEventListener("input", function () {
            clearTimeout(debounce);
            debounce = setTimeout(function () {
                state.q = normalize(input.value);
                apply();
            }, 100);
        });

        // Intro con un único resultado abre su ficha.
        input.addEventListener("keydown", function (event) {
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

        genSelect.addEventListener("change", function () {
            state.gen = genSelect.value;
            apply();
        });

        sortSelect.addEventListener("change", function () {
            state.sort = sortSelect.value;
            apply();
        });

        chips.forEach(function (chip) {
            chip.addEventListener("click", function () {
                var type = chip.getAttribute("data-type");
                var index = state.types.indexOf(type);
                if (index >= 0) state.types.splice(index, 1);
                else {
                    state.types.push(type);
                    if (state.types.length > 2) state.types.shift(); // como mucho dos tipos
                }
                apply();
            });
        });

        resetButtons.forEach(function (button) {
            button.addEventListener("click", function () {
                input.value = "";
                state = { q: "", gen: "", types: [], sort: state.sort };
                genSelect.value = "";
                apply();
                input.focus();
            });
        });

        // "/" enfoca la búsqueda, como en muchas webs.
        document.addEventListener("keydown", function (event) {
            if (event.key === "/" && !isTyping(event) && !event.ctrlKey && !event.metaKey) {
                event.preventDefault();
                input.focus();
                input.select();
            }
        });

        readUrl();
        if (state.q || state.gen || state.types.length || state.sort !== "num") apply();
    }

    // ---------- Ficha ----------

    var artwork = document.getElementById("artwork");
    var shinyToggle = document.querySelector("[data-shiny-toggle]");

    if (artwork && shinyToggle) {
        var shinyLabel = shinyToggle.querySelector("[data-shiny-label]");
        var shinyImage = new Image();
        shinyImage.src = artwork.getAttribute("data-shiny"); // precarga

        shinyToggle.addEventListener("click", function () {
            var shiny = shinyToggle.getAttribute("aria-pressed") !== "true";
            var src = artwork.getAttribute(shiny ? "data-shiny" : "data-normal");
            artwork.classList.add("is-swapping");
            setTimeout(function () {
                artwork.onload = function () { artwork.classList.remove("is-swapping"); };
                artwork.src = src;
                if (artwork.complete) artwork.classList.remove("is-swapping");
            }, 160);
            shinyToggle.setAttribute("aria-pressed", shiny ? "true" : "false");
            shinyLabel.textContent = shiny ? "Ver color normal" : "Ver variocolor";
        });
    }

    var cryButton = document.querySelector("[data-cry]");
    if (cryButton) {
        var cry;
        cryButton.addEventListener("click", function () {
            if (!cry) {
                cry = new Audio(cryButton.getAttribute("data-cry"));
                cry.volume = 0.5;
            }
            cry.currentTime = 0;
            var playing = cry.play();
            if (playing && playing.catch) playing.catch(function () { /* el navegador bloqueó el audio */ });
        });
    }

    // Flechas izquierda/derecha: Pokémon anterior/siguiente.
    var prev = document.querySelector("[data-nav='prev']");
    var next = document.querySelector("[data-nav='next']");
    if (prev || next) {
        document.addEventListener("keydown", function (event) {
            if (isTyping(event) || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
            if (event.key === "ArrowLeft" && prev) prev.click();
            if (event.key === "ArrowRight" && next) next.click();
        });
    }
})();
