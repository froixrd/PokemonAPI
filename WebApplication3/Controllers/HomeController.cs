using System.Threading.Tasks;
using System.Web.Mvc;
using WebApplication3.Services;

namespace WebApplication3.Controllers
{
    public class HomeController : Controller
    {
        private readonly PokemonService _pokemon;

        public HomeController() : this(new PokemonService()) { }

        public HomeController(PokemonService pokemon)
        {
            _pokemon = pokemon;
        }

        // GET /
        [OutputCache(Duration = 600, VaryByParam = "none")]
        public async Task<ActionResult> Index()
        {
            var model = await _pokemon.GetPokedexAsync();
            return View(model);
        }

        // GET /pokemon/25  ·  /pokemon/pikachu (redirige a /pokemon/25)
        [OutputCache(Duration = 600, VaryByParam = "id")]
        public async Task<ActionResult> Pokemon(string id)
        {
            int number;
            if (!int.TryParse(id, out number))
            {
                var found = await _pokemon.FindIdByNameAsync(id);
                if (found == null) throw new PokeApiNotFoundException("pokemon/" + id);
                return RedirectToActionPermanent("Pokemon", new { id = found.Value });
            }

            if (number <= 0) throw new PokeApiNotFoundException("pokemon/" + id);

            var model = await _pokemon.GetDetailAsync(number);
            return View(model);
        }

        // GET /home/about
        public ActionResult About()
        {
            return View();
        }
    }
}
