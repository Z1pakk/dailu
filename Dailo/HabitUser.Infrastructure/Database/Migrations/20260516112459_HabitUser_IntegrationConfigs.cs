using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HabitUser.Infrastructure.Database.Migrations
{
    /// <inheritdoc />
    public partial class HabitUser_IntegrationConfigs : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "integration_configs",
                schema: "habit_users",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    habit_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    provider = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    config = table.Column<string>(type: "text", nullable: false),
                    created_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    created_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    last_modified_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    last_modified_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    is_deleted = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    version = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_integration_configs", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "ix_integration_configs_created_at_utc",
                schema: "habit_users",
                table: "integration_configs",
                column: "created_at_utc");

            migrationBuilder.CreateIndex(
                name: "ix_integration_configs_habit_user_id_provider",
                schema: "habit_users",
                table: "integration_configs",
                columns: new[] { "habit_user_id", "provider" },
                unique: true,
                filter: "is_deleted = false");

            migrationBuilder.CreateIndex(
                name: "ix_integration_configs_is_deleted",
                schema: "habit_users",
                table: "integration_configs",
                column: "is_deleted",
                filter: "\"is_deleted\" = false");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "integration_configs",
                schema: "habit_users");
        }
    }
}
