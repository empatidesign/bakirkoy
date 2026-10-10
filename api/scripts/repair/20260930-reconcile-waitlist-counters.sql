-- Rebuild derived counters only. No registration/application status or quota changes.
-- Run with psql -v ON_ERROR_STOP=1. Take a counter snapshot before executing.
BEGIN;
SET LOCAL lock_timeout = '5s';
LOCK TABLE "FacilityGroups", "FacilityRegistrations", "Travels", "TravelApplications", "TravelApplicationPassengers" IN SHARE ROW EXCLUSIVE MODE;

WITH actual AS (
    SELECT g."Id", count(r."Id")::int AS waiting
    FROM "FacilityGroups" g
    LEFT JOIN "FacilityRegistrations" r ON r."GroupId" = g."Id"
        AND r."Status" = 'active' AND r."Kind" = 'reserve' AND NOT r."IsDeleted"
    WHERE NOT g."IsDeleted"
    GROUP BY g."Id"
)
UPDATE "FacilityGroups" g SET "WaitlistCount" = a.waiting
FROM actual a WHERE g."Id" = a."Id" AND g."WaitlistCount" <> a.waiting
RETURNING g."Id", g."Module", g."WaitlistCount";

-- Travel capacity counts people, including companions, rather than applications.
WITH passengers AS (
    SELECT "ApplicationId", count(*)::int AS n
    FROM "TravelApplicationPassengers" WHERE NOT "IsDeleted" GROUP BY "ApplicationId"
), actual AS (
    SELECT t."Id",
        coalesce(sum(greatest(coalesce(p.n, 0), 1)) FILTER (WHERE a."Status" = 'approved'), 0)::int AS approved,
        coalesce(sum(greatest(coalesce(p.n, 0), 1)) FILTER (WHERE a."Status" = 'waitlist'), 0)::int AS waiting
    FROM "Travels" t
    LEFT JOIN "TravelApplications" a ON a."TravelId" = t."Id" AND NOT a."IsDeleted"
    LEFT JOIN passengers p ON p."ApplicationId" = a."Id"
    WHERE NOT t."IsDeleted"
    GROUP BY t."Id"
)
UPDATE "Travels" t SET "RegisteredCount" = a.approved, "ReserveCount" = a.waiting
FROM actual a WHERE t."Id" = a."Id"
    AND (t."RegisteredCount" <> a.approved OR t."ReserveCount" <> a.waiting)
RETURNING t."Id", t."RegisteredCount", t."ReserveCount";
COMMIT;
