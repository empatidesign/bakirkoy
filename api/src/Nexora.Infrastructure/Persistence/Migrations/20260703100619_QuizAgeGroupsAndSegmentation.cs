using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Nexora.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class QuizAgeGroupsAndSegmentation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "AgeGroupId",
                table: "Quizzes",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "AllowRetry",
                table: "Quizzes",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "EducationLevel",
                table: "Quizzes",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "MaxParticipants",
                table: "Quizzes",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<bool>(
                name: "NegativeMarking",
                table: "Quizzes",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "PassRights",
                table: "Quizzes",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "PassingScore",
                table: "Quizzes",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<bool>(
                name: "RandomizeQuestions",
                table: "Quizzes",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<Guid>(
                name: "SubCategoryId",
                table: "Quizzes",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "AgeGroupId",
                table: "QuizQuestions",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Language",
                table: "QuizQuestions",
                type: "character varying(10)",
                maxLength: 10,
                nullable: false,
                defaultValue: "tr");

            migrationBuilder.AddColumn<Guid>(
                name: "SubCategoryId",
                table: "QuizQuestions",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<List<string>>(
                name: "Tags",
                table: "QuizQuestions",
                type: "text[]",
                nullable: false,
                defaultValueSql: "'{}'");

            migrationBuilder.AddColumn<Guid>(
                name: "AgeGroupId",
                table: "QuizParticipations",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "CategoryId",
                table: "QuizParticipations",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ParticipantAge",
                table: "QuizParticipations",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<Guid>(
                name: "ParentId",
                table: "QuizCategories",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "QuizAgeGroups",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    MinAge = table.Column<int>(type: "integer", nullable: false),
                    MaxAge = table.Column<int>(type: "integer", nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_QuizAgeGroups", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_QuizQuestions_AgeGroupId",
                table: "QuizQuestions",
                column: "AgeGroupId");

            migrationBuilder.CreateIndex(
                name: "IX_QuizAgeGroups_Name",
                table: "QuizAgeGroups",
                column: "Name",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "QuizAgeGroups");

            migrationBuilder.DropIndex(
                name: "IX_QuizQuestions_AgeGroupId",
                table: "QuizQuestions");

            migrationBuilder.DropColumn(
                name: "AgeGroupId",
                table: "Quizzes");

            migrationBuilder.DropColumn(
                name: "AllowRetry",
                table: "Quizzes");

            migrationBuilder.DropColumn(
                name: "EducationLevel",
                table: "Quizzes");

            migrationBuilder.DropColumn(
                name: "MaxParticipants",
                table: "Quizzes");

            migrationBuilder.DropColumn(
                name: "NegativeMarking",
                table: "Quizzes");

            migrationBuilder.DropColumn(
                name: "PassRights",
                table: "Quizzes");

            migrationBuilder.DropColumn(
                name: "PassingScore",
                table: "Quizzes");

            migrationBuilder.DropColumn(
                name: "RandomizeQuestions",
                table: "Quizzes");

            migrationBuilder.DropColumn(
                name: "SubCategoryId",
                table: "Quizzes");

            migrationBuilder.DropColumn(
                name: "AgeGroupId",
                table: "QuizQuestions");

            migrationBuilder.DropColumn(
                name: "Language",
                table: "QuizQuestions");

            migrationBuilder.DropColumn(
                name: "SubCategoryId",
                table: "QuizQuestions");

            migrationBuilder.DropColumn(
                name: "Tags",
                table: "QuizQuestions");

            migrationBuilder.DropColumn(
                name: "AgeGroupId",
                table: "QuizParticipations");

            migrationBuilder.DropColumn(
                name: "CategoryId",
                table: "QuizParticipations");

            migrationBuilder.DropColumn(
                name: "ParticipantAge",
                table: "QuizParticipations");

            migrationBuilder.DropColumn(
                name: "ParentId",
                table: "QuizCategories");
        }
    }
}
