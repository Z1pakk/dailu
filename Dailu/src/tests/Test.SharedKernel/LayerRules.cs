using ArchUnitNET.Domain;
using ArchUnitNET.Fluent;
using ArchUnitNET.xUnit;
using static ArchUnitNET.Fluent.ArchRuleDefinition;
using Assembly = System.Reflection.Assembly;

namespace Test.SharedKernel;

public static class LayerRules
{
    public static void DomainMustNotDependOn(
        Architecture architecture,
        Assembly domain,
        params Assembly[] forbidden
    ) => AssemblyShouldNotDependOn(architecture, "Domain", domain, forbidden);

    public static void ApplicationMustNotDependOn(
        Architecture architecture,
        Assembly application,
        params Assembly[] forbidden
    ) => AssemblyShouldNotDependOn(architecture, "Application", application, forbidden);

    public static void ApiMustNotDependOn(
        Architecture architecture,
        Assembly api,
        params Assembly[] forbidden
    ) => AssemblyShouldNotDependOn(architecture, "Api", api, forbidden);

    public static void AssemblyShouldNotDependOn(
        Architecture architecture,
        string label,
        Assembly assembly,
        params Assembly[] forbidden
    )
    {
        var sourceLayer = Types().That().ResideInAssembly(assembly).As(label);

        IArchRule? rule = null;

        foreach (var forbiddenAssembly in forbidden)
        {
            var forbiddenLayer = Types()
                .That()
                .ResideInAssembly(forbiddenAssembly)
                .As(forbiddenAssembly.GetName().Name!);

            var singleRule = Types()
                .That()
                .Are(sourceLayer)
                .Should()
                .NotDependOnAny(forbiddenLayer);
            rule = rule is null ? singleRule : rule.And(singleRule);
        }

        rule?.Check(architecture);
    }
}
