using System.Net;
using System.Web;
using System.Web.Hosting;
using System.Web.Mvc;
using System.Web.Optimization;
using System.Web.Routing;
using WebApplication3.Services;

namespace WebApplication3
{
    public class MvcApplication : HttpApplication
    {
        protected void Application_Start()
        {
            // PokeAPI solo acepta TLS 1.2 o superior.
            ServicePointManager.SecurityProtocol |= SecurityProtocolType.Tls12;

            MvcHandler.DisableMvcResponseHeader = true;
            ViewEngines.Engines.Clear();
            ViewEngines.Engines.Add(new RazorViewEngine());

            AreaRegistration.RegisterAllAreas();
            FilterConfig.RegisterGlobalFilters(GlobalFilters.Filters);
            RouteConfig.RegisterRoutes(RouteTable.Routes);
            BundleConfig.RegisterBundles(BundleTable.Bundles);

            // Precarga en segundo plano la lista y los tipos: la primera visita ya los tiene en caché.
            HostingEnvironment.QueueBackgroundWorkItem(async ct =>
            {
                try { await new PokemonService().WarmUpAsync(); }
                catch (PokeApiException) { /* se reintentará en la primera visita */ }
            });
        }
    }
}
