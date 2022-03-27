const Server = require('./libs/server')

const server = Server.create()


const start = async () => {
  await server.start()
}

start()