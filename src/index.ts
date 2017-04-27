import { BotServer } from 'netflux'
import * as https from 'https'
import * as http from 'http'
import * as express from 'express'
import * as program from 'commander'

import { BotStorage } from './BotStorage'
import { MongooseAdapter } from './MongooseAdapter'
import { createLogger, log } from './log'

// Default options
const defaults = {
  name: 'Repono',
  host: '0.0.0.0',
  port: 8080,
  portBot: 9000,
  signalingURL: 'ws://vps387425.ovh.net:8000',
  useHttps: false,
  logLevel: 'info',
  logIntoFile: false
}

// Configure command-line interface
program
  .option('-n, --name <bot name>',
    `Specify a name for the bot, DEFAULT: "${defaults.name}"`, defaults.name)
  .option('-h, --host <ip or host name>',
    `Specify host address to bind to, DEFAULT: "${defaults.host}"`, defaults.host)
  .option('-p, --port <n>',
    `Specify port to use for the server (REST API), DEFAULT: ${defaults.port}`, defaults.port)
  .option('-b, --portBot <n>',
    `Specify port to use for the peer to peer bot, DEFAULT: ${defaults.portBot}`, defaults.portBot)
  .option('-s, --signalingURL <url>',
    `Specify Signaling server url for the peer to peer bot, DEFAULT: ${defaults.signalingURL}\n`, defaults.signalingURL)
  .option('-t, --https',
    `If present, the REST API server is listening on HTTPS instead of HTTP`)
  .option('-l, --logLevel <none|trace|debug|info|warn|error|fatal>',
    `Specify level for logging. DEFAULT: "info". `,
    /^(none|trace|debug|info|warn|error|fatal)$/i, defaults.logLevel)
  .option('-f, --logFile', `If specified, writes logs into file`)
  .parse(process.argv)

// Setup settings
const {name, host, port, portBot, signalingURL, logLevel} = program
const useHttps = (program as any).useHttps ? true : false
const logIntoFile = (program as any).logFile ? true : false

// Configure logging
createLogger(logIntoFile, logLevel)

// Configure error handling on process
process.on('uncaughtException', (err) => log.fatal(err))

// Connect to MongoDB
let error = null
const mongooseAdapter = new MongooseAdapter()
mongooseAdapter.connect('localhost')
  .then(() => {
    log.info(`Successfully connected to the database`)

    // Configure & Start Peer To Peer storage bot
    const bot = new BotServer({host: host, port: portBot, signalingURL})
    bot.onWebChannel = (wc) => {
      log.info('New peer to peer network invitation received. Waiting for a document key...')
      new BotStorage(name, wc, mongooseAdapter)
    }
    return bot.start()
  })
  .then(() => {
    log.info(`Successfully started the storage bot server at ws://${host}:${portBot}`)
  })
  .catch((err) => {
    error = err
    log.fatal(`Error during database/bot initialization`, err)
  })

// Configure & Start REST server
const app = express()

// Configure CORS: Cross-origin resource sharing middleware
app.use(function(req, res, next) {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept')
  next()
})

app.get('/name', (req, res) => {
  if (error === null) {
    res.send(name)
  } else {
    res.status(503).send(error.message)
  }
})

app.get('/docs', (req, res) => {
  mongooseAdapter.list()
    .then((docs: any[]) => {
      const docList = docs.map((doc) => { return { id: doc.key }})
      res.json(docList)
    })
    .catch( (err) => {
      log.error('Could not retreive the document list stored in database', err)
      res.status(500).send(err.message)
    })
})

// Start listen on http(s)
const server = useHttps ? https.createServer(app) : http.createServer(app)
server.listen(port, host, () => {
  log.info('Current settings are\n',
    {name, host, port, portBot, signalingURL, useHttps, logLevel, logIntoFile}
  )
  log.info(`Successfully started the REST API server at http${useHttps ? 's' : ''}://${host}:${port}`)
})
