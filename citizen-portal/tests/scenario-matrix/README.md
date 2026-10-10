# Citizen scenario matrix harness

Live HTTP-only harness for citizen-facing modules. It uses real `/api/v1/auth/citizen` login/OTP and `/api/v1/me/*` endpoints, never direct database inserts.

```bash
cd citizen-portal/tests/scenario-matrix
../../node_modules/.bin/tsc scenario-matrix.ts --target ES2022 --module NodeNext --moduleResolution NodeNext --skipLibCheck --outDir .generated
node .generated/scenario-matrix.js
```

Optional flags:

- `SCENARIO_REGISTER_COUNT=5` creates additional synthetic parents through the real registration API.
- `SCENARIO_MUTATE=1` enables real apply/reserve mutation smoke tests.
- `SCENARIO_LIMIT=200` controls list endpoint page size.

Generated artifacts:

- `REPORT.md`
- `scenario-results.json`
- `scenario-findings.csv`
