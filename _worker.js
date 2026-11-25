function basicAuth(user, pass) {
  return "Basic " + btoa(user + ":" + pass);
}

const PREFLIGHT_INIT = {
  status: 204,
  headers: new Headers({
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,PUT,PATCH,TRACE,DELETE,HEAD,OPTIONS',
    'access-control-max-age': '1728000',
  }),
}

const regs = {
  token: /^\/token$/,
  v2: /^\/v2(\/.*)?$/
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, PREFLIGHT_INIT)
    }
    const url = new URL(request.url)
    const reqHeaders = new Headers(request.headers)
    reqHeaders.delete("host")

    let upstreamAuth = ""
    if (env.AUTH_USER && env.AUTH_PASS) {
      upstreamAuth = basicAuth(env.AUTH_USER, env.AUTH_PASS)
    }

    if (regs.token.test(url.pathname)) {
      const authUrl = new URL("https://auth.docker.io/token")
      url.searchParams.forEach((v, k) => authUrl.searchParams.set(k, v))
      const hd = new Headers(reqHeaders)
      if (upstreamAuth) {
        hd.set("Authorization", upstreamAuth)
      }
      return fetch(new Request(authUrl, {
        method: request.method,
        headers: hd,
        body: request.body,
        redirect: "follow"
      }))
    }

    if (regs.v2.test(url.pathname)) {
      const target = new URL("https://registry-1.docker.io" + url.pathname + url.search)
      const hd = new Headers(reqHeaders)
      hd.set("Host", "registry-1.docker.io")
      return fetch(new Request(target, {
        method: request.method,
        headers: hd,
        body: request.body,
        redirect: "follow"
      }))
    }

    return new Response("Not Found", { status: 404 })
  }
}
