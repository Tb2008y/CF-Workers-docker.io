/**
 * @param {string} user
 * @param {string} pass
 * @returns {string}
 */
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

const regExps = {
  // 匹配 /v2/xxx 镜像拉取
  v2: /^\/v2\/(?<name>.+)$/,
  // 匹配 /token 鉴权接口
  token: /^\/token$/,
}

/**
 * @param {Request} req
 * @param {Env} env
 * @returns {Promise<Response>}
 */
async function handleRequest(req, env) {
  const url = new URL(req.url)
  const path = url.pathname
  const reqHd = new Headers(req.headers)
  reqHd.delete("host")

  // 读取上游Docker Hub账号PAT
  let upstreamAuth = ""
  if (env.AUTH_USER && env.AUTH_PASS) {
    upstreamAuth = basicAuth(env.AUTH_USER, env.AUTH_PASS)
  }

  // 处理token鉴权请求（重点：这里加上游认证）
  if (regExps.token.test(path)) {
    const authUrl = new URL("https://auth.docker.io/token" + url.search)
    const newHd = new Headers(reqHd)
    if (upstreamAuth) {
      newHd.set("Authorization", upstreamAuth)
    }
    const authReq = new Request(authUrl, {
      method: req.method,
      headers: newHd,
      body: req.body,
      redirect: "follow",
    })
    return fetch(authReq)
  }

  // 处理v2镜像拉取请求，转发到 registry-1.docker.io
  if (regExps.v2.test(path)) {
    const targetUrl = new URL("https://registry-1.docker.io" + path + url.search)
    const newHd = new Headers(reqHd)
    newHd.set("Host", "registry-1.docker.io")
    const proxyReq = new Request(targetUrl, {
      method: req.method,
      headers: newHd,
      body: req.body,
      redirect: "follow",
    })
    return fetch(proxyReq)
  }

  // 其他路径直接404
  return new Response("Not found", { status: 404 })
}

export default {
  /**
   * @param {Request} request
   * @param {Env} env
   * @param {ExecutionContext} ctx
   * @returns {Promise<Response>}
   */
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") {
      return new Response(null, PREFLIGHT_INIT)
    }
    return handleRequest(request, env)
  },
}
