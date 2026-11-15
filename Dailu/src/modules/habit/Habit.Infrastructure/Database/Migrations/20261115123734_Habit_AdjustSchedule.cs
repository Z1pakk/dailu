using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Habit.Infrastructure.Database.Migrations
{
    /// <inheritdoc />
    public partial class Habit_AdjustSchedule : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "frequency_month_days",
                schema: "habits",
                table: "habits",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "frequency_week_days",
                schema: "habits",
                table: "habits",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<TimeOnly>(
                name: "timing_at",
                schema: "habits",
                table: "habits",
                type: "time without time zone",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "timing_duration_minutes",
                schema: "habits",
                table: "habits",
                type: "integer",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "frequency_month_days",
                schema: "habits",
                table: "habits");

            migrationBuilder.DropColumn(
                name: "frequency_week_days",
                schema: "habits",
                table: "habits");

            migrationBuilder.DropColumn(
                name: "timing_at",
                schema: "habits",
                table: "habits");

            migrationBuilder.DropColumn(
                name: "timing_duration_minutes",
                schema: "habits",
                table: "habits");
        }
    }
}
