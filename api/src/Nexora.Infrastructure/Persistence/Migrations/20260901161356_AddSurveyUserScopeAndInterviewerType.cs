using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Nexora.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddSurveyUserScopeAndInterviewerType : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "InterviewerType",
                table: "SurveyResponses",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "Neighborhood",
                table: "SurveyFieldTasks",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(100)",
                oldMaxLength: 100);

            migrationBuilder.AddColumn<string>(
                name: "InterviewerType",
                table: "SurveyFieldTasks",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<bool>(
                name: "IsSurveyUser",
                table: "AdminUsers",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "SurveyAllNeighborhoods",
                table: "AdminUsers",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "SurveyCanViewParticipants",
                table: "AdminUsers",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "SurveyCanViewPastSurveys",
                table: "AdminUsers",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "SurveyCreateOnly",
                table: "AdminUsers",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<List<string>>(
                name: "SurveyNeighborhoods",
                table: "AdminUsers",
                type: "text[]",
                nullable: false,
                defaultValueSql: "ARRAY[]::text[]");

            migrationBuilder.AddColumn<bool>(
                name: "SurveyOwnSurveysOnly",
                table: "AdminUsers",
                type: "boolean",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "InterviewerType",
                table: "SurveyResponses");

            migrationBuilder.DropColumn(
                name: "InterviewerType",
                table: "SurveyFieldTasks");

            migrationBuilder.DropColumn(
                name: "IsSurveyUser",
                table: "AdminUsers");

            migrationBuilder.DropColumn(
                name: "SurveyAllNeighborhoods",
                table: "AdminUsers");

            migrationBuilder.DropColumn(
                name: "SurveyCanViewParticipants",
                table: "AdminUsers");

            migrationBuilder.DropColumn(
                name: "SurveyCanViewPastSurveys",
                table: "AdminUsers");

            migrationBuilder.DropColumn(
                name: "SurveyCreateOnly",
                table: "AdminUsers");

            migrationBuilder.DropColumn(
                name: "SurveyNeighborhoods",
                table: "AdminUsers");

            migrationBuilder.DropColumn(
                name: "SurveyOwnSurveysOnly",
                table: "AdminUsers");

            migrationBuilder.AlterColumn<string>(
                name: "Neighborhood",
                table: "SurveyFieldTasks",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "character varying(100)",
                oldMaxLength: 100,
                oldNullable: true);
        }
    }
}
