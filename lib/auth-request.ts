// Retry only rejected authentication. Other failures may follow a completed mutation.
export async function authenticatedRequest(
  path: string,
  body: unknown,
  getToken: (refresh: boolean) => Promise<string | null>,
  request: typeof fetch = fetch,
) {
  const send = (token: string) =>
    request(path, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  let token = await getToken(false);
  if (!token)
    throw new Error("Sua sessão terminou. Saia da conta e entre novamente.");
  let response = await send(token);
  if (response.status === 401) {
    token = await getToken(true);
    if (!token)
      throw new Error("Sua sessão terminou. Saia da conta e entre novamente.");
    response = await send(token);
  }
  if (response.status === 401)
    throw new Error(
      "Sua sessão não pôde ser validada. Saia da conta e entre novamente.",
    );
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Não foi possível concluir.");
  return data;
}
