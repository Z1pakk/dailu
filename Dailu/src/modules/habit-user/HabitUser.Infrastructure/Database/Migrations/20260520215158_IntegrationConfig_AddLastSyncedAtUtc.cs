using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HabitUser.Infrastructure.Database.Migrations
{
    /// <inheritdoc />
    public partial class IntegrationConfig_AddLastSyncedAtUtc : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "last_synced_at_utc",
                schema: "habit_users",
                table: "integration_configs",
                type: "timestamp with time zone",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "last_synced_at_utc",
                schema: "habit_users",
                table: "integration_configs");
        }
    }
}
