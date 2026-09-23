import test from "node:test";
import assert from "node:assert/strict";
import {
  youtubeId,
  studentSchema,
  eligible,
  workoutSchema,
  exampleWorkout,
  blankWorkout,
} from "../lib/model";
test("YouTube accepts watch, short and mobile links; rejects forged hosts and scripts", () => {
  for (const url of [
    "https://youtu.be/dQw4w9WgXcQ",
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30",
    "https://m.youtube.com/shorts/dQw4w9WgXcQ",
  ])
    assert.equal(youtubeId(url), "dQw4w9WgXcQ");
  for (const url of [
    "javascript:alert(1)",
    "https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ",
    "https://youtube.com/watch?v=bad",
    "http://youtu.be/dQw4w9WgXcQ",
  ])
    assert.equal(youtubeId(url), null);
});
test("Consent and active status are required independently for each channel", () => {
  const s = {
    id: "x",
    name: "Aluno Teste",
    birth_date: "",
    email: "aluno@example.com",
    whatsapp: "+5511999999999",
    active: true,
    email_opt_in: true,
    whatsapp_opt_in: false,
  };
  assert.equal(eligible(s, "email"), true);
  assert.equal(eligible(s, "whatsapp"), false);
  assert.equal(eligible({ ...s, active: false }, "email"), false);
  assert.equal(eligible({ ...s, email: "" }, "email"), false);
  assert.equal(
    studentSchema.safeParse({ ...s, email: "not-email" }).success,
    false,
  );
  assert.equal(
    studentSchema.safeParse({ ...s, whatsapp: "11999999999" }).success,
    false,
  );
  assert.equal(
    studentSchema.safeParse({ ...s, birth_date: "2999-01-01" }).success,
    false,
  );
});
test("Only workout fields survive validation; personal data is excluded from publication", () => {
  const input = {
    ...exampleWorkout(),
    students: [{ name: "Private Person", email: "secret@example.com" }],
  };
  const result = workoutSchema.parse(input);
  assert.equal("students" in result, false);
  assert.equal(JSON.stringify(result).includes("secret@example.com"), false);
  assert.equal(result.days.length, 7);
});
test("HYROX examples are editable and invalid videos stop publication", () => {
  const w = exampleWorkout();
  assert.equal(workoutSchema.safeParse(w).success, true);
  w.days[0].blocks[0].name = "Race Preparation";
  assert.equal(
    workoutSchema.parse(w).days[0].blocks[0].name,
    "Race Preparation",
  );
  w.days[0].blocks[0].exercises[0].video = "https://evil.test/video";
  assert.equal(workoutSchema.safeParse(w).success, false);
  assert.equal(
    workoutSchema.safeParse({ ...blankWorkout(), days: [] }).success,
    false,
  );
});
