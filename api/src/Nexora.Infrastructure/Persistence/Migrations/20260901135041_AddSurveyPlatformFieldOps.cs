using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Nexora.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddSurveyPlatformFieldOps : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "FieldEnabled",
                table: "Surveys",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "IdentityMode",
                table: "Surveys",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<bool>(
                name: "RequireLocation",
                table: "Surveys",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "SurveyType",
                table: "Surveys",
                type: "character varying(30)",
                maxLength: 30,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<List<string>>(
                name: "TargetNeighborhoods",
                table: "Surveys",
                type: "text[]",
                nullable: false,
                defaultValueSql: "ARRAY[]::text[]");

            migrationBuilder.AddColumn<int>(
                name: "TargetResponseCount",
                table: "Surveys",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "Topic",
                table: "Surveys",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "AgeGroup",
                table: "SurveyResponses",
                type: "character varying(10)",
                maxLength: 10,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Channel",
                table: "SurveyResponses",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "DeviceId",
                table: "SurveyResponses",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "DurationSeconds",
                table: "SurveyResponses",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "FieldTaskId",
                table: "SurveyResponses",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "FlagReason",
                table: "SurveyResponses",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Gender",
                table: "SurveyResponses",
                type: "character varying(10)",
                maxLength: 10,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "InterviewerId",
                table: "SurveyResponses",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsFlagged",
                table: "SurveyResponses",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<double>(
                name: "Latitude",
                table: "SurveyResponses",
                type: "double precision",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "LocalUuid",
                table: "SurveyResponses",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "Longitude",
                table: "SurveyResponses",
                type: "double precision",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Neighborhood",
                table: "SurveyResponses",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "SurveyFieldTasks",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    SurveyId = table.Column<Guid>(type: "uuid", nullable: false),
                    InterviewerId = table.Column<Guid>(type: "uuid", nullable: false),
                    Neighborhood = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    StartDate = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    EndDate = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    TargetCount = table.Column<int>(type: "integer", nullable: false),
                    DailyTarget = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Note = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    LastSyncAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SurveyFieldTasks", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SurveyFieldTasks_Surveys_SurveyId",
                        column: x => x.SurveyId,
                        principalTable: "Surveys",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "SurveyQuestionBank",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Question = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    Description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    Type = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    Options = table.Column<List<string>>(type: "text[]", nullable: false),
                    Topic = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Unit = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: true),
                    ScaleMin = table.Column<int>(type: "integer", nullable: true),
                    ScaleMax = table.Column<int>(type: "integer", nullable: true),
                    MinLabel = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    MaxLabel = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    RatingCount = table.Column<int>(type: "integer", nullable: true),
                    UsageCount = table.Column<int>(type: "integer", nullable: false),
                    LastUsedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SurveyQuestionBank", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "SurveyQuotas",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    SurveyId = table.Column<Guid>(type: "uuid", nullable: false),
                    Dimension = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Value = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    TargetCount = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SurveyQuotas", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SurveyQuotas_Surveys_SurveyId",
                        column: x => x.SurveyId,
                        principalTable: "Surveys",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Surveys_Topic",
                table: "Surveys",
                column: "Topic");

            migrationBuilder.CreateIndex(
                name: "IX_SurveyResponses_InterviewerId",
                table: "SurveyResponses",
                column: "InterviewerId");

            migrationBuilder.CreateIndex(
                name: "IX_SurveyResponses_LocalUuid",
                table: "SurveyResponses",
                column: "LocalUuid",
                unique: true,
                filter: "\"LocalUuid\" IS NOT NULL AND \"IsDeleted\" = false");

            migrationBuilder.CreateIndex(
                name: "IX_SurveyResponses_Neighborhood",
                table: "SurveyResponses",
                column: "Neighborhood");

            migrationBuilder.CreateIndex(
                name: "IX_SurveyFieldTasks_Neighborhood",
                table: "SurveyFieldTasks",
                column: "Neighborhood");

            migrationBuilder.CreateIndex(
                name: "IX_SurveyFieldTasks_SurveyId_InterviewerId",
                table: "SurveyFieldTasks",
                columns: new[] { "SurveyId", "InterviewerId" });

            migrationBuilder.CreateIndex(
                name: "IX_SurveyQuestionBank_Topic",
                table: "SurveyQuestionBank",
                column: "Topic");

            migrationBuilder.CreateIndex(
                name: "IX_SurveyQuotas_SurveyId_Dimension_Value",
                table: "SurveyQuotas",
                columns: new[] { "SurveyId", "Dimension", "Value" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SurveyFieldTasks");

            migrationBuilder.DropTable(
                name: "SurveyQuestionBank");

            migrationBuilder.DropTable(
                name: "SurveyQuotas");

            migrationBuilder.DropIndex(
                name: "IX_Surveys_Topic",
                table: "Surveys");

            migrationBuilder.DropIndex(
                name: "IX_SurveyResponses_InterviewerId",
                table: "SurveyResponses");

            migrationBuilder.DropIndex(
                name: "IX_SurveyResponses_LocalUuid",
                table: "SurveyResponses");

            migrationBuilder.DropIndex(
                name: "IX_SurveyResponses_Neighborhood",
                table: "SurveyResponses");

            migrationBuilder.DropColumn(
                name: "FieldEnabled",
                table: "Surveys");

            migrationBuilder.DropColumn(
                name: "IdentityMode",
                table: "Surveys");

            migrationBuilder.DropColumn(
                name: "RequireLocation",
                table: "Surveys");

            migrationBuilder.DropColumn(
                name: "SurveyType",
                table: "Surveys");

            migrationBuilder.DropColumn(
                name: "TargetNeighborhoods",
                table: "Surveys");

            migrationBuilder.DropColumn(
                name: "TargetResponseCount",
                table: "Surveys");

            migrationBuilder.DropColumn(
                name: "Topic",
                table: "Surveys");

            migrationBuilder.DropColumn(
                name: "AgeGroup",
                table: "SurveyResponses");

            migrationBuilder.DropColumn(
                name: "Channel",
                table: "SurveyResponses");

            migrationBuilder.DropColumn(
                name: "DeviceId",
                table: "SurveyResponses");

            migrationBuilder.DropColumn(
                name: "DurationSeconds",
                table: "SurveyResponses");

            migrationBuilder.DropColumn(
                name: "FieldTaskId",
                table: "SurveyResponses");

            migrationBuilder.DropColumn(
                name: "FlagReason",
                table: "SurveyResponses");

            migrationBuilder.DropColumn(
                name: "Gender",
                table: "SurveyResponses");

            migrationBuilder.DropColumn(
                name: "InterviewerId",
                table: "SurveyResponses");

            migrationBuilder.DropColumn(
                name: "IsFlagged",
                table: "SurveyResponses");

            migrationBuilder.DropColumn(
                name: "Latitude",
                table: "SurveyResponses");

            migrationBuilder.DropColumn(
                name: "LocalUuid",
                table: "SurveyResponses");

            migrationBuilder.DropColumn(
                name: "Longitude",
                table: "SurveyResponses");

            migrationBuilder.DropColumn(
                name: "Neighborhood",
                table: "SurveyResponses");
        }
    }
}
