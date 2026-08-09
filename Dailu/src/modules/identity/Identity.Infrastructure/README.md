### Database

```bash
# Create migration
dotnet ef migrations add InitialCreate --context IdentityDbContext -o Database/Migrations

# Update database
dotnet ef database update --context IdentityDbContext

# Remove last migration
dotnet ef migrations remove --context IdentityDbContext
```