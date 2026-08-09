namespace SharedKernel.Entity;

public interface ISoftDeletableEntity
{
    bool IsDeleted { get; set; }
}
