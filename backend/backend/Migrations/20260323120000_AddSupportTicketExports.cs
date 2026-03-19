using System;
using backend.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace backend.Migrations
{
    [DbContext(typeof(AppDbContext))]
    [Migration("20260323120000_AddSupportTicketExports")]
    /// <inheritdoc />
    public partial class AddSupportTicketExports : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "support_ticket_exports",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    ticket_id = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    reported_by_user_id = table.Column<long>(type: "bigint", nullable: false),
                    inventory_id = table.Column<long>(type: "bigint", nullable: true),
                    summary = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                    priority = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    page_link = table.Column<string>(type: "character varying(2048)", maxLength: 2048, nullable: false),
                    provider = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    admins_emails_snapshot = table.Column<string>(type: "text", nullable: false),
                    status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    uploaded_file_ref = table.Column<string>(type: "character varying(2048)", maxLength: 2048, nullable: true),
                    provider_file_id = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: true),
                    provider_rev = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: true),
                    error_message = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: true),
                    created_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    uploaded_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_support_ticket_exports", x => x.id);
                    table.ForeignKey(
                        name: "FK_support_ticket_exports_inventories_inventory_id",
                        column: x => x.inventory_id,
                        principalTable: "inventories",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_support_ticket_exports_users_reported_by_user_id",
                        column: x => x.reported_by_user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_support_ticket_exports_created_at_utc",
                table: "support_ticket_exports",
                column: "created_at_utc");

            migrationBuilder.CreateIndex(
                name: "IX_support_ticket_exports_inventory_id",
                table: "support_ticket_exports",
                column: "inventory_id");

            migrationBuilder.CreateIndex(
                name: "IX_support_ticket_exports_reported_by_user_id",
                table: "support_ticket_exports",
                column: "reported_by_user_id");

            migrationBuilder.CreateIndex(
                name: "IX_support_ticket_exports_ticket_id",
                table: "support_ticket_exports",
                column: "ticket_id",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "support_ticket_exports");
        }
    }
}
