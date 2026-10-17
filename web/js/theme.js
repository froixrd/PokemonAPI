// Se carga en <head> sin defer: aplica el tema guardado antes de pintar para evitar el parpadeo.
(function () {
    try {
        var t = localStorage.getItem("pokedex-theme");
        if (t === "light" || t === "dark") document.documentElement.setAttribute("data-theme", t);
    } catch (e) { }
})();
