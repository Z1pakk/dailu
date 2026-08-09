using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Tag.Infrastructure.Database.Migrations
{
    /// <inheritdoc />
    public partial class Tag_AddIndexes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "ix_tags_user_id",
                schema: "tags",
                table: "tags",
                column: "user_id",
                filter: "\"is_deleted\" = false");

            migrationBuilder.CreateIndex(
                name: "ix_tags_user_id_name",
                schema: "tags",
                table: "tags",
                columns: new[] { "user_id", "name" },
                filter: "\"is_deleted\" = false");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_tags_user_id",
                schema: "tags",
                table: "tags");

            migrationBuilder.DropIndex(
                name: "ix_tags_user_id_name",
                schema: "tags",
                table: "tags");
        }
    }
}
