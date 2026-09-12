/**
 * Tracks the dependencies that must be usable before the API may receive
 * traffic.
 *
 * Liveness answers "is the process running"; readiness answers "can it serve a
 * request right now". Keeping them apart stops the platform from routing
 * traffic to an instance whose database connection is not up yet.
 *
 * A dependency is registered as a named async probe, for example the MongoDB
 * connection once persistence is introduced.
 */
export function createHealthService() {
  const probes = new Map()

  function registerProbe(name, probe) {
    probes.set(name, probe)
  }

  function getLiveness() {
    return { status: 'ok', uptime: process.uptime() }
  }

  async function getReadiness() {
    const names = [...probes.keys()]

    const results = await Promise.all(
      names.map(async (name) => {
        try {
          await probes.get(name)()
          return [name, { status: 'ok' }]
        } catch (error) {
          return [name, { status: 'error', reason: error.message }]
        }
      }),
    )

    const dependencies = Object.fromEntries(results)
    const ready = results.every(([, result]) => result.status === 'ok')

    return { ready, dependencies }
  }

  return { registerProbe, getLiveness, getReadiness }
}
