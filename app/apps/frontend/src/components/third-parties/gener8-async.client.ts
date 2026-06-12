const POLL_INTERVAL_MS = 3000;
const CLIENT_DEADLINE_MS = 300_000;

export type Gener8AsyncRequest = (
  url: string,
  init?: RequestInit
) => Promise<Response>;

function readErrorMessage(resBody: Record<string, unknown>, fallback: string) {
  const msg = resBody?.message;
  return typeof msg === 'string' && msg.trim() ? msg.trim() : fallback;
}

/**
 * Short-lived HTTP calls only (submit → poll status → complete) so a single browser→origin
 * request never stays open for the full Gener8 duration (avoids ~100s CDN/proxy cutoffs).
 */
export async function gener8SubmitAsyncPollAndComplete(
  request: Gener8AsyncRequest,
  integrationId: string,
  body: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const base = `/third-party/${integrationId}`;
  const start = await request(`${base}/gener8/submit-async`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const startJson = (await start.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  if (!start.ok) {
    throw new Error(readErrorMessage(startJson, 'Generation failed. Please try again.'));
  }
  const jobToken =
    typeof startJson.jobToken === 'string' ? startJson.jobToken.trim() : '';
  if (!jobToken) {
    throw new Error('Invalid response from server (missing job).');
  }

  const deadline = Date.now() + CLIENT_DEADLINE_MS;

  while (Date.now() < deadline) {
    const st = await request(`${base}/gener8/job-status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobToken }),
    });
    const stJson = (await st.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    if (!st.ok) {
      throw new Error(
        readErrorMessage(stJson, 'Generation status request failed.')
      );
    }
    if (stJson.status === 'failed') {
      const detail =
        typeof stJson.error === 'string' && stJson.error.trim()
          ? stJson.error.trim()
          : readErrorMessage(stJson, 'Gener8 reported a failure.');
      throw new Error(detail);
    }
    if (stJson.status === 'completed') {
      const done = await request(`${base}/gener8/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobToken }),
      });
      const doneJson = (await done.json().catch(() => ({}))) as Record<
        string,
        unknown
      >;
      if (!done.ok) {
        throw new Error(
          readErrorMessage(
            doneJson,
            'Generation failed while saving the image.'
          )
        );
      }
      return doneJson;
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }

  throw new Error(
    'Image generation is taking longer than expected. Please try again.'
  );
}
