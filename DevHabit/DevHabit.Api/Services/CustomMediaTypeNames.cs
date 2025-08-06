namespace DevHabit.Api.Services;

public static class CustomMediaTypeNames
{
    public static class Application
    {
        public const string JsonV1 = "application/json;v=1";
        public const string JsonV2 = "application/json;v=2";

        public const string HateoasJson = "application/vnd.devhabit.hateoas+json";
        public const string HateoasJsonV1 = "application/vnd.devhabit.hateoas.1+json";
        public const string HateoasJsonV2 = "application/vnd.devhabit.hateoas.2+json";
    }
}
