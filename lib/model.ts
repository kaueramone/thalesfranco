import { z } from "zod";
export function youtubeId(value: string): string | null {
  try {
    const u = new URL(value);
    if (u.protocol !== "https:") return null;
    const host = u.hostname.replace(/^www\./, "");
    let id: string | null = null;
    if (host === "youtu.be") id = u.pathname.split("/")[1];
    if (["youtube.com", "m.youtube.com", "youtube-nocookie.com"].includes(host))
      id =
        u.pathname === "/watch"
          ? u.searchParams.get("v")
          : ["embed", "shorts", "live"].includes(u.pathname.split("/")[1])
            ? u.pathname.split("/")[2]
            : null;
    return id && /^[\w-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}
export const exerciseSchema = z.object({
  id: z.string().max(100),
  name: z.string().trim().min(1).max(200),
  prescription: z.string().max(3000),
  video: z
    .string()
    .max(500)
    .refine(
      (v) => !v || !!youtubeId(v),
      "Informe um link HTTPS válido do YouTube.",
    ),
});
export const workoutSchema = z.object({
  title: z.string().trim().min(1).max(160),
  week: z.coerce.number().int().min(1).max(999),
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  phase: z.string().max(100),
  intro: z.string().max(12000),
  days: z
    .array(
      z.object({
        name: z.string().max(60),
        rest: z.boolean(),
        notes: z.string().max(6000),
        blocks: z
          .array(
            z.object({
              id: z.string().max(100),
              name: z.string().min(1).max(100),
              exercises: z.array(exerciseSchema).max(50),
            }),
          )
          .max(15),
      }),
    )
    .length(7),
});
export type Workout = z.infer<typeof workoutSchema>;
export const studentSchema = z
  .object({
    name: z.string().trim().min(2).max(150),
    birth_date: z
      .string()
      .refine(
        (v) =>
          !v ||
          (/^\d{4}-\d{2}-\d{2}$/.test(v) &&
            v <= new Date().toISOString().slice(0, 10)),
        "Data de nascimento inválida.",
      ),
    email: z.union([z.literal(""), z.email()]),
    whatsapp: z
      .string()
      .refine(
        (v) => !v || /^\+[1-9]\d{7,14}$/.test(v),
        "Use +, código do país e número (ex.: +5511999999999).",
      ),
    active: z.boolean(),
    email_opt_in: z.boolean(),
    whatsapp_opt_in: z.boolean(),
  })
  .refine((s) => !!s.email || !!s.whatsapp, "Informe e-mail ou WhatsApp.")
  .refine(
    (s) => !s.email_opt_in || !!s.email,
    "Informe e-mail para habilitar esse canal.",
  )
  .refine(
    (s) => !s.whatsapp_opt_in || !!s.whatsapp,
    "Informe WhatsApp para habilitar esse canal.",
  );
export type Student = z.infer<typeof studentSchema> & { id: string };
export type WorkoutRow = { id: string; content: Workout; updated_at: string };
export type Delivery = {
  id: string;
  channel: string;
  status: string;
  created_at: string;
  error: string | null;
  students: { name: string } | null;
  publications: { title: string } | null;
};
const uid = () => crypto.randomUUID();
export function blankWorkout(week = 1): Workout {
  return {
    title: `Weekly Program · Week ${week}`,
    week,
    start: new Date().toISOString().slice(0, 10),
    phase: "Base Building",
    intro: "",
    days: [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ].map((name) => ({
      name,
      rest: false,
      notes: "",
      blocks: [
        "Warm-up",
        "Running",
        "Strength",
        "HYROX Stations",
        "Cool-down",
      ].map((name) => ({ id: uid(), name, exercises: [] })),
    })),
  };
}
export function exampleWorkout(): Workout {
  const w = blankWorkout(8);
  w.title = "Built for the long run.";
  w.phase = "Base Building";
  w.intro =
    "Programação HYROX · Modelo demonstrativo.\nDefina as distâncias, cargas, volumes e adaptações para sua turma antes de enviar.";
  const ex = (name: string, prescription: string) => ({
    id: uid(),
    name,
    prescription,
    video: "",
  });
  w.days[0].blocks = [
    {
      id: uid(),
      name: "Warm-up",
      exercises: [
        ex("Easy Run", "Defina a duração e a intensidade do aquecimento."),
        ex(
          "Dynamic Mobility",
          "Descreva a sequência de mobilidade e preparação.",
        ),
      ],
    },
    {
      id: uid(),
      name: "Running",
      exercises: [
        ex(
          "Run Intervals",
          "Defina a distância, o número de repetições, o ritmo e a recuperação.",
        ),
      ],
    },
    {
      id: uid(),
      name: "Strength",
      exercises: [
        ex("Sled Push", "Defina carga, distância, séries e descanso."),
        ex("Sled Pull", "Defina carga, distância, séries e descanso."),
      ],
    },
    {
      id: uid(),
      name: "HYROX Stations",
      exercises: [
        ex("SkiErg", "Defina distância e intensidade."),
        ex("Farmers Carry", "Defina carga, distância e foco técnico."),
        ex("Wall Balls", "Defina carga, repetições e adaptações."),
      ],
    },
    {
      id: uid(),
      name: "Cool-down",
      exercises: [
        ex("Recovery & Mobility", "Oriente a volta à calma e a recuperação."),
      ],
    },
  ];
  w.days[0].notes =
    "Modelo de estrutura, sem prescrição pronta. Personalize a sessão conforme o nível e os objetivos dos alunos.";
  w.days[3].rest = true;
  w.days[6].rest = true;
  return w;
}
export function eligible(s: Student, channel: "email" | "whatsapp") {
  return (
    s.active &&
    (channel === "email"
      ? !!s.email && s.email_opt_in
      : !!s.whatsapp && s.whatsapp_opt_in)
  );
}
