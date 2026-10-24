import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { splitSqlStatements } from "./sql-statements.mjs";

test("keeps the equipment listing migration DO block intact", () => {
  const migration = readFileSync(new URL("./add-equipment-listing-fields.sql", import.meta.url), "utf8");
  const statements = splitSqlStatements(migration);
  const block = statements.find((statement) => statement.startsWith("do $$"));

  assert.equal(statements[0].toLowerCase(), "begin");
  assert.equal(statements.at(-1).toLowerCase(), "commit");
  assert.ok(block?.includes("end $$"));
});

test("keeps semicolons inside a dollar-quoted block", () => {
  const statements = splitSqlStatements(`begin;
do $$
begin
  perform 'first; second';
end $$;
commit;`);

  assert.deepEqual(statements, [
    "begin",
    `do $$
begin
  perform 'first; second';
end $$`,
    "commit",
  ]);
});

test("ignores semicolons in strings, identifiers, and comments", () => {
  const statements = splitSqlStatements(
    `select 'one; two', "semi;colon"; -- ignored;
/* outer; /* nested; */ still ignored; */
select 'escaped '' quote; safely';`
  );

  assert.deepEqual(statements, [
    `select 'one; two', "semi;colon"`,
    `-- ignored;
/* outer; /* nested; */ still ignored; */
select 'escaped '' quote; safely'`,
  ]);
});

test("rejects an unterminated dollar-quoted block", () => {
  assert.throws(() => splitSqlStatements("do $$ begin;"), /Unterminated dollar-quoted SQL block/);
});
