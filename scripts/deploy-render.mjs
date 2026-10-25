// Deploy exactly the checked-out tag's commit, never the latest branch head.
export async function deployWorker({ apiKey, serviceId, commitId, request = fetch, pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms)), attempts = 120 }) {
  if (!apiKey || !/^srv-[a-zA-Z0-9]+$/.test(serviceId || "") || !/^[a-f0-9]{40}$/.test(commitId || "")) {
    throw new Error("Valid Render credentials, service ID, and a full release commit SHA are required");
  }
  const endpoint = `https://api.render.com/v1/services/${serviceId}/deploys`;
  const headers = { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };
  async function call(url, options = {}) {
    const response = await request(url, { ...options, headers, signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error(`Render request failed (HTTP ${response.status}); inspect the Render dashboard`);
    return response.json();
  }
  // Do not retry this POST blindly: it could create duplicate deployments.
  const deployment = await call(endpoint, { method: "POST", body: JSON.stringify({ commitId }) });
  if (!/^dep-[a-zA-Z0-9]+$/.test(deployment.id || "")) throw new Error("Render returned no valid deployment ID");
  for (let attempt = 0; attempt < attempts; attempt++) {
    const current = await call(`${endpoint}/${deployment.id}`);
    if (current.status === "live") {
      if (current.commit?.id !== commitId) throw new Error("Render deployed a different commit; web deployment stopped");
      console.log(`Worker deployed successfully for ${commitId}`);
      return;
    }
    if (["build_failed", "update_failed", "pre_deploy_failed", "canceled", "deactivated"].includes(current.status)) {
      throw new Error(`Worker deployment stopped (${current.status}); web deployment was not started`);
    }
    await pause(10_000);
  }
  throw new Error("Timed out waiting for the worker; inspect Render before retrying the release");
}

