using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace backend.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "categories",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_categories", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "roles",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    name = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_roles", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "tags",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    normalized_name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_tags", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "users",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    email = table.Column<string>(type: "character varying(320)", maxLength: 320, nullable: false),
                    normalized_email = table.Column<string>(type: "character varying(320)", maxLength: 320, nullable: false),
                    user_name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    display_name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    is_blocked = table.Column<bool>(type: "boolean", nullable: false),
                    preferred_language = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    preferred_theme = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_users", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "external_auth_accounts",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    user_id = table.Column<long>(type: "bigint", nullable: false),
                    provider = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    provider_user_id = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_external_auth_accounts", x => x.id);
                    table.ForeignKey(
                        name: "FK_external_auth_accounts_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "inventories",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    creator_id = table.Column<long>(type: "bigint", nullable: false),
                    category_id = table.Column<int>(type: "integer", nullable: false),
                    title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    description_markdown = table.Column<string>(type: "character varying(10000)", maxLength: 10000, nullable: false),
                    image_url = table.Column<string>(type: "character varying(2048)", maxLength: 2048, nullable: true),
                    is_public = table.Column<bool>(type: "boolean", nullable: false),
                    version = table.Column<int>(type: "integer", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_inventories", x => x.id);
                    table.CheckConstraint("ck_inventories_version_positive", "version > 0");
                    table.ForeignKey(
                        name: "FK_inventories_categories_category_id",
                        column: x => x.category_id,
                        principalTable: "categories",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_inventories_users_creator_id",
                        column: x => x.creator_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "user_roles",
                columns: table => new
                {
                    user_id = table.Column<long>(type: "bigint", nullable: false),
                    role_id = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_user_roles", x => new { x.user_id, x.role_id });
                    table.ForeignKey(
                        name: "FK_user_roles_roles_role_id",
                        column: x => x.role_id,
                        principalTable: "roles",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_user_roles_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "custom_fields",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    inventory_id = table.Column<long>(type: "bigint", nullable: false),
                    field_type = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    slot_no = table.Column<int>(type: "integer", nullable: false),
                    title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    description = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    show_in_table = table.Column<bool>(type: "boolean", nullable: false),
                    sort_order = table.Column<int>(type: "integer", nullable: false),
                    is_enabled = table.Column<bool>(type: "boolean", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_custom_fields", x => x.id);
                    table.CheckConstraint("ck_custom_fields_field_type", "field_type in ('single_line','multi_line','number','link','bool')");
                    table.CheckConstraint("ck_custom_fields_slot_no", "slot_no between 1 and 3");
                    table.ForeignKey(
                        name: "FK_custom_fields_inventories_inventory_id",
                        column: x => x.inventory_id,
                        principalTable: "inventories",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "custom_id_sequence_state",
                columns: table => new
                {
                    inventory_id = table.Column<long>(type: "bigint", nullable: false),
                    last_value = table.Column<long>(type: "bigint", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_custom_id_sequence_state", x => x.inventory_id);
                    table.ForeignKey(
                        name: "FK_custom_id_sequence_state_inventories_inventory_id",
                        column: x => x.inventory_id,
                        principalTable: "inventories",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "custom_id_templates",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    inventory_id = table.Column<long>(type: "bigint", nullable: false),
                    is_enabled = table.Column<bool>(type: "boolean", nullable: false),
                    validation_regex = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_custom_id_templates", x => x.id);
                    table.ForeignKey(
                        name: "FK_custom_id_templates_inventories_inventory_id",
                        column: x => x.inventory_id,
                        principalTable: "inventories",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "discussion_posts",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    inventory_id = table.Column<long>(type: "bigint", nullable: false),
                    author_user_id = table.Column<long>(type: "bigint", nullable: false),
                    content_markdown = table.Column<string>(type: "character varying(10000)", maxLength: 10000, nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_discussion_posts", x => x.id);
                    table.ForeignKey(
                        name: "FK_discussion_posts_inventories_inventory_id",
                        column: x => x.inventory_id,
                        principalTable: "inventories",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_discussion_posts_users_author_user_id",
                        column: x => x.author_user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "inventory_access",
                columns: table => new
                {
                    inventory_id = table.Column<long>(type: "bigint", nullable: false),
                    user_id = table.Column<long>(type: "bigint", nullable: false),
                    granted_by_user_id = table.Column<long>(type: "bigint", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_inventory_access", x => new { x.inventory_id, x.user_id });
                    table.ForeignKey(
                        name: "FK_inventory_access_inventories_inventory_id",
                        column: x => x.inventory_id,
                        principalTable: "inventories",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_inventory_access_users_granted_by_user_id",
                        column: x => x.granted_by_user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_inventory_access_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "inventory_statistics",
                columns: table => new
                {
                    inventory_id = table.Column<long>(type: "bigint", nullable: false),
                    items_count = table.Column<int>(type: "integer", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_inventory_statistics", x => x.inventory_id);
                    table.ForeignKey(
                        name: "FK_inventory_statistics_inventories_inventory_id",
                        column: x => x.inventory_id,
                        principalTable: "inventories",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "inventory_tags",
                columns: table => new
                {
                    inventory_id = table.Column<long>(type: "bigint", nullable: false),
                    tag_id = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_inventory_tags", x => new { x.inventory_id, x.tag_id });
                    table.ForeignKey(
                        name: "FK_inventory_tags_inventories_inventory_id",
                        column: x => x.inventory_id,
                        principalTable: "inventories",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_inventory_tags_tags_tag_id",
                        column: x => x.tag_id,
                        principalTable: "tags",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "items",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    inventory_id = table.Column<long>(type: "bigint", nullable: false),
                    custom_id = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    created_by_user_id = table.Column<long>(type: "bigint", nullable: true),
                    updated_by_user_id = table.Column<long>(type: "bigint", nullable: true),
                    version = table.Column<int>(type: "integer", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_items", x => x.id);
                    table.CheckConstraint("ck_items_version_positive", "version > 0");
                    table.ForeignKey(
                        name: "FK_items_inventories_inventory_id",
                        column: x => x.inventory_id,
                        principalTable: "inventories",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_items_users_created_by_user_id",
                        column: x => x.created_by_user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_items_users_updated_by_user_id",
                        column: x => x.updated_by_user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "inventory_numeric_field_statistics",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    inventory_id = table.Column<long>(type: "bigint", nullable: false),
                    custom_field_id = table.Column<long>(type: "bigint", nullable: false),
                    min_value = table.Column<decimal>(type: "numeric(18,4)", precision: 18, scale: 4, nullable: true),
                    max_value = table.Column<decimal>(type: "numeric(18,4)", precision: 18, scale: 4, nullable: true),
                    avg_value = table.Column<decimal>(type: "numeric(18,4)", precision: 18, scale: 4, nullable: true),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_inventory_numeric_field_statistics", x => x.id);
                    table.ForeignKey(
                        name: "FK_inventory_numeric_field_statistics_custom_fields_custom_fie~",
                        column: x => x.custom_field_id,
                        principalTable: "custom_fields",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_inventory_numeric_field_statistics_inventories_inventory_id",
                        column: x => x.inventory_id,
                        principalTable: "inventories",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "inventory_string_field_statistics",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    inventory_id = table.Column<long>(type: "bigint", nullable: false),
                    custom_field_id = table.Column<long>(type: "bigint", nullable: false),
                    most_frequent_value = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    most_frequent_count = table.Column<int>(type: "integer", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_inventory_string_field_statistics", x => x.id);
                    table.ForeignKey(
                        name: "FK_inventory_string_field_statistics_custom_fields_custom_fiel~",
                        column: x => x.custom_field_id,
                        principalTable: "custom_fields",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_inventory_string_field_statistics_inventories_inventory_id",
                        column: x => x.inventory_id,
                        principalTable: "inventories",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "custom_id_template_parts",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    template_id = table.Column<long>(type: "bigint", nullable: false),
                    sort_order = table.Column<int>(type: "integer", nullable: false),
                    part_type = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    fixed_text = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    format_pattern = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_custom_id_template_parts", x => x.id);
                    table.CheckConstraint("ck_custom_id_template_parts_part_type", "part_type in ('fixed_text','random_20_bit','random_32_bit','random_6_digit','random_9_digit','guid','datetime','sequence')");
                    table.ForeignKey(
                        name: "FK_custom_id_template_parts_custom_id_templates_template_id",
                        column: x => x.template_id,
                        principalTable: "custom_id_templates",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "item_custom_field_values",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    item_id = table.Column<long>(type: "bigint", nullable: false),
                    custom_field_id = table.Column<long>(type: "bigint", nullable: false),
                    string_value = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    text_value = table.Column<string>(type: "character varying(10000)", maxLength: 10000, nullable: true),
                    number_value = table.Column<decimal>(type: "numeric(18,4)", precision: 18, scale: 4, nullable: true),
                    link_value = table.Column<string>(type: "character varying(2048)", maxLength: 2048, nullable: true),
                    bool_value = table.Column<bool>(type: "boolean", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_item_custom_field_values", x => x.id);
                    table.ForeignKey(
                        name: "FK_item_custom_field_values_custom_fields_custom_field_id",
                        column: x => x.custom_field_id,
                        principalTable: "custom_fields",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_item_custom_field_values_items_item_id",
                        column: x => x.item_id,
                        principalTable: "items",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "item_likes",
                columns: table => new
                {
                    item_id = table.Column<long>(type: "bigint", nullable: false),
                    user_id = table.Column<long>(type: "bigint", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_item_likes", x => new { x.item_id, x.user_id });
                    table.ForeignKey(
                        name: "FK_item_likes_items_item_id",
                        column: x => x.item_id,
                        principalTable: "items",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_item_likes_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.InsertData(
                table: "categories",
                columns: new[] { "id", "name" },
                values: new object[,]
                {
                    { 1, "Equipment" },
                    { 2, "Furniture" },
                    { 3, "Book" },
                    { 4, "Other" }
                });

            migrationBuilder.InsertData(
                table: "roles",
                columns: new[] { "id", "name" },
                values: new object[,]
                {
                    { 1, "user" },
                    { 2, "admin" }
                });

            migrationBuilder.CreateIndex(
                name: "IX_categories_name",
                table: "categories",
                column: "name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_custom_fields_inventory_id_field_type_slot_no",
                table: "custom_fields",
                columns: new[] { "inventory_id", "field_type", "slot_no" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_custom_id_template_parts_template_id_sort_order",
                table: "custom_id_template_parts",
                columns: new[] { "template_id", "sort_order" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_custom_id_templates_inventory_id",
                table: "custom_id_templates",
                column: "inventory_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_discussion_posts_author_user_id",
                table: "discussion_posts",
                column: "author_user_id");

            migrationBuilder.CreateIndex(
                name: "IX_discussion_posts_inventory_id_id",
                table: "discussion_posts",
                columns: new[] { "inventory_id", "id" });

            migrationBuilder.CreateIndex(
                name: "IX_external_auth_accounts_provider_provider_user_id",
                table: "external_auth_accounts",
                columns: new[] { "provider", "provider_user_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_external_auth_accounts_user_id",
                table: "external_auth_accounts",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "IX_inventories_category_id",
                table: "inventories",
                column: "category_id");

            migrationBuilder.CreateIndex(
                name: "IX_inventories_creator_id",
                table: "inventories",
                column: "creator_id");

            migrationBuilder.CreateIndex(
                name: "IX_inventory_access_granted_by_user_id",
                table: "inventory_access",
                column: "granted_by_user_id");

            migrationBuilder.CreateIndex(
                name: "IX_inventory_access_user_id",
                table: "inventory_access",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "IX_inventory_numeric_field_statistics_custom_field_id",
                table: "inventory_numeric_field_statistics",
                column: "custom_field_id");

            migrationBuilder.CreateIndex(
                name: "IX_inventory_numeric_field_statistics_inventory_id_custom_fiel~",
                table: "inventory_numeric_field_statistics",
                columns: new[] { "inventory_id", "custom_field_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_inventory_string_field_statistics_custom_field_id",
                table: "inventory_string_field_statistics",
                column: "custom_field_id");

            migrationBuilder.CreateIndex(
                name: "IX_inventory_string_field_statistics_inventory_id_custom_field~",
                table: "inventory_string_field_statistics",
                columns: new[] { "inventory_id", "custom_field_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_inventory_tags_tag_id",
                table: "inventory_tags",
                column: "tag_id");

            migrationBuilder.CreateIndex(
                name: "IX_item_custom_field_values_custom_field_id",
                table: "item_custom_field_values",
                column: "custom_field_id");

            migrationBuilder.CreateIndex(
                name: "IX_item_custom_field_values_item_id_custom_field_id",
                table: "item_custom_field_values",
                columns: new[] { "item_id", "custom_field_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_item_likes_user_id",
                table: "item_likes",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "IX_items_created_by_user_id",
                table: "items",
                column: "created_by_user_id");

            migrationBuilder.CreateIndex(
                name: "IX_items_inventory_id_created_at",
                table: "items",
                columns: new[] { "inventory_id", "created_at" },
                descending: new[] { false, true });

            migrationBuilder.CreateIndex(
                name: "IX_items_inventory_id_custom_id",
                table: "items",
                columns: new[] { "inventory_id", "custom_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_items_updated_by_user_id",
                table: "items",
                column: "updated_by_user_id");

            migrationBuilder.CreateIndex(
                name: "IX_roles_name",
                table: "roles",
                column: "name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_tags_normalized_name",
                table: "tags",
                column: "normalized_name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_user_roles_role_id",
                table: "user_roles",
                column: "role_id");

            migrationBuilder.CreateIndex(
                name: "IX_users_email",
                table: "users",
                column: "email",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_users_normalized_email",
                table: "users",
                column: "normalized_email",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_users_user_name",
                table: "users",
                column: "user_name",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "custom_id_sequence_state");

            migrationBuilder.DropTable(
                name: "custom_id_template_parts");

            migrationBuilder.DropTable(
                name: "discussion_posts");

            migrationBuilder.DropTable(
                name: "external_auth_accounts");

            migrationBuilder.DropTable(
                name: "inventory_access");

            migrationBuilder.DropTable(
                name: "inventory_numeric_field_statistics");

            migrationBuilder.DropTable(
                name: "inventory_statistics");

            migrationBuilder.DropTable(
                name: "inventory_string_field_statistics");

            migrationBuilder.DropTable(
                name: "inventory_tags");

            migrationBuilder.DropTable(
                name: "item_custom_field_values");

            migrationBuilder.DropTable(
                name: "item_likes");

            migrationBuilder.DropTable(
                name: "user_roles");

            migrationBuilder.DropTable(
                name: "custom_id_templates");

            migrationBuilder.DropTable(
                name: "tags");

            migrationBuilder.DropTable(
                name: "custom_fields");

            migrationBuilder.DropTable(
                name: "items");

            migrationBuilder.DropTable(
                name: "roles");

            migrationBuilder.DropTable(
                name: "inventories");

            migrationBuilder.DropTable(
                name: "categories");

            migrationBuilder.DropTable(
                name: "users");
        }
    }
}
