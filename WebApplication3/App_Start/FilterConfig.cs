using System.Web.Mvc;
using WebApplication3.Services;

namespace WebApplication3
{
    public class FilterConfig
    {
        public static void RegisterGlobalFilters(GlobalFilterCollection filters)
        {
            filters.Add(new HandleErrorAttribute());

            // Se registra después para ejecutarse antes (los filtros de excepción van en orden inverso).
            filters.Add(new PokeApiErrorFilter());
        }
    }

    /// <summary>
    /// Convierte los fallos de PokeAPI en páginas útiles: 404 si el Pokémon no existe,
    /// 503 si la API no responde. El resto de errores sigue el flujo normal (HandleError).
    /// </summary>
    public class PokeApiErrorFilter : IExceptionFilter
    {
        public void OnException(ExceptionContext context)
        {
            if (context.ExceptionHandled) return;

            var apiError = context.Exception as PokeApiException;
            if (apiError == null) return;

            var notFound = apiError is PokeApiNotFoundException;

            context.Result = new ViewResult
            {
                ViewName = notFound ? "NotFound" : "ApiError",
                ViewData = new ViewDataDictionary(context.Controller.ViewData)
            };

            var response = context.HttpContext.Response;
            response.Clear();
            response.StatusCode = notFound ? 404 : 503;
            response.TrySkipIisCustomErrors = true;
            context.ExceptionHandled = true;
        }
    }
}
