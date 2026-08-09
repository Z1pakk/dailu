using ArchUnitNET.Domain;
using ArchUnitNET.Loader;
using Assembly = System.Reflection.Assembly;

namespace HabitUser.ArchitectureTests;

public class HabitUserLayerTests
{
    private static readonly Assembly Domain = HabitUser.Domain.AssemblyReference.Assembly;
    private static readonly Assembly Application = HabitUser.Application.AssemblyReference.Assembly;
    private static readonly Assembly Api = HabitUser.Api.AssemblyReference.Assembly;
    private static readonly Assembly Infrastructure = HabitUser.Infrastructure.AssemblyReference.Assembly;
    private static readonly Assembly Github = HabitUser.Github.AssemblyReference.Assembly;
    private static readonly Assembly Strava = HabitUser.Strava.AssemblyReference.Assembly;

    private static readonly Architecture Architecture = new ArchLoader()
        .LoadAssemblies(Domain, Application, Api, Infrastructure, Github, Strava)
        .Build();

    [Fact]
    public void DomainLayer_Should_NotDependOnHigherLayers() =>
        LayerRules.DomainMustNotDependOn(Architecture, Domain, Application, Api, Infrastructure, Github, Strava);

    [Fact]
    public void ApplicationLayer_Should_NotDependOnHigherLayers() =>
        LayerRules.ApplicationMustNotDependOn(Architecture, Application, Api, Infrastructure, Github, Strava);

    [Fact]
    public void ApiLayer_Should_NotDependOnInfrastructure() =>
        LayerRules.ApiMustNotDependOn(Architecture, Api, Infrastructure, Github, Strava);

    [Fact]
    public void GithubLayer_Should_NotDependOnInfrastructure() =>
        LayerRules.AssemblyShouldNotDependOn(Architecture, "HabitUser.Github", Github, Infrastructure);

    [Fact]
    public void StravaLayer_Should_NotDependOnInfrastructure() =>
        LayerRules.AssemblyShouldNotDependOn(Architecture, "HabitUser.Strava", Strava, Infrastructure);
}
