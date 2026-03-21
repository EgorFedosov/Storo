using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace backend.Migrations
{
    /// <inheritdoc />
    public partial class AddSalesforceContacts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "salesforce_contacts",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    user_id = table.Column<long>(type: "bigint", nullable: false),
                    sf_account_id = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    sf_contact_id = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    sync_status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    last_sync_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    last_error = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: true),
                    created_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_salesforce_contacts", x => x.id);
                    table.ForeignKey(
                        name: "FK_salesforce_contacts_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_salesforce_contacts_sf_account_id",
                table: "salesforce_contacts",
                column: "sf_account_id");

            migrationBuilder.CreateIndex(
                name: "IX_salesforce_contacts_sf_contact_id",
                table: "salesforce_contacts",
                column: "sf_contact_id");

            migrationBuilder.CreateIndex(
                name: "IX_salesforce_contacts_user_id",
                table: "salesforce_contacts",
                column: "user_id",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "salesforce_contacts");
        }
    }
}
