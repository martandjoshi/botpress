import crypto from 'crypto'
import _ from 'lodash'

import Provider from './base'

export default class DialogflowProvider extends Provider {
  private projectId: any
  private agentClient: any
  private sessionClient: any
  private agent: any

  constructor(config) {
    super({ ...config, name: 'dialogflow', entityKey: '@dialogflow' })

    this.projectId = this.config.googleProjectId

    // TODO: get rid of eval once we drop webpack for node-part (needed to overcome webpack compilation)
    const dialogflow = eval("require('dialogflow')") // eslint-disable-line no-eval

    this.agentClient = new dialogflow.AgentsClient()
    this.sessionClient = new dialogflow.SessionsClient()
  }

  private getSessionId(event) {
    let shortUserId = _.get(event, 'user.id') || ''
    if (shortUserId.length > 36) {
      shortUserId = crypto
        .createHash('md5')
        .update(shortUserId)
        .digest('hex')
    }
    return shortUserId
  }

  private resolveEntity(field) {
    const entity = field[field.kind]

    if (field.kind === 'stringValue' || field.kind === 'numberValue') {
      return entity
    } else if (field.kind === 'listValue') {
      return entity.values.map(v => this.resolveEntity(v))
    } else if (field.kind === 'structValue') {
      return _.mapValues(entity.fields, f => this.resolveEntity(f))
    } else {
      throw new Error('Not supported')
    }
  }

  async init() {
    const [agent] = await this.agentClient.getAgent({ parent: this.agentClient.projectPath(this.projectId) })
    this.agent = agent
  }

  async sync() {
    throw new Error('Not implemented')
  }

  async checkSyncNeeded() {
    return false // Not implemented yet
  }

  async extract(event) {
    const request = {
      session: this.sessionClient.sessionPath(this.projectId, this.getSessionId(event)),
      queryInput: {
        text: {
          text: event.text,
          languageCode: this.agent.defaultLanguageCode
        }
      }
    }
    const detection = await this.sessionClient.detectIntent(request)
    const { queryResult } = detection[0]
    const intent = {
      name: queryResult.intent.displayName,
      confidence: queryResult.intentDetectionConfidence,
      provider: 'dialogflow'
    }
    const entities = _.map(queryResult.parameters.fields, (v, k) => ({ name: k, value: this.resolveEntity(v) }))

    return {
      intent,
      intents: [intent],
      entities: entities.map(entity => ({
        name: entity.name, // usually the entity name, but can be modified
        type: entity.name, // when parameter name modified dialogflow doesn't give the original entity name
        value: entity.value,
        original: undefined,
        confidence: undefined,
        position: undefined,
        provider: 'dialogflow'
      }))
    }
  }

  async getCustomEntities() {
    return [] // Not implemented yet
  }
}
