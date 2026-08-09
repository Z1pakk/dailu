namespace SharedKernel.Persistence;

public interface IDataSeeder
{
    Task SeedAsync(CancellationToken cancellationToken = default);
}
