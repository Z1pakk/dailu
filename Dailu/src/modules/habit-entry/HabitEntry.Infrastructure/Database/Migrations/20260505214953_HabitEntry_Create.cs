using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HabitEntry.Infrastructure.Database.Migrations
{
    /// <inheritdoc />
    public partial class HabitEntry_Create : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "habit_entries");

            migrationBuilder.CreateTable(
                name: "habit_entries",
                schema: "habit_entries",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    habit_id = table.Column<Guid>(type: "uuid", nullable: false),
                    value = table.Column<int>(type: "integer", nullable: false),
                    notes = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    source = table.Column<int>(type: "integer", nullable: false),
                    external_id = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    date = table.Column<DateOnly>(type: "date", nullable: false),
                    is_archived = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    created_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    created_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    last_modified_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    last_modified_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    is_deleted = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    version = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_habit_entries", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "ix_habit_entries_created_at_utc",
                schema: "habit_entries",
                table: "habit_entries",
                column: "created_at_utc");

            migrationBuilder.CreateIndex(
                name: "ix_habit_entries_is_deleted",
                schema: "habit_entries",
                table: "habit_entries",
                column: "is_deleted",
                filter: "\"is_deleted\" = false");

            migrationBuilder.CreateIndex(
                name: "ix_habit_entries_user_id",
                schema: "habit_entries",
                table: "habit_entries",
                column: "user_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "habit_entries",
                schema: "habit_entries");
        }
    }
}
