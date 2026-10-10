-- BUG-3 düzeltmesi: Migration 20260628153800 "applied" işaretli ama MobileMenu
-- tabloları DB'de yok (aynı migration'daki Loyalty tabloları var). Şemayı migration
-- dosyasına birebir uygun, idempotent olarak oluştur.
BEGIN;

CREATE TABLE IF NOT EXISTS "MobileMenuBanners" (
    "Id" uuid NOT NULL,
    "PageKey" character varying(120) NOT NULL,
    "ImageUrl" character varying(1000) NOT NULL,
    "LinkType" integer NOT NULL,
    "LinkTarget" character varying(1000) NULL,
    "IsVisible" boolean NOT NULL,
    "Order" integer NOT NULL,
    "CreatedAt" timestamp without time zone NOT NULL,
    "UpdatedAt" timestamp without time zone NULL,
    "IsDeleted" boolean NOT NULL,
    "DeletedAt" timestamp without time zone NULL,
    CONSTRAINT "PK_MobileMenuBanners" PRIMARY KEY ("Id")
);

CREATE TABLE IF NOT EXISTS "MobileMenuItems" (
    "Id" uuid NOT NULL,
    "Title" character varying(120) NOT NULL,
    "Icon" character varying(1000) NOT NULL,
    "IconType" integer NOT NULL,
    "Color" character varying(20) NOT NULL,
    "LinkType" integer NOT NULL,
    "LinkTarget" character varying(1000) NOT NULL,
    "GroupKey" character varying(60) NOT NULL,
    "GroupTitle" character varying(120) NOT NULL,
    "IsPopular" boolean NOT NULL,
    "IsVisible" boolean NOT NULL,
    "RequiresAuth" boolean NOT NULL,
    "Order" integer NOT NULL,
    "CreatedAt" timestamp without time zone NOT NULL,
    "UpdatedAt" timestamp without time zone NULL,
    "IsDeleted" boolean NOT NULL,
    "DeletedAt" timestamp without time zone NULL,
    CONSTRAINT "PK_MobileMenuItems" PRIMARY KEY ("Id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "IX_MobileMenuBanners_PageKey" ON "MobileMenuBanners" ("PageKey");
CREATE INDEX IF NOT EXISTS "IX_MobileMenuItems_GroupKey" ON "MobileMenuItems" ("GroupKey");
CREATE INDEX IF NOT EXISTS "IX_MobileMenuItems_Order" ON "MobileMenuItems" ("Order");

COMMIT;
