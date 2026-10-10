using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Nexora.Domain.Entities.Travels;

namespace Nexora.Infrastructure.Persistence.Configurations;

public class TravelRouteConfiguration : IEntityTypeConfiguration<TravelRoute>
{
    public void Configure(EntityTypeBuilder<TravelRoute> builder)
    {
        builder.HasKey(x => x.Id);

        builder.Property(x => x.Name).IsRequired().HasMaxLength(200);
        builder.Property(x => x.Destination).HasMaxLength(200);
        builder.Property(x => x.DeparturePoint).HasMaxLength(300);
        builder.Property(x => x.Gender).IsRequired().HasMaxLength(20);

        builder.Property(x => x.Description).HasColumnType("text");
        builder.Property(x => x.Conditions).HasColumnType("text");
        builder.Property(x => x.InternalNote).HasColumnType("text");

        builder.Property(x => x.RestrictionsJson).IsRequired().HasColumnType("jsonb");
        builder.Property(x => x.ImagesJson).IsRequired().HasColumnType("jsonb");
        builder.Property(x => x.PricingJson).IsRequired().HasColumnType("jsonb");
        builder.Property(x => x.PointsJson).IsRequired().HasColumnType("jsonb");

        builder.Property(x => x.IsActive).IsRequired();
        builder.Property(x => x.SultangaziResidentOnly).IsRequired();

        builder.Property(x => x.CreatedBy).HasMaxLength(200);
        builder.Property(x => x.UpdatedBy).HasMaxLength(200);

        builder.HasIndex(x => x.CategoryId);
        builder.HasIndex(x => x.Name);

        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}
