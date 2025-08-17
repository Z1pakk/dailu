using Microsoft.Net.Http.Headers;

namespace DevHabit.Api.Services;

public static class CustomMediaTypeNames
{
    public static class Application
    {
        private const string Prefix = "application";
        private const string VndPrefix = "vnd.devhabit";

        public const string JsonV1 = $"{Prefix}/json;v=1";
        public const string JsonV2 = $"{Prefix}/json;v=2";

        public const string HateoasJson = $"{Prefix}/{VndPrefix}.hateoas+json";

        public static readonly MediaTypeHeaderValue HateoasJsonMediaType = new(HateoasJson);

        public const string HateoasJsonV1 = $"{Prefix}/{VndPrefix}.hateoas.1+json";
        public const string HateoasJsonV2 = $"{Prefix}/{VndPrefix}.hateoas.2+json";
    }
}
