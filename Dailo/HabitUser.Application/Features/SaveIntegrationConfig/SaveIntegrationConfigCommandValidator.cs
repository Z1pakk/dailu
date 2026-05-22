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
                    .NotEmpty()
                    .WithMessage("Access token is required.")
                    .Must(x => !string.IsNullOrWhiteSpace(x))
                    .WithMessage("Access token cannot be only whitespace.")
                    .MaximumLength(255)
                    .WithMessage("Access token must not exceed 255 characters.");
            }
        );

        When(
            x => x.Config is StravaIntegrationConfig,
            () =>
            {
                RuleFor(x => ((StravaIntegrationConfig)x.Config).AccessToken)
                    .NotEmpty()
                    .WithMessage("Access token is required.")
                    .Must(x => !string.IsNullOrWhiteSpace(x))
                    .WithMessage("Access token cannot be only whitespace.")
                    .MaximumLength(255)
                    .WithMessage("Access token must not exceed 255 characters.");

                RuleFor(x => ((StravaIntegrationConfig)x.Config).RefreshToken)
                    .NotEmpty()
                    .WithMessage("Refresh token is required.")
                    .Must(x => !string.IsNullOrWhiteSpace(x))
                    .WithMessage("Refresh token cannot be only whitespace.")
                    .MaximumLength(255)
                    .WithMessage("Refresh token must not exceed 255 characters.");
            }
        );
    }
}
