### Database

```bash
# Create migration
dotnet ef migrations add InitialCreate --context SearchDbContext -o Database/Migrations


# Update database
dotnet ef database update --context SearchDbContext

# Remove last migration
dotnet ef migrations remove --context SearchDbContext
```