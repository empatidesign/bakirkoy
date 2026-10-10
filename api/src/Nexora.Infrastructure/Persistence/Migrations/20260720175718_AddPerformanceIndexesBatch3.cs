using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Nexora.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddPerformanceIndexesBatch3 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Wheels_Status",
                table: "Wheels");

            migrationBuilder.DropIndex(
                name: "IX_Wheels_Title",
                table: "Wheels");

            migrationBuilder.DropIndex(
                name: "IX_TravelAttendances_TravelId",
                table: "TravelAttendances");

            migrationBuilder.DropIndex(
                name: "IX_Surveys_Category",
                table: "Surveys");

            migrationBuilder.DropIndex(
                name: "IX_Surveys_Status",
                table: "Surveys");

            migrationBuilder.DropIndex(
                name: "IX_SurveyResponses_SurveyId",
                table: "SurveyResponses");

            migrationBuilder.DropIndex(
                name: "IX_ServiceFacilities_LocationType",
                table: "ServiceFacilities");

            migrationBuilder.DropIndex(
                name: "IX_ServiceFacilities_Status",
                table: "ServiceFacilities");

            migrationBuilder.DropIndex(
                name: "IX_SedaPeriods_IsActive",
                table: "SedaPeriods");

            migrationBuilder.DropIndex(
                name: "IX_SedaApplications_Status",
                table: "SedaApplications");

            migrationBuilder.DropIndex(
                name: "IX_SedaApplications_Tckn",
                table: "SedaApplications");

            migrationBuilder.DropIndex(
                name: "IX_RolePermissions_RoleId",
                table: "RolePermissions");

            migrationBuilder.DropIndex(
                name: "IX_Quizzes_Status",
                table: "Quizzes");

            migrationBuilder.DropIndex(
                name: "IX_QuizParticipations_QuizId",
                table: "QuizParticipations");

            migrationBuilder.DropIndex(
                name: "IX_Permissions_ModuleKey",
                table: "Permissions");

            migrationBuilder.DropIndex(
                name: "IX_LibraryStaffMembers_AdminUserId",
                table: "LibraryStaffMembers");

            migrationBuilder.DropIndex(
                name: "IX_LibraryStaffMembers_IsActive",
                table: "LibraryStaffMembers");

            migrationBuilder.DropIndex(
                name: "IX_LibraryShifts_StaffId",
                table: "LibraryShifts");

            migrationBuilder.DropIndex(
                name: "IX_LibraryShifts_StartTime",
                table: "LibraryShifts");

            migrationBuilder.DropIndex(
                name: "IX_LibrarySettingsHistories_CreatedAt",
                table: "LibrarySettingsHistories");

            migrationBuilder.DropIndex(
                name: "IX_LibrarySettingsHistories_LibraryId",
                table: "LibrarySettingsHistories");

            migrationBuilder.DropIndex(
                name: "IX_LibraryRules_IsActive",
                table: "LibraryRules");

            migrationBuilder.DropIndex(
                name: "IX_Libraries_IsActive",
                table: "Libraries");

            migrationBuilder.DropIndex(
                name: "IX_Gifts_Name",
                table: "Gifts");

            migrationBuilder.DropIndex(
                name: "IX_Gifts_Status",
                table: "Gifts");

            migrationBuilder.DropIndex(
                name: "IX_EmergencyAreas_Name",
                table: "EmergencyAreas");

            migrationBuilder.DropIndex(
                name: "IX_EmergencyAreas_Neighborhood",
                table: "EmergencyAreas");

            migrationBuilder.DropIndex(
                name: "IX_EmergencyAreas_Status",
                table: "EmergencyAreas");

            migrationBuilder.CreateIndex(
                name: "IX_SedaEducationRecords_AcademicYear_Tckn",
                table: "SedaEducationRecords",
                columns: new[] { "AcademicYear", "Tckn" });

            migrationBuilder.CreateIndex(
                name: "IX_SedaApplications_CitizenUserId_CreatedAt",
                table: "SedaApplications",
                columns: new[] { "CitizenUserId", "CreatedAt" },
                filter: "\"CitizenUserId\" IS NOT NULL AND \"IsDeleted\" = false");

            migrationBuilder.CreateIndex(
                name: "IX_SedaApplications_CreatedAt",
                table: "SedaApplications",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_Quizzes_AgeGroupId",
                table: "Quizzes",
                column: "AgeGroupId");

            migrationBuilder.CreateIndex(
                name: "IX_QuizParticipations_CategoryId_Score",
                table: "QuizParticipations",
                columns: new[] { "CategoryId", "Score" });

            migrationBuilder.CreateIndex(
                name: "IX_LibraryStaffMembers_AdminUserId",
                table: "LibraryStaffMembers",
                column: "AdminUserId",
                unique: true,
                // Bug fix (2026-07-22): Bu migration hiçbir ortamda başarıyla tamamlanmamıştı
                // (her yerde Pending durumundaydı) çünkü soft-delete'i (IsDeleted) hesaba
                // katmayan bir unique index oluşturmaya çalışıyordu — test/geliştirme
                // döngüsünde bir AdminUserId için birden fazla SİLİNMİŞ LibraryStaff kaydı
                // oluştuğunda (normal bir durum) index oluşturma başarısız oluyor ve bu
                // noktadan sonraki HİÇBİR migration uygulanamıyordu. Migration hiçbir yerde
                // gerçekten uygulanmadığı için (her ortamda Pending), düzeltmeyi ayrı bir
                // migration yerine doğrudan burada yapmak daha temiz: filter eklenerek
                // yalnızca silinmemiş kayıtlar arasında tekillik zorunlu kılınıyor.
                filter: "\"IsDeleted\" = false");

            migrationBuilder.CreateIndex(
                name: "IX_LibraryShifts_StaffId_StartTime",
                table: "LibraryShifts",
                columns: new[] { "StaffId", "StartTime" });

            migrationBuilder.CreateIndex(
                name: "IX_LibrarySettingsHistories_LibraryId_CreatedAt",
                table: "LibrarySettingsHistories",
                columns: new[] { "LibraryId", "CreatedAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_SedaEducationRecords_AcademicYear_Tckn",
                table: "SedaEducationRecords");

            migrationBuilder.DropIndex(
                name: "IX_SedaApplications_CitizenUserId_CreatedAt",
                table: "SedaApplications");

            migrationBuilder.DropIndex(
                name: "IX_SedaApplications_CreatedAt",
                table: "SedaApplications");

            migrationBuilder.DropIndex(
                name: "IX_Quizzes_AgeGroupId",
                table: "Quizzes");

            migrationBuilder.DropIndex(
                name: "IX_QuizParticipations_CategoryId_Score",
                table: "QuizParticipations");

            migrationBuilder.DropIndex(
                name: "IX_LibraryStaffMembers_AdminUserId",
                table: "LibraryStaffMembers");

            migrationBuilder.DropIndex(
                name: "IX_LibraryShifts_StaffId_StartTime",
                table: "LibraryShifts");

            migrationBuilder.DropIndex(
                name: "IX_LibrarySettingsHistories_LibraryId_CreatedAt",
                table: "LibrarySettingsHistories");

            migrationBuilder.CreateIndex(
                name: "IX_Wheels_Status",
                table: "Wheels",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_Wheels_Title",
                table: "Wheels",
                column: "Title");

            migrationBuilder.CreateIndex(
                name: "IX_TravelAttendances_TravelId",
                table: "TravelAttendances",
                column: "TravelId");

            migrationBuilder.CreateIndex(
                name: "IX_Surveys_Category",
                table: "Surveys",
                column: "Category");

            migrationBuilder.CreateIndex(
                name: "IX_Surveys_Status",
                table: "Surveys",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_SurveyResponses_SurveyId",
                table: "SurveyResponses",
                column: "SurveyId");

            migrationBuilder.CreateIndex(
                name: "IX_ServiceFacilities_LocationType",
                table: "ServiceFacilities",
                column: "LocationType");

            migrationBuilder.CreateIndex(
                name: "IX_ServiceFacilities_Status",
                table: "ServiceFacilities",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_SedaPeriods_IsActive",
                table: "SedaPeriods",
                column: "IsActive");

            migrationBuilder.CreateIndex(
                name: "IX_SedaApplications_Status",
                table: "SedaApplications",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_SedaApplications_Tckn",
                table: "SedaApplications",
                column: "Tckn");

            migrationBuilder.CreateIndex(
                name: "IX_RolePermissions_RoleId",
                table: "RolePermissions",
                column: "RoleId");

            migrationBuilder.CreateIndex(
                name: "IX_Quizzes_Status",
                table: "Quizzes",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_QuizParticipations_QuizId",
                table: "QuizParticipations",
                column: "QuizId");

            migrationBuilder.CreateIndex(
                name: "IX_Permissions_ModuleKey",
                table: "Permissions",
                column: "ModuleKey");

            migrationBuilder.CreateIndex(
                name: "IX_LibraryStaffMembers_AdminUserId",
                table: "LibraryStaffMembers",
                column: "AdminUserId");

            migrationBuilder.CreateIndex(
                name: "IX_LibraryStaffMembers_IsActive",
                table: "LibraryStaffMembers",
                column: "IsActive");

            migrationBuilder.CreateIndex(
                name: "IX_LibraryShifts_StaffId",
                table: "LibraryShifts",
                column: "StaffId");

            migrationBuilder.CreateIndex(
                name: "IX_LibraryShifts_StartTime",
                table: "LibraryShifts",
                column: "StartTime");

            migrationBuilder.CreateIndex(
                name: "IX_LibrarySettingsHistories_CreatedAt",
                table: "LibrarySettingsHistories",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_LibrarySettingsHistories_LibraryId",
                table: "LibrarySettingsHistories",
                column: "LibraryId");

            migrationBuilder.CreateIndex(
                name: "IX_LibraryRules_IsActive",
                table: "LibraryRules",
                column: "IsActive");

            migrationBuilder.CreateIndex(
                name: "IX_Libraries_IsActive",
                table: "Libraries",
                column: "IsActive");

            migrationBuilder.CreateIndex(
                name: "IX_Gifts_Name",
                table: "Gifts",
                column: "Name");

            migrationBuilder.CreateIndex(
                name: "IX_Gifts_Status",
                table: "Gifts",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_EmergencyAreas_Name",
                table: "EmergencyAreas",
                column: "Name");

            migrationBuilder.CreateIndex(
                name: "IX_EmergencyAreas_Neighborhood",
                table: "EmergencyAreas",
                column: "Neighborhood");

            migrationBuilder.CreateIndex(
                name: "IX_EmergencyAreas_Status",
                table: "EmergencyAreas",
                column: "Status");
        }
    }
}
