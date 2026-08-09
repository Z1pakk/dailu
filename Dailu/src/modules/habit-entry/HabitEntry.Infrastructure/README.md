### Database

```bash
# Create migration
dotnet ef migrations add InitialCreate --context HabitEntryDbContext -o Database/Migrations


# Update database
dotnet ef database update --context HabitEntryDbContext

# Remove last migration
dotnet ef migrations remove --context HabitEntryDbContext
```