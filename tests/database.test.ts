import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
test("SQL is rerunnable; RLS isolates administrators and public; delivery claims are unique", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to authenticated,anon,service_role;grant execute on function auth.uid() to authenticated;`,
    );
    // PGlite uses core gen_random_uuid; Supabase also enables pgcrypto for compatibility.
    const sql = (await readFile("supabase/001_schema.sql", "utf8")).replace(
      "create extension if not exists pgcrypto;",
      "",
    );
    await db.exec(sql);
    await db.exec(sql);
    const a = "11111111-1111-4111-8111-111111111111",
      b = "22222222-2222-4222-8222-222222222222",
      c = "33333333-3333-4333-8333-333333333333";
    await db.exec(
      `insert into auth.users values('${a}','a@example.com'),('${b}','b@example.com'),('${c}','c@example.com');insert into public.admins values('${a}'),('${b}');set role authenticated;set request.jwt.claim.sub='${a}';`,
    );
    const {
      rows: [s],
    } = await db.query<{ id: string }>(
      `insert into students(name,email) values('Aluno A','aluno@example.com') returning id`,
    );
    const {
      rows: [w],
    } = await db.query<{ id: string }>(
      `insert into workouts(content) values('{}') returning id`,
    );
    await db.exec(`set request.jwt.claim.sub='${b}'`);
    assert.equal((await db.query("select * from students")).rows.length, 0);
    assert.equal((await db.query("select * from workouts")).rows.length, 0);
    await assert.rejects(
      db.query(
        `insert into students(owner_id,name,email) values('${a}','Inválido','a@example.com')`,
      ),
    );
    await db.exec(`set request.jwt.claim.sub='${c}'`);
    await assert.rejects(
      db.query(`insert into workouts(content) values('{}')`),
    );
    await db.exec("set role anon");
    await assert.rejects(db.query("select * from students"));
    await assert.rejects(db.query("select * from publications"));
    await assert.rejects(db.query("select * from deliveries"));
    await db.exec("reset role");
    const {
      rows: [p],
    } = await db.query<{ id: string }>(
      `insert into publications(owner_id,workout_id,title,content,content_hash) values('${a}','${w.id}','Week 1','{}','hash') returning id`,
    );
    const claim = `insert into deliveries(owner_id,publication_id,student_id,channel) values('${a}','${p.id}','${s.id}','email')`;
    await db.exec(claim);
    await assert.rejects(db.exec(claim));
    await db.exec(`set role authenticated;set request.jwt.claim.sub='${a}'`);
    await assert.rejects(db.query(`update publications set revoked=true`));
    assert.equal((await db.query("select * from deliveries")).rows.length, 1);
  } finally {
    await db.close();
  }
});
