using Newtonsoft.Json;
using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Threading.Tasks;

namespace WebApplication3.Models
{
    public class PokemonService
    {
        private readonly HttpClient _httpClient;

        public PokemonService()
        {
            _httpClient = new HttpClient();
            _httpClient.BaseAddress = new Uri("https://pokeapi.co/api/v2/");
        }

        public async Task<List<Pokemon>> GetAllPokemonAsync()
        {
            var response = await _httpClient.GetAsync("pokemon?limit=1000"); // Consulta para obtener todos los Pokémon (limit=1000 para obtener la mayoría de los Pokémon)
            if (response.IsSuccessStatusCode)
            {
                var content = await response.Content.ReadAsStringAsync();
                var result = JsonConvert.DeserializeObject<PokemonListResponse>(content);
                return result.Results;
            }
            else
            {
                throw new Exception("Failed to fetch Pokémon data.");
            }
        }
    }
}