using Microsoft.EntityFrameworkCore.Migrations;
using NpgsqlTypes;

#nullable disable

namespace backend.Migrations
{
    /// <inheritdoc />
    public partial class HardenDatabaseSchema : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_external_auth_accounts_user_id",
                table: "external_auth_accounts");

            migrationBuilder.AddColumn<string>(
                name: "normalized_user_name",
                table: "users",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<NpgsqlTsVector>(
                name: "search_vector",
                table: "tags",
                type: "tsvector",
                nullable: true,
                computedColumnSql: "to_tsvector('simple', coalesce(name, ''))",
                stored: true);

            migrationBuilder.AddColumn<NpgsqlTsVector>(
                name: "search_vector",
                table: "item_custom_field_values",
                type: "tsvector",
                nullable: true,
                computedColumnSql: "to_tsvector('simple', coalesce(string_value, '') || ' ' || coalesce(text_value, '') || ' ' || coalesce(link_value, ''))",
                stored: true);

            migrationBuilder.AddColumn<NpgsqlTsVector>(
                name: "search_vector",
                table: "inventories",
                type: "tsvector",
                nullable: true,
                computedColumnSql: "to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(description_markdown, ''))",
                stored: true);

            migrationBuilder.CreateIndex(
                name: "IX_users_normalized_user_name",
                table: "users",
                column: "normalized_user_name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_tags_search_vector",
                table: "tags",
                column: "search_vector")
                .Annotation("Npgsql:IndexMethod", "GIN");

            migrationBuilder.CreateIndex(
                name: "IX_item_custom_field_values_search_vector",
                table: "item_custom_field_values",
                column: "search_vector")
                .Annotation("Npgsql:IndexMethod", "GIN");

            migrationBuilder.AddCheckConstraint(
                name: "ck_item_custom_field_values_single_value",
                table: "item_custom_field_values",
                sql: "(case when string_value is not null then 1 else 0 end + case when text_value is not null then 1 else 0 end + case when number_value is not null then 1 else 0 end + case when link_value is not null then 1 else 0 end + case when bool_value is not null then 1 else 0 end) <= 1");

            migrationBuilder.CreateIndex(
                name: "IX_inventory_statistics_items_count",
                table: "inventory_statistics",
                column: "items_count",
                descending: new bool[0]);

            migrationBuilder.CreateIndex(
                name: "IX_inventories_created_at",
                table: "inventories",
                column: "created_at",
                descending: new bool[0]);

            migrationBuilder.CreateIndex(
                name: "IX_inventories_search_vector",
                table: "inventories",
                column: "search_vector")
                .Annotation("Npgsql:IndexMethod", "GIN");

            migrationBuilder.CreateIndex(
                name: "IX_external_auth_accounts_user_id_provider",
                table: "external_auth_accounts",
                columns: new[] { "user_id", "provider" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_users_normalized_user_name",
                table: "users");

            migrationBuilder.DropIndex(
                name: "IX_tags_search_vector",
                table: "tags");

            migrationBuilder.DropIndex(
                name: "IX_item_custom_field_values_search_vector",
                table: "item_custom_field_values");

            migrationBuilder.DropCheckConstraint(
                name: "ck_item_custom_field_values_single_value",
                table: "item_custom_field_values");

            migrationBuilder.DropIndex(
                name: "IX_inventory_statistics_items_count",
                table: "inventory_statistics");

            migrationBuilder.DropIndex(
                name: "IX_inventories_created_at",
                table: "inventories");

            migrationBuilder.DropIndex(
                name: "IX_inventories_search_vector",
                table: "inventories");

            migrationBuilder.DropIndex(
                name: "IX_external_auth_accounts_user_id_provider",
                table: "external_auth_accounts");

            migrationBuilder.DropColumn(
                name: "search_vector",
                table: "tags");

            migrationBuilder.DropColumn(
                name: "search_vector",
                table: "item_custom_field_values");

            migrationBuilder.DropColumn(
                name: "search_vector",
                table: "inventories");

            migrationBuilder.DropColumn(
                name: "normalized_user_name",
                table: "users");

            migrationBuilder.CreateIndex(
                name: "IX_external_auth_accounts_user_id",
                table: "external_auth_accounts",
                column: "user_id");
        }
    }
}
