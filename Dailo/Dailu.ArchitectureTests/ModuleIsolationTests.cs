using ArchUnitNET.Domain;
using ArchUnitNET.Fluent;
using ArchUnitNET.Loader;
using ArchUnitNET.xUnit;
using static ArchUnitNET.Fluent.ArchRuleDefinition;
using Assembly = System.Reflection.Assembly;

namespace Dailu.ArchitectureTests;

public class ModuleIsolationTests
{
    private static readonly Dictionary<string, Assembly[]> InnerLayers = new()
    {
        ["Habit"] =
        [
            Habit.Domain.AssemblyReference.Assembly,
            Habit.Application.AssemblyReference.Assembly,
            Habit.Api.AssemblyReference.Assembly,
            Habit.Infrastructure.AssemblyReference.Assembly,
        ],
        ["HabitEntry"] =
        [
            HabitEntry.Domain.AssemblyReference.Assembly,
            HabitEntry.Application.AssemblyReference.Assembly,
            HabitEntry.Api.AssemblyReference.Assembly,
            HabitEntry.Infrastructure.AssemblyReference.Assembly,
        ],
        ["HabitUser"] =
        [
            HabitUser.Domain.AssemblyReference.Assembly,
            HabitUser.Application.AssemblyReference.Assembly,
            HabitUser.Api.AssemblyReference.Assembly,
            HabitUser.Infrastructure.AssemblyReference.Assembly,
            HabitUser.Github.AssemblyReference.Assembly,
            HabitUser.Strava.AssemblyReference.Assembly,
        ],
        ["Tag"] =
        [
            Tag.Domain.AssemblyReference.Assembly,
            Tag.Application.AssemblyReference.Assembly,
            Tag.Api.AssemblyReference.Assembly,
            Tag.Infrastructure.AssemblyReference.Assembly,
        ],
        ["Identity"] =
        [
            Identity.Domain.AssemblyReference.Assembly,
            Identity.Application.AssemblyReference.Assembly,
            Identity.Api.AssemblyReference.Assembly,
            Identity.Infrastructure.AssemblyReference.Assembly,
        ],
    };

    private static readonly Dictionary<string, Assembly[]> AllAssemblies = new()
    {
        ["Habit"] =
        [
            Habit.Domain.AssemblyReference.Assembly,
            Habit.Application.AssemblyReference.Assembly,
            Habit.Api.AssemblyReference.Assembly,
            Habit.Infrastructure.AssemblyReference.Assembly,
            Habit.DataTransfer.AssemblyReference.Assembly,
            Habit.Integrations.AssemblyReference.Assembly,
        ],
        ["HabitEntry"] =
        [
            HabitEntry.Domain.AssemblyReference.Assembly,
            HabitEntry.Application.AssemblyReference.Assembly,
            HabitEntry.Api.AssemblyReference.Assembly,
            HabitEntry.Infrastructure.AssemblyReference.Assembly,
            HabitEntry.Integrations.AssemblyReference.Assembly,
        ],
        ["HabitUser"] =
        [
            HabitUser.Domain.AssemblyReference.Assembly,
            HabitUser.Application.AssemblyReference.Assembly,
            HabitUser.Api.AssemblyReference.Assembly,
            HabitUser.Infrastructure.AssemblyReference.Assembly,
            HabitUser.Github.AssemblyReference.Assembly,
            HabitUser.Strava.AssemblyReference.Assembly,
            HabitUser.Integrations.AssemblyReference.Assembly,
        ],
        ["Tag"] =
        [
            Tag.Domain.AssemblyReference.Assembly,
            Tag.Application.AssemblyReference.Assembly,
            Tag.Api.AssemblyReference.Assembly,
            Tag.Infrastructure.AssemblyReference.Assembly,
            Tag.DataTransfer.AssemblyReference.Assembly,
            Tag.Integrations.AssemblyReference.Assembly,
        ],
        ["Identity"] =
        [
            Identity.Domain.AssemblyReference.Assembly,
            Identity.Application.AssemblyReference.Assembly,
            Identity.Api.AssemblyReference.Assembly,
            Identity.Infrastructure.AssemblyReference.Assembly,
            Identity.DataTransfer.AssemblyReference.Assembly,
        ],
    };

    private static readonly Architecture Architecture = new ArchLoader()
        .LoadAssemblies(
            AllAssemblies.Values
                .SelectMany(a => a)
                .Distinct()
                .ToArray())
        .Build();

    [Theory]
    [InlineData("Habit")]
    [InlineData("HabitEntry")]
    [InlineData("HabitUser")]
    [InlineData("Tag")]
    [InlineData("Identity")]
    public void Module_Should_NotDependOnOtherModulesInnerLayers(string moduleName)
    {
        var moduleLayer = BuildLayer(AllAssemblies[moduleName], moduleName);

        var forbiddenAssemblies = InnerLayers
            .Where(kvp => kvp.Key != moduleName)
            .SelectMany(kvp => kvp.Value)
            .Distinct()
            .ToArray();

        IArchRule? rule = null;

        foreach (var forbiddenAssembly in forbiddenAssemblies)
        {
            var forbiddenLayer = Types().That()
                .ResideInAssembly(forbiddenAssembly)
                .As(forbiddenAssembly.GetName().Name!);

            var singleRule = Types().That().Are(moduleLayer).Should().NotDependOnAny(forbiddenLayer);
            rule = rule is null ? singleRule : rule.And(singleRule);
        }

        rule?.Check(Architecture);
    }

    private static IObjectProvider<IType> BuildLayer(Assembly[] assemblies, string label)
    {
        var layer = Types().That().ResideInAssembly(assemblies[0]);

        foreach (var assembly in assemblies.Skip(1))
        {
            layer = layer.Or().ResideInAssembly(assembly);
        }

        return layer.As(label);
    }
}
