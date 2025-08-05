using System.Dynamic;
using DevHabit.Api.Database;
using DevHabit.Api.DTOs.Common;
using DevHabit.Api.DTOs.Habits;
using DevHabit.Api.Entities;
using DevHabit.Api.Services;
using DevHabit.Api.Services.Sorting;
using FluentValidation;
using Microsoft.AspNetCore.JsonPatch;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DevHabit.Api.Controllers;

[ApiController]
[Route("habits")]
public class HabitsController(ApplicationDbContext dbContext) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetHabits(
        [FromQuery] HabitsQueryParameters queryParams,
        [FromServices] SortMappingProvider sortMappingProvider,
        [FromServices] DataShapingService dataShapingService
    )
    {
        if (!sortMappingProvider.ValidateMappings<HabitDto, Habit>(queryParams.Sort))
        {
            return Problem(
                detail: $"The sort parameter is invalid: {queryParams.Sort}",
                statusCode: StatusCodes.Status400BadRequest
            );
        }

        if (!dataShapingService.Validate<HabitDto>(queryParams.Fields))
        {
            return Problem(
                detail: $"The fields parameter is invalid: {queryParams.Fields}",
                statusCode: StatusCodes.Status400BadRequest
            );
        }

        queryParams.SearchQuery ??= queryParams.SearchQuery?.Trim().ToLowerInvariant();

        IQueryable<Habit> query = dbContext.Habits;

        SortMapping[] sortMappings = sortMappingProvider.GetMappings<HabitDto, Habit>();

        if (!string.IsNullOrEmpty(queryParams.SearchQuery))
        {
            query = query.Where(h =>
                h.Name.ToLower().Contains(queryParams.SearchQuery)
                || h.Description != null
                    && h.Description.ToLower().Contains(queryParams.SearchQuery)
            );
        }

        if (queryParams.Type is not null)
        {
            query = query.Where(h => h.Type == queryParams.Type);
        }

        if (queryParams.Status is not null)
        {
            query = query.Where(h => h.Status == queryParams.Status);
        }

        IQueryable<HabitDto> habitsQuery = query
            .ApplySort(queryParams.Sort, sortMappings)
            .Select(HabitQueries.ProjectToDto());

        int totalCount = await habitsQuery.CountAsync();

        List<HabitDto> habits = await habitsQuery
            .Skip((queryParams.Page - 1) * queryParams.PageSize)
            .Take(queryParams.PageSize)
            .ToListAsync();

        var paginationResult = new PaginationResult<ExpandoObject>()
        {
            Items = dataShapingService.ShapeCollectionData(habits, queryParams.Fields),
            Page = queryParams.Page,
            PageSize = queryParams.PageSize,
            TotalCount = totalCount,
        };

        return Ok(paginationResult);
    }

    [HttpGet]
    [Route("{id}")]
    public async Task<IActionResult> GetHabit(
        [FromRoute] string id,
        [FromQuery] string? fields,
        [FromServices] DataShapingService dataShapingService
    )
    {
        if (!dataShapingService.Validate<HabitWithTagsDto>(fields))
        {
            return Problem(
                detail: $"The fields parameter is invalid: {fields}",
                statusCode: StatusCodes.Status400BadRequest
            );
        }

        HabitWithTagsDto? habitDto = await dbContext
            .Habits.Select(HabitQueries.ProjectToDtoWithTags())
            .FirstOrDefaultAsync(h => h.Id == id);

        if (habitDto == null)
        {
            return NotFound();
        }

        ExpandoObject shapedHabitDto = dataShapingService.ShapeData(habitDto, fields);

        return Ok(shapedHabitDto);
    }

    [HttpPost]
    public async Task<ActionResult<HabitDto>> CreateHabit(
        [FromBody] CreateHabitDto createHabitDto,
        [FromServices] IValidator<CreateHabitDto> validator
    )
    {
        await validator.ValidateAndThrowAsync(createHabitDto);

        Habit habit = createHabitDto.ToEntity();

        dbContext.Habits.Add(habit);
        await dbContext.SaveChangesAsync();

        HabitDto habitDto = habit.ToDto();

        return CreatedAtAction(nameof(GetHabit), new { id = habit.Id }, habitDto);
    }

    [HttpPut("{id}")]
    public async Task<ActionResult> UpdateHabit(string id, [FromBody] UpdateHabitDto updateHabitDto)
    {
        Habit? habit = await dbContext.Habits.FirstOrDefaultAsync(h => h.Id == id);

        if (habit is null)
        {
            return NotFound();
        }

        habit.UpdateFromDto(updateHabitDto);

        await dbContext.SaveChangesAsync();

        return NoContent();
    }

    [HttpPatch("{id}")]
    public async Task<ActionResult> PatchHabit(string id, JsonPatchDocument<HabitDto> patchDocument)
    {
        Habit? habit = await dbContext.Habits.FirstOrDefaultAsync(h => h.Id == id);
        if (habit is null)
        {
            return NotFound();
        }

        HabitDto habitDto = habit.ToDto();

        patchDocument.ApplyTo(habitDto, ModelState);

        if (!TryValidateModel(habitDto))
        {
            return ValidationProblem(ModelState);
        }

        habit.Name = habitDto.Name;
        habit.Description = habitDto.Description;
        habit.UpdatedAtUtc = DateTime.UtcNow;

        await dbContext.SaveChangesAsync();

        return NoContent();
    }

    [HttpDelete("{id}")]
    public async Task<ActionResult> DeleteHabit(string id)
    {
        Habit? habit = await dbContext.Habits.FirstOrDefaultAsync(h => h.Id == id);

        if (habit is null)
        {
            return NotFound();
        }

        dbContext.Habits.Remove(habit);
        await dbContext.SaveChangesAsync();

        return NoContent();
    }
}
