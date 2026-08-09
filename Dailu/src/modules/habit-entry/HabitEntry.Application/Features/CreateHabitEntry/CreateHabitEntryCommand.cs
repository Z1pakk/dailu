using HabitEntry.Application.IntegratedServices;
using HabitEntry.Application.Models;
using HabitEntry.Application.Persistence;
using HabitEntry.Domain.Aggregates;
using HabitEntry.Domain.Enums;
using SharedKernel.CQRS;
using SharedKernel.ResultPattern;
using SharedKernel.User;
using StrictId;

namespace HabitEntry.Application.Features.CreateHabitEntry;

public sealed record CreateHabitEntryCommand(
    Id HabitId,
    int Value,
    string? Notes,
    DateTime CompletedAt
) : ICommand<Result<CreateHabitEntryCommandResponse>>;

public sealed record CreateHabitEntryCommandResponse(Id<HabitEntryModel> Id);

public sealed class CreateHabitEntryCommandHandler(
    IHabitEntryDbContext dbContext,
    ICurrentUserService currentUserService,
    IHabitService habitService
) : ICommandHandler<CreateHabitEntryCommand, Result<CreateHabitEntryCommandResponse>>
{
    public async ValueTask<Result<CreateHabitEntryCommandResponse>> Handle(
        CreateHabitEntryCommand request,
        CancellationToken cancellationToken
    )
    {
        var habits = await habitService.GetByIdsAsync([request.HabitId], cancellationToken);

        if (!habits.ContainsKey(request.HabitId))
        {
            return Result<CreateHabitEntryCommandResponse>.NotFound(
                "Habit not found or does not belong to the current user."
            );
        }

        var habitEntryResult = HabitEntryAggregate.Create(
            Id<HabitEntryAggregate>.NewId(),
            currentUserService.UserId,
            request.HabitId,
            request.Value,
            request.Notes,
            HabitEntrySource.Manual,
            externalId: null,
            request.CompletedAt
        );

        if (habitEntryResult.IsFailure)
        {
            return habitEntryResult.ToTargetResult<CreateHabitEntryCommandResponse>();
        }

        var entity = habitEntryResult.Value.ToEntity();

        dbContext.HabitEntries.Add(entity);

        await dbContext.SaveChangesAsync(cancellationToken);

        return Result<CreateHabitEntryCommandResponse>.Success(
            new CreateHabitEntryCommandResponse(new Id<HabitEntryModel>(entity.Id.Value))
        );
    }
}
