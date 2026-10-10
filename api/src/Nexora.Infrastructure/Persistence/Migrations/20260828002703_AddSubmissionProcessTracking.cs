using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Nexora.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddSubmissionProcessTracking : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "AddressType",
                table: "CitizenSubmissions",
                type: "text",
                nullable: false,
                // Mevcut kayıtlar için anlamlı varsayılan: vatandaşlar bugüne kadar kendi
                // ikametgah mahallesini seçerek başvuru yaptığı için "residence".
                defaultValue: "residence");

            migrationBuilder.AddColumn<double>(
                name: "AnalysisConfidence",
                table: "CitizenSubmissions",
                type: "double precision",
                nullable: true);

            migrationBuilder.AddColumn<List<string>>(
                name: "AnalysisKeywords",
                table: "CitizenSubmissions",
                type: "text[]",
                nullable: false,
                // NOT NULL kolon mevcut satırlar için boş dizi ile doldurulur.
                defaultValueSql: "'{}'::text[]");

            migrationBuilder.AddColumn<bool>(
                name: "ContainsPersonReference",
                table: "CitizenSubmissions",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "FirstResponseAt",
                table: "CitizenSubmissions",
                type: "timestamp without time zone",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsAnonymousToMuhtar",
                table: "CitizenSubmissions",
                type: "boolean",
                nullable: false,
                // Kimlik gizliliği varsayılan olarak AÇIK (kullanıcı isteği 2026-08-28).
                defaultValue: true);

            migrationBuilder.AddColumn<string>(
                name: "ResolutionNote",
                table: "CitizenSubmissions",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RoutedUnit",
                table: "CitizenSubmissions",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Scope",
                table: "CitizenSubmissions",
                type: "text",
                nullable: false,
                defaultValue: "neighborhood");

            migrationBuilder.CreateTable(
                name: "CitizenSubmissionEvents",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    SubmissionId = table.Column<Guid>(type: "uuid", nullable: false),
                    EventType = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Note = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    ActorType = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    ActorName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: true),
                    ActorId = table.Column<Guid>(type: "uuid", nullable: true),
                    OccurredAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    VisibleToCitizen = table.Column<bool>(type: "boolean", nullable: false),
                    VisibleToMuhtar = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CitizenSubmissionEvents", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CitizenSubmissionEvents_SubmissionId_OccurredAt",
                table: "CitizenSubmissionEvents",
                columns: new[] { "SubmissionId", "OccurredAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CitizenSubmissionEvents");

            migrationBuilder.DropColumn(
                name: "AddressType",
                table: "CitizenSubmissions");

            migrationBuilder.DropColumn(
                name: "AnalysisConfidence",
                table: "CitizenSubmissions");

            migrationBuilder.DropColumn(
                name: "AnalysisKeywords",
                table: "CitizenSubmissions");

            migrationBuilder.DropColumn(
                name: "ContainsPersonReference",
                table: "CitizenSubmissions");

            migrationBuilder.DropColumn(
                name: "FirstResponseAt",
                table: "CitizenSubmissions");

            migrationBuilder.DropColumn(
                name: "IsAnonymousToMuhtar",
                table: "CitizenSubmissions");

            migrationBuilder.DropColumn(
                name: "ResolutionNote",
                table: "CitizenSubmissions");

            migrationBuilder.DropColumn(
                name: "RoutedUnit",
                table: "CitizenSubmissions");

            migrationBuilder.DropColumn(
                name: "Scope",
                table: "CitizenSubmissions");
        }
    }
}
