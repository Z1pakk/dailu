### Database

```bash
# Create migration
dotnet ef migrations add InitialCreate --context TagDbContext -o Database/Migrations


# Update database
dotnet ef database update --context TagDbContext

# Remove last migration
dotnet ef migrations remove --context TagDbContext
```