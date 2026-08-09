using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Habit.Infrastructure.Database.Migrations
{
    /// <inheritdoc />
    public partial class Habit_AddRelationsToTagsAndIndexes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "ix_habits_user_id",
                schema: "habits",
                table: "habits",
                column: "user_id",
                filter: "\"is_deleted\" = false");

            migrationBuilder.CreateIndex(
                name: "ix_habits_user_id_name",
                schema: "habits",
                table: "habits",
                columns: new[] { "user_id", "name" },
                filter: "\"is_deleted\" = false");

            migrationBuilder.AddForeignKey(
                name: "fk_habit_tags_habits_habit_id",
                schema: "habits",
                table: "habit_tags",
                column: "habit_id",
                principalSchema: "habits",
                principalTable: "habits",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_habit_tags_habits_habit_id",
                schema: "habits",
                table: "habit_tags");

            migrationBuilder.DropIndex(
                name: "ix_habits_user_id",
                schema: "habits",
                table: "habits");

            migrationBuilder.DropIndex(
                name: "ix_habits_user_id_name",
                schema: "habits",
                table: "habits");
        }
    }
}
