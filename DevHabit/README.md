### Database

```bash
# Create migration
cd .\DevHabit\
dotnet ef migrations add Initial --project DevHabit.Api\DevHabit.Api.csproj --startup-project DevHabit.Api\DevHabit.Api.csproj --context DevHabit.Api.Database.ApplicationDbContext
```