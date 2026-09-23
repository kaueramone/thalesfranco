import { workoutPdf } from "../lib/pdf";
import { exampleWorkout } from "../lib/model";
import { mkdir, writeFile } from "node:fs/promises";
async function main() {
  await mkdir("output/pdf", { recursive: true });
  await writeFile(
    "output/pdf/thales-franco-semana-8.pdf",
    await workoutPdf(
      exampleWorkout(),
      "https://example.com/treino/demonstracao",
    ),
  );
  console.log("PDF gerado");
}
main();
