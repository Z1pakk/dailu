using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Habit.Infrastructure.Database.Migrations
{
    /// <inheritdoc />
    public partial class Habit_AddAutomationFilter : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "automation_filter",
                schema: "habits",
                table: "habits",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "automation_filter",
                schema: "habits",
                table: "habits");
        }
    }
}
