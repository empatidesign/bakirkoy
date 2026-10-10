using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Nexora.Domain.Entities.Organization;

namespace Nexora.Infrastructure.Persistence.Configurations;

public class DepartmentConfiguration : IEntityTypeConfiguration<Department>
{
    public void Configure(EntityTypeBuilder<Department> builder)
    {
        builder.HasKey(x => x.Id);

        builder.Property(x => x.Name).IsRequired().HasMaxLength(100);
        builder.Property(x => x.Description).HasMaxLength(300);

        // Unique index'in silinmiş (soft-deleted) kayıtları da kapsaması, bir departman
        // silinip aynı isimle yeniden oluşturulmak istendiğinde 23505 (unique violation) ->
        // DUPLICATE_RECORD hatası vermesine yol açıyordu — silinen kayıt tabloda kalmaya
        // devam ettiği için isim sonsuza kadar "işgal edilmiş" görünüyordu (bkz.
        // departments-soft-delete-unique-index-2026-07-30 bulgusu, P2). Filtreli (partial)
        // index'e geçilerek sadece IsDeleted=false kayıtlar arasında benzersizlik zorlanıyor.
        builder.HasIndex(x => x.Name).IsUnique().HasFilter("\"IsDeleted\" = false");

        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}
