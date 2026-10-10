using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Nexora.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddAccessibleApplicationFeatures : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "AccessibleApplicationDetails",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    FacilityApplicationId = table.Column<Guid>(type: "uuid", nullable: false),
                    PrimaryDisabilityType = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    DisabilityRate = table.Column<int>(type: "integer", nullable: true),
                    EmergencyContactName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    EmergencyContactPhone = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    RequiresWheelchairAccess = table.Column<bool>(type: "boolean", nullable: false),
                    RequiresSignLanguage = table.Column<bool>(type: "boolean", nullable: false),
                    RequiresBraille = table.Column<bool>(type: "boolean", nullable: false),
                    KvkkConsentVersion = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    KvkkConsentGivenAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AccessibleApplicationDetails", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "AccessibleCaregivers",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ParticipantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Tckn = table.Column<string>(type: "character varying(11)", maxLength: 11, nullable: false),
                    Phone = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Relation = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    IsAuthorizedPickup = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AccessibleCaregivers", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "AccessibleProgressNotes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    FacilityApplicationId = table.Column<Guid>(type: "uuid", nullable: false),
                    NoteType = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    RecommendedAdjustments = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    RecordedBy = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    RecordedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AccessibleProgressNotes", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AccessibleApplicationDetails_FacilityApplicationId",
                table: "AccessibleApplicationDetails",
                column: "FacilityApplicationId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_AccessibleCaregivers_ParticipantId",
                table: "AccessibleCaregivers",
                column: "ParticipantId");

            migrationBuilder.CreateIndex(
                name: "IX_AccessibleProgressNotes_FacilityApplicationId",
                table: "AccessibleProgressNotes",
                column: "FacilityApplicationId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AccessibleApplicationDetails");

            migrationBuilder.DropTable(
                name: "AccessibleCaregivers");

            migrationBuilder.DropTable(
                name: "AccessibleProgressNotes");
        }
    }
}
