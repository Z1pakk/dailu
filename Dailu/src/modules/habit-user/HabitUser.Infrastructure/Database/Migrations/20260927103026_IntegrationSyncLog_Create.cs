using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HabitUser.Infrastructure.Database.Migrations
{
    /// <inheritdoc />
    public partial class IntegrationSyncLog_Create : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "integration_sync_logs",
                schema: "habit_users",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    integration_config_id = table.Column<Guid>(type: "uuid", nullable: false),
                    started_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    finished_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    activities_count = table.Column<int>(type: "integer", nullable: false),
                    synced_from_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    error_message = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    created_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    created_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    last_modified_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    last_modified_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    is_deleted = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    version = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_integration_sync_logs", x => x.id);
                    table.ForeignKey(
                        name: "fk_integration_sync_logs_integration_configs_integration_confi",
                        column: x => x.integration_config_id,
                        principalSchema: "habit_users",
                        principalTable: "integration_configs",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_integration_sync_logs_created_at_utc",
                schema: "habit_users",
                table: "integration_sync_logs",
                column: "created_at_utc");

            migrationBuilder.CreateIndex(
                name: "ix_integration_sync_logs_integration_config_id_started_at_utc",
                schema: "habit_users",
                table: "integration_sync_logs",
                columns: new[] { "integration_config_id", "started_at_utc" },
                descending: new[] { false, true });

            migrationBuilder.CreateIndex(
                name: "ix_integration_sync_logs_is_deleted",
                schema: "habit_users",
                table: "integration_sync_logs",
                column: "is_deleted",
                filter: "\"is_deleted\" = false");

            migrationBuilder.CreateIndex(
                name: "ix_integration_sync_logs_started_at_utc",
                schema: "habit_users",
                table: "integration_sync_logs",
                column: "started_at_utc");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "integration_sync_logs",
                schema: "habit_users");
        }
    }
}
