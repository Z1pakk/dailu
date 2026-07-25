# syntax=docker/dockerfile:1
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS base
USER $APP_UID
WORKDIR /app

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
ARG BUILD_CONFIGURATION=Release
WORKDIR /src
COPY Directory.Build.props Directory.Packages.props ./
COPY --parents **/*.csproj ./
RUN dotnet restore "Dailo.MigrationsRunner/Dailo.MigrationsRunner.csproj"
COPY . .
WORKDIR "/src/Dailo.MigrationsRunner"
RUN dotnet build "./Dailo.MigrationsRunner.csproj" -c $BUILD_CONFIGURATION -o /app/build

FROM build AS publish
ARG BUILD_CONFIGURATION=Release
RUN dotnet publish "./Dailo.MigrationsRunner.csproj" -c $BUILD_CONFIGURATION -o /app/publish /p:UseAppHost=false

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "Dailo.MigrationsRunner.dll"]
