"use client";
import { useRef, useState } from "react";
import { Play, Download, X, ArrowUpRight, Leaf } from "lucide-react";
import { type Workout, youtubeId } from "@/lib/model";
export default function WorkoutView({
  workout,
  token,
}: {
  workout: Workout;
  token?: string;
}) {
  const [day, setDay] = useState(0);
  const [video, setVideo] = useState<{
    name: string;
    id: string;
    url: string;
  } | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const d = workout.days[day];
  return (
    <div className="workout-view">
      <header className="reader-header">
        <img src="/logo-black.png" alt="Thales Franco" />
        <span>TRAINING PROGRAM</span>
        {token && (
          <a className="btn secondary" href={`/api/pdf/${token}`}>
            <Download size={16} /> Baixar PDF
          </a>
        )}
      </header>
      <section className="reader-hero">
        <span className="eyebrow">
          SUA PROGRAMAÇÃO · SEMANA {String(workout.week).padStart(2, "0")}
        </span>
        <h1>{workout.title}</h1>
        <p>
          {workout.phase} <span>•</span>{" "}
          {new Date(workout.start + "T12:00:00").toLocaleDateString("pt-BR")}
        </p>
      </section>
      {workout.intro && <p className="intro-text">{workout.intro}</p>}
      <nav className="day-tabs" aria-label="Dias da semana">
        {workout.days.map((d, i) => (
          <button
            key={i}
            className={day === i ? "active" : ""}
            onClick={() => setDay(i)}
          >
            {d.name.split("-")[0]}
          </button>
        ))}
      </nav>
      <section className="reader-day">
        <h2>{d.name}</h2>
        {d.rest ? (
          <div className="rest-card">
            <Leaf />
            <h3>Recuperar também é evoluir.</h3>
            <p>Dia de descanso. Respeite o tempo do seu corpo.</p>
          </div>
        ) : (
          <div className="reader-blocks">
            {d.blocks
              .filter((b) => b.exercises.length)
              .map((b, i) => (
                <article className="reader-block" key={b.id}>
                  <div className="block-heading">
                    <span className="block-number">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <h3>{b.name}</h3>
                  </div>
                  {b.exercises.map((e) => (
                    <div className="reader-exercise" key={e.id}>
                      <h4>{e.name}</h4>
                      <p>{e.prescription}</p>
                      {youtubeId(e.video) && (
                        <button
                          className="video-btn"
                          onClick={() => {
                            setVideo({
                              name: e.name,
                              id: youtubeId(e.video)!,
                              url: e.video,
                            });
                            dialog.current?.showModal();
                          }}
                        >
                          <Play size={14} /> Ver demonstração{" "}
                          <ArrowUpRight size={13} />
                        </button>
                      )}
                    </div>
                  ))}
                </article>
              ))}
          </div>
        )}
        {!d.rest && !d.blocks.some((b) => b.exercises.length) && (
          <p className="muted">Nenhum exercício definido para este dia.</p>
        )}
        {d.notes && (
          <aside className="coach-note">
            <span className="eyebrow">COACH’S NOTES</span>
            <p>{d.notes}</p>
          </aside>
        )}
      </section>
      <footer className="reader-footer">
        Treino com ciência. Resultado com constância.
        <br />
        <strong>THALES FRANCO</strong>
      </footer>
      <dialog
        ref={dialog}
        className="video-dialog"
        onClose={() => setVideo(null)}
      >
        <div className="modal-head">
          <h3>{video?.name}</h3>
          <button
            className="icon-btn"
            aria-label="Fechar vídeo"
            onClick={() => dialog.current?.close()}
          >
            <X />
          </button>
        </div>
        {video && (
          <>
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${video.id}`}
              title={video.name}
              allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
            />
            <a href={video.url} target="_blank" rel="noreferrer">
              Abrir no YouTube ↗
            </a>
          </>
        )}
      </dialog>
    </div>
  );
}
