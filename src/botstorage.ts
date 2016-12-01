const pb = require('./message_pb.js')

import * as MuteStructs from 'mute-structs'

export class BotStorage {

  private doc: MuteStructs.LogootSRopes
  private username = 'BotStorage'
  private webChannel

  constructor(webChannel) {
    this.webChannel = webChannel

    webChannel.onMessage = (id, msg, isBroadcast) => {
      this.handleMessage(webChannel, id, msg, isBroadcast)
    }

    // webChannel.replicaNumber = webChannel.myId
    // webChannel.username = 'BotStorage'

    // TODO: Determine if we want to query the doc or broadcast the stored version
    this.sendQueryDoc()

    this.sendPeerPseudo(this.username, -1)
    this.webChannel.onPeerJoin = (id) => this.sendPeerPseudo(this.username, id)
  }

  handleMessage (wc, id, bytes, isBroadcast) {
    let msg = pb.Message.deserializeBinary(bytes)
    switch (msg.getTypeCase()) {
      case pb.Message.TypeCase.LOGOOTSADD:
        // TODO: Handle this message
        break
      case pb.Message.TypeCase.LOGOOTSDEL:
        // TODO: Handle this message
        break
      case pb.Message.TypeCase.LOGOOTSROPES:
        const myId: number = this.webChannel.myId
        const clock = 0

        const plainDoc: any = msg.toObject().logootsropes

        // Protobuf rename keys like 'base' to 'baseList' because, just because...
        if (plainDoc.root instanceof Object) {
          this.renameKeys(plainDoc.root)
        }

        this.doc = MuteStructs.LogootSRopes.fromPlain(myId, clock, plainDoc)
        console.log('Received doc: ', this.doc.str)
        break
      case pb.Message.TypeCase.PEERPSEUDO:
      case pb.Message.TypeCase.PEERCURSOR:
        // Don't care about this message
        break
      case pb.Message.TypeCase.QUERYDOC:
        // Should not happen
        break
      case pb.Message.TypeCase.TYPE_NOT_SET:
        console.error('network', 'Protobuf: message type not set')
        break
    }
  }

  sendQueryDoc () {
    const msg = new pb.Message()

    const queryDoc = new pb.QueryDoc()
    msg.setQuerydoc(queryDoc)

    const peerDoor: number = this.webChannel.members[0]

    this.webChannel.sendTo(peerDoor, msg.serializeBinary())
  }

  sendPeerPseudo (pseudo: string, id: number = -1) {
    let pseudoMsg = new pb.PeerPseudo()
    pseudoMsg.setPseudo(pseudo)
    let msg = new pb.Message()
    msg.setPeerpseudo(pseudoMsg)
    if (id !== -1) {
      this.webChannel.sendTo(id, msg.serializeBinary())
    } else {
      this.webChannel.send(msg.serializeBinary())
    }
  }

  // FIXME: Prevent Protobuf from renaming our fields or move this code elsewhere
  renameKeys (node: {block: {id: any, nbElement?: any, nbelement: number}, right?: any, left?: any}) {
    node.block.id.base = node.block.id.baseList
    node.block.nbElement = node.block.nbelement
    if (node.left) {
      this.renameKeys(node.left)
    }
    if (node.right) {
      this.renameKeys(node.right)
    }
  }

}
