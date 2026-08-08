# syntax=docker/dockerfile:1
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS base
USER $APP_UID
WORKDIR /app
EXPOSE 8080

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
ARG BUILD_CONFIGURATION=Release
WORKDIR /src
COPY Directory.Build.props Directory.Packages.props ./
COPY --parents **/*.csproj ./
RUN dotnet restore "Dailo.Api/Dailo.Api.csproj"
COPY . .
WORKDIR "/src/Dailo.Api"
RUN dotnet build "./Dailo.Api.csproj" -c $BUILD_CONFIGURATION -o /app/build

FROM build AS publish
ARG BUILD_CONFIGURATION=Release
ARG GIT_SHA=unknown
RUN dotnet publish "./Dailo.Api.csproj" -c $BUILD_CONFIGURATION -o /app/publish /p:UseAppHost=false /p:InformationalVersion=$GIT_SHA

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "Dailo.Api.dll"]
