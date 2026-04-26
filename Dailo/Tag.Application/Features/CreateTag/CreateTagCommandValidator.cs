using FluentValidation;
using Microsoft.EntityFrameworkCore;
using SharedKernel.User;
using Tag.Application.Persistence;

namespace Tag.Application.Features.CreateTag;

public sealed class CreateTagCommandValidator : AbstractValidator<CreateTagCommand>
{
    public CreateTagCommandValidator(
        ITagDbContext dbContext,
        ICurrentUserService currentUserService
    )
    {
        RuleFor(x => x.Name)
            .NotEmpty()
            .WithMessage("'Name' must not be empty.")
            .MaximumLength(100)
            .MustAsync(
                async (name, cancellationToken) =>
                    !await dbContext.Tags.AnyAsync(
                        t => t.UserId == currentUserService.UserId && t.Name == name,
                        cancellationToken
                    )
            )
            .WithMessage("A tag with this name already exists.");

        When(
            x => !string.IsNullOrEmpty(x.Description),
            () =>
            {
                RuleFor(x => x.Description)
                    .NotEmpty()
                    .WithMessage("'Description' must not be empty.")
                    .MaximumLength(2000);
            }
        );
    }
}
