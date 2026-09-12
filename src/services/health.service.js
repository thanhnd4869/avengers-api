/**
 * Liveness answers "is the process running"; readiness answers "can it serve a
 * request right now". Keeping them apart stops the platform from routing
 * traffic to an instance whose database connection is not up yet.
 */
export function createHealthService() {
  const probes = new Map()

  function registerProbe(name, probe) {
    probes.set(name, probe)
  }

  function getLiveness() {
    return {
      status: 'ok',
      uptime: process.uptime(),
      checkedAt: new Date().toISOString(),
    }
  }

  async function getReadiness() {
    const entries = await Promise.all(
      [...probes.keys()].map(async (name) => {
        try {
          await probes.get(name)()
          return [name, { status: 'ok' }]
        } catch (error) {
          return [name, { status: 'error', reason: error.message }]
        }
      }),
    )

    const ready = entries.every(([, result]) => result.status === 'ok')

    return {
      ready,
      status: ready ? 'ready' : 'not-ready',
      dependencies: Object.fromEntries(entries),
      checkedAt: new Date().toISOString(),
    }
  }

  return { registerProbe, getLiveness, getReadiness }
}
