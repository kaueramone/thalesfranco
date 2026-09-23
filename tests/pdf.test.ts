import test from "node:test";
import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import { workoutPdf } from "../lib/pdf";
import { exampleWorkout } from "../lib/model";

test("PDF uses compact weekly schedule, tabular session and clickable video links", async () => {
  const w = exampleWorkout();
  w.days[0].blocks[0].exercises[0].video = "https://youtu.be/dQw4w9WgXcQ";
  const pdf = await PDFDocument.load(
    await workoutPdf(w, "https://thalesfranco.vercel.app/treino/test"),
  );
  assert.equal(pdf.getPageCount(), 3);
  assert.equal(pdf.getPage(1).node.Annots()?.size(), 1);
  assert.equal(pdf.getPage(2).node.Annots()?.size(), 1);
});
test("Long uneven columns continue on additional pages and retain final links", async () => {
  const w = exampleWorkout();
  w.days[0].blocks[0].exercises[0].prescription = Array.from(
    { length: 170 },
    (_, i) => `Line ${i + 1}: 10 controlled repetitions.`,
  ).join("\n");
  w.days[0].blocks[0].exercises[0].video = "https://youtu.be/dQw4w9WgXcQ";
  w.days[0].notes = "Recovery notes. ".repeat(150);
  const pdf = await PDFDocument.load(
    await workoutPdf(w, "https://thalesfranco.vercel.app/treino/test"),
  );
  assert.ok(pdf.getPageCount() > 3);
  assert.ok(pdf.getPageCount() < 20);
  assert.equal(
    pdf.getPages().reduce((n, p) => n + (p.node.Annots()?.size() || 0), 0),
    2,
  );
});
