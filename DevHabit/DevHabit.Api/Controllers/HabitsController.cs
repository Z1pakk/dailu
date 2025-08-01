using DevHabit.Api.Database;
using DevHabit.Api.DTOs.Habits;
using DevHabit.Api.Entities;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DevHabit.Api.Controllers;

[ApiController]
[Route("habits")]
public class HabitsController(ApplicationDbContext dbContext) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<HabitCollectionDto>> GetHabits()
    {
        List<HabitDto> habits = await dbContext
            .Habits.Select(h => new HabitDto()
            {
                Id = h.Id,
                Name = h.Name,
                Description = h.Description,
                Type = h.Type,
                Frequency = new FrequencyDto
                {
                    Type = h.Frequency.Type,
                    TimesPerPeriod = h.Frequency.TimesPerPeriod,
                },
                Target = new TargetDto { Value = h.Target.Value, Unit = h.Target.Unit },
                Status = h.Status,
                IsArchived = h.IsArchived,
                EndDAte = h.EndDAte,
                Milestone =
                    h.Milestone != null
                        ? new MilestoneDto
                        {
                            Target = h.Milestone.Target,
                            Current = h.Milestone.Current,
                        }
                        : null,
                CreatedAtUtc = h.CreatedAtUtc,
                UpdatedAtUtc = h.UpdatedAtUtc,
                LastCompletedAtUtc = h.LastCompletedAtUtc,
            })
            .ToListAsync();

        var response = new HabitCollectionDto { Data = habits };

        return Ok(response);
    }

    [HttpGet]
    [Route("{id}")]
    public async Task<ActionResult<HabitDto>> GetHabit(string id)
    {
        HabitDto? habitDto = await dbContext
            .Habits.Select(h => new HabitDto()
            {
                Id = h.Id,
                Name = h.Name,
                Description = h.Description,
                Type = h.Type,
                Frequency = new FrequencyDto
                {
                    Type = h.Frequency.Type,
                    TimesPerPeriod = h.Frequency.TimesPerPeriod,
                },
                Target = new TargetDto { Value = h.Target.Value, Unit = h.Target.Unit },
                Status = h.Status,
                IsArchived = h.IsArchived,
                EndDAte = h.EndDAte,
                Milestone =
                    h.Milestone != null
                        ? new MilestoneDto
                        {
                            Target = h.Milestone.Target,
                            Current = h.Milestone.Current,
                        }
                        : null,
                CreatedAtUtc = h.CreatedAtUtc,
                UpdatedAtUtc = h.UpdatedAtUtc,
                LastCompletedAtUtc = h.LastCompletedAtUtc,
            })
            .FirstOrDefaultAsync(h => h.Id == id);

        if (habitDto == null)
        {
            return NotFound();
        }

        return Ok(habitDto);
    }
}
