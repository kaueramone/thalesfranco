"use client";
import { useEffect, useRef, useState } from "react";
import {
  LayoutDashboard,
  Dumbbell,
  Users,
  Send,
  Settings,
  LogOut,
  Plus,
  ArrowUpRight,
  ArrowRight,
  ChevronRight,
  Search,
  MoreHorizontal,
  CalendarDays,
  Check,
  Mail,
  MessageCircle,
  Clock,
  FileText,
  Eye,
  Save,
  Trash2,
  Copy,
  X,
  Link as LinkIcon,
  ShieldCheck,
  Activity,
  Loader2,
} from "lucide-react";
import { supabase, configured, api } from "@/lib/supabase";
import {
  blankWorkout,
  exampleWorkout,
  workoutSchema,
  studentSchema,
  eligible,
  type Workout,
  type WorkoutRow,
  type Student,
  type Delivery,
} from "@/lib/model";
import WorkoutView from "./workout-view";
import WhatsAppShare from "./whatsapp-share";
type Tab = "overview" | "workouts" | "students" | "history" | "settings";
type Modal = "student" | "preview" | "send" | "whatsapp" | null;
const tabNames: Record<Tab, string> = {
  overview: "Visão geral",
  workouts: "Meus treinos",
  students: "Alunos",
  history: "Envios",
  settings: "Configurações",
};
const emptyStudent = {
  name: "",
  birth_date: "",
  email: "",
  whatsapp: "",
  active: true,
  email_opt_in: false,
  whatsapp_opt_in: false,
};
const statusLabel: Record<string, string> = {
  accepted: "Aceito pelo provedor",
  failed: "Falhou",
  processing: "Em processamento",
  uncertain: "Verificar no provedor",
};
export default function Studio() {
  const [ready, setReady] = useState(false),
    [logged, setLogged] = useState(false),
    [demo, setDemo] = useState(false),
    [tab, setTab] = useState<Tab>("overview");
  const [workouts, setWorkouts] = useState<WorkoutRow[]>([]),
    [students, setStudents] = useState<Student[]>([]),
    [history, setHistory] = useState<Delivery[]>([]),
    [pubs, setPubs] = useState<
      { id: string; title: string; token: string; revoked: boolean }[]
    >([]);
  const [editor, setEditor] = useState<Workout | null>(null),
    [editingId, setEditingId] = useState<string | null>(null),
    [day, setDay] = useState(0),
    [dirty, setDirty] = useState(false);
  const [modal, setModal] = useState<Modal>(null),
    [student, setStudent] = useState({ ...emptyStudent, id: "" }),
    [query, setQuery] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [selected, setSelected] = useState<string[]>([]),
    [channels, setChannels] = useState({ email: true, whatsapp: false }),
    [sendProgress, setSendProgress] = useState(""),
    [sending, setSending] = useState(false);
  const [connection, setConnection] = useState<{
      email: boolean;
      whatsapp: boolean;
      url: boolean;
    } | null>(null),
    [preview, setPreview] = useState<Workout | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const locked = useRef(false);
  const inform = (s: string) => setNotice(s);
  const problem = (e: unknown) =>
    inform(
      e instanceof Error ? e.message : "Ocorreu um erro. Tente novamente.",
    );
  async function load() {
    if (!supabase) return;
    const results = await Promise.all([
      supabase
        .from("workouts")
        .select("id,content,updated_at")
        .order("updated_at", { ascending: false }),
      supabase.from("students").select("*").order("name"),
      supabase
        .from("deliveries")
        .select(
          "id,channel,status,created_at,error,students(name),publications(title)",
        )
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("publications")
        .select("id,title,token,revoked")
        .order("created_at", { ascending: false }),
    ]);
    for (const r of results)
      if (r.error)
        throw new Error(
          "Não foi possível carregar os dados. Verifique a conexão e se os SQLs foram executados.",
        );
    setWorkouts(results[0].data as WorkoutRow[]);
    setStudents(
      (results[1].data || []).map((s) => ({
        ...s,
        birth_date: s.birth_date || "",
      })) as Student[],
    );
    setHistory(results[2].data as unknown as Delivery[]);
    setPubs(results[3].data as typeof pubs);
  }
  useEffect(() => {
    if (!supabase) {
      setReady(true);
      return;
    }
    let live = true;
    const client = supabase;
    client.auth.getSession().then(async ({ data }) => {
      if (!live) return;
      if (data.session) {
        const { data: admin } = await client
          .from("admins")
          .select("user_id")
          .eq("user_id", data.session.user.id)
          .maybeSingle();
        if (admin) {
          setLogged(true);
          try {
            await load();
          } catch (e) {
            problem(e);
          }
        } else await client.auth.signOut();
      }
      setReady(true);
    });
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        setLogged(false);
        setStudents([]);
        setWorkouts([]);
        setHistory([]);
        setPubs([]);
        setEditor(null);
        setDirty(false);
        setModal(null);
        setConnection(null);
      }
    });
    return () => {
      live = false;
      subscription.unsubscribe();
    };
  }, []);
  useEffect(() => {
    if (modal) dialog.current?.showModal();
    else dialog.current?.close();
  }, [modal]);
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty || sending) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty, sending]);
  useEffect(() => {
    if (tab === "settings" && !demo && logged)
      api("/api/settings").then(setConnection).catch(problem);
  }, [tab, logged, demo]);
  async function login(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (!supabase)
        throw new Error(
          "Configure as variáveis do Supabase para habilitar o login.",
        );
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw new Error("E-mail ou senha incorretos.");
      const { data: admin } = await supabase
        .from("admins")
        .select("user_id")
        .eq("user_id", data.user.id)
        .maybeSingle();
      if (!admin) {
        await supabase.auth.signOut();
        throw new Error(
          "Este usuário não tem permissão. Execute o SQL de autorização do Thales.",
        );
      }
      setPassword("");
      setLogged(true);
      await load();
    } catch (e) {
      problem(e);
    } finally {
      setBusy(false);
    }
  }
  function startDemo() {
    setDemo(true);
    setLogged(true);
    setWorkouts([
      {
        id: "demo",
        content: exampleWorkout(),
        updated_at: new Date().toISOString(),
      },
    ]);
    inform("Demonstração local: dados temporários, sem disparos reais.");
  }
  function navigate(next: Tab) {
    if (sending) return;
    if (dirty && !confirm("Descartar alterações não salvas?")) return;
    setDirty(false);
    setEditor(null);
    setTab(next);
  }
  function openWorkout(row?: WorkoutRow) {
    if (dirty && !confirm("Descartar alterações não salvas?")) return;
    setEditingId(row?.id || null);
    setEditor(
      structuredClone(
        row?.content ||
          blankWorkout(Math.max(0, ...workouts.map((w) => w.content.week)) + 1),
      ),
    );
    setDay(0);
    setDirty(!row);
    setTab("workouts");
  }
  function change(fn: (w: Workout) => void) {
    setEditor((old) => {
      if (!old) return old;
      const copy = structuredClone(old);
      fn(copy);
      return copy;
    });
    setDirty(true);
  }
  async function save() {
    if (!editor) return null;
    const parsed = workoutSchema.safeParse(editor);
    if (!parsed.success) {
      inform(parsed.error.issues[0].message);
      return null;
    }
    setBusy(true);
    try {
      let id = editingId;
      if (demo) {
        id = id || crypto.randomUUID();
        setWorkouts((old) => [
          {
            id: id!,
            content: structuredClone(editor),
            updated_at: new Date().toISOString(),
          },
          ...old.filter((w) => w.id !== id),
        ]);
      } else {
        const result = id
          ? await supabase!
              .from("workouts")
              .update({ content: parsed.data })
              .eq("id", id)
              .select("id")
              .single()
          : await supabase!
              .from("workouts")
              .insert({ content: parsed.data })
              .select("id")
              .single();
        if (result.error) throw new Error("Não foi possível salvar o treino.");
        id = result.data.id;
        await load();
      }
      setEditingId(id);
      setDirty(false);
      inform("Treino salvo. Tudo pronto para o próximo passo.");
      return id;
    } catch (e) {
      problem(e);
      return null;
    } finally {
      setBusy(false);
    }
  }
  async function saveStudent(e: React.FormEvent) {
    e.preventDefault();
    const parsed = studentSchema.safeParse(student);
    if (!parsed.success) {
      inform(parsed.error.issues[0].message);
      return;
    }
    setBusy(true);
    try {
      if (demo)
        setStudents((old) => [
          ...old.filter((s) => s.id !== student.id),
          { ...parsed.data, id: student.id || crypto.randomUUID() },
        ]);
      else {
        const payload = {
          ...parsed.data,
          birth_date: parsed.data.birth_date || null,
        };
        const { error } = student.id
          ? await supabase!
              .from("students")
              .update(payload)
              .eq("id", student.id)
          : await supabase!.from("students").insert(payload);
        if (error) throw new Error("Não foi possível salvar o aluno.");
        await load();
      }
      setModal(null);
      inform("Cadastro salvo.");
    } catch (e) {
      problem(e);
    } finally {
      setBusy(false);
    }
  }
  async function removeStudent(s: Student) {
    if (!confirm(`Excluir o cadastro de ${s.name}?`)) return;
    try {
      if (demo) setStudents((old) => old.filter((x) => x.id !== s.id));
      else {
        const { error } = await supabase!
          .from("students")
          .delete()
          .eq("id", s.id);
        if (error) throw error;
        await load();
      }
      inform("Cadastro excluído.");
    } catch (e) {
      problem(e);
    }
  }
  async function prepareWhatsApp() {
    if (!editor) return;
    if (dirty || !editingId) {
      const id = await save();
      if (!id) return;
    }
    setNotice("");
    setModal("whatsapp");
  }
  async function prepareSend() {
    if (!editor) return;
    if (dirty || !editingId) {
      const id = await save();
      if (!id) return;
    }
    setSelected(students.filter((s) => s.active).map((s) => s.id));
    setSendProgress("");
    setModal("send");
  }
  async function send() {
    if (locked.current || !editingId) return;
    locked.current = true;
    setSending(true);
    try {
      if (demo)
        throw new Error(
          "O modo demonstração não envia mensagens. Configure as integrações para ativar os disparos.",
        );
      const tasks = students
        .filter((s) => selected.includes(s.id))
        .flatMap((s) =>
          (["email", "whatsapp"] as const)
            .filter((c) => channels[c] && eligible(s, c))
            .map((channel) => ({ studentId: s.id, channel })),
        );
      if (!tasks.length)
        throw new Error("Selecione alunos e canais autorizados.");
      const settings = await api("/api/settings");
      if (tasks.some((t) => !settings[t.channel]) || !settings.url)
        throw new Error(
          "Configure os canais selecionados e APP_URL antes de enviar.",
        );
      const publication = await api("/api/publish", { workoutId: editingId });
      let accepted = 0,
        attention = 0;
      for (let i = 0; i < tasks.length; i++) {
        setSendProgress(
          `Processando ${i + 1} de ${tasks.length} envios… Mantenha esta página aberta.`,
        );
        try {
          const result = await api("/api/send", {
            publicationId: publication.id,
            ...tasks[i],
          });
          if (result.status === "accepted") accepted++;
          else attention++;
        } catch {
          attention++;
        }
      }
      setSendProgress(
        `${accepted} aceitos pelo provedor · ${attention} precisam de atenção. Consulte o histórico.`,
      );
      await load();
      inform(
        "Processamento concluído. O histórico mostra o resultado de cada canal.",
      );
    } catch (e) {
      problem(e);
    } finally {
      setSending(false);
      locked.current = false;
    }
  }
  const active = students.filter((s) => s.active).length;
  const latest = workouts[0];
  const deliveriesOk = history.filter((h) => h.status === "accepted").length;
  const selectedCount = students
    .filter((s) => selected.includes(s.id))
    .reduce(
      (n, s) =>
        n +
        Number(channels.email && eligible(s, "email")) +
        Number(channels.whatsapp && eligible(s, "whatsapp")),
      0,
    );
  if (!ready)
    return (
      <main className="center-page">
        <Loader2 className="spin" />
        <p>Preparando seu espaço…</p>
      </main>
    );
  if (!logged)
    return (
      <div className="login-page">
        <section className="login-brand">
          <img src="/logo-white.png" alt="Thales Franco" />
          <div>
            <span className="eyebrow">TRAINING STUDIO</span>
            <h1>
              O próximo nível
              <br />
              começa com
              <br />
              <em>constância.</em>
            </h1>
            <p>Seu método. Seus alunos. Uma experiência completa.</p>
          </div>
          <span className="login-foot">
            CIÊNCIA NO TREINO. INTENÇÃO EM CADA DETALHE.
          </span>
        </section>
        <main className="login-form">
          <span className="pill">
            <ShieldCheck size={14} /> ACESSO DO TREINADOR
          </span>
          <h2>Bom ter você de volta.</h2>
          <p className="muted">Entre para preparar a próxima evolução.</p>
          <form onSubmit={login}>
            <label>
              E-mail
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                placeholder="seu@email.com"
              />
            </label>
            <label>
              Senha
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="Sua senha"
              />
            </label>
            <button className="btn primary" disabled={busy || !configured}>
              {busy ? (
                <Loader2 className="spin" size={16} />
              ) : (
                <>
                  Entrar no studio <ArrowRight size={17} />
                </>
              )}
            </button>
          </form>
          {!configured && (
            <p className="setup-note">
              Conecte o Supabase para habilitar o acesso. Enquanto isso, explore
              o painel de demonstração.
            </p>
          )}
          {!configured && (
            <button className="text-btn" onClick={startDemo}>
              Explorar demonstração <ArrowUpRight size={14} />
            </button>
          )}
          <small>
            Acesso exclusivo de Thales Franco. Alunos recebem o treino por link.
          </small>
          {notice && (
            <div role="status" className="inline-notice">
              {notice}
            </div>
          )}
        </main>
      </div>
    );
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            navigate("overview");
          }}
          className="brand"
        >
          <img src="/logo-white.png" alt="Thales Franco" />
          <span>TRAINING STUDIO</span>
        </a>
        <div className="nav-caption">SEU ESPAÇO</div>
        <nav>
          {(
            [
              ["overview", LayoutDashboard],
              ["workouts", Dumbbell],
              ["students", Users],
              ["history", Send],
            ] as const
          ).map(([key, Icon]) => (
            <button
              key={key}
              className={tab === key ? "nav-item active" : "nav-item"}
              onClick={() => navigate(key)}
            >
              <Icon size={18} />
              <span>{tabNames[key]}</span>
              {key === "students" && <small>{students.length}</small>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="studio-note">
            <span className="red-dot" />
            <span>Consistência muda tudo.</span>
          </div>
          <button
            className={"nav-item " + (tab === "settings" ? "active" : "")}
            onClick={() => navigate("settings")}
          >
            <Settings size={18} />
            <span>Configurações</span>
          </button>
          <div className="profile">
            <div className="avatar">TF</div>
            <div>
              <strong>Thales Franco</strong>
              <small>Treinador</small>
            </div>
            <button
              className="icon-btn"
              title="Sair"
              aria-label="Sair"
              disabled={sending}
              onClick={async () => {
                if (dirty && !confirm("Sair sem salvar?")) return;
                if (demo) {
                  setDemo(false);
                  setLogged(false);
                  setWorkouts([]);
                  setStudents([]);
                  setHistory([]);
                  setEditor(null);
                  setDirty(false);
                } else await supabase!.auth.signOut();
              }}
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div>
            <span>Studio</span>
            <ChevronRight size={13} />
            <strong>{tabNames[tab]}</strong>
          </div>
          <div className="topbar-right">
            <span className={demo ? "demo-indicator" : "private-indicator"}>
              <span /> {demo ? "Modo demonstração" : "Espaço privado"}
            </span>
            <button
              className="icon-btn mobile-settings"
              aria-label="Configurações do studio"
              onClick={() => navigate("settings")}
            >
              <Settings size={17} />
            </button>
            <button
              className="avatar small profile-button"
              aria-label="Sair da conta"
              disabled={sending}
              onClick={async () => {
                if (dirty && !confirm("Sair sem salvar?")) return;
                if (demo) {
                  setDemo(false);
                  setLogged(false);
                  setEditor(null);
                  setDirty(false);
                  setStudents([]);
                  setWorkouts([]);
                } else await supabase!.auth.signOut();
              }}
            >
              TF
            </button>
          </div>
        </header>
        <main className="main-content">
          {tab === "overview" && (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">UM NOVO DIA PARA EVOLUIR</span>
                  <h1>
                    Olá, Thales<span className="red">.</span>
                  </h1>
                  <p>Menos gestão. Mais tempo para transformar resultados.</p>
                </div>
                <button className="btn primary" onClick={() => openWorkout()}>
                  <Plus size={18} /> Novo treino
                </button>
              </div>
              <section className="stats">
                <Stat
                  icon={<Users size={19} />}
                  value={active.toString().padStart(2, "0")}
                  label="Alunos ativos"
                  foot="Pessoas em movimento"
                />
                <Stat
                  icon={<Dumbbell size={19} />}
                  value={workouts.length.toString().padStart(2, "0")}
                  label="Treinos criados"
                  foot="Seu método, organizado"
                />
                <Stat
                  icon={<Send size={19} />}
                  value={deliveriesOk.toString().padStart(2, "0")}
                  label="Envios aceitos"
                  foot="Nos últimos 200 registros"
                />
              </section>
              <div className="overview-grid">
                <section className="featured">
                  <div className="featured-top">
                    <span className="pill dark">
                      <span className="red-dot" /> PROGRAMAÇÃO EM FOCO
                    </span>
                    <span className="week-large">
                      {latest
                        ? String(latest.content.week).padStart(2, "0")
                        : "01"}
                    </span>
                  </div>
                  <div className="featured-body">
                    <span className="eyebrow">
                      {latest
                        ? `SEMANA ${String(latest.content.week).padStart(2, "0")} · ${latest.content.phase.toUpperCase()}`
                        : "SEU PRÓXIMO PASSO"}
                    </span>
                    <h2>
                      {latest
                        ? latest.content.title
                        : "Grandes resultados.\nUma semana de cada vez."}
                    </h2>
                    <p>
                      {latest
                        ? "Cada sessão é um passo. Prepare os detalhes e leve o seu método aos alunos."
                        : "Crie sua primeira programação e comece a construir a evolução dos seus alunos."}
                    </p>
                    <button
                      className="btn light"
                      onClick={() => openWorkout(latest)}
                    >
                      {latest
                        ? "Continuar programação"
                        : "Criar primeiro treino"}
                      <ArrowUpRight size={17} />
                    </button>
                  </div>
                  <div className="featured-footer">
                    <span>
                      <CalendarDays size={15} />
                      {latest
                        ? "7 dias de programação"
                        : "Planejamento semanal"}
                    </span>
                    <span>
                      FEITO PARA EVOLUIR <ArrowRight size={14} />
                    </span>
                  </div>
                </section>
                <section className="panel quick-start">
                  <div className="section-title">
                    <h2>Do plano à prática</h2>
                    <Activity size={18} />
                  </div>
                  <p className="muted">Uma rotina simples. Um impacto real.</p>
                  {[
                    {
                      n: "01",
                      title: "Organize sua turma",
                      text: "Cadastre os alunos e seus contatos.",
                      action: () => navigate("students"),
                    },
                    {
                      n: "02",
                      title: "Prepare a semana",
                      text: "Exercícios, orientações e vídeos.",
                      action: () => openWorkout(latest),
                    },
                    {
                      n: "03",
                      title: "Faça o treino chegar",
                      text: "E-mail e compartilhamento por WhatsApp.",
                      action: () => {
                        if (latest) openWorkout(latest);
                        else inform("Crie e salve um treino para enviar.");
                      },
                    },
                  ].map((step) => (
                    <button className="step" key={step.n} onClick={step.action}>
                      <span>{step.n}</span>
                      <div>
                        <strong>{step.title}</strong>
                        <p>{step.text}</p>
                      </div>
                      <ArrowUpRight size={16} />
                    </button>
                  ))}
                </section>
              </div>
              <section className="panel recent-panel">
                <div className="section-title">
                  <div>
                    <h2>Últimos envios</h2>
                    <p className="muted">
                      Acompanhe o caminho do treino até seus alunos.
                    </p>
                  </div>
                  <button
                    className="text-btn"
                    onClick={() => navigate("history")}
                  >
                    Ver histórico <ArrowRight size={15} />
                  </button>
                </div>
                {history.length ? (
                  <HistoryTable rows={history.slice(0, 4)} />
                ) : (
                  <div className="empty-inline">
                    <span className="empty-icon">
                      <Send size={22} />
                    </span>
                    <div>
                      <strong>O próximo passo é compartilhar.</strong>
                      <p>
                        Os envios da sua primeira programação aparecerão aqui.
                      </p>
                    </div>
                    <button
                      className="btn secondary"
                      onClick={() => openWorkout(latest)}
                    >
                      Preparar treino <ArrowRight size={15} />
                    </button>
                  </div>
                )}
              </section>
              <div className="bottom-line">
                <span>Planejado com intenção. Entregue com cuidado.</span>
                <span>THALES FRANCO · TRAINING STUDIO</span>
              </div>
            </>
          )}
          {tab === "workouts" && !editor && (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">SEU MÉTODO EM MOVIMENTO</span>
                  <h1>Meus treinos</h1>
                  <p>Uma semana de cada vez. Uma evolução contínua.</p>
                </div>
                <button className="btn primary" onClick={() => openWorkout()}>
                  <Plus size={17} /> Novo treino
                </button>
              </div>
              <div className="workout-cards">
                {workouts.map((w) => (
                  <article className="panel workout-card" key={w.id}>
                    <div className="section-title">
                      <span className="pill">SEMANA {w.content.week}</span>
                      <Dumbbell size={19} />
                    </div>
                    <h2>{w.content.title}</h2>
                    <p>
                      {w.content.phase} ·{" "}
                      {
                        w.content.days.filter(
                          (d) =>
                            d.blocks.some((b) => b.exercises.length) && !d.rest,
                        ).length
                      }{" "}
                      dias com treino
                    </p>
                    <div className="row-actions">
                      <button
                        className="btn secondary"
                        onClick={() => openWorkout(w)}
                      >
                        Editar <ArrowUpRight size={15} />
                      </button>
                      <button
                        className="icon-btn"
                        aria-label={`Duplicar ${w.content.title}`}
                        onClick={() => {
                          const copy = structuredClone(w);
                          copy.content.week++;
                          copy.content.title = `${copy.content.title} (cópia)`;
                          openWorkout(copy);
                          setEditingId(null);
                          setDirty(true);
                        }}
                      >
                        <Copy size={17} />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
              {!workouts.length && (
                <Empty
                  icon={<Dumbbell />}
                  title="Seu método começa aqui."
                  text="Crie uma semana de treino com exercícios e orientações."
                  action={() => openWorkout()}
                  actionText="Criar treino"
                />
              )}
            </>
          )}
          {tab === "workouts" && editor && (
            <>
              <div className="page-heading editor-heading">
                <div>
                  <button
                    className="text-btn"
                    onClick={() => navigate("workouts")}
                  >
                    ← Todos os treinos
                  </button>
                  <h1>Programação semanal</h1>
                  <p>
                    {dirty ? "Alterações ainda não salvas" : "Tudo salvo"}{" "}
                    <span className="muted">· Semana {editor.week}</span>
                  </p>
                </div>
                <div className="row-actions">
                  <button
                    className="btn secondary"
                    onClick={() => {
                      setPreview(editor);
                      setModal("preview");
                    }}
                  >
                    <Eye size={16} /> Prévia
                  </button>
                  <button
                    className="btn secondary"
                    disabled={busy}
                    onClick={save}
                  >
                    <Save size={16} /> Salvar
                  </button>
                  <button
                    className="btn secondary"
                    disabled={busy}
                    onClick={prepareWhatsApp}
                  >
                    <MessageCircle size={16} /> WhatsApp
                  </button>
                  <button
                    className="btn primary"
                    disabled={busy}
                    onClick={prepareSend}
                  >
                    <Mail size={16} /> Enviar e-mail
                  </button>
                </div>
              </div>
              <section className="panel editor-meta">
                <div className="form-grid">
                  <label className="span-2">
                    Título da programação
                    <input
                      value={editor.title}
                      maxLength={160}
                      onChange={(e) =>
                        change((w) => {
                          w.title = e.target.value;
                        })
                      }
                    />
                  </label>
                  <label>
                    Semana
                    <input
                      type="number"
                      min={1}
                      max={999}
                      value={editor.week}
                      onChange={(e) =>
                        change((w) => {
                          w.week = Number(e.target.value);
                        })
                      }
                    />
                  </label>
                  <label>
                    Data de início
                    <input
                      type="date"
                      value={editor.start}
                      onChange={(e) =>
                        change((w) => {
                          w.start = e.target.value;
                        })
                      }
                    />
                  </label>
                  <label>
                    Período / fase
                    <input
                      value={editor.phase}
                      placeholder="Ex.: Deload"
                      maxLength={100}
                      onChange={(e) =>
                        change((w) => {
                          w.phase = e.target.value;
                        })
                      }
                    />
                  </label>
                </div>
                <label>
                  Introdução e orientações gerais
                  <textarea
                    value={editor.intro}
                    rows={3}
                    onChange={(e) =>
                      change((w) => {
                        w.intro = e.target.value;
                      })
                    }
                    placeholder="Contextualize os objetivos desta semana…"
                  />
                </label>
              </section>
              <nav className="day-tabs" aria-label="Editar dia">
                {editor.days.map((d, i) => (
                  <button
                    key={i}
                    className={day === i ? "active" : ""}
                    onClick={() => setDay(i)}
                  >
                    {d.name.split("-")[0]}
                    {(d.rest || d.blocks.some((b) => b.exercises.length)) && (
                      <span className="day-dot" />
                    )}
                  </button>
                ))}
              </nav>
              <div className="section-title day-title">
                <input
                  className="day-name-input"
                  aria-label="Título do dia"
                  value={editor.days[day].name}
                  onChange={(e) =>
                    change((w) => {
                      w.days[day].name = e.target.value;
                    })
                  }
                />
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={editor.days[day].rest}
                    onChange={(e) =>
                      change((w) => {
                        w.days[day].rest = e.target.checked;
                      })
                    }
                  />{" "}
                  Dia de descanso
                </label>
              </div>
              {!editor.days[day].rest && (
                <>
                  {editor.days[day].blocks.map((block, bi) => (
                    <section className="panel editor-block" key={block.id}>
                      <div className="block-heading">
                        <span className="block-number">
                          {String(bi + 1).padStart(2, "0")}
                        </span>
                        <input
                          aria-label="Nome do bloco"
                          value={block.name}
                          onChange={(e) =>
                            change((w) => {
                              w.days[day].blocks[bi].name = e.target.value;
                            })
                          }
                        />
                        <button
                          className="icon-btn"
                          aria-label={`Excluir bloco ${block.name}`}
                          onClick={() => {
                            if (
                              confirm("Excluir este bloco e seus exercícios?")
                            )
                              change((w) => {
                                w.days[day].blocks.splice(bi, 1);
                              });
                          }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                      {block.exercises.map((exercise, ei) => (
                        <div className="exercise-editor" key={exercise.id}>
                          <div className="exercise-index">
                            {String(ei + 1).padStart(2, "0")}
                          </div>
                          <div className="exercise-fields">
                            <div className="form-grid two">
                              <label>
                                Exercício
                                <input
                                  value={exercise.name}
                                  placeholder="Ex.: Sled Push"
                                  onChange={(e) =>
                                    change((w) => {
                                      w.days[day].blocks[bi].exercises[
                                        ei
                                      ].name = e.target.value;
                                    })
                                  }
                                />
                              </label>
                              <label>
                                <LinkIcon size={12} /> Vídeo do YouTube{" "}
                                <span className="optional">opcional</span>
                                <input
                                  type="url"
                                  value={exercise.video}
                                  placeholder="https://youtube.com/watch?v=…"
                                  onChange={(e) =>
                                    change((w) => {
                                      w.days[day].blocks[bi].exercises[
                                        ei
                                      ].video = e.target.value;
                                    })
                                  }
                                />
                              </label>
                            </div>
                            <label>
                              Prescrição e orientações
                              <textarea
                                rows={3}
                                value={exercise.prescription}
                                placeholder="Séries, repetições, carga, descanso e observações…"
                                onChange={(e) =>
                                  change((w) => {
                                    w.days[day].blocks[bi].exercises[
                                      ei
                                    ].prescription = e.target.value;
                                  })
                                }
                              />
                            </label>
                          </div>
                          <button
                            className="icon-btn"
                            aria-label={`Excluir exercício ${exercise.name || ei + 1}`}
                            onClick={() =>
                              change((w) => {
                                w.days[day].blocks[bi].exercises.splice(ei, 1);
                              })
                            }
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ))}
                      <button
                        className="add-exercise"
                        onClick={() =>
                          change((w) => {
                            w.days[day].blocks[bi].exercises.push({
                              id: crypto.randomUUID(),
                              name: "",
                              prescription: "",
                              video: "",
                            });
                          })
                        }
                      >
                        <Plus size={16} /> Adicionar exercício
                      </button>
                    </section>
                  ))}
                  <button
                    className="btn secondary add-block"
                    onClick={() =>
                      change((w) => {
                        w.days[day].blocks.push({
                          id: crypto.randomUUID(),
                          name: "New Block",
                          exercises: [],
                        });
                      })
                    }
                  >
                    <Plus size={16} /> Adicionar bloco de treino
                  </button>
                </>
              )}
              <section className="panel notes-panel">
                <label>
                  Notas do treinador
                  <textarea
                    rows={4}
                    value={editor.days[day].notes}
                    onChange={(e) =>
                      change((w) => {
                        w.days[day].notes = e.target.value;
                      })
                    }
                    placeholder="Adaptações, estímulos desejados e recados para o aluno…"
                  />
                </label>
              </section>
            </>
          )}
          {tab === "students" && (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">PESSOAS ANTES DOS NÚMEROS</span>
                  <h1>Seus alunos</h1>
                  <p>
                    Os contatos ficam privados. No treino, só o que importa.
                  </p>
                </div>
                <button
                  className="btn primary"
                  onClick={() => {
                    setStudent({ ...emptyStudent, id: "" });
                    setModal("student");
                  }}
                >
                  <Plus size={17} /> Adicionar aluno
                </button>
              </div>
              <section className="panel">
                <div className="table-toolbar">
                  <div className="search-field">
                    <Search size={17} />
                    <input
                      aria-label="Buscar aluno"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Buscar por nome, e-mail ou WhatsApp"
                    />
                  </div>
                  <span className="muted">
                    {active} ativos · {students.length} cadastrados
                  </span>
                </div>
                {students.length ? (
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Aluno</th>
                          <th>Contato</th>
                          <th>Canais autorizados</th>
                          <th>Status</th>
                          <th>
                            <span className="sr-only">Ações</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {students
                          .filter((s) =>
                            `${s.name} ${s.email} ${s.whatsapp}`
                              .toLowerCase()
                              .includes(query.toLowerCase()),
                          )
                          .map((s) => (
                            <tr key={s.id}>
                              <td>
                                <div className="person">
                                  <span className="avatar pale">
                                    {s.name
                                      .split(" ")
                                      .map((n) => n[0])
                                      .slice(0, 2)
                                      .join("")}
                                  </span>
                                  <div>
                                    <strong>{s.name}</strong>
                                    <small>
                                      {s.birth_date
                                        ? new Date(
                                            s.birth_date + "T12:00:00",
                                          ).toLocaleDateString("pt-BR")
                                        : "Nascimento não informado"}
                                    </small>
                                  </div>
                                </div>
                              </td>
                              <td>
                                <span>{s.email || "—"}</span>
                                <small>{s.whatsapp || "—"}</small>
                              </td>
                              <td>
                                <div className="channel-icons">
                                  <Mail
                                    size={17}
                                    className={s.email_opt_in ? "enabled" : ""}
                                  />
                                  <MessageCircle
                                    size={17}
                                    className={
                                      s.whatsapp_opt_in ? "enabled" : ""
                                    }
                                  />
                                </div>
                              </td>
                              <td>
                                <span
                                  className={
                                    "status " +
                                    (s.active ? "accepted" : "inactive")
                                  }
                                >
                                  {s.active ? "Ativo" : "Inativo"}
                                </span>
                              </td>
                              <td>
                                <div className="row-actions">
                                  <button
                                    className="text-btn"
                                    onClick={() => {
                                      setStudent(s);
                                      setModal("student");
                                    }}
                                  >
                                    Editar
                                  </button>
                                  <button
                                    className="icon-btn"
                                    aria-label={`Excluir ${s.name}`}
                                    onClick={() => removeStudent(s)}
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                    {!students.some((s) =>
                      `${s.name} ${s.email} ${s.whatsapp}`
                        .toLowerCase()
                        .includes(query.toLowerCase()),
                    ) && (
                      <p className="empty-search">Nenhum aluno encontrado.</p>
                    )}
                  </div>
                ) : (
                  <Empty
                    icon={<Users />}
                    title="Uma turma cheia de possibilidades."
                    text="Adicione o primeiro aluno para começar."
                    action={() => {
                      setStudent({ ...emptyStudent, id: "" });
                      setModal("student");
                    }}
                    actionText="Adicionar aluno"
                  />
                )}
              </section>
            </>
          )}
          {tab === "history" && (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">CADA ENVIO, UM NOVO COMEÇO</span>
                  <h1>Histórico de envios</h1>
                  <p>
                    “Aceito” significa que o provedor recebeu a mensagem; não
                    confirma a entrega ao aluno.
                  </p>
                </div>
                <button
                  className="btn secondary"
                  disabled={demo}
                  onClick={() => load().catch(problem)}
                >
                  Atualizar
                </button>
              </div>
              <section className="panel">
                {history.length ? (
                  <HistoryTable rows={history} />
                ) : (
                  <Empty
                    icon={<Send />}
                    title="Ainda não há envios."
                    text="Prepare um treino e escolha os alunos que vão recebê-lo."
                    action={() => openWorkout(latest)}
                    actionText="Preparar treino"
                  />
                )}
              </section>
              {history.some((h) =>
                ["uncertain", "processing"].includes(h.status),
              ) && (
                <p className="setup-note">
                  Envios sem confirmação ficam bloqueados para evitar
                  duplicidade. Confira o resultado no provedor antes de qualquer
                  intervenção.
                </p>
              )}
            </>
          )}
          {tab === "settings" && (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">TUDO NO SEU LUGAR</span>
                  <h1>Configurações</h1>
                  <p>Conexões que levam seu trabalho mais longe.</p>
                </div>
              </div>
              <div className="settings-grid">
                {[
                  {
                    name: "Supabase",
                    icon: <ShieldCheck />,
                    ready: !demo && configured,
                    text: "Login privado e armazenamento dos treinos e alunos.",
                  },
                  {
                    name: "Resend",
                    icon: <Mail />,
                    ready: connection?.email,
                    text: "E-mails individuais com o treino em PDF e o link interativo.",
                  },
                  {
                    name: "WhatsApp Business",
                    icon: <MessageCircle />,
                    ready: true,
                    text: "Compartilhamento manual no grupo ou com alunos. Sem API; confirme o envio no WhatsApp.",
                  },
                ].map((c) => (
                  <section className="panel integration" key={c.name}>
                    <div className="section-title">
                      {c.icon}
                      <span
                        className={
                          "status " + (c.ready ? "accepted" : "inactive")
                        }
                      >
                        {c.name === "WhatsApp Business"
                          ? "Manual · sem API"
                          : c.ready
                            ? "Configurado"
                            : "Pendente"}
                      </span>
                    </div>
                    <h2>{c.name}</h2>
                    <p>{c.text}</p>
                  </section>
                ))}
              </div>
              <section className="panel settings-info">
                <h2>Ativação do seu studio</h2>
                <p>
                  Execute os SQLs da pasta <code>supabase</code>, crie o usuário
                  do Thales e configure as variáveis de ambiente na Vercel. As
                  chaves privadas são configuradas apenas no servidor.
                </p>
                <p>
                  Consulte o guia <code>docs/CONFIGURACAO.md</code> no
                  repositório para conectar os canais e criar o template do
                  WhatsApp.
                </p>
              </section>
              <section className="panel settings-info">
                <h2>Links publicados</h2>
                <p>
                  O link permite a leitura do treino sem login. Você pode
                  revogá-lo a qualquer momento.
                </p>
                {pubs.length ? (
                  pubs.map((p) => (
                    <div className="publication-row" key={p.id}>
                      <div>
                        <strong>{p.title}</strong>
                        <small>{p.revoked ? "Revogado" : "Ativo"}</small>
                      </div>
                      <div className="row-actions">
                        {!p.revoked && (
                          <>
                            <a
                              className="text-btn"
                              href={`/treino/${p.token}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Abrir <ArrowUpRight size={14} />
                            </a>
                            <button
                              className="text-btn danger"
                              onClick={async () => {
                                if (
                                  !confirm(
                                    "Revogar este link? Alunos não poderão mais acessá-lo.",
                                  )
                                )
                                  return;
                                try {
                                  await api("/api/revoke", { id: p.id });
                                  await load();
                                } catch (e) {
                                  problem(e);
                                }
                              }}
                            >
                              Revogar
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="muted">Nenhuma publicação ainda.</p>
                )}
              </section>
            </>
          )}
        </main>
      </div>
      {notice && (
        <div className="toast" role="status">
          <span>{notice}</span>
          <button
            className="icon-btn"
            aria-label="Dispensar aviso"
            onClick={() => setNotice("")}
          >
            <X size={16} />
          </button>
        </div>
      )}
      <dialog
        ref={dialog}
        className={"modal " + (modal === "preview" ? "preview-modal" : "")}
        onCancel={(e) => {
          if (sending) e.preventDefault();
          else setModal(null);
        }}
        onClose={() => {
          if (!sending) setModal(null);
        }}
      >
        <div className="modal-head">
          <div>
            <span className="eyebrow">THALES FRANCO STUDIO</span>
            <h2>
              {modal === "student"
                ? student.id
                  ? "Editar aluno"
                  : "Novo aluno"
                : modal === "whatsapp"
                  ? "Compartilhar no WhatsApp"
                  : modal === "send"
                    ? "Pronto para compartilhar?"
                    : "Experiência do aluno"}
            </h2>
          </div>
          <button
            className="icon-btn"
            aria-label="Fechar janela"
            disabled={sending}
            onClick={() => setModal(null)}
          >
            <X size={21} />
          </button>
        </div>
        {notice && modal !== "preview" && (
          <div role="status" className="dialog-notice">
            {notice}
          </div>
        )}
        {modal === "student" && (
          <form onSubmit={saveStudent} className="modal-body">
            <div className="form-grid two">
              <label className="full">
                Nome completo
                <input
                  required
                  value={student.name}
                  onChange={(e) =>
                    setStudent({ ...student, name: e.target.value })
                  }
                  autoFocus
                />
              </label>
              <label>
                Data de nascimento
                <input
                  type="date"
                  max={new Date().toISOString().slice(0, 10)}
                  value={student.birth_date}
                  onChange={(e) =>
                    setStudent({ ...student, birth_date: e.target.value })
                  }
                />
              </label>
              <label>
                WhatsApp (com país)
                <input
                  type="tel"
                  placeholder="+5511999999999"
                  value={student.whatsapp}
                  onChange={(e) =>
                    setStudent({
                      ...student,
                      whatsapp: e.target.value.replace(/[\s()-]/g, ""),
                    })
                  }
                />
              </label>
              <label className="full">
                E-mail
                <input
                  type="email"
                  value={student.email}
                  onChange={(e) =>
                    setStudent({ ...student, email: e.target.value })
                  }
                />
              </label>
            </div>
            <div className="consent-box">
              <strong>Preferências de recebimento</strong>
              <p>
                Marque os canais que o aluno autorizou para receber os treinos.
              </p>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={student.email_opt_in}
                  onChange={(e) =>
                    setStudent({ ...student, email_opt_in: e.target.checked })
                  }
                />{" "}
                Autoriza receber por e-mail
              </label>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={student.whatsapp_opt_in}
                  onChange={(e) =>
                    setStudent({
                      ...student,
                      whatsapp_opt_in: e.target.checked,
                    })
                  }
                />{" "}
                Autoriza receber por WhatsApp
              </label>
            </div>
            <label className="check-label">
              <input
                type="checkbox"
                checked={student.active}
                onChange={(e) =>
                  setStudent({ ...student, active: e.target.checked })
                }
              />{" "}
              Aluno ativo
            </label>
            <div className="modal-footer">
              <button
                type="button"
                className="btn secondary"
                onClick={() => setModal(null)}
              >
                Cancelar
              </button>
              <button className="btn primary" disabled={busy}>
                Salvar aluno <Check size={16} />
              </button>
            </div>
          </form>
        )}
        {modal === "preview" && preview && <WorkoutView workout={preview} />}
        {modal === "whatsapp" && editingId && editor && (
          <WhatsAppShare
            workoutId={editingId}
            week={editor.week}
            students={students}
            demo={demo}
          />
        )}
        {modal === "send" && (
          <div className="modal-body">
            <p className="muted">
              Uma cópia desta programação será compartilhada com os alunos
              selecionados. Alterações futuras não modificam o treino já
              enviado.
            </p>
            <div className="send-channels">
              {(["email"] as const).map((c) => (
                <label
                  className={"channel-option " + (channels[c] ? "chosen" : "")}
                  key={c}
                >
                  <input
                    type="checkbox"
                    disabled={sending}
                    checked={channels[c]}
                    onChange={(e) =>
                      setChannels({ ...channels, [c]: e.target.checked })
                    }
                  />
                  {c === "email" ? (
                    <Mail size={21} />
                  ) : (
                    <MessageCircle size={21} />
                  )}
                  <div>
                    <strong>{c === "email" ? "E-mail" : "WhatsApp"}</strong>
                    <small>
                      {c === "email"
                        ? "PDF + treino interativo"
                        : "Link do treino e do PDF"}
                    </small>
                  </div>
                </label>
              ))}
            </div>
            <div className="section-title">
              <h3>Destinatários</h3>
              <button
                className="text-btn"
                disabled={sending}
                onClick={() =>
                  setSelected(
                    selected.length
                      ? []
                      : students.filter((s) => s.active).map((s) => s.id),
                  )
                }
              >
                {selected.length ? "Desmarcar todos" : "Selecionar todos"}
              </button>
            </div>
            <div className="recipient-list">
              {students
                .filter((s) => s.active)
                .map((s) => (
                  <label className="recipient" key={s.id}>
                    <input
                      type="checkbox"
                      disabled={sending}
                      checked={selected.includes(s.id)}
                      onChange={(e) =>
                        setSelected((old) =>
                          e.target.checked
                            ? [...old, s.id]
                            : old.filter((id) => id !== s.id),
                        )
                      }
                    />
                    <span>{s.name}</span>
                    <small>
                      {[
                        eligible(s, "email") ? "E-mail" : "",
                        eligible(s, "whatsapp") ? "WhatsApp" : "",
                      ]
                        .filter(Boolean)
                        .join(" · ") || "Nenhum canal autorizado"}
                    </small>
                  </label>
                ))}
              {!active && (
                <p className="muted">Cadastre alunos ativos antes de enviar.</p>
              )}
            </div>
            <p className="setup-note">
              {selectedCount} mensagens elegíveis. Canais sem contato ou sem
              autorização são ignorados. Esta mesma versão não será reenviada
              aos canais já aceitos.
            </p>
            {sendProgress && (
              <p role="status" className="inline-notice">
                {sendProgress}
              </p>
            )}
            <div className="modal-footer">
              <button
                className="btn secondary"
                disabled={sending}
                onClick={() => setModal(null)}
              >
                Fechar
              </button>
              <button
                className="btn primary"
                disabled={sending || selectedCount === 0}
                onClick={send}
              >
                {sending ? (
                  <Loader2 size={16} className="spin" />
                ) : (
                  <Send size={16} />
                )}{" "}
                {sending ? "Enviando…" : `Confirmar ${selectedCount} envios`}
              </button>
            </div>
          </div>
        )}
      </dialog>
    </div>
  );
}
function Stat({
  icon,
  value,
  label,
  foot,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
  foot: string;
}) {
  return (
    <article className="stat-card">
      <div className="stat-top">
        <span>{label}</span>
        {icon}
      </div>
      <strong>{value}</strong>
      <small>{foot}</small>
    </article>
  );
}
function Empty({
  icon,
  title,
  text,
  action,
  actionText,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
  action: () => void;
  actionText: string;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">{icon}</span>
      <h2>{title}</h2>
      <p>{text}</p>
      <button className="btn secondary" onClick={action}>
        {actionText}
        <ArrowRight size={15} />
      </button>
    </div>
  );
}
function HistoryTable({ rows }: { rows: Delivery[] }) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Aluno / programação</th>
            <th>Canal</th>
            <th>Data</th>
            <th>Resultado</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((h) => (
            <tr key={h.id}>
              <td>
                <strong>{h.students?.name || "Cadastro removido"}</strong>
                <small>{h.publications?.title || "Treino"}</small>
              </td>
              <td>
                <span className="inline-icon">
                  {h.channel === "email" ? (
                    <Mail size={15} />
                  ) : (
                    <MessageCircle size={15} />
                  )}{" "}
                  {h.channel === "email" ? "E-mail" : "WhatsApp"}
                </span>
              </td>
              <td>
                {new Date(h.created_at).toLocaleString("pt-BR", {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </td>
              <td>
                <span className={"status " + h.status}>
                  {statusLabel[h.status] || h.status}
                </span>
                {h.error && <small className="error-detail">{h.error}</small>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
