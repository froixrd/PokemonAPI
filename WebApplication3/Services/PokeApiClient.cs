using System;
using System.IO;
using System.Net;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Runtime.Caching;
using System.Threading;
using System.Threading.Tasks;
using Newtonsoft.Json;
using Newtonsoft.Json.Serialization;

namespace WebApplication3.Services
{
    /// <summary>Error al hablar con PokeAPI (caída, tiempo agotado, respuesta inválida...).</summary>
    public class PokeApiException : Exception
    {
        public PokeApiException(string message, Exception inner = null) : base(message, inner) { }
    }

    /// <summary>PokeAPI devolvió 404: el recurso pedido no existe.</summary>
    public class PokeApiNotFoundException : PokeApiException
    {
        public PokeApiNotFoundException(string resource)
            : base("No existe el recurso '" + resource + "' en PokeAPI.") { }
    }

    /// <summary>
    /// Cliente de PokeAPI con:
    ///  - un único HttpClient para toda la aplicación (evita agotar sockets),
    ///  - caché en memoria de 12 h (los datos de PokeAPI son prácticamente estáticos),
    ///  - deduplicación de peticiones simultáneas a la misma URL,
    ///  - reintentos con espera exponencial ante 429/5xx/errores de red,
    ///  - deserialización en streaming (sin cargar el JSON entero en un string).
    /// </summary>
    public sealed class PokeApiClient
    {
        public static readonly PokeApiClient Shared = new PokeApiClient();

        private const string BaseUrl = "https://pokeapi.co/api/v2/";
        private const int MaxAttempts = 3;
        private static readonly TimeSpan CacheDuration = TimeSpan.FromHours(12);

        private readonly HttpClient _http;
        private readonly MemoryCache _cache = new MemoryCache("PokeApi");
        private readonly JsonSerializer _serializer = JsonSerializer.Create(new JsonSerializerSettings
        {
            ContractResolver = new DefaultContractResolver { NamingStrategy = new SnakeCaseNamingStrategy() },
            MissingMemberHandling = MissingMemberHandling.Ignore,
            NullValueHandling = NullValueHandling.Ignore
        });

        private PokeApiClient()
        {
            var baseUri = new Uri(BaseUrl);
            var handler = new HttpClientHandler
            {
                AutomaticDecompression = DecompressionMethods.GZip | DecompressionMethods.Deflate
            };

            _http = new HttpClient(handler) { BaseAddress = baseUri, Timeout = TimeSpan.FromSeconds(20) };
            _http.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
            _http.DefaultRequestHeaders.UserAgent.ParseAdd("PokedexMvc/2.0 (+https://github.com/froixrd/PokemonAPI)");

            // Un HttpClient de larga vida no se entera de cambios de DNS: renovar conexiones cada 5 min.
            ServicePointManager.FindServicePoint(baseUri).ConnectionLeaseTimeout = (int)TimeSpan.FromMinutes(5).TotalMilliseconds;
        }

        /// <summary>
        /// Descarga (o devuelve de caché) un recurso. Acepta una ruta relativa ("pokemon/25")
        /// o una URL completa de PokeAPI, como las que vienen dentro de otras respuestas.
        /// </summary>
        public Task<T> GetAsync<T>(string pathOrUrl) where T : class
        {
            var path = Normalize(pathOrUrl);
            var key = typeof(T).FullName + "|" + path;

            var created = new Lazy<Task<T>>(() => FetchAsync<T>(path), LazyThreadSafetyMode.ExecutionAndPublication);
            var existing = _cache.AddOrGetExisting(key, created, DateTimeOffset.UtcNow.Add(CacheDuration)) as Lazy<Task<T>>;
            var lazy = existing ?? created;
            var task = lazy.Value;

            if (existing == null)
            {
                // Si la descarga falla, no dejar el error en caché: la siguiente visita lo reintenta.
                task.ContinueWith(
                    t => { if (ReferenceEquals(_cache.Get(key), lazy)) _cache.Remove(key); },
                    CancellationToken.None,
                    TaskContinuationOptions.NotOnRanToCompletion | TaskContinuationOptions.ExecuteSynchronously,
                    TaskScheduler.Default);
            }

            return task;
        }

        /// <summary>Igual que GetAsync pero devuelve null si falla, para datos secundarios que no deben tumbar la página.</summary>
        public async Task<T> TryGetAsync<T>(string pathOrUrl) where T : class
        {
            if (string.IsNullOrEmpty(pathOrUrl)) return null;
            try
            {
                return await GetAsync<T>(pathOrUrl).ConfigureAwait(false);
            }
            catch (PokeApiException)
            {
                return null;
            }
        }

        private async Task<T> FetchAsync<T>(string path) where T : class
        {
            for (var attempt = 1; ; attempt++)
            {
                try
                {
                    using (var response = await _http.GetAsync(path, HttpCompletionOption.ResponseHeadersRead).ConfigureAwait(false))
                    {
                        if (response.StatusCode == HttpStatusCode.NotFound)
                            throw new PokeApiNotFoundException(path);

                        if (IsTransient(response.StatusCode) && attempt < MaxAttempts)
                        {
                            await Task.Delay(Backoff(attempt)).ConfigureAwait(false);
                            continue;
                        }

                        if (!response.IsSuccessStatusCode)
                            throw new PokeApiException("PokeAPI respondió " + (int)response.StatusCode + " al pedir '" + path + "'.");

                        using (var stream = await response.Content.ReadAsStreamAsync().ConfigureAwait(false))
                        using (var reader = new StreamReader(stream))
                        using (var json = new JsonTextReader(reader))
                        {
                            var result = _serializer.Deserialize<T>(json);
                            if (result == null)
                                throw new PokeApiException("PokeAPI devolvió una respuesta vacía para '" + path + "'.");
                            return result;
                        }
                    }
                }
                catch (PokeApiException)
                {
                    throw;
                }
                catch (JsonException ex)
                {
                    throw new PokeApiException("PokeAPI devolvió un formato inesperado para '" + path + "'.", ex);
                }
                catch (Exception ex) when (ex is HttpRequestException || ex is TaskCanceledException || ex is IOException)
                {
                    if (attempt >= MaxAttempts)
                        throw new PokeApiException("No se pudo contactar con PokeAPI ('" + path + "').", ex);
                    await Task.Delay(Backoff(attempt)).ConfigureAwait(false);
                }
            }
        }

        private static bool IsTransient(HttpStatusCode status)
        {
            var code = (int)status;
            return code == 429 || code == 408 || code >= 500;
        }

        private static TimeSpan Backoff(int attempt)
        {
            return TimeSpan.FromMilliseconds(400 * Math.Pow(2, attempt - 1));
        }

        private static string Normalize(string pathOrUrl)
        {
            if (string.IsNullOrWhiteSpace(pathOrUrl))
                throw new ArgumentException("Ruta de PokeAPI vacía.", "pathOrUrl");

            var path = pathOrUrl.Trim();
            if (path.StartsWith(BaseUrl, StringComparison.OrdinalIgnoreCase))
                path = path.Substring(BaseUrl.Length);

            var query = string.Empty;
            var q = path.IndexOf('?');
            if (q >= 0)
            {
                query = path.Substring(q);
                path = path.Substring(0, q);
            }

            return path.Trim('/').ToLowerInvariant() + query;
        }
    }
}
