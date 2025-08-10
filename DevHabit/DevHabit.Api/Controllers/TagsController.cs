using System.Net.Mime;
using DevHabit.Api.Database;
using DevHabit.Api.DTOs.Common;
using DevHabit.Api.DTOs.Tags;
using DevHabit.Api.Entities;
using DevHabit.Api.Services;
using FluentValidation;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DevHabit.Api.Controllers;

[Authorize]
[ApiController]
[Route("tags")]
[Produces(
    MediaTypeNames.Application.Json,
    CustomMediaTypeNames.Application.JsonV1,
    CustomMediaTypeNames.Application.HateoasJson,
    CustomMediaTypeNames.Application.HateoasJsonV1
)]
public sealed class TagsController(
    ApplicationDbContext dbContext,
    LinkService linkService,
    UserContext userContext
) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<TagsCollectionDto>> GetTags(
        [FromHeader] AcceptHeaderDto acceptHeader
    )
    {
        string? userId = await userContext.GetUserIdAsync();
        if (string.IsNullOrWhiteSpace(userId))
        {
            return Unauthorized("User not found.");
        }

        IQueryable<TagDto> query = dbContext
            .Tags.Where(t => t.UserId == userId)
            .Select(TagQueries.ProjectToDto());

        var tagsCollectionDto = new TagsCollectionDto() { Items = await query.ToListAsync() };

        if (acceptHeader.IsLinksIncluded)
        {
            tagsCollectionDto.Links = CreateLinksForTags();
        }

        return Ok(tagsCollectionDto);
    }

    [HttpGet]
    [Route("{id}")]
    public async Task<ActionResult<TagDto>> GetTag(
        string id,
        [FromHeader] AcceptHeaderDto acceptHeader
    )
    {
        string? userId = await userContext.GetUserIdAsync();
        if (string.IsNullOrWhiteSpace(userId))
        {
            return Unauthorized("User not found.");
        }

        TagDto? tagDto = await dbContext
            .Tags.Where(t => t.Id == id && t.UserId == userId)
            .Select(TagQueries.ProjectToDto())
            .FirstOrDefaultAsync();

        if (tagDto == null)
        {
            return NotFound();
        }

        if (acceptHeader.IsLinksIncluded)
        {
            tagDto.Links = CreateLinksForTag(tagDto.Id);
        }

        return Ok(tagDto);
    }

    [HttpPost]
    public async Task<ActionResult<TagDto>> CreateTag(
        [FromBody] CreateTagDto createTagDto,
        [FromServices] IValidator<CreateTagDto> validator
    )
    {
        string? userId = await userContext.GetUserIdAsync();
        if (string.IsNullOrWhiteSpace(userId))
        {
            return Unauthorized("User not found.");
        }

        await validator.ValidateAndThrowAsync(createTagDto);

        Tag tag = createTagDto.ToEntity(userId);

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
        string? userId = await userContext.GetUserIdAsync();
        if (string.IsNullOrWhiteSpace(userId))
        {
            return Unauthorized("User not found.");
        }

        Tag? tag = await dbContext.Tags.FirstOrDefaultAsync(t => t.Id == id && t.UserId == userId);

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
        string? userId = await userContext.GetUserIdAsync();
        if (string.IsNullOrWhiteSpace(userId))
        {
            return Unauthorized("User not found.");
        }

        Tag? tag = await dbContext.Tags.FirstOrDefaultAsync(t => t.Id == id && t.UserId == userId);

        if (tag is null)
        {
            return NotFound();
        }

        dbContext.Tags.Remove(tag);
        await dbContext.SaveChangesAsync();

        return NoContent();
    }

    private List<LinkDto> CreateLinksForTags()
    {
        return
        [
            linkService.Create(nameof(GetTags), "self", HttpMethods.Get),
            linkService.Create(nameof(CreateTag), "create", HttpMethods.Post),
        ];
    }

    private List<LinkDto> CreateLinksForTag(string tagId)
    {
        return
        [
            linkService.Create(nameof(GetTags), "self", HttpMethods.Get, new { id = tagId }),
            linkService.Create(nameof(UpdateTag), "update", HttpMethods.Put, new { id = tagId }),
            linkService.Create(nameof(DeleteTag), "delete", HttpMethods.Delete, new { id = tagId }),
        ];
    }
}
