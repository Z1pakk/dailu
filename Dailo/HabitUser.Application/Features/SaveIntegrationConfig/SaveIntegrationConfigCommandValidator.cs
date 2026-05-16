using FluentValidation;
using HabitUser.Domain.Integrations;

namespace HabitUser.Application.Features.SaveIntegrationConfig;

public sealed class SaveIntegrationConfigCommandValidator
    : AbstractValidator<SaveIntegrationConfigCommand>
{
    public SaveIntegrationConfigCommandValidator()
    {
        When(
            x => x.Config is GithubIntegrationConfig,
            () =>
            {
                RuleFor(x => ((GithubIntegrationConfig)x.Config).AccessToken)
                    .NotEmpty().WithMessage("Access token is required.")
                    .Must(x => !string.IsNullOrWhiteSpace(x)).WithMessage("Access token cannot be only whitespace.")
                    .MaximumLength(255).WithMessage("Access token must not exceed 255 characters.");

                When(
                    x => ((GithubIntegrationConfig)x.Config).ExpiresInDays is not null,
                    () =>
                    {
                        RuleFor(x => ((GithubIntegrationConfig)x.Config).ExpiresInDays)
                            .GreaterThan(0).WithMessage("Expiry must be greater than 0 days.")
                            .LessThanOrEqualTo(365).WithMessage("Expiry must not exceed 365 days.");
                    }
                );
            }
        );

        When(
            x => x.Config is StravaIntegrationConfig,
            () =>
            {
                RuleFor(x => ((StravaIntegrationConfig)x.Config).ClientId)
                    .NotEmpty().WithMessage("Client ID is required.")
                    .Must(x => !string.IsNullOrWhiteSpace(x)).WithMessage("Client ID cannot be only whitespace.")
                    .MaximumLength(100).WithMessage("Client ID must not exceed 100 characters.");

                RuleFor(x => ((StravaIntegrationConfig)x.Config).ClientSecret)
                    .NotEmpty().WithMessage("Client secret is required.")
                    .Must(x => !string.IsNullOrWhiteSpace(x)).WithMessage("Client secret cannot be only whitespace.")
                    .MaximumLength(255).WithMessage("Client secret must not exceed 255 characters.");
            }
        );
    }
}
