using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HabitUser.Infrastructure.Database.Migrations
{
    /// <inheritdoc />
    public partial class HabitUser_AddForeignKeyToIntegrationConfig : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddForeignKey(
                name: "fk_integration_configs_habit_users_habit_user_id",
                schema: "habit_users",
                table: "integration_configs",
                column: "habit_user_id",
                principalSchema: "habit_users",
                principalTable: "habit_users",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_integration_configs_habit_users_habit_user_id",
                schema: "habit_users",
                table: "integration_configs");
        }
    }
}
