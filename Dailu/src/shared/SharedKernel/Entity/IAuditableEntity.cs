namespace SharedKernel.Entity;

public interface IAuditableEntity
{
    DateTime CreatedAtUtc { get; set; }

    Guid? CreatedByUserId { get; set; }

    DateTime? LastModifiedAtUtc { get; set; }

    Guid? LastModifiedByUserId { get; set; }
}
