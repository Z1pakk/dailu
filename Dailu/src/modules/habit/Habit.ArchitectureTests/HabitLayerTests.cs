using ArchUnitNET.Domain;
using ArchUnitNET.Loader;
using Assembly = System.Reflection.Assembly;

namespace Habit.ArchitectureTests;

public class HabitLayerTests
{
    private static readonly Assembly Domain = Habit.Domain.AssemblyReference.Assembly;
    private static readonly Assembly Application = Habit.Application.AssemblyReference.Assembly;
    private static readonly Assembly Api = Habit.Api.AssemblyReference.Assembly;
    private static readonly Assembly Infrastructure = Habit.Infrastructure.AssemblyReference.Assembly;

    private static readonly Architecture Architecture = new ArchLoader()
        .LoadAssemblies(Domain, Application, Api, Infrastructure)
        .Build();

    [Fact]
    public void DomainLayer_Should_NotDependOnHigherLayers() =>
        LayerRules.DomainMustNotDependOn(Architecture, Domain, Application, Api, Infrastructure);

    [Fact]
    public void ApplicationLayer_Should_NotDependOnHigherLayers() =>
        LayerRules.ApplicationMustNotDependOn(Architecture, Application, Api, Infrastructure);

    [Fact]
    public void ApiLayer_Should_NotDependOnInfrastructure() =>
        LayerRules.ApiMustNotDependOn(Architecture, Api, Infrastructure);
}
