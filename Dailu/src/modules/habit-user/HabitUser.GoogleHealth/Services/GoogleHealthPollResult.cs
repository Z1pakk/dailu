using HabitUser.Domain.ValueObjects.IntegrationConfigs;
using SharedKernel.ResultPattern;

namespace HabitUser.GoogleHealth.Services;

public sealed record GoogleHealthPollResult(
    Result Result,
    GoogleHealthIntegrationConfig? RefreshedConfig = null
);
