using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Nexora.Domain.Entities.Quizzes;

namespace Nexora.Infrastructure.Persistence.Configurations;

public class QuizParticipationConfiguration : IEntityTypeConfiguration<QuizParticipation>
{
    public void Configure(EntityTypeBuilder<QuizParticipation> builder)
    {
        builder.HasKey(x => x.Id);

        builder.Property(x => x.ParticipantName).IsRequired().HasMaxLength(200);
        builder.Property(x => x.Tckn).IsRequired().HasMaxLength(11);
        builder.Property(x => x.AnswersJson).IsRequired().HasColumnType("jsonb");

        builder.HasIndex(x => new { x.QuizId, x.Tckn }).IsUnique().HasFilter("\"IsDeleted\" = false");
        builder.HasIndex(x => new { x.CategoryId, x.Score });

        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}
