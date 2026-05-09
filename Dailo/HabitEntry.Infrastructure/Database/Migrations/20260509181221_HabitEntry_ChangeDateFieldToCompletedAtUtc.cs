using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HabitEntry.Infrastructure.Database.Migrations
{
    /// <inheritdoc />
    public partial class HabitEntry_ChangeDateFieldToCompletedAtUtc : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "date",
                schema: "habit_entries",
                table: "habit_entries");

            migrationBuilder.AddColumn<DateTime>(
                name: "completed_at_utc",
                schema: "habit_entries",
                table: "habit_entries",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "completed_at_utc",
                schema: "habit_entries",
                table: "habit_entries");

            migrationBuilder.AddColumn<DateOnly>(
                name: "date",
                schema: "habit_entries",
                table: "habit_entries",
                type: "date",
                nullable: false,
                defaultValue: new DateOnly(1, 1, 1));
        }
    }
}
