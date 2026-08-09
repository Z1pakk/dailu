IDistributedApplicationBuilder builder = DistributedApplication.CreateBuilder(args);

IResourceBuilder<PostgresServerResource> db = builder
    .AddPostgres("dailo-db")
    .WithContainerName("dailo-db-postgres")
    .WithLifetime(ContainerLifetime.Persistent);

builder
    .AddProject<Projects.Dailu_Api>("api")
    .WithHttpsEndpoint(port: 5001)
    .WithReference(db, connectionName: "HabitPostgresConnectionString")
    .WithReference(db, connectionName: "HabitEntryPostgresConnectionString")
    .WithReference(db, connectionName: "TagPostgresConnectionString")
    .WithReference(db, connectionName: "IdentityPostgresConnectionString")
    .WithReference(db, connectionName: "HabitUserPostgresConnectionString")
    .WaitFor(db)
    .WithEnvironment("OTEL_EXPORTER_OTLP_ENDPOINT", "http://localhost:4317");

await builder.Build().RunAsync();
