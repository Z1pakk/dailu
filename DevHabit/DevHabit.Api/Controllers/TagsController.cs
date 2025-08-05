using DevHabit.Api.Database;
using DevHabit.Api.DTOs.Common;
using DevHabit.Api.DTOs.Tags;
using DevHabit.Api.Entities;
using FluentValidation;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DevHabit.Api.Controllers;

[ApiController]
[Route("tags")]
public sealed class TagsController(ApplicationDbContext dbContext) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<PaginationResult<TagDto>>> GetTags()
    {
        IQueryable<TagDto> query = dbContext.Tags.Select(TagQueries.ProjectToDto());

        var paginationResult = await PaginationResult<TagDto>.CreateAsync(query);

        return Ok(paginationResult);
    }

    [HttpGet]
    [Route("{id}")]
    public async Task<ActionResult<TagDto>> GetTag(string id)
    {
        TagDto? tagDto = await dbContext
            .Tags.Select(TagQueries.ProjectToDto())
            .FirstOrDefaultAsync(t => t.Id == id);

        if (tagDto == null)
        {
            return NotFound();
        }

        return Ok(tagDto);
    }

    [HttpPost]
    public async Task<ActionResult<TagDto>> CreateTag(
        [FromBody] CreateTagDto createTagDto,
        [FromServices] IValidator<CreateTagDto> validator
    )
    {
        await validator.ValidateAndThrowAsync(createTagDto);

        Tag tag = createTagDto.ToEntity();

        if (await dbContext.Tags.AnyAsync(t => t.Name == tag.Name))
        {
            return Problem(
                $"A tag with the name '{tag.Name}' already exists.",
                statusCode: StatusCodes.Status409Conflict
            );
        }

        dbContext.Tags.Add(tag);
        await dbContext.SaveChangesAsync();

        TagDto tagDto = tag.ToDto();

        return CreatedAtAction(nameof(GetTag), new { id = tag.Id }, tagDto);
    }

    [HttpPut("{id}")]
    public async Task<ActionResult> UpdateTag(string id, [FromBody] UpdateTagDto updateTagDto)
    {
        Tag? tag = await dbContext.Tags.FirstOrDefaultAsync(t => t.Id == id);

        if (tag is null)
        {
            return NotFound();
        }

        if (await dbContext.Tags.AnyAsync(t => t.Name == tag.Name && t.Id != id))
        {
            return Conflict($"A tag with the name '{tag.Name}' already exists.");
        }

        tag.UpdateFromDto(updateTagDto);

        // there will be a database exception if the name already exists
        await dbContext.SaveChangesAsync();

        return NoContent();
    }

    [HttpDelete("{id}")]
    public async Task<ActionResult> DeleteTag(string id)
    {
        Tag? tag = await dbContext.Tags.FirstOrDefaultAsync(t => t.Id == id);

        if (tag is null)
        {
            return NotFound();
        }

        dbContext.Tags.Remove(tag);
        await dbContext.SaveChangesAsync();

        return NoContent();
    }
}
