namespace SharedInfrastructure.Health;

public static class HealthCheckTags
{
    /// <summary>
    /// Checks with this tag run on <c>/health/ready</c> — modules tag their own checks with it.
    /// </summary>
    public const string Ready = "ready";
}
