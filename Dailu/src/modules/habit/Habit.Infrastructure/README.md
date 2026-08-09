### Database

```bash
# Create migration
dotnet ef migrations add InitialCreate --context HabitDbContext -o Database/Migrations


# Update database
dotnet ef database update --context HabitDbContext

# Remove last migration
dotnet ef migrations remove --context HabitDbContext
```