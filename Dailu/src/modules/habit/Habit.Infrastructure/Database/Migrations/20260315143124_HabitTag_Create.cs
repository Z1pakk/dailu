using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Habit.Infrastructure.Database.Migrations
{
    /// <inheritdoc />
    public partial class HabitTag_Create : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "habit_tags",
                schema: "habits",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    habit_id = table.Column<Guid>(type: "uuid", nullable: false),
                    tag_id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    created_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    last_modified_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    last_modified_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    is_deleted = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    version = table.Column<Guid>(type: "uuid", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_habit_tags", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "ix_habit_tags_created_at_utc",
                schema: "habits",
                table: "habit_tags",
                column: "created_at_utc");

            migrationBuilder.CreateIndex(
                name: "ix_habit_tags_habit_id_tag_id_user_id",
                schema: "habits",
                table: "habit_tags",
                columns: new[] { "habit_id", "tag_id", "user_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_habit_tags_is_deleted",
                schema: "habits",
                table: "habit_tags",
                column: "is_deleted",
                filter: "\"is_deleted\" = false");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "habit_tags",
                schema: "habits");
        }
    }
}
