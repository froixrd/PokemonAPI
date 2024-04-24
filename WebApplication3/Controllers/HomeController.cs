using System;
using System.Threading.Tasks;
using System.Web.Mvc;
using WebApplication3.Models;

namespace WebApplication3.Controllers
{
    public class HomeController : Controller
    {
        private readonly PokemonService _pokemonService;

        public HomeController()
        {
            _pokemonService = new PokemonService(); // Aquí se crea una instancia de PokemonService
        }

        public async Task<ActionResult> Index()
        {
            try
            {
                var pokemonList = await _pokemonService.GetAllPokemonAsync();
                return View(pokemonList);
            }
            catch (Exception ex)
            {
                ViewBag.ErrorMessage = $"Error al obtener la lista de Pokémon: {ex.Message}";
                return View("Error");
            }
        }

        public ActionResult About()
        {
            ViewBag.Message = "Your application description page.";

            return View();
        }

        public ActionResult Contact()
        {
            ViewBag.Message = "Your contact page.";

            return View();
        }
    }
}