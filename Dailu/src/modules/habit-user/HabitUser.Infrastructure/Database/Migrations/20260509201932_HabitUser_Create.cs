using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HabitUser.Infrastructure.Database.Migrations
{
    /// <inheritdoc />
    public partial class HabitUser_Create : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "habit_users");

            migrationBuilder.CreateTable(
                name: "habit_users",
                schema: "habit_users",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    identity_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    created_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    last_modified_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    last_modified_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    is_deleted = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    version = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_habit_users", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "ix_habit_users_created_at_utc",
                schema: "habit_users",
                table: "habit_users",
                column: "created_at_utc");

            migrationBuilder.CreateIndex(
                name: "ix_habit_users_is_deleted",
                schema: "habit_users",
                table: "habit_users",
                column: "is_deleted",
                filter: "\"is_deleted\" = false");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "habit_users",
                schema: "habit_users");
        }
    }
}
