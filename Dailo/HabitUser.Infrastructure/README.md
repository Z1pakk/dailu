### Database

```bash
# Create migration
dotnet ef migrations add InitialCreate --context HabitUserDbContext -o Database/Migrations

# Update database
dotnet ef database update --context HabitUserDbContext

# Remove last migration
dotnet ef migrations remove --context HabitUserDbContext
```