import Link from "next/link";
export default function NotFound() {
  return (
    <main className="center-page">
      <img src="/logo-black.png" width="180" alt="Thales Franco" />
      <h1>Treino indisponível.</h1>
      <p>
        Este link não existe ou foi revogado. Solicite o link atualizado ao
        treinador.
      </p>
      <Link className="btn secondary" href="/">
        Ir para o início
      </Link>
    </main>
  );
}
