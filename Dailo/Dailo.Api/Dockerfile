FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS base
USER $APP_UID
WORKDIR /app
EXPOSE 8080

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
ARG BUILD_CONFIGURATION=Release
WORKDIR /src
COPY ["Directory.Build.props", "."]
COPY ["Directory.Packages.props", "."]
COPY ["Dailo.Api/Dailo.Api.csproj", "Dailo.Api/"]
COPY ["Dailo.Events/Dailo.Events.csproj", "Dailo.Events/"]
COPY ["Dailo.Infrastructure/Dailo.Infrastructure.csproj", "Dailo.Infrastructure/"]
COPY ["SharedInfrastructure/SharedInfrastructure.csproj", "SharedInfrastructure/"]
COPY ["SharedKernel/SharedKernel.csproj", "SharedKernel/"]
COPY ["Habit.Api/Habit.Api.csproj", "Habit.Api/"]
COPY ["Habit.Application/Habit.Application.csproj", "Habit.Application/"]
COPY ["Habit.DataTransfer/Habit.DataTransfer.csproj", "Habit.DataTransfer/"]
COPY ["Habit.Domain/Habit.Domain.csproj", "Habit.Domain/"]
COPY ["Habit.Infrastructure/Habit.Infrastructure.csproj", "Habit.Infrastructure/"]
COPY ["Habit.Integrations/Habit.Integrations.csproj", "Habit.Integrations/"]
COPY ["HabitEntry.Api/HabitEntry.Api.csproj", "HabitEntry.Api/"]
COPY ["HabitEntry.Application/HabitEntry.Application.csproj", "HabitEntry.Application/"]
COPY ["HabitEntry.Domain/HabitEntry.Domain.csproj", "HabitEntry.Domain/"]
COPY ["HabitEntry.Infrastructure/HabitEntry.Infrastructure.csproj", "HabitEntry.Infrastructure/"]
COPY ["HabitEntry.Integrations/HabitEntry.Integrations.csproj", "HabitEntry.Integrations/"]
COPY ["HabitUser.Api/HabitUser.Api.csproj", "HabitUser.Api/"]
COPY ["HabitUser.Application/HabitUser.Application.csproj", "HabitUser.Application/"]
COPY ["HabitUser.Domain/HabitUser.Domain.csproj", "HabitUser.Domain/"]
COPY ["HabitUser.Infrastructure/HabitUser.Infrastructure.csproj", "HabitUser.Infrastructure/"]
COPY ["HabitUser.Github/HabitUser.Github.csproj", "HabitUser.Github/"]
COPY ["HabitUser.GoogleHealth/HabitUser.GoogleHealth.csproj", "HabitUser.GoogleHealth/"]
COPY ["HabitUser.Integrations/HabitUser.Integrations.csproj", "HabitUser.Integrations/"]
COPY ["HabitUser.Strava/HabitUser.Strava.csproj", "HabitUser.Strava/"]
COPY ["HabitUser.GoogleHealth/HabitUser.GoogleHealth.csproj", "HabitUser.GoogleHealth/"]
COPY ["Identity.Api/Identity.Api.csproj", "Identity.Api/"]
COPY ["Identity.Application/Identity.Application.csproj", "Identity.Application/"]
COPY ["Identity.DataTransfer/Identity.DataTransfer.csproj", "Identity.DataTransfer/"]
COPY ["Identity.Domain/Identity.Domain.csproj", "Identity.Domain/"]
COPY ["Identity.Infrastructure/Identity.Infrastructure.csproj", "Identity.Infrastructure/"]
COPY ["Tag.Api/Tag.Api.csproj", "Tag.Api/"]
COPY ["Tag.Application/Tag.Application.csproj", "Tag.Application/"]
COPY ["Tag.DataTransfer/Tag.DataTransfer.csproj", "Tag.DataTransfer/"]
COPY ["Tag.Domain/Tag.Domain.csproj", "Tag.Domain/"]
COPY ["Tag.Infrastructure/Tag.Infrastructure.csproj", "Tag.Infrastructure/"]
RUN dotnet restore "Dailo.Api/Dailo.Api.csproj"
COPY . .
WORKDIR "/src/Dailo.Api"
RUN dotnet build "./Dailo.Api.csproj" -c $BUILD_CONFIGURATION -o /app/build

FROM build AS publish
ARG BUILD_CONFIGURATION=Release
RUN dotnet publish "./Dailo.Api.csproj" -c $BUILD_CONFIGURATION -o /app/publish /p:UseAppHost=false

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "Dailo.Api.dll"]
