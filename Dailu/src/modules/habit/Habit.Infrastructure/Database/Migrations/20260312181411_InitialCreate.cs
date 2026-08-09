using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Habit.Infrastructure.Database.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "habits");

            migrationBuilder.CreateTable(
                name: "habits",
                schema: "habits",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    type = table.Column<int>(type: "integer", nullable: false),
                    frequency_type = table.Column<int>(type: "integer", nullable: false),
                    frequency_times_per_period = table.Column<int>(type: "integer", nullable: false),
                    target_value = table.Column<int>(type: "integer", nullable: false),
                    target_unit = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    status = table.Column<int>(type: "integer", nullable: false),
                    is_archived = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    end_date = table.Column<DateOnly>(type: "date", nullable: true),
                    milestone_target = table.Column<int>(type: "integer", nullable: true),
                    milestone_current = table.Column<int>(type: "integer", nullable: true),
                    last_completed_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    created_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    created_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    last_modified_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    last_modified_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    is_deleted = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    version = table.Column<Guid>(type: "uuid", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_habits", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "ix_habits_created_at_utc",
                schema: "habits",
                table: "habits",
                column: "created_at_utc");

            migrationBuilder.CreateIndex(
                name: "ix_habits_is_deleted",
                schema: "habits",
                table: "habits",
                column: "is_deleted",
                filter: "\"is_deleted\" = false");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "habits",
                schema: "habits");
        }
    }
}
