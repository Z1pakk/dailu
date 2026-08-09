using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Identity.Infrastructure.Database.Migrations
{
    /// <inheritdoc />
    public partial class UserRole_ChangePrimaryKey : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropPrimaryKey(
                name: "pk_user_roles",
                schema: "identity",
                table: "user_roles");

            migrationBuilder.DropIndex(
                name: "ix_user_roles_user_id",
                schema: "identity",
                table: "user_roles");

            migrationBuilder.AddUniqueConstraint(
                name: "ak_user_roles_id",
                schema: "identity",
                table: "user_roles",
                column: "id");

            migrationBuilder.AddPrimaryKey(
                name: "pk_user_roles",
                schema: "identity",
                table: "user_roles",
                columns: new[] { "user_id", "role_id" });

            migrationBuilder.CreateIndex(
                name: "ix_user_roles_id",
                schema: "identity",
                table: "user_roles",
                column: "id",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropUniqueConstraint(
                name: "ak_user_roles_id",
                schema: "identity",
                table: "user_roles");

            migrationBuilder.DropPrimaryKey(
                name: "pk_user_roles",
                schema: "identity",
                table: "user_roles");

            migrationBuilder.DropIndex(
                name: "ix_user_roles_id",
                schema: "identity",
                table: "user_roles");

            migrationBuilder.AddPrimaryKey(
                name: "pk_user_roles",
                schema: "identity",
                table: "user_roles",
                column: "id");

            migrationBuilder.CreateIndex(
                name: "ix_user_roles_user_id",
                schema: "identity",
                table: "user_roles",
                column: "user_id");
        }
    }
}
